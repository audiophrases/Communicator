// Finding buttons by what is typed, in English or Catalan. Used by the board (buttons appear under the text box as
// you type) and by the editor's "Find a button".
//
// A query matches from the start of a word: "wa" finds "want" and "water", "stop" finds "bus stop". "?" stands for one
// letter and "*" for any number of them ("h?t" finds "hot" and "hat", "*ppy" finds "happy"). Capitals and accents do
// not matter ("germa" finds "germà"). The forms of a Catalan verb find its button too ("plou" finds rain: pluja /
// ploure). After these come buttons spelt nearly like the query ("watter" finds water, "plutja" finds rain).

import type { Board, Word } from '../shared/board.ts';
import { verbForms } from './catalanVerbs.ts';
import { MORE } from './vocabMore.ts';

// near: spelt nearly like the query, not matching it. Enter does not pick one unless it was chosen.
export type Hit = { word: Word; page: string; pageName: string; index: number; near?: true };

// The A2 and B1 words (src/vocabMore.ts), by English and colour: among equal matches they come after the everyday
// ones, so "wa" still offers want, water and wait before war, warn and wave.
const LATER = new Set(Object.values(MORE).flatMap(rows => rows.flatMap(([kind, items]) =>
    items.split('|').map(item => `${item.split('=')[0]}|${kind}`))));

