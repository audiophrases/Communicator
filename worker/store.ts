// The class's state on the laptop: the teacher's board, the Fix switch, and the answers already paid for.
// No board stored means the built-in board.
//
// Saved answers work like PinPlay's voice cache: each is kept under a fingerprint of what was asked
// (sha256 of the words, level, language, model and prompt version; or of voice::rate::text for a clip), so the
// same question goes to OpenAI or the voice bridge once and every student after that gets the saved answer.

import { DurableObject } from 'cloudflare:workers';
import { boardImages, type Board } from '../shared/board.ts';
import { BOARD_REFRESH_MS, type Saved } from '../shared/options.ts';
import { readPublishedBoard, type PublishedBoard } from './published.ts';

export type Kind = 'fix' | 'ca' | 'speech';
const KEEP: Record<Kind, number> = { fix: 5000, ca: 5000, speech: 3000 }; // the most recently used of each
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // unused for 60 days: dropped
const MAX_AUDIO = 1024 * 1024;

export class BoardStore extends DurableObject {
    private writes = 0;
    private nextBoardCheck = 0;
    private publication?: Promise<PublishedBoard | null>;

    constructor(ctx: DurableObjectState, env: unknown) {
        super(ctx, env as never);
        ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS memo (
            key TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT, audio BLOB, hits INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL)`);
        ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS memo_used ON memo (kind, used)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS button_images (name TEXT, part INTEGER, data BLOB NOT NULL, PRIMARY KEY(name, part))');
    }

    async board(): Promise<Board | null> {
        return (await this.ctx.storage.get<Board>('board')) ?? null;
    }

    // Only the online Worker uses this mirror. Concurrent readers share one GitHub check.
    async publishedBoard(repository: string): Promise<PublishedBoard | null> {
        if (this.publication) return this.publication;
        if (Date.now() < this.nextBoardCheck) {
            return (await this.ctx.storage.get<PublishedBoard>('published')) ?? null;
        }
        this.nextBoardCheck = (Math.floor(Date.now() / BOARD_REFRESH_MS) + 1) * BOARD_REFRESH_MS;
        this.publication = this.refreshPublication(repository);
        try { return await this.publication; }
        finally {
            this.publication = undefined;
        }
    }

    private async refreshPublication(repository: string): Promise<PublishedBoard | null> {
        const previous = await this.ctx.storage.get<PublishedBoard>('published');
        let current: PublishedBoard;
        try { current = await readPublishedBoard(repository); }
        catch { return previous ?? null; }
        if (previous?.revision !== current.revision) await this.ctx.storage.put('published', current);
        return current;
    }
    async save(board: Board): Promise<boolean> {
        if (boardImages(board).some(name => !this.hasImage(name))) return false;
        await this.ctx.storage.put('board', board);
        return true;
    }

    private hasImage(name: string) {
        return this.ctx.storage.sql.exec('SELECT 1 FROM button_images WHERE name = ? AND part = 0', name).toArray().length > 0;
    }
    putImage(name: string, data: ArrayBuffer): void {
        if (this.hasImage(name)) return;
        const chunk = 1024 * 1024; // Each SQLite row also fits older classroom runtimes.
        this.ctx.storage.transactionSync(() => {
            for (let at = 0; at < data.byteLength; at += chunk) {
                this.ctx.storage.sql.exec('INSERT INTO button_images VALUES (?, ?, ?)', name, at, data.slice(at, at + chunk));
            }
        });
    }
    getImage(name: string): ArrayBuffer | null {
        const parts = this.ctx.storage.sql.exec<{ data: ArrayBuffer }>('SELECT data FROM button_images WHERE name = ? ORDER BY part', name).toArray();
        if (!parts.length) return null;
        const bytes = new Uint8Array(parts.reduce((n, part) => n + part.data.byteLength, 0));
        let at = 0;
        for (const { data } of parts) { bytes.set(new Uint8Array(data), at); at += data.byteLength; }
        return bytes.buffer;
    }
    // Whether students can use Fix (OpenAI). On until the teacher switches it off.
    async fixOn(): Promise<boolean> {
        return (await this.ctx.storage.get<boolean>('fixOn')) ?? true;
    }
    async setFixOn(on: boolean): Promise<void> {
        await this.ctx.storage.put('fixOn', on);
    }

    async xkiroRetryAt(): Promise<number> {
        return (await this.ctx.storage.get<number>('xkiroRetryAt')) ?? 0;
    }

    async pauseXkiroUntil(retryAt: number): Promise<void> {
        const previous = await this.xkiroRetryAt();
        if (retryAt > previous) await this.ctx.storage.put('xkiroRetryAt', retryAt);
    }

    // Saved answers by key; a key that is not there was never asked (or was forgotten).
    recall(keys: string[]): Record<string, { value: string | null; audio: ArrayBuffer | null }> {
        const found: Record<string, { value: string | null; audio: ArrayBuffer | null }> = {};
        const now = Date.now();
        for (const key of keys) {
            const row = this.ctx.storage.sql.exec<{ value: string | null; audio: ArrayBuffer | null; used: number }>(
                'SELECT value, audio, used FROM memo WHERE key = ?', key).toArray()[0];
            if (!row || now - row.used > MAX_AGE_MS) continue;
            this.ctx.storage.sql.exec('UPDATE memo SET hits = hits + 1, used = ? WHERE key = ?', now, key);
            found[key] = { value: row.value, audio: row.audio };
        }
        return found;
    }

    remember(kind: Kind, key: string, value: string | null, audio: ArrayBuffer | null = null): void {
        if (audio && audio.byteLength > MAX_AUDIO) return;
        this.ctx.storage.sql.exec(`INSERT INTO memo (key, kind, value, audio, hits, used) VALUES (?, ?, ?, ?, 0, ?)
            ON CONFLICT (key) DO UPDATE SET value = excluded.value, audio = excluded.audio, used = excluded.used`,
            key, kind, value, audio, Date.now());
        if (++this.writes % 50 === 1) this.prune();
    }

    private prune(): void {
        this.ctx.storage.sql.exec('DELETE FROM memo WHERE used < ?', Date.now() - MAX_AGE_MS);
        for (const [kind, keep] of Object.entries(KEEP)) {
            this.ctx.storage.sql.exec(`DELETE FROM memo WHERE kind = ? AND key NOT IN
                (SELECT key FROM memo WHERE kind = ? ORDER BY used DESC LIMIT ?)`, kind, kind, keep);
        }
    }

    saved(): Saved {
        const saved: Saved = { fix: 0, ca: 0, speech: 0, reused: 0 };
        for (const row of this.ctx.storage.sql.exec<{ kind: Kind; n: number; hits: number }>(
            'SELECT kind, COUNT(*) AS n, SUM(hits) AS hits FROM memo GROUP BY kind')) {
            saved[row.kind] = row.n;
            saved.reused += row.hits ?? 0;
        }
        return saved;
    }

    forget(): void {
        this.ctx.storage.sql.exec('DELETE FROM memo');
    }
}
