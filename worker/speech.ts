// Voices come from PinPlay's Edge TTS bridge on Render, as in HelloChat and Pixel Plaza: the laptop asks it and
// passes the audio on to students over the school Wi-Fi. Returns MP3, or null so the page uses the device's voice.

export const DEFAULT_EDGE_TTS_URL = 'https://pinplay-tts-bridge-27sk.onrender.com/tts'; // keep in sync with scripts/warm-speech.mjs
export type SpeechEnv = { EDGE_TTS_URL?: string; EDGE_TTS_SECRET?: string };

const MAX_BYTES = 4 * 1024 * 1024;

export async function synthesize(env: SpeechEnv, text: string, voice: string, rate: string, signal: AbortSignal): Promise<Response | null> {
    try {
        const url = new URL(env.EDGE_TTS_URL || DEFAULT_EDGE_TTS_URL);
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
        const response = await fetch(url, {
            method: 'POST', redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(50_000)]),
            headers: { 'Content-Type': 'application/json', ...(env.EDGE_TTS_SECRET ? { Authorization: `Bearer ${env.EDGE_TTS_SECRET}` } : {}) },
            body: JSON.stringify({ text, voice, rate })
        });
        const length = Number(response.headers.get('Content-Length') || 0);
        if (!response.ok || !response.body || !(response.headers.get('Content-Type') || '').startsWith('audio/') || length > MAX_BYTES) {
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
        return null; // never log what the speaker said
    }
}
