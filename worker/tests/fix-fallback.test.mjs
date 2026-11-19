import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctSentence } from '../fix.ts';

const xkiro = { OPENAI_API_KEY: 'xkiro-key', OPENAI_BASE_URL: 'https://api.xkiro.com', OPENAI_PHRASE_MODEL: 'mistralai/mistral-large-2512' };
const openai = { OPENAI_API_KEY: 'openai-key', OPENAI_PHRASE_MODEL: 'gpt-4o-mini' };
const input = { text: 'yesterday I go home', level: 'A2', language: 'Catalan' };
const correction = { sentence: 'Yesterday I went home.', alternatives: [], translation: 'Ahir vaig anar a casa.' };

function memory() {
    const saved = new Map();
    let retryAt = 0;
    return {
        recall: keys => Object.fromEntries(keys.filter(key => saved.has(key)).map(key => [key, { value: saved.get(key) }])),
        remember: (_kind, key, value) => saved.set(key, value),
        xkiroRetryAt: () => retryAt,
        pauseXkiroUntil: until => { retryAt = until; }
    };
}

function answer(fix = correction) {
    return Response.json({ choices: [{ message: { content: JSON.stringify({ ...fix, context_used: false }) } }] });
}

test('a quota response uses the separate OpenAI key, caches the backup, and returns to xKiro after Retry-After', async t => {
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    const calls = [];
    let rateLimited = true;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        calls.push([url, init.headers.authorization, JSON.parse(init.body).model]);
        return url.startsWith(xkiro.OPENAI_BASE_URL) && rateLimited
            ? new Response(null, { status: 429, headers: { 'Retry-After': '120' } })
            : answer();
    });
    const store = memory();
    let allowances = 0;
    const allow = async () => { allowances++; return true; };
    assert.deepEqual(await correctSentence(input, xkiro, openai, store, allow), { fix: correction, cache: 'miss' });
    assert.deepEqual(calls, [
        ['https://api.xkiro.com/v1/chat/completions', 'Bearer xkiro-key', 'mistralai/mistral-large-2512'],
        ['https://api.openai.com/v1/chat/completions', 'Bearer openai-key', 'gpt-4o-mini']
    ]);
    assert.equal(store.xkiroRetryAt(), now + 120_000);
    assert.deepEqual(await correctSentence(input, xkiro, openai, store, allow), { fix: correction, cache: 'hit' });
    assert.equal(calls.length, 2);
    assert.equal(allowances, 1);
    await correctSentence({ ...input, text: 'I go home yesterday' }, xkiro, openai, store, allow);
    assert.equal(calls.length, 3);
    assert.match(calls[2][0], /^https:\/\/api\.openai\.com\//);

    now += 120_001;
    rateLimited = false;
    assert.deepEqual(await correctSentence(input, xkiro, openai, store, allow), { fix: correction, cache: 'miss' });
    assert.equal(calls.length, 4);
    assert.match(calls[3][0], /^https:\/\/api\.xkiro\.com\//);
    assert.deepEqual(await correctSentence(input, xkiro, openai, store, allow), { fix: correction, cache: 'hit' });
    assert.equal(calls.length, 4);
});

test('a rejection by the app or an xKiro auth error does not spend OpenAI quota', async t => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
    const store = memory();
    assert.equal(await correctSentence(input, xkiro, openai, store, async () => false), 'limited');
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.equal(await correctSentence(input, xkiro, openai, store, async () => true), 'unavailable');
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.match(fetchMock.mock.calls[0].arguments[0], /^https:\/\/api\.xkiro\.com\//);
});
