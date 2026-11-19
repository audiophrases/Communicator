import { fixPhrase, fixSeed } from './phrase.ts';
import { synthesize } from './speech.ts';
import { readPublishedImage } from './published.ts';
import { BoardStore } from './store.ts';
import { newSession, passwordMatches, sessionValid, sha256Hex } from './teacher.ts';
import { caSeed, MAX_ITEMS, toCatalan, type Item } from './translate.ts';
import { boardImages, LIMITS, sanitizeBoard, type Board } from '../shared/board.ts';
import { imageContentType, isUploadedImage, MAX_IMAGE_BYTES, uploadedImageName } from '../shared/images.ts';
import { isLanguage, isLevel, MAX_LINKED_SENTENCES, MAX_TEXT, type Level, type Status, type TeacherSettings } from '../shared/options.ts';
import { bridgeRate, DEFAULT_VOICE, isEnglishVoice } from '../shared/voices.ts';

export { BoardStore };

export interface Env {
    BOARD: DurableObjectNamespace<BoardStore>;
    // Optional: Fix and the editor's Catalan translation. Without it the board works, without Fix.
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string; // tests only
    OPENAI_PHRASE_MODEL?: string;
    // The teacher's password for /create, the same as PinPlay's.
    CREATE_PASSWORD_HASH?: string;
    // Optional override for PinPlay's Render Edge TTS bridge.
    EDGE_TTS_URL?: string;
    EDGE_TTS_SECRET?: string;
    // Set by scripts/classroom.mjs: the address students open on the school network.
    LAN_URL?: string;
    BOARD_SYNC_URL?: string;
    BOARD_REPOSITORY?: string;
    USE_RL?: RateLimit;
    AUTH_RL?: RateLimit;
}

// X-Cache says whether a saved answer was reused (hit) or OpenAI / the voice bridge was asked (miss).
const json = (body: unknown, status = 200, cache?: 'hit' | 'miss') =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cache ? { 'X-Cache': cache } : {}) } });
const audioResponse = (audio: ArrayBuffer, cache: 'hit' | 'miss') => new Response(audio, { headers: {
    'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Cache': cache
} });
const store = (env: Env) => env.BOARD.getByName('main');

async function saveSharedBoard(env: Env, url: string, board: Board, revision: unknown, seed = false) {
    // The first Git save can include pictures from a board previously kept only on this laptop.
    if (revision === '') {
        for (const name of boardImages(board)) {
            const local = await store(env).getImage(name);
            if (!local) continue;
            const staged = await fetch(`${url}/images/${name}`, { method: 'PUT', body: local });
            if (!staged.ok) return staged;
        }
    }
    return fetch(url, { method: 'POST', body: JSON.stringify({ board, revision, seed }) });
}

async function teacherSettings(env: Env): Promise<TeacherSettings> {
    const stub = store(env);
    return { key: !!env.OPENAI_API_KEY, fixOn: await stub.fixOn(), lanUrl: env.LAN_URL || '', saved: await stub.saved() };
}

async function allowed(limiter: RateLimit | undefined, key: string, slots = 1): Promise<boolean> {
    if (!limiter) return true;
    try {
        const results = await Promise.all(Array.from({ length: slots }, () => limiter.limit({ key })));
        return results.every(result => result.success);
    } catch {
        return true; // a limiter outage must not take the speaker's voice away
    }
}

// On the laptop every student can look like the same address, so each device also sends its own random id.
function visitor(request: Request, env: Env): string {
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (env.BOARD_REPOSITORY) return ip;
    const device = (request.headers.get('x-device') || '').replace(/[^\w-]/g, '').slice(0, 40);
    return `${ip}:${device}`;
}

function boardResponse(request: Request, snapshot: { board: unknown; revision?: string; sync?: string }) {
    if (!snapshot.revision) return json(snapshot);
    const headers = { ETag: `"${snapshot.revision}"`, 'Cache-Control': 'private, no-cache' };
    if (request.headers.get('If-None-Match') === headers.ETag) return new Response(null, { status: 304, headers });
    return Response.json(snapshot, { headers });
}

async function readBytes(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | Response> {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'The request body is empty.' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) { await reader.cancel(); return json({ error: 'Request is too large.' }, 413); }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
}

async function readJson(request: Request, max: number): Promise<{ body: any } | { error: Response }> {
    const bytes = await readBytes(request, max);
    if (bytes instanceof Response) return { error: bytes };
    try { return { body: JSON.parse(new TextDecoder().decode(bytes)) }; } catch { return { error: json({ error: 'Invalid JSON.' }, 400) }; }
}

const text = (value: unknown): string => typeof value === 'string' && value.trim().length <= MAX_TEXT ? value.trim() : '';

