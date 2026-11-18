// Publish only classroom-board.json on main. Keep pending offline edits reachable with a private Git ref.
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { LIMITS, sanitizeBoard } from '../shared/board.ts';

const branch = 'refs/heads/main';
const pending = 'refs/communicator/pending-board';
const upstream = 'refs/remotes/origin/main';
const file = 'classroom-board.json';

export function boardRepository(root) {
    function git(args, input, extraEnv = {}) {
        return new Promise((resolve, reject) => {
            const child = execFile('git', args, { cwd: root, timeout: 12_000, maxBuffer: 4_000_000, windowsHide: true,
                env: { ...process.env, ...extraEnv, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
            }, (error, stdout, stderr) => error ? reject(Object.assign(error, { gitMessage: stderr })) : resolve(stdout.trim()));
            child.stdin.on('error', () => {});
            child.stdin.end(input);
        });
    }
    async function head(ref) {
        try { return await git(['rev-parse', '--verify', '--quiet', ref]); }
        catch (error) { if (error.code === 1) return ''; throw error; }
    }
    let status = 'offline';
    let tail = Promise.resolve();
    function serialize(operation) {
        const next = tail.then(operation);
        tail = next.catch(() => {});
        return next;
    }
    async function mainHead() {
        return await head(upstream) || await head(branch);
    }
    async function boardBlob(commit) {
        if (!commit) return '';
        const entry = await git(['ls-tree', commit, '--', file]);
        return entry ? entry.split(/\s+/)[2] : '';
    }
    async function snapshot(commit) {
        const revision = await boardBlob(commit);
        const board = revision ? sanitizeBoard(JSON.parse(await git(['cat-file', 'blob', revision]))) : null;
        if (revision && !board) throw new Error('Invalid shared board.');
        return { board, revision, sync: status };
    }
    async function boardCommit(parent, blob) {
        // A separate index based on the remote tree preserves every unrelated file, even if the teacher
        // has a different branch checked out or changes staged in their own index.
        const dir = await mkdtemp(path.join(tmpdir(), 'communicator-index-'));
        const env = { GIT_INDEX_FILE: path.join(dir, 'index') };
        try {
            await git(['read-tree', parent], undefined, env);
            await git(['update-index', '--add', '--cacheinfo', '100644', blob, file], undefined, env);
            const tree = await git(['write-tree'], undefined, env);
            return await git(['-c', 'user.name=Communicator', '-c', 'user.email=board@communicator.local',
                'commit-tree', tree, '-p', parent, '-m', 'Update classroom board']);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    }
    async function publish(ours, remote) {
        const localBlob = await boardBlob(ours);
        const remoteBlob = await boardBlob(remote);
        if (localBlob !== remoteBlob) {
            const base = await head(ours + '^');
            if (await boardBlob(base) !== remoteBlob) return 'conflict';
            // New code commits can land while a laptop is offline. Replay only the board on top.
            const next = base === remote ? ours : await boardCommit(remote, localBlob);
            await git(['push', 'origin', next + ':' + branch]);
        }
        await git(['update-ref', '-d', pending, ours]);
        return 'synced';
    }
    async function reconcile() {
        try {
            await git(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', 'origin', branch + ':' + upstream]);
            const ours = await head(pending);
            status = ours ? await publish(ours, await head(upstream)) : 'synced';
        } catch {
            status = 'offline';
        }
        return status;
    }
    return {
        read: async () => snapshot(await head(pending) || await mainHead()),
        refresh: () => serialize(reconcile),
        save: (value, revision, seed = false) => serialize(async () => {
            const board = sanitizeBoard(value);
            if (!board || JSON.stringify(board).length > LIMITS.json) throw Object.assign(new Error('Invalid board.'), { status: 400 });
            await reconcile();
            const previous = await head(pending);
            const tip = previous || await mainHead();
            const current = await snapshot(tip);
            if (seed && (current.board || current.sync !== 'synced')) return current;
            if (status === 'conflict') throw Object.assign(new Error('Both laptops have offline edits. Both versions are kept in Git. See Board sync in the README.'), { status: 409 });
            // A retry after a lost HTTP response is safe, even when the commit already exists.
            if (JSON.stringify(board) === JSON.stringify(current.board)) return current;
            if (revision !== current.revision) throw Object.assign(new Error('The board changed on another computer. Your draft is still here. Reload the shared board before saving.'), { status: 409 });
            const blob = await git(['hash-object', '-w', '--stdin'], JSON.stringify(board, null, 2) + '\n');
            const base = previous ? await head(previous + '^') : tip;
            if (!base) throw new Error('No local or remote main branch.');
            const commit = await boardCommit(base, blob);
            await git(['update-ref', '--create-reflog', pending, commit, previous]);
            if (status === 'synced') {
                try { status = await publish(commit, await head(upstream)); }
                catch { status = 'offline'; }
            }
            return { board, revision: blob, sync: status };
        })
    };
}

// Only the authenticated teacher endpoint can ask this loopback service to save a board.
export async function startBoardSync(root) {
    const repo = boardRepository(root);
    const secretPath = '/' + randomUUID();
    await repo.refresh();
    const server = createServer(async (request, response) => {
        const reply = (status, body) => {
            response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify(body));
        };
        if (request.url !== secretPath) return reply(404, {});
        try {
            if (request.method === 'GET') return reply(200, await repo.read());
            if (request.method !== 'POST') return reply(405, {});
            const chunks = [];
            let size = 0;
            for await (const chunk of request) {
                size += chunk.length;
                if (size > LIMITS.json * 4 + 1024) return reply(413, { error: 'Board is too large.' });
                chunks.push(chunk);
            }
            const { board, revision, seed } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            reply(200, await repo.save(board, revision, seed === true));
        } catch (error) {
            reply(error.status || 503, { error: error.status ? error.message : 'Could not access the Git board. Check Git on this laptop and try again.' });
        }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const timer = setInterval(() => { void repo.refresh().catch(() => {}); }, 60_000);
    return { url: 'http://127.0.0.1:' + server.address().port + secretPath, close() { clearInterval(timer); server.close(); } };
}
