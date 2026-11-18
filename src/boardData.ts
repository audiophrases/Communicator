// Where the page gets its board: the teacher's saved board, or the built-in one.

import { sanitizeBoard, type Board, type Word } from '../shared/board.ts';
import { DEFAULT_BOARD } from './vocab.ts';

const CACHE = 'board';

// Older boards predate full picture coverage. Match within the original page and word class so
// "break" in School gets a recess picture and "break" in Actions keeps its verb picture.
export function readBoard(value: unknown): Board | null {
    const board = sanitizeBoard(value);
    if (!board || board.pictureVersion === 2) return board;
    const fillBlanks = board.pictureVersion === undefined;
    function fill(words: Word[], defaults: Word[]) {
        for (const word of words) {
            if (!word.w || word.e) continue;
            if (word.s && !word.s.startsWith('bliss_')) continue;
            if (!word.s && !fillBlanks) continue;
            const match = defaults.find(item => item.w === word.w && item.k === word.k && (!word.ca || word.ca === item.ca));
            // Only replace the former default for this word. Keep a teacher's choice of a different sign.
            if (word.s && match?.s !== word.s.replace(/^bliss_/, 'scene_')) continue;
            if (match?.s) word.s = match.s;
            else if (match?.e) word.e = match.e;
        }
    }
    fill(board.core, DEFAULT_BOARD.core);
    for (const page of board.pages) {
        const original = DEFAULT_BOARD.pages.find(item => item.id === page.id);
        if (original) fill(page.words, original.words);
    }
    board.pictureVersion = 2;
    return board;
}

// The last board this device saw, so the page opens at once and works offline.
export function cachedBoard(): Board {
    try {
        return readBoard(JSON.parse(localStorage.getItem(CACHE) ?? 'null')) ?? DEFAULT_BOARD;
    } catch {
        return DEFAULT_BOARD;
    }
}

// The board to show now, or null when the server could not be reached.
export async function fetchBoard(): Promise<{ board: Board; custom: boolean } | null> {
    try {
        const response = await fetch('/api/board', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return null;
        const board = readBoard((await response.json()).board);
        try {
            if (board) localStorage.setItem(CACHE, JSON.stringify(board));
            else localStorage.removeItem(CACHE);
        } catch { /* private window: nothing is kept */ }
        return { board: board ?? DEFAULT_BOARD, custom: !!board };
    } catch {
        return null;
    }
}
