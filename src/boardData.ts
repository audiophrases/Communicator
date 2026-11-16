// Where the page gets its board: the teacher's saved board, or the built-in one.

import { sanitizeBoard, type Board } from '../shared/board.ts';
import { DEFAULT_BOARD } from './vocab.ts';

const CACHE = 'board';

// The last board this device saw, so the page opens at once and works offline.
export function cachedBoard(): Board {
    try {
        return sanitizeBoard(JSON.parse(localStorage.getItem(CACHE) ?? 'null')) ?? DEFAULT_BOARD;
    } catch {
        return DEFAULT_BOARD;
    }
}

// The board to show now, or null when the server could not be reached.
export async function fetchBoard(): Promise<{ board: Board; custom: boolean } | null> {
    try {
        const response = await fetch('/api/board', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return null;
        const board = sanitizeBoard((await response.json()).board);
        try {
            if (board) localStorage.setItem(CACHE, JSON.stringify(board));
            else localStorage.removeItem(CACHE);
        } catch { /* private window: nothing is kept */ }
        return { board: board ?? DEFAULT_BOARD, custom: !!board };
    } catch {
        return null;
    }
}
