// Wakes PinPlay's Render voice bridge while the class starts, so the first sentence is not slow.
// A plain request: no text is synthesized or sent. An offline bridge must not stop the class.
import fs from 'node:fs';
import path from 'node:path';

try {
    const vars = path.join(import.meta.dirname, '..', '.dev.vars');
    if (fs.existsSync(vars)) process.loadEnvFile(vars);
    // Keep the fallback in sync with worker/speech.ts.
    const url = new URL(process.env.EDGE_TTS_URL || 'https://pinplay-tts-bridge-27sk.onrender.com/tts');
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        const response = await fetch(new URL('/', url), { redirect: 'manual', signal: AbortSignal.timeout(120_000) });
        await response.body?.cancel();
    }
} catch {
    // The class starts normally if Render or the network is unavailable.
}
