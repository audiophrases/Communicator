import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clean, fixPhrase } from '../phrase.ts';

const answer = (content) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));

async function withFetch(fake, run) {
    const real = globalThis.fetch;
    globalThis.fetch = fake;
    try { return await run(); } finally { globalThis.fetch = real; }
}

test('clean keeps a believable sentence and tidies the rest', () => {
    const fix = clean('I want go doctor', {
        sentence: '  I want to go to the doctor. ',
        alternatives: ['I want to go to the doctor.', 'Do I want to go to the doctor?', 'I wanted to go to the doctor.', 'A fourth one.', 7],
        note: 'After "want" we say "to".', translation: 'Quiero ir al médico.'
    });
    assert.deepEqual(fix, {
        sentence: 'I want to go to the doctor.',
        alternatives: ['Do I want to go to the doctor?', 'I wanted to go to the doctor.'],
        note: 'After "want" we say "to".', translation: 'Quiero ir al médico.'
    });
});

test('clean refuses junk and inventions', () => {
    assert.equal(clean('hi', null), null);
    assert.equal(clean('hi', { sentence: '' }), null);
    assert.equal(clean('hi', { sentence: 42 }), null);
    assert.equal(clean('I hungry', { sentence: 'I am hungry because I did not eat breakfast today and now I would like a very large pizza.' }), null);
});

test('fixPhrase sends the words as data and returns the fix', async () => {
    let sent;
    const fix = await withFetch(async (url, init) => {
        sent = { url, body: JSON.parse(init.body) };
        return answer({ sentence: 'Where is the bus stop?', alternatives: [], note: 'A question needs "is".', translation: '' });
    }, () => fixPhrase({ text: 'where bus stop', level: 'A1', language: 'Spanish', context: 'I am lost.' }, { OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'http://ai.test', OPENAI_PHRASE_MODEL: 'test-model' }));
    assert.equal(fix.sentence, 'Where is the bus stop?');
    assert.equal(sent.url, 'http://ai.test/v1/chat/completions');
    assert.equal(sent.body.model, 'test-model');
    assert.match(sent.body.messages[0].content, /CEFR A1/);
    assert.match(sent.body.messages[0].content, /in Spanish/);
    assert.deepEqual(JSON.parse(sent.body.messages[1].content), { words: 'where bus stop', context: 'I am lost.' });
});

test('fixPhrase gives up quietly', async () => {
    assert.equal(await fixPhrase({ text: 'x', level: 'A2' }, {}), null); // no key: no call
    assert.equal(await withFetch(async () => new Response('no', { status: 500 }), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => { throw new Error('offline'); }, () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => new Response('{"choices":[{"message":{"content":"not json"}}]}'), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
});
