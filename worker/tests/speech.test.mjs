import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_EDGE_TTS_URL, synthesize } from '../speech.ts';
import { bridgeRate, isEnglishVoice } from '../../shared/voices.ts';

async function withFetch(fake, run) {
    const real = globalThis.fetch;
    globalThis.fetch = fake;
    try { return await run(); } finally { globalThis.fetch = real; }
}

test('speech goes to the Edge TTS bridge, never to OpenAI', async () => {
    let sent;
    const audio = await withFetch(async (url, init) => {
        sent = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
        return new Response(new Uint8Array([0xff, 0xf3, 0x44]), { headers: { 'Content-Type': 'audio/mpeg' } });
    }, () => synthesize({}, 'Where is the bus stop?', 'en-GB-SoniaNeural', '-20%', new AbortController().signal));
    assert.equal(sent.url, DEFAULT_EDGE_TTS_URL);
    assert.deepEqual(sent.body, { text: 'Where is the bus stop?', voice: 'en-GB-SoniaNeural', rate: '-20%' });
    assert.equal(sent.headers.Authorization, undefined);
    assert.equal(audio.headers.get('Content-Type'), 'audio/mpeg');
    assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [0xff, 0xf3, 0x44]);
});

test('speech sends the bridge secret when there is one, and gives up quietly', async () => {
    let auth;
    await withFetch(async (url, init) => { auth = init.headers.Authorization; return new Response('x', { headers: { 'Content-Type': 'audio/mpeg' } }); },
        () => synthesize({ EDGE_TTS_SECRET: 's' }, 'Hi', 'en-GB-SoniaNeural', '+0%', new AbortController().signal));
    assert.equal(auth, 'Bearer s');
    const signal = new AbortController().signal;
    assert.equal(await withFetch(async () => new Response('busy', { status: 502 }), () => synthesize({}, 'Hi', 'v', '+0%', signal)), null);
    assert.equal(await withFetch(async () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }), () => synthesize({}, 'Hi', 'v', '+0%', signal)), null);
    assert.equal(await withFetch(async () => { throw new Error('offline'); }, () => synthesize({}, 'Hi', 'v', '+0%', signal)), null);
    assert.equal(await synthesize({ EDGE_TTS_URL: 'http://example.com/tts' }, 'Hi', 'v', '+0%', signal), null); // plain http only for localhost
});

test('voices and speeds are checked', () => {
    assert.equal(isEnglishVoice('en-GB-SoniaNeural'), true);
    assert.equal(isEnglishVoice('coral'), false);
    assert.deepEqual([0.8, 1, 1.15, 3, 'x'].map(bridgeRate), ['-20%', '+0%', '+15%', '+0%', '+0%']);
});
