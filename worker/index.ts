import { fixPhrase, fixSeed } from './phrase.ts';
import { synthesize } from './speech.ts';
import { BoardStore } from './store.ts';
import { newSession, passwordMatches, sessionValid, sha256Hex } from './teacher.ts';
import { caSeed, MAX_ITEMS, toCatalan, type Item } from './translate.ts';
import { LIMITS, sanitizeBoard } from '../shared/board.ts';
import { isLanguage, isLevel, MAX_TEXT, type Level, type Status, type TeacherSettings } from '../shared/options.ts';
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
function visitor(request: Request): string {
    const device = (request.headers.get('x-device') || '').replace(/[^\w-]/g, '').slice(0, 40);
    return `${request.headers.get('CF-Connecting-IP') || 'local'}:${device}`;
}

// The JSON body, read no further than max bytes.
async function readJson(request: Request, max: number): Promise<{ body: any } | { error: Response }> {
    const reader = request.body?.getReader();
    if (!reader) return { error: json({ error: 'Expected JSON.' }, 400) };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) { await reader.cancel(); return { error: json({ error: 'Request is too large.' }, 413) }; }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return { body: JSON.parse(new TextDecoder().decode(bytes)) }; } catch { return { error: json({ error: 'Invalid JSON.' }, 400) }; }
}

const text = (value: unknown): string => typeof value === 'string' && value.trim().length <= MAX_TEXT ? value.trim() : '';

async function teacher(request: Request, env: Env, path: string): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
    if (!env.CREATE_PASSWORD_HASH) return json({ error: 'The teacher password is not set up. Run classroom.bat.' }, 503);
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

    if (!(await sessionValid(request.headers.get('x-teacher-session') || '', env.CREATE_PASSWORD_HASH))) {
        return json({ error: 'Please sign in again.' }, 401);
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
            await store(env).save(board);
            return json({ board });
        }
        case '/api/teacher/reset':
            await store(env).reset();
            return json({ board: null });
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

    if (path === '/api/health') return json({ ok: true });
    if (path === '/api/status' && request.method === 'GET') {
        return json({ fix: !!env.OPENAI_API_KEY && await store(env).fixOn() } satisfies Status);
    }
    if (path === '/api/board' && request.method === 'GET') return json({ board: await store(env).board() });
    if (path.startsWith('/api/teacher/')) return teacher(request, env, path);
    if (request.method !== 'POST' || (path !== '/api/fix' && path !== '/api/speak')) return json({ error: 'Not found.' }, 404);

    const read = await readJson(request, 8192);
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
        if (!(await allowed(env.USE_RL, `speak:${visitor(request)}`))) return json({ error: 'Too fast. Wait a moment.' }, 429);
        const audio = await synthesize(env, words, voice, rate, request.signal);
        const bytes = audio ? await audio.arrayBuffer().catch(() => null) : null; // fails past the 4 MB limit
        if (!bytes) return json({ error: 'The voice is unavailable.' }, 503);
        await store(env).remember('speech', key, null, bytes);
        return audioResponse(bytes, 'miss');
    }

    if (!env.OPENAI_API_KEY || !(await store(env).fixOn())) return json({ error: 'Your teacher has switched Fix off.' }, 403);
    const level: Level = isLevel(body.level) ? body.level : 'A2';
    const input = { text: words, level, language: isLanguage(body.language) ? body.language : undefined };
    const key = await sha256Hex(fixSeed(input, env));
    const saved = (await store(env).recall([key]))[key];
    if (saved?.value) return json(JSON.parse(saved.value), 200, 'hit');
    if (!(await allowed(env.USE_RL, `fix:${visitor(request)}`))) return json({ error: 'Too fast. Wait a moment.' }, 429);
    const fix = await fixPhrase(input, env);
    if (!fix) return json({ error: 'No suggestion right now. You can still speak your words.' }, 503);
    await store(env).remember('fix', key, JSON.stringify(fix));
    return json(fix, 200, 'miss');
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
