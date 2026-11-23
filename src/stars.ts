// Core is the starred buttons. Every button lives on a page; starring it also puts it in a Core slot, where it keeps
// its place so hands learn where it is. A saved board has a copy in each place, kept alike by shared/board.ts.
// In the editor a starred button is one object in Core and on its page (structuredClone keeps it one), so a change
// in either place is a change to both.

import { LIMITS, sameButton, type Board, type Word } from '../shared/board.ts';

// One object per button: Core holds its page button, and a second page copy (hot on Describe and Nature) is it too.
// A core word on no page (a board from before stars) stays as it is.
export function linkStars(board: Board): Board {
    const onPages = board.pages.flatMap(page => page.words);
    board.core = board.core.map(word => onPages.find(item => sameButton(item, word)) ?? word);
    for (const page of board.pages) page.words = page.words.map(word => board.core.find(item => sameButton(item, word)) ?? word);
    return board;
}

const isIt = (word: Word) => (item: Word) => item === word || sameButton(item, word);
export const coreSlot = (board: Board, word: Word) => board.core.findIndex(isIt(word));
export const coreFull = (board: Board) => board.core.length >= LIMITS.core && board.core.every(item => item.w);

// Into the first empty Core slot, or a new one at the end.
export function star(board: Board, word: Word) {
    const slot = board.core.findIndex(item => !item.w);
    if (slot >= 0) board.core[slot] = word;
    else if (board.core.length < LIMITS.core) board.core.push(word);
}

// Its Core slot is left empty, so the other core words stay where they are.
export function unstar(board: Board, word: Word) {
    board.core = board.core.map(item => isIt(word)(item) ? { w: '', k: item.k } : item);
}

// A starred button taken off every page leaves Core too.
export function unstarRemoved(board: Board, removed: Word[]) {
    for (const word of removed) if (!board.pages.some(page => page.words.some(isIt(word)))) unstar(board, word);
}

// A page button given a starred button's English and colour becomes that button, with its picture and Catalan, as it
// will be once saved. Done when the teacher moves on, not while typing: "today" passes through "to".
export function joinStarred(board: Board, tab: string, index: number): Board {
    const p = board.pages.findIndex(page => page.id === tab);
    const word = board.pages[p]?.words[index];
    const c = word ? board.core.findIndex(item => item !== word && sameButton(item, word)) : -1;
    if (c < 0) return board;
    const next = structuredClone(board);
    next.pages[p].words[index] = next.core[c];
    return next;
}
