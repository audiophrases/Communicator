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
        return answer({ sentence: 'Where is the bus stop?', alternatives: [], translation: "On és la parada d'autobús?", context_used: false });
    }, () => fixPhrase({ text: 'where bus stop', level: 'A1', language: 'Catalan' }, { OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'http://ai.test', OPENAI_PHRASE_MODEL: 'test-model' }));
    assert.deepEqual(fix, { fix: { sentence: 'Where is the bus stop?', alternatives: [], translation: "On és la parada d'autobús?" }, contextUsed: false });
    assert.equal(sent.url, 'http://ai.test/v1/chat/completions');
    assert.equal(sent.body.model, 'test-model');
    assert.match(sent.body.messages[0].content, /CEFR A1/);
    assert.match(sent.body.messages[0].content, /in Catalan/);
    assert.doesNotMatch(sent.body.messages[0].content, /note/);
    assert.deepEqual(JSON.parse(sent.body.messages[1].content), { words: 'where bus stop' });
});

test('fixPhrase sends the sentence before and says whether it changed the answer', async () => {
    const env = { OPENAI_API_KEY: 'k' };
    const input = { text: 'I eat ice cream', level: 'A2', context: 'Yesterday I went to the park.' };
    let sent;
    const used = await withFetch(async (url, init) => {
        sent = JSON.parse(JSON.parse(init.body).messages[1].content);
        return answer({ sentence: 'I ate ice cream.', alternatives: [], translation: '', context_used: true });
    }, () => fixPhrase(input, env));
    assert.deepEqual(sent, { words: 'I eat ice cream', before: 'Yesterday I went to the park.' });
    assert.deepEqual(used, { fix: { sentence: 'I ate ice cream.', alternatives: [], translation: '' }, contextUsed: true });
    // Not said, or no sentence before: an answer with a sentence before counts as using it, one without never does.
    const unsure = await withFetch(async () => answer({ sentence: 'I ate ice cream.', alternatives: [], translation: '' }), () => fixPhrase(input, env));
    assert.equal(unsure.contextUsed, true);
    const alone = await withFetch(async () => answer({ sentence: 'I eat ice cream.', alternatives: [], translation: '', context_used: true }),
        () => fixPhrase({ text: 'I eat ice cream', level: 'A2' }, env));
    assert.equal(alone.contextUsed, false);
});

test('an answer that used the sentence before is saved only for that pair', () => {
    const env = {};
    const input = { text: 'I eat ice cream', level: 'A2', context: 'Yesterday I went to the park.' };
    assert.equal(fixSeed(input, env), fixSeed({ text: 'I eat ice cream', level: 'A2' }, env)); // the class-wide key ignores it
    assert.notEqual(fixSeed(input, env, true), fixSeed(input, env));
    assert.equal(fixSeed(input, env, true), fixSeed({ ...input, context: 'yesterday I went to the park' }, env, true));
    assert.notEqual(fixSeed(input, env, true), fixSeed({ ...input, context: 'Tomorrow I go to the park.' }, env, true));
});

test('fixPhrase gives up quietly', async () => {
    assert.equal(await fixPhrase({ text: 'x', level: 'A2' }, {}), null); // no key: no call
    assert.equal(await withFetch(async () => new Response('no', { status: 500 }), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => { throw new Error('offline'); }, () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => new Response('{"choices":[{"message":{"content":"not json"}}]}'), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
});
