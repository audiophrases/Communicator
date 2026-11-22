import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findButtons, fold, sentenceWords, typedQuery } from '../../src/search.ts';
import { DEFAULT_BOARD } from '../../src/vocab.ts';

const words = (query, options) => findButtons(DEFAULT_BOARD, query, options).map(hit => hit.word.w);

test('a few letters find the buttons that start with them, best first', () => {
    const wa = words('wa');
    assert.ok(['want', 'water', 'wait', 'walk', 'wash'].every(w => wa.includes(w)), wa.join(', '));
    assert.equal(words('want')[0], 'want');
    assert.equal(words('wa')[0], 'want'); // a core word before "was", so Tab picks the useful one
    assert.equal(words('eat')[0], 'eat'); // the whole word before longer ones
    assert.ok(words('stop').includes('bus stop')); // a later word of a button
});

test('Catalan finds the English button, with or without accents', () => {
    assert.equal(words('menjar')[0], 'eat');
    assert.ok(words('lavabo').includes('bathroom'));
    assert.ok(words('germa').includes('brother'));
    assert.ok(words('estomac').includes('stomach'));
    assert.ok(words('meva').includes('my')); // "el meu / la meva"
    assert.ok(words("d'hora").includes('early'));
});

test('? is one letter, * is any number of letters', () => {
    const hot = words('h?t');
    assert.ok(hot.includes('hot') && hot.includes('hurt') === false, hot.join(', '));
    assert.ok(words('*ppy').includes('happy'));
    assert.ok(words('t*ed').includes('tired'));
    assert.deepEqual(words('*'), []); // wildcards alone find nothing
    assert.deepEqual(words('??'), []);
});

test('the board shows a word once; the editor shows every place it is', () => {
    assert.equal(words('want').filter(w => w === 'want').length, 1);
    const places = findButtons(DEFAULT_BOARD, 'want', { distinct: false }).filter(hit => hit.word.w === 'want').map(hit => hit.page);
    assert.deepEqual(places, ['core', 'actions']);
});

test('typing searches the last word, or the last words when they start a longer button', () => {
    assert.equal(typedQuery(DEFAULT_BOARD, 'I wa').query, 'wa');
    assert.equal(typedQuery(DEFAULT_BOARD, 'I wa').words, 1);
    const bus = typedQuery(DEFAULT_BOARD, 'where bus st');
    assert.deepEqual([bus.query, bus.words, bus.hits[0].word.w], ['bus st', 2, 'bus stop']);
    assert.equal(typedQuery(DEFAULT_BOARD, 'I want '), null); // a word just finished
    assert.equal(typedQuery(DEFAULT_BOARD, ''), null);
    assert.equal(typedQuery(DEFAULT_BOARD, 'zzqx'), null);
    assert.equal(fold(' Germà '), 'germa');
});

test('a sentence put back in the bar keeps the pictures of the buttons it is made of', () => {
    const pictured = text => sentenceWords(DEFAULT_BOARD, text).map(word => `${word.w}${word.typed ? '' : '*'}`);
    // "went" and "friends" are forms no button has: typed words, no picture. "bus stop" is one button.
    assert.deepEqual(pictured('Yesterday I went to the bus stop with my friends.'),
        ['Yesterday*', 'I*', 'went', 'to*', 'the*', 'bus stop*', 'with*', 'my*', 'friends.']);
    const coffee = sentenceWords(DEFAULT_BOARD, 'Do you want coffee?');
    assert.deepEqual(coffee.map(word => word.w), ['Do', 'you', 'want', 'coffee', '?']);
    assert.equal(coffee[3].e, '☕');
    assert.ok(!coffee[4].typed); // the ? key
    // The bar writes it back as it was: "coffee ?" → "coffee?".
    assert.equal(coffee.map(word => word.w).join(' ').replace(/ \?/g, '?'), 'Do you want coffee?');
    assert.deepEqual(pictured('Thank you.'), ['Thank you.*']);
    // A name's button only for the name: "May" is the month, "may" is not.
    assert.deepEqual(pictured('In May you may go.'), ['In*', 'May*', 'you*', 'may', 'go.*']);
    assert.equal(pictured('No, problem')[0], 'No,*'); // a comma ends a run: not the "no problem" button
});
