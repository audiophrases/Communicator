import { fixPhrase } from './phrase.ts';
import { synthesize } from './speech.ts';
import { isLanguage, isLevel, isVoice, MAX_TEXT, type Status } from '../shared/options.ts';

export interface Env {
    // Optional: without a key the board works with the device's voice and no Fix.
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string; // tests only
    OPENAI_PHRASE_MODEL?: string;
    OPENAI_TTS_MODEL?: string;
    // Optional: a code people type once before the app spends the key.
    ACCESS_CODE?: string;
    AI_RL?: RateLimit;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function codeMatches(given: string, expected: string): Promise<boolean> {
    const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    const [a, b] = await Promise.all([digest(given), digest(expected)]);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// Why an OpenAI call may not go ahead, or null.
async function refused(request: Request, env: Env): Promise<Response | null> {
    if (!env.OPENAI_API_KEY) return json({ error: 'AI is not set up.' }, 503);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (env.AI_RL) {
        try {
            if (!(await env.AI_RL.limit({ key: ip })).success) return json({ error: 'Too fast. Wait a moment.' }, 429);
        } catch { /* a limiter outage must not take the speaker's voice away */ }
    }
    if (env.ACCESS_CODE && !(await codeMatches(request.headers.get('x-access-code') || '', env.ACCESS_CODE))) {
        return json({ error: 'Type the access code in Settings.' }, 401);
    }
    return null;
}

const text = (value: unknown): string => typeof value === 'string' && value.trim().length <= MAX_TEXT ? value.trim() : '';

async function handle(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (path === '/api/status' && request.method === 'GET') {
        return json({ ai: !!env.OPENAI_API_KEY, locked: !!(env.OPENAI_API_KEY && env.ACCESS_CODE) } satisfies Status);
    }
    if (request.method !== 'POST' || (path !== '/api/fix' && path !== '/api/speak')) return json({ error: 'Not found.' }, 404);

    if (Number(request.headers.get('Content-Length') || 0) > 8192) return json({ error: 'Request is too large.' }, 413);
    let body: any;
    try { body = JSON.parse((await request.text()).slice(0, 8192)); } catch { return json({ error: 'Invalid JSON.' }, 400); }
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
