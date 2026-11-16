import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS, sanitizeBoard } from '../../shared/board.ts';
import { DEFAULT_BOARD } from '../../src/vocab.ts';

test('the built-in board is valid and every button has Catalan', () => {
    const board = sanitizeBoard(DEFAULT_BOARD);
    assert.ok(board);
    assert.equal(board.core.length, 60);
    assert.equal(board.pages.length, DEFAULT_BOARD.pages.length);
    assert.ok(JSON.stringify(board).length < LIMITS.json);
    const missing = [
        ...board.core.filter(word => word.w && !word.ca).map(word => word.w),
        ...board.pages.filter(page => !page.ca).map(page => `page ${page.name}`),
        ...board.pages.flatMap(page => page.words.filter(word => !word.ca).map(word => `${page.name}: ${word.w}`)),
        ...board.quick.filter(phrase => !phrase.ca).map(phrase => phrase.t)
    ];
    assert.deepEqual(missing, []);
    for (const page of board.pages) assert.equal(page.words.length, DEFAULT_BOARD.pages.find(item => item.id === page.id).words.length);
});

test('sanitizeBoard keeps empty core slots in place but drops empty page buttons', () => {
    const board = sanitizeBoard({
        core: [{ w: 'I', k: 'person', ca: 'jo' }, { w: '', k: 'verb', e: '🍎', ca: 'x' }, { w: 'go', k: 'verb' }, { w: '' }, { w: '  ' }],
        pages: [
            { id: 'food', name: 'Food', icon: '🍎', words: [{ w: 'apple', k: 'noun' }, { w: '', k: 'noun' }, { w: 'tea', k: 'nonsense' }] },
            { id: 'food', name: 'Food 2', words: [] },
            { id: 'x', name: '', words: [] },
            'junk'
        ],
        quick: [{ t: 'Hello!', ca: 'Hola!' }, { t: '' }, { t: '  Thanks   a lot ' }, null]
    });
    assert.deepEqual(board.core, [{ w: 'I', k: 'person', ca: 'jo' }, { w: '', k: 'verb' }, { w: 'go', k: 'verb' }]);
    assert.deepEqual(board.pages.map(page => [page.id, page.name, page.icon, page.words.length]), [['food', 'Food', '🍎', 2], ['food-2', 'Food 2', '📄', 0]]);
    assert.equal(board.pages[0].words[1].k, 'noun');
    assert.deepEqual(board.quick, [{ t: 'Hello!', ca: 'Hola!' }, { t: 'Thanks a lot' }]);
});

test('sanitizeBoard refuses what is not a board and caps sizes', () => {
    assert.equal(sanitizeBoard(null), null);
    assert.equal(sanitizeBoard({ core: [], pages: {} , quick: [] }), null);
    const big = sanitizeBoard({ core: Array.from({ length: 200 }, () => ({ w: 'x'.repeat(99), k: 'noun' })), pages: [], quick: [] });
    assert.equal(big.core.length, LIMITS.core);
    assert.equal(big.core[0].w.length, LIMITS.word);
});
