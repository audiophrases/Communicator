import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { LIMITS, sanitizeBoard, symbolUrl } from '../../shared/board.ts';
import { DEFAULT_BOARD } from '../../src/vocab.ts';
import { readBoard } from '../../src/boardData.ts';

const everyWord = () => [...DEFAULT_BOARD.core, ...DEFAULT_BOARD.pages.flatMap(page => page.words)].filter(word => word.w);

test("every built-in word has a picture and each SVG is in the board's symbol library", () => {
    const dir = new URL('../../mulberry-symbols/EN-symbols/', import.meta.url);
    const csv = fs.readFileSync(new URL('../../mulberry-symbols/symbol-info.csv', import.meta.url), 'utf8');
    const used = [...new Set(everyWord().filter(word => word.s).map(word => word.s))];
    assert.ok(used.length > 50);
    const own = new URL('../../own-symbols/', import.meta.url); // the app's own, for words Mulberry has no picture for
    const scenes = new URL('../../scene-symbols/', import.meta.url);
    assert.deepEqual(everyWord().filter(word => !word.s && !word.e).map(word => word.w), []);
    assert.deepEqual(used.filter(name => ![dir, own, scenes].some(root => fs.existsSync(new URL(`${name}.svg`, root)))), []);
    // The build serves only the own symbols vite.config.ts lists.
    const config = fs.readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    assert.deepEqual(fs.readdirSync(own).map(file => file.replace(/\.svg$/, '')).filter(name => !config.includes(`n: '${name}'`)), []);
    assert.deepEqual(used.filter(name => new RegExp(`,1,[^,]*,"?${name.replace(/[^\w]/g, '.')}"?,`).test(csv)), []);
    // A word with a symbol shows only the symbol.
    assert.deepEqual(everyWord().filter(word => word.s && word.e).map(word => word.w), []);
});

test('old boards gain missing vocabulary pictures and teachers can still remove them', () => {
    const old = { core: [{ w: 'because', k: 'little' }, { w: 'my', k: 'person', e: '⭐' }, { w: '', k: 'noun' }, { w: 'you', k: 'person' }],
        pages: [{ id: 'school', name: 'Class', icon: '🎓', words: [{ w: 'break', k: 'noun' }, { w: 'mean', k: 'describe' }] }], quick: [] };
    const board = readBoard(old);
    assert.equal(board.core[0].s, 'scene_because');
    assert.equal(board.core[1].e, '⭐');
    assert.deepEqual(board.core[2], { w: '', k: 'noun' });
    assert.equal(board.pages[0].words[0].s, 'break_time_1');
    assert.equal(board.pages[0].words[1].s, undefined);
    delete board.core[0].s;
    assert.deepEqual(readBoard(board), board);
});

test('saved boards gain the new scenes while keeping chosen pictures and deliberately blank buttons', () => {
    const board = readBoard({ pictureVersion: 1, core: [], quick: [], pages: [{ id: 'actions', name: 'Actions', words: [
        { w: 'sell', k: 'verb', s: 'bliss_sell' }, { w: 'spend', k: 'verb', s: 'bliss_business' }, { w: 'do', k: 'verb' }
    ] }] });
    assert.deepEqual(board.pages[0].words.map(word => word.s), ['scene_sell', 'bliss_business', undefined]);
    assert.equal(board.pictureVersion, 4);
    board.pages[0].words[0].s = 'bliss_sell';
    assert.deepEqual(readBoard(board), board);
});

test('no two different words share a picture', () => {
    const owners = new Map();
    for (const word of everyWord()) {
        const picture = word.s ? `symbol ${word.s}` : word.e ? `emoji ${word.e}` : '';
        if (!picture) continue;
        if (!owners.has(picture)) owners.set(picture, new Set());
        owners.get(picture).add(word.w.toLowerCase());
    }
    const shared = [...owners].filter(([, words]) => words.size > 1).map(([picture, words]) => `${picture}: ${[...words].join(', ')}`);
    assert.deepEqual(shared, []); // the same word on two pages (more, less, hurt) may repeat its picture
});

test('symbol names stay inside /symbols/', () => {
    const board = sanitizeBoard({ core: [{ w: 'eat', k: 'verb', s: 'eat_,_to' }, { w: 'x', k: 'verb', s: '../../etc/passwd' },
        { w: 'y', k: 'verb', s: 'a/b' }, { w: '', k: 'verb', s: 'eat_,_to' }, { w: 'z', k: 'noun', s: 'shoe_-_mans' }], pages: [], quick: [] });
    assert.deepEqual(board.core.map(word => word.s ?? null), ['eat_,_to', null, null, null, 'shoe_-_mans']);
    assert.equal(symbolUrl('glass_,_drinking'), '/symbols/glass_%2C_drinking.svg');
});

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
