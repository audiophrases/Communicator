// OpenAI's natural voices. Returns MP3, or null so the page falls back to the device's own voice.

import type { Voice } from '../shared/options.ts';

export type SpeechEnv = { OPENAI_API_KEY?: string; OPENAI_BASE_URL?: string; OPENAI_TTS_MODEL?: string };

// The speaker's words must sound like a person talking, not like a narrator or an advert.
const STYLE = 'Speak clearly and naturally, like a friendly person talking to someone face to face. Calm, even pace. Say exactly the text.';
const MAX_BYTES = 4 * 1024 * 1024;

export async function synthesize(env: SpeechEnv, text: string, voice: Voice, signal: AbortSignal): Promise<Response | null> {
    if (!env.OPENAI_API_KEY) return null;
    const model = env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
    try {
        const response = await fetch(`${env.OPENAI_BASE_URL || 'https://api.openai.com'}/v1/audio/speech`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
            // tts-1 and tts-1-hd reject "instructions".
            body: JSON.stringify({ model, voice, input: text, response_format: 'mp3', ...(model.startsWith('tts-1') ? {} : { instructions: STYLE }) }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)])
        });
        if (!response.ok || !response.body) {
            console.log(`speech: HTTP ${response.status}`);
            await response.body?.cancel();
            return null;
        }
        let size = 0;
        const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                size += chunk.byteLength;
                if (size > MAX_BYTES) controller.error(new Error('Audio response exceeds the limit.'));
                else controller.enqueue(chunk);
            }
        }));
        return new Response(stream, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch {
        return null;
    }
}
