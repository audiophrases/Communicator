import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALAN_RULE, clean, fixLanguage, fixPhrase, fixSeed } from '../phrase.ts';
import { caSeed, toCatalan } from '../translate.ts';

test('FIX_TRANSLATION=off (the online board) answers in English only, whatever the page asks for', () => {
    assert.equal(fixLanguage('Catalan'), 'Catalan'); // the laptop
    assert.equal(fixLanguage('Catalan', 'off'), undefined);
    assert.equal(fixLanguage('', undefined), undefined); // "Do not translate"
    assert.equal(fixLanguage('Klingon'), undefined);
});

test('the same question shares one saved answer; a different one does not', () => {
    const env = {};
    const seed = (text, level = 'A2', language = '') => fixSeed({ text, level, language }, env);
    assert.equal(seed('I want go home'), seed('  i WANT go   home. '));
    // The ? button asks: "you want coffee?" is not "you want coffee", however the mark was spaced.
    assert.notEqual(seed('you want coffee'), seed('you want coffee?'));
    assert.equal(seed('you want coffee?'), seed('You want coffee ?'));
    assert.equal(seed('where bus stop?'), seed('Where bus stop ? '));
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

test('linked Fix sends the paragraph in order and caches each context separately', async () => {
    const context = ['Yesterday I went to the park.', 'I saw my friend.'];
    const input = { text: 'we play football', level: 'A2', context };
    await withFetch(async (_url, init) => {
        const [system, user] = JSON.parse(init.body).messages;
        assert.deepEqual(JSON.parse(user.content), { words: input.text, before: context });
        assert.match(system.content, /paragraph/);
        assert.doesNotMatch(system.content, /ONLY when "before" names a past time/);
        return answer({ sentence: 'We played football.', alternatives: [], translation: '', context_used: true });
    }, () => fixPhrase(input, { OPENAI_API_KEY: 'k' }));
    const key = fixSeed(input, {}, true);
    assert.notEqual(key, fixSeed(input, {}));
    assert.notEqual(key, fixSeed({ ...input, context: context.toReversed() }, {}, true));
    assert.notEqual(key, fixSeed({ ...input, context: ['Tomorrow we will meet.', context[1]] }, {}, true));
});

test('Fix and the editor use gpt-6-luna without thinking, unless told otherwise', async () => {
    const bodies = [];
    await withFetch(async (url, init) => {
        bodies.push(JSON.parse(init.body));
        return answer({ sentence: 'Hi there.', alternatives: [], translation: '', context_used: false, translations: ['hola'] });
    }, async () => {
        await fixPhrase({ text: 'hi there', level: 'A2' }, { OPENAI_API_KEY: 'k' });
        await fixPhrase({ text: 'hi there', level: 'A2' }, { OPENAI_API_KEY: 'k', OPENAI_PHRASE_MODEL: 'gpt-5.4-mini' });
        await fixPhrase({ text: 'hi there', level: 'A2' }, { OPENAI_API_KEY: 'k', OPENAI_PHRASE_MODEL: 'gpt-4o-mini' });
        await toCatalan([{ text: 'hello' }], { OPENAI_API_KEY: 'k' });
    });
    assert.deepEqual(bodies.map(body => [body.model, body.reasoning_effort ?? null]),
        [['gpt-6-luna', 'none'], ['gpt-5.4-mini', 'none'], ['gpt-4o-mini', null], ['gpt-6-luna', 'none']]); // older models reject the setting
    // Saved answers belong to the model that gave them.
    assert.notEqual(fixSeed({ text: 'x', level: 'A2' }, {}), fixSeed({ text: 'x', level: 'A2' }, { OPENAI_PHRASE_MODEL: 'gpt-5.4-mini' }));
    assert.notEqual(caSeed({ text: 'glass' }, {}), caSeed({ text: 'glass' }, { OPENAI_PHRASE_MODEL: 'gpt-5.4-mini' }));
});

test('the Catalan rule for agradar goes with every Catalan translation, and only then', async () => {
    const systems = [];
    await withFetch(async (url, init) => {
        systems.push(JSON.parse(init.body).messages[0].content);
        return answer({ sentence: 'I like you.', alternatives: [], translation: '', context_used: false, translations: ['hola'] });
    }, async () => {
        await fixPhrase({ text: 'I like you', level: 'A2', language: 'Catalan' }, { OPENAI_API_KEY: 'k' });
        await fixPhrase({ text: 'I like you', level: 'A2' }, { OPENAI_API_KEY: 'k' });
        await toCatalan([{ text: 'I like it.', hint: 'phrase' }], { OPENAI_API_KEY: 'k' });
    });
    assert.deepEqual(systems.map(text => text.includes(CATALAN_RULE)), [true, false, true]);
    assert.match(CATALAN_RULE, /M'agrades/);
});

test('fixPhrase gives up quietly', async () => {
    assert.equal(await fixPhrase({ text: 'x', level: 'A2' }, {}), null); // no key: no call
    assert.equal(await withFetch(async () => new Response('no', { status: 500 }), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => { throw new Error('offline'); }, () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
    assert.equal(await withFetch(async () => new Response('{"choices":[{"message":{"content":"not json"}}]}'), () => fixPhrase({ text: 'x', level: 'A2' }, { OPENAI_API_KEY: 'k' })), null);
});