// Lower case, without accents, one kind of apostrophe.
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’`]/g, "'").trim();

// The query as a pattern for the start of a text: "h?t" → /^h.t/.
function pattern(query: string): RegExp | null {
    const q = fold(query).replace(/\s+/g, ' ');
    if (!q.replace(/[?*\s]/g, '')) return null; // only wildcards: everything would match
    const body = q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\?/g, '.').replace(/\*/g, '.*');
    return new RegExp(`^${body}`);
}

// Each button once per board, with its texts ready to search. The board is replaced, never changed, when edited.
type Entry = Hit & {
    english: string; englishLater: string[]; catalan: string[]; catalanLater: string[]; forms: string[];
    englishAll: string[]; catalanAll: string[]; // the words compared for spelling
    rank: number; // core words (the most used) first, then the other A1 words, then shorter ones
};
const entries = new WeakMap<Board, Entry[]>();

function entriesOf(board: Board): Entry[] {
    let list = entries.get(board);
    if (list) return list;
    list = [];
    const places = [{ page: 'core', pageName: 'Core', words: board.core }, ...board.pages.map(page => ({ page: page.id, pageName: page.name, words: page.words }))];
    for (const { page, pageName, words } of places) {
        words.forEach((word, index) => {
            if (!word.w) return;
            const english = fold(word.w);
            const alternatives = (word.ca ?? '').replace(/[()]/g, '').split(/\s*\/\s*/).map(text => text.trim()).filter(Boolean);
            const catalan = alternatives.map(fold);
            const englishLater = english.split(/[\s-]+/).slice(1);
            const catalanLater = catalan.flatMap(text => text.split(/[\s'-]+/).slice(1));
            list!.push({
                word, page, pageName, index, english, catalan, englishLater, catalanLater,
                englishAll: [english, ...englishLater], catalanAll: [...catalan, ...catalanLater],
                // A verb's Catalan, and the verb after a noun's ("neu / nevar": the board writes a word that is both
                // as noun / verb).
                forms: alternatives.flatMap((text, i) => word.k === 'verb' || i > 0 ? verbForms(text, word.k === 'verb') : []).map(fold),
                rank: (page === 'core' ? 5 : 0) - (LATER.has(`${word.w}|${word.k}`) ? 1 : 0) - word.w.length / 100
            });
        });
    }
    entries.set(board, list);
    return list;
}

// How well a button matches: 0 for not at all. Its whole English word beats its whole Catalan (each "/"
// alternative), which beats the start of the English: a student typing "com" means how (com), not come, company and
// the twenty other English words that start with it. Then a later English word, the start of the Catalan and a later
// word in it, then a form of its verb.
function score(entry: Entry, start: RegExp, whole: RegExp): number {
    if (whole.test(entry.english)) return 100;
    if (entry.catalan.some(text => whole.test(text))) return 90;
    if (start.test(entry.english)) return 80;
    if (entry.englishLater.some(part => start.test(part))) return 60;
    if (entry.catalan.some(text => start.test(text))) return 50;
    if (entry.catalanLater.some(part => start.test(part))) return 40;
    if (entry.forms.some(text => whole.test(text))) return 35;
    if (entry.forms.some(text => start.test(text))) return 30;
    return 0;
}

// How many letters may be wrong, missing, extra or swapped for a button to be spelt nearly like the query.
const slack = (query: string) => query.length < 4 ? 0 : query.length < 6 ? 1 : 2;

// The fewest changes that turn the query into the start of the text (a swap of two letters is one), or more than
// most when it is further. It runs for every button at each letter typed, so it reuses three rows.
let rows = [new Int32Array(64), new Int32Array(64), new Int32Array(64)];
function distance(query: string, text: string, most: number): number {
    if (text.length < query.length - most) return most + 1;
    const width = Math.min(text.length, query.length + most);
    if (rows[0].length <= width) rows = rows.map(() => new Int32Array(width * 2));
    let [before, previous, row] = rows;
    for (let j = 0; j <= width; j++) previous[j] = j;
    let best = 0;
    for (let i = 1; i <= query.length; i++) {
        row[0] = best = i;
        for (let j = 1; j <= width; j++) {
            let value = previous[j - 1] + (query[i - 1] === text[j - 1] ? 0 : 1);
            if (previous[j] + 1 < value) value = previous[j] + 1;
            if (row[j - 1] + 1 < value) value = row[j - 1] + 1;
            if (i > 1 && j > 1 && query[i - 1] === text[j - 2] && query[i - 2] === text[j - 1] && before[j - 2] + 1 < value) value = before[j - 2] + 1;
            row[j] = value;
            if (value < best) best = value;
        }
        if (best > most) return most + 1;
        [before, previous, row] = [previous, row, before];
    }
    best = most + 1;
    for (let j = 0; j <= width; j++) if (previous[j] < best) best = previous[j];
    return best;
}

const NEAR = 4; // buttons spelt nearly like the query, after the ones that match it

// Every button that matches, best first, then a few spelt nearly like the query. distinct: show a word once even if
// it is on Core and on a page (the board); otherwise each place it is (the editor, to edit that one).
export function findButtons(board: Board, query: string, { limit = 12, distinct = true } = {}): Hit[] {
    const start = pattern(query);
    if (!start) return [];
    const whole = new RegExp(`${start.source}$`);
    const typed = fold(query);
    // One plain word: no wildcards, no spaces.
    const most = /^[\p{L}']+$/u.test(typed) ? slack(typed) : 0;
    const hits: { entry: Entry; score: number }[] = [];
    const near: { entry: Entry; score: number }[] = [];
    for (const entry of entriesOf(board)) {
        const value = score(entry, start, whole);
        if (value) { hits.push({ entry, score: value + entry.rank }); continue; }
        if (!most) continue;
        // English before Catalan when as near.
        let english = most + 1;
        for (const text of entry.englishAll) english = Math.min(english, distance(typed, text, most));
        let catalan = most + 1;
        for (const text of entry.catalanAll) catalan = Math.min(catalan, distance(typed, text, most));
        const changes = Math.min(english, catalan);
        if (changes <= most) near.push({ entry, score: -100 * changes + (english <= catalan ? 2 : 0) + entry.rank });
    }
    // A stable sort: among equal scores, the board's order.
    hits.sort((a, b) => b.score - a.score);
    near.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const out: Hit[] = [];
    const add = ({ word, page, pageName, index }: Entry, max: number, nearly: boolean) => {
        const key = `${word.w}|${word.k}|${word.s ?? word.e ?? ''}`;
        if (out.length >= max || (distinct && seen.has(key))) return;
        seen.add(key);
        out.push({ word, page, pageName, index, ...(nearly ? { near: true as const } : {}) });
    };
    for (const { entry } of hits) add(entry, limit, false);
    const matched = out.length;
    for (const { entry } of near) add(entry, matched + NEAR, true);
    return out;
}

// A sentence put back in the bar (a story line, a suggestion, a phrase) as the buttons it is made of. A word or a run
// of words that is a button ("bus stop", "Thank you.") gets that button's picture, the core's first. A form no button
// has ("went", "friends") stays a typed word with no picture. A question mark ends its word as the ? key does, so the
// bar writes the sentence back the same: "coffee?" is "coffee" and "?".
export type SentenceWord = { w: string; e?: string; s?: string; typed?: true };
const unpunctuated = (text: string) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || text;
const capital = (text: string) => /^\p{Lu}/u.test(text);

export function sentenceWords(board: Board, text: string): SentenceWord[] {
    const buttons = new Map<string, Word[]>();
    let longest = 1;
    for (const word of [...board.core, ...board.pages.flatMap(page => page.words)]) {
        if (!word.w) continue;
        const key = fold(unpunctuated(word.w));
        buttons.set(key, [...buttons.get(key) ?? [], word]);
        longest = Math.max(longest, key.split(' ').length);
    }
    const parts = text.trim().split(/\s+/).filter(Boolean).flatMap(part => /^[^?]+\?$/.test(part) ? [part.slice(0, -1), '?'] : [part]);
    const words: SentenceWord[] = [];
    for (let i = 0; i < parts.length;) {
        let match: { word: Word; length: number } | undefined;
        for (let length = Math.min(longest, parts.length - i); length > 0 && !match; length--) {
            // A run of words is words: "coffee" and "?" are two buttons, not "coffee ?".
            if (length > 1 && parts.slice(i, i + length).some(part => !/[\p{L}\p{N}]/u.test(part))) continue;
            const span = unpunctuated(parts.slice(i, i + length).join(' '));
            // "Turkey" and "May" are buttons; "turkey" and "may" are other words.
            const word = buttons.get(fold(span))?.find(item => !capital(item.w) || capital(span));
            if (word) match = { word, length };
        }
        if (!match) { words.push({ w: parts[i++], typed: true }); continue; }
        const { word: { e, s }, length } = match;
        words.push({ w: parts.slice(i, i + length).join(' '), ...(e ? { e } : {}), ...(s ? { s } : {}) });
        i += length;
    }
    return words;
}

// What to search for while typing: the last word, or the last two or three when they start a longer button
// ("bus st" → "bus stop"). Returns the query and how many typed words it covers.
export function typedQuery(board: Board, draft: string): { query: string; words: number; hits: Hit[] } | null {
    if (!draft.trim() || /\s$/.test(draft)) return null; // nothing typed, or a word just finished
    const words = draft.trim().split(/\s+/);
    for (let n = Math.min(3, words.length); n >= 1; n--) {
        const query = words.slice(-n).join(' ');
        const hits = findButtons(board, query);
        if (hits.length && (n === 1 || hits.some(hit => fold(hit.word.w).includes(' ') || fold(hit.word.ca ?? '').includes(' ')))) {
            return { query, words: n, hits };
        }
    }
    return null;
}