async function teacher(request: Request, env: Env, path: string): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    if (!env.CREATE_PASSWORD_HASH) return json({ error: 'The teacher password is not set up. Run classroom.bat.' }, 503);
    if (path !== '/api/teacher/login' && !(await sessionValid(request.headers.get('x-teacher-session') || '', env.CREATE_PASSWORD_HASH))) {
        return json({ error: 'Please sign in again.' }, 401);
    }
    if (path === '/api/teacher/image') {
        const bytes = await readBytes(request, MAX_IMAGE_BYTES);
        if (bytes instanceof Response) return bytes;
        const name = await uploadedImageName(bytes);
        if (!name) return json({ error: 'Choose a GIF, JPG, PNG or SVG image.' }, 415);
        if (env.BOARD_SYNC_URL) return fetch(`${env.BOARD_SYNC_URL}/images/${name}`, { method: 'PUT', body: bytes });
        await store(env).putImage(name, bytes.buffer);
        return json({ name });
    }
    const read = await readJson(request, path === '/api/teacher/board' ? LIMITS.json + 40_000 : 16_384);
    if ('error' in read) return read.error;
    const body = read.body;

    if (path === '/api/teacher/login') {
        const key = `teacher:${request.headers.get('CF-Connecting-IP') || 'local'}`;
        if (!(await allowed(env.AUTH_RL, key))) return json({ error: 'Too many tries. Wait a minute, then try again.' }, 429);
        if (!(await passwordMatches(body?.password, env.CREATE_PASSWORD_HASH))) {
            await allowed(env.AUTH_RL, key, 4); // a wrong guess costs five tries
            return json({ error: 'Wrong password.' }, 401);
        }
        return json({ token: await newSession(env.CREATE_PASSWORD_HASH) });
    }

    switch (path) {
        case '/api/teacher/settings':
            if (typeof body?.fixOn === 'boolean') await store(env).setFixOn(body.fixOn);
            return json(await teacherSettings(env));
        case '/api/teacher/forget':
            await store(env).forget();
            return json(await teacherSettings(env));
        case '/api/teacher/board': {
            const board = sanitizeBoard(body?.board);
            if (!board) return json({ error: 'That board is not valid.' }, 400);
            if (JSON.stringify(board).length > LIMITS.json) return json({ error: 'The board is too big. Remove some buttons or pages.' }, 413);
            if (env.BOARD_SYNC_URL) return saveSharedBoard(env, env.BOARD_SYNC_URL, board, body.revision);
            if (!await store(env).save(board)) return json({ error: 'A picture is missing. Choose its file again and save.' }, 400);
            return json({ board });
        }
        case '/api/teacher/translate': {
            if (!env.OPENAI_API_KEY) return json({ error: 'There is no OpenAI key, so type the Catalan yourself.' }, 503);
            const items: Item[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS + 1).map((item: any) => ({
                text: typeof item?.text === 'string' ? item.text.trim().slice(0, LIMITS.phrase) : '',
                ...(typeof item?.hint === 'string' && item.hint ? { hint: item.hint.slice(0, 60) } : {})
            })) : [];
            if (!items.length || items.length > MAX_ITEMS || items.some(item => !item.text)) return json({ error: 'Nothing to translate.' }, 400);
            // Only what was never translated before goes to OpenAI.
            const keys = await Promise.all(items.map(item => sha256Hex(caSeed(item, env))));
            const saved = await store(env).recall(keys);
            const ca = keys.map(key => saved[key]?.value ?? '');
            const missing = items.map((item, i) => ({ item, i })).filter(({ i }) => !ca[i]);
            if (missing.length) {
                const fresh = await toCatalan(missing.map(({ item }) => item), env);
                if (!fresh) return json({ error: 'Translation is unavailable right now. Try again, or type it yourself.' }, 503);
                for (const [j, { i }] of missing.entries()) {
                    ca[i] = fresh[j];
                    if (fresh[j]) await store(env).remember('ca', keys[i], fresh[j]);
                }
            }
            return json({ ca, reused: items.length - missing.length }, 200, missing.length ? 'miss' : 'hit');
        }
        default:
            return json({ error: 'Not found.' }, 404);
    }
}

