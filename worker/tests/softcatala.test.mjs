import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCatalanSentence } from '../softcatala.ts';

async function withFetch(fake, run) {
    const real = globalThis.fetch;
    globalThis.fetch = fake;
    try { return await run(); } finally { globalThis.fetch = real; }
}
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('a sentence goes to Softcatalà English→Catalan and comes back tidy', async () => {
    let asked;
    const catalan = await withFetch(async url => {
        asked = new URL(String(url));
        return reply({ responseStatus: 200, responseData: { translatedText: '  No entenc   els deures. ' } });
    }, () => toCatalanSentence(" I don't understand the homework. "));
    assert.equal(catalan, 'No entenc els deures.');
    assert.equal(asked.origin + asked.pathname, 'https://api.softcatala.org/v2/nmt/translate');
    assert.equal(asked.searchParams.get('langpair'), 'eng|cat');
    assert.equal(asked.searchParams.get('q'), "I don't understand the homework.");
});

test('no answer from Softcatalà means null, so the model\'s translation stays', async () => {
    assert.equal(await withFetch(async () => reply({ error: 'busy' }, 503), () => toCatalanSentence('Hello.')), null);
    assert.equal(await withFetch(async () => reply({ responseStatus: 500, responseData: null }), () => toCatalanSentence('Hello.')), null);
    assert.equal(await withFetch(async () => new Response('<html>'), () => toCatalanSentence('Hello.')), null);
    assert.equal(await withFetch(async () => { throw new Error('offline'); }, () => toCatalanSentence('Hello.')), null);
    assert.equal(await toCatalanSentence('   '), null); // nothing asked
    assert.equal(await toCatalanSentence('x'.repeat(501)), null);
});
