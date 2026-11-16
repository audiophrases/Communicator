import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newSession, passwordMatches, sessionValid, sha256Hex } from '../teacher.ts';
import { toCatalan } from '../translate.ts';

test('the password uses the PinPlay scheme', async () => {
    const hash = await sha256Hex('café secret'.normalize('NFC'));
    assert.equal(await passwordMatches('  café secret ', hash), true);
    assert.equal(await passwordMatches('café secret', hash.toUpperCase()), true); // NFC and any case of hex
    assert.equal(await passwordMatches('wrong', hash), false);
    assert.equal(await passwordMatches('', hash), false);
    assert.equal(await passwordMatches('café secret', ''), false);
    assert.equal(await passwordMatches(42, hash), false);
});

test('sessions are signed, expire, and end when the password changes', async () => {
    const hash = await sha256Hex('one');
    const now = 1_800_000_000_000;
    const token = await newSession(hash, now);
    assert.equal(await sessionValid(token, hash, now + 1000), true);
    assert.equal(await sessionValid(token, hash, now + 13 * 3600_000), false);
    assert.equal(await sessionValid(token, await sha256Hex('two'), now), false);
    const [time, signature] = token.split('.');
    assert.equal(await sessionValid(`${Number(time) + 1}.${signature}`, hash, now), false);
    assert.equal(await sessionValid(`${time}.${signature}.x`, hash, now), false);
    assert.equal(await sessionValid('', hash, now), false);
    assert.equal(await sessionValid(token, undefined, now), false);
});

test('toCatalan returns one answer per item, or null', async () => {
    const real = globalThis.fetch;
    let sent;
    try {
        globalThis.fetch = async (url, init) => {
            sent = JSON.parse(init.body);
            return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations: [' feina ', 'Hola!'] }) } }] }));
        };
        const items = [{ text: 'work', hint: 'noun on the Places page' }, { text: 'Hello!' }];
        assert.deepEqual(await toCatalan(items, { OPENAI_API_KEY: 'k' }), ['feina', 'Hola!']);
        assert.deepEqual(JSON.parse(sent.messages[1].content), { items });
        assert.equal(await toCatalan([{ text: 'one' }], { OPENAI_API_KEY: 'k' }), null); // two answers for one item
        assert.equal(await toCatalan(items, {}), null);
    } finally {
        globalThis.fetch = real;
    }
});