async function handle(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (env.BOARD_REPOSITORY && (path === '/create' || path === '/create/')) {
        return Response.redirect(new URL('/', request.url).href, 302);
    }
    if (path === '/api/health') return json({ ok: true });
    if (path.startsWith('/api/images/') && request.method === 'GET') {
        const name = path.slice('/api/images/'.length);
        if (!isUploadedImage(name)) return json({ error: 'Invalid image name.' }, 404);
        let body: ArrayBuffer | ReadableStream | null = null;
        if (env.BOARD_SYNC_URL) {
            const response = await fetch(`${env.BOARD_SYNC_URL}/images/${name}`);
            if (response.ok) body = response.body;
            else if (response.status !== 404) return response;
        }
        body ??= await store(env).getImage(name);
        if (!body && env.BOARD_REPOSITORY) {
            const published = await readPublishedImage(env.BOARD_REPOSITORY, name);
            if (published) {
                await store(env).putImage(name, published);
                body = published;
            }
        }
        if (!body) return json({ error: 'Image not found.' }, 404);
        return new Response(body, { headers: {
            'Content-Type': imageContentType(name), 'Cache-Control': 'private, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
            'Cross-Origin-Resource-Policy': 'same-origin'
        } });
    }
    if (path === '/api/status' && request.method === 'GET') {
        return json({ fix: !!env.OPENAI_API_KEY && await store(env).fixOn(), naturalWordVoice: !!env.BOARD_REPOSITORY } satisfies Status);
    }
    if (path === '/api/board' && request.method === 'GET') {
        if (env.BOARD_REPOSITORY) {
            const snapshot = await store(env).publishedBoard(env.BOARD_REPOSITORY);
            return snapshot ? boardResponse(request, snapshot) : json({ error: 'The published board is unavailable.' }, 503);
        }
        if (!env.BOARD_SYNC_URL) return json({ board: await store(env).board() });
        const response = await fetch(env.BOARD_SYNC_URL);
        if (!response.ok) return response;
        const snapshot = await response.json<{ board: unknown; revision: string; sync: string }>();
        if (snapshot.board) return boardResponse(request, snapshot);
        const legacy = await store(env).board();
        if (legacy && snapshot.sync === 'synced') {
            const seeded = await saveSharedBoard(env, env.BOARD_SYNC_URL, legacy, '', true);
            if (!seeded.ok) return seeded;
            const latest = await seeded.json<typeof snapshot>();
            return json({ ...latest, board: latest.board ?? legacy });
        }
        return json({ ...snapshot, board: legacy });
    }
    if (path.startsWith('/api/teacher/')) {
        if (env.BOARD_REPOSITORY) return json({ error: 'Publish board changes from the laptop editor.' }, 403);
        return teacher(request, env, path);
    }
    if (request.method !== 'POST' || (path !== '/api/fix' && path !== '/api/speak')) return json({ error: 'Not found.' }, 404);

    const read = await readJson(request, path === '/api/fix' ? (MAX_LINKED_SENTENCES + 1) * MAX_TEXT * 6 + 1024 : 8192);
    if ('error' in read) return read.error;
    const body = read.body;
    const words = text(body?.text);
    if (!words) return json({ error: 'Nothing to say yet.' }, 400);

    // Saved answers are reused without counting against the student's limit: only new questions cost anything.
    if (path === '/api/speak') {
        const voice = isEnglishVoice(body.voice) ? body.voice : DEFAULT_VOICE;
        const rate = bridgeRate(body.rate);
        const key = await sha256Hex(`speech::${voice}::${rate}::${words}`); // as PinPlay: voice::rate::text
        const saved = (await store(env).recall([key]))[key];
        if (saved?.audio) return audioResponse(saved.audio, 'hit');
        if (!(await allowed(env.USE_RL, `speak:${visitor(request, env)}`))) return json({ error: 'Too fast. Wait a moment.' }, 429);
        const audio = await synthesize(env, words, voice, rate, request.signal);
        const bytes = audio ? await audio.arrayBuffer().catch(() => null) : null; // fails past the 4 MB limit
        if (!bytes) return json({ error: 'The voice is unavailable.' }, 503);
        await store(env).remember('speech', key, null, bytes);
        return audioResponse(bytes, 'miss');
    }

    if (!env.OPENAI_API_KEY || !(await store(env).fixOn())) return json({ error: 'Your teacher has switched Fix off.' }, 403);
    const level: Level = isLevel(body.level) ? body.level : 'A2';
    const context = Array.isArray(body.context) ? body.context.map(text) : text(body.context);
    if (Array.isArray(context) && (!context.length || context.length > MAX_LINKED_SENTENCES || context.some(line => !line))) {
        return json({ error: 'Invalid paragraph context.' }, 400);
    }
    const input = { text: words, level, language: isLanguage(body.language) ? body.language : undefined, ...(context ? { context } : {}) };
    // A lookup includes the paragraph because the same words can have different tenses in different stories.
    const shared = await sha256Hex(fixSeed(input, env));
    const paired = context ? await sha256Hex(fixSeed(input, env, true)) : null;
    const lookup = paired ?? shared;
    const saved = (await store(env).recall([lookup]))[lookup];
    if (saved?.value) return json(JSON.parse(saved.value), 200, 'hit');
    if (!(await allowed(env.USE_RL, `fix:${visitor(request, env)}`))) return json({ error: 'Too fast. Wait a moment.' }, 429);
    const result = await fixPhrase(input, env);
    if (!result) return json({ error: 'No suggestion right now. You can still speak your words.' }, 503);
    await store(env).remember('fix', lookup, JSON.stringify(result.fix));
    // Older clients shared a standalone answer when their single preceding sentence had no effect.
    if (paired && !Array.isArray(context) && !result.contextUsed) await store(env).remember('fix', shared, JSON.stringify(result.fix));
    return json(result.fix, 200, 'miss');
}

// Only /api/* reaches the Worker; the built app is served as static assets.
export default {
    async fetch(request, env): Promise<Response> {
        try {
            return await handle(request, env);
        } catch (error) {
            console.error(error);
            return json({ error: 'Something went wrong. Please try again.' }, 500);
        }
    }
} satisfies ExportedHandler<Env>;
