import { fixPhrase } from './phrase.ts';
import { synthesize } from './speech.ts';
import { BoardStore } from './store.ts';
import { newSession, passwordMatches, sessionValid } from './teacher.ts';
import { MAX_ITEMS, toCatalan, type Item } from './translate.ts';
import { LIMITS, sanitizeBoard } from '../shared/board.ts';
import { isLanguage, isLevel, isVoice, MAX_TEXT, type Status } from '../shared/options.ts';

export { BoardStore };

export interface Env {
    BOARD: DurableObjectNamespace<BoardStore>;
    // Optional: without a key the board works with the device's voice and no Fix.
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string; // tests only
    OPENAI_PHRASE_MODEL?: string;
    OPENAI_TTS_MODEL?: string;
    // Optional: a code people type once before the app spends the key.
    ACCESS_CODE?: string;
    // The teacher's password for /create, the same as PinPlay's.
    CREATE_PASSWORD_HASH?: string;
    AI_RL?: RateLimit;
    AUTH_RL?: RateLimit;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const store = (env: Env) => env.BOARD.getByName('main');

async function codeMatches(given: string, expected: string): Promise<boolean> {
    const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    const [a, b] = await Promise.all([digest(given), digest(expected)]);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
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

// Why an OpenAI call for the speaker may not go ahead, or null.
async function refused(request: Request, env: Env): Promise<Response | null> {
    if (!env.OPENAI_API_KEY) return json({ error: 'AI is not set up.' }, 503);
    if (!(await allowed(env.AI_RL, request.headers.get('CF-Connecting-IP') || 'local'))) return json({ error: 'Too fast. Wait a moment.' }, 429);
    if (env.ACCESS_CODE && !(await codeMatches(request.headers.get('x-access-code') || '', env.ACCESS_CODE))) {
        return json({ error: 'Type the access code in Settings.' }, 401);
    }
    return null;
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
    if (!env.CREATE_PASSWORD_HASH) return json({ error: 'The teacher password is not set up. See README.' }, 503);
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
            if (!env.OPENAI_API_KEY) return json({ error: 'AI is not set up, so type the Catalan yourself.' }, 503);
            const items: Item[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS + 1).map((item: any) => ({
                text: typeof item?.text === 'string' ? item.text.trim().slice(0, LIMITS.phrase) : '',
                ...(typeof item?.hint === 'string' && item.hint ? { hint: item.hint.slice(0, 60) } : {})
            })) : [];
            if (!items.length || items.length > MAX_ITEMS || items.some(item => !item.text)) return json({ error: 'Nothing to translate.' }, 400);
            const ca = await toCatalan(items, env);
            return ca ? json({ ca }) : json({ error: 'Translation is unavailable right now. Try again, or type it yourself.' }, 503);
        }
        default:
            return json({ error: 'Not found.' }, 404);
    }
}

async function handle(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (path === '/api/status' && request.method === 'GET') {
        return json({ ai: !!env.OPENAI_API_KEY, locked: !!(env.OPENAI_API_KEY && env.ACCESS_CODE) } satisfies Status);
    }
    if (path === '/api/board' && request.method === 'GET') return json({ board: await store(env).board() });
    if (path.startsWith('/api/teacher/')) return teacher(request, env, path);
    if (request.method !== 'POST' || (path !== '/api/fix' && path !== '/api/speak')) return json({ error: 'Not found.' }, 404);

    const read = await readJson(request, 8192);
    if ('error' in read) return read.error;
    const body = read.body;
    const words = text(body?.text);
    if (!words) return json({ error: 'Nothing to say yet.' }, 400);

    const stop = await refused(request, env);
    if (stop) return stop;

    if (path === '/api/fix') {
        const fix = await fixPhrase({
            text: words, level: isLevel(body.level) ? body.level : 'A2',
            language: isLanguage(body.language) ? body.language : undefined, context: text(body.context) || undefined
        }, env);
        return fix ? json(fix) : json({ error: 'No suggestion right now. You can still speak your words.' }, 503);
    }
    const audio = await synthesize(env, words, isVoice(body.voice) ? body.voice : 'coral', request.signal);
    return audio ?? json({ error: 'The voice is unavailable.' }, 503);
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
