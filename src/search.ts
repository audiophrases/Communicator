// Finding buttons by what is typed, in English or Catalan. Used by the board (buttons appear under the text box as
// you type) and by the editor's "Find a button".
//
// A query matches from the start of a word: "wa" finds "want" and "water", "stop" finds "bus stop". "?" stands for one
// letter and "*" for any number of them ("h?t" finds "hot" and "hat", "*ppy" finds "happy"). Capitals and accents do
// not matter ("germa" finds "germà").

import type { Board, Word } from '../shared/board.ts';
import { MORE } from './vocabMore.ts';

export type Hit = { word: Word; page: string; pageName: string; index: number };

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

// How well a button matches: 0 for not at all. Its whole English word beats the start of it, which beats a later
// word in it; then the same for its Catalan (each "/" alternative and each word in it).
function score(word: Word, start: RegExp, whole: RegExp): number {
    const english = fold(word.w);
    if (whole.test(english)) return 100;
    if (start.test(english)) return 80;
    if (english.split(/[\s-]+/).slice(1).some(part => start.test(part))) return 60;
    if (!word.ca) return 0;
    const alternatives = fold(word.ca).replace(/[()]/g, '').split(/\s*\/\s*/);
    if (alternatives.some(text => whole.test(text))) return 70;
    if (alternatives.some(text => start.test(text))) return 50;
    if (alternatives.some(text => text.split(/[\s'-]+/).slice(1).some(part => start.test(part)))) return 40;
    return 0;
}

// Every button that matches, best first. distinct: show a word once even if it is on Core and on a page (the board);
// otherwise each place it is (the editor, to edit that one).
export function findButtons(board: Board, query: string, { limit = 12, distinct = true } = {}): Hit[] {
    const start = pattern(query);
    if (!start) return [];
    const whole = new RegExp(`${start.source}$`);
    const hits: (Hit & { score: number; order: number })[] = [];
    const places: { page: string; pageName: string; words: Word[] }[] = [
        { page: 'core', pageName: 'Core', words: board.core }, ...board.pages.map(page => ({ page: page.id, pageName: page.name, words: page.words }))
    ];
    for (const place of places) {
        place.words.forEach((word, index) => {
            if (!word.w) return;
            const value = score(word, start, whole);
            // Among equal matches, core words (the most used) first, then the other A1 words, then shorter ones: Tab
            // picks the first.
            if (value) hits.push({ word, page: place.page, pageName: place.pageName, index, order: hits.length,
                score: value + (place.page === 'core' ? 5 : 0) - (LATER.has(`${word.w}|${word.k}`) ? 1 : 0) - word.w.length / 100 });
        });
    }
    hits.sort((a, b) => b.score - a.score || a.order - b.order);
    const seen = new Set<string>();
    const out: Hit[] = [];
    for (const { score: _score, order: _order, ...hit } of hits) {
        const key = `${hit.word.w}|${hit.word.k}|${hit.word.s ?? hit.word.e ?? ''}`;
        if (distinct && seen.has(key)) continue;
        seen.add(key);
        out.push(hit);
        if (out.length === limit) break;
    }
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
