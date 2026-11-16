import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clean, fixPhrase, fixSeed } from '../phrase.ts';
import { caSeed } from '../translate.ts';

test('the same question shares one saved answer; a different one does not', () => {
    const env = {};
    const seed = (text, level = 'A2', language = '') => fixSeed({ text, level, language }, env);
    assert.equal(seed('I want go home'), seed('  i WANT go   home. '));
    assert.equal(seed('where bus stop'), seed('Where bus stop?'));
    assert.notEqual(seed('I want go home'), seed('I want go home', 'B1'));
    assert.notEqual(seed('I want go home'), seed('I want go home', 'A2', 'Catalan'));
    assert.notEqual(seed('I want go home'), seed('I want go school'));
    assert.notEqual(seed('I want go home'), fixSeed({ text: 'I want go home', level: 'A2' }, { OPENAI_PHRASE_MODEL: 'other-model' }));
    assert.equal(caSeed({ text: ' work ', hint: 'noun on the Places page' }, env), caSeed({ text: 'work', hint: 'noun on the Places page' }, env));
    assert.notEqual(caSeed({ text: 'work', hint: 'noun on the Places page' }, env), caSeed({ text: 'work', hint: 'verb' }, env));
});

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
        translation: 'Vull anar al metge.'
    });
    assert.deepEqual(fix, {
        sentence: 'I want to go to the doctor.',
        alternatives: ['Do I want to go to the doctor?', 'I wanted to go to the doctor.'],
        translation: 'Vull anar al metge.'
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
        return answer({ sentence: 'Where is the bus stop?', alternatives: [], translation: "On és la parada d'autobús?" });
    }, () => fixPhrase({ text: 'where bus stop', level: 'A1', language: 'Catalan' }, { OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'http://ai.test', OPENAI_PHRASE_MODEL: 'test-model' }));
    assert.deepEqual(fix, { sentence: 'Where is the bus stop?', alternatives: [], translation: "On és la parada d'autobús?" });
    assert.equal(sent.url, 'http://ai.test/v1/chat/completions');
    assert.equal(sent.body.model, 'test-model');
    assert.match(sent.body.messages[0].content, /CEFR A1/);
    assert.match(sent.body.messages[0].content, /in Catalan/);
    assert.doesNotMatch(sent.body.messages[0].content, /note/);
    assert.deepEqual(JSON.parse(sent.body.messages[1].content), { words: 'where bus stop' });
});

test('fixPhrase gives up quietly', async () => {
    assert.equal(await fixPhrase({ text: 'x', level: 'A2' }, {}), null); // no key: no call
    assert.equal(await withFetch(async () => new Response('no', { status: 500 }), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => { throw new Error('offline'); }, () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => new Response('{"choices":[{"message":{"content":"not json"}}]}'), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
});
