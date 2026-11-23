// Where the page gets its board: the teacher's saved board, or the built-in one.

import { linkCoreWords, sanitizeBoard, type Board, type Word } from '../shared/board.ts';
import { DEFAULT_BOARD } from './vocab.ts';
import type { BoardSync, Status } from '../shared/options.ts';

function readStatus(header: string | null): Status | null {
    try {
        const value = JSON.parse(header ?? 'null') as Status | null;
        return typeof value?.fix === 'boolean' ? value : null;
    } catch { return null; }
}

const CACHE = 'board';

// Older boards predate full picture coverage. Match within the original page and word class so
// "break" in School gets a recess picture and "break" in Actions keeps its verb picture.
export function readBoard(value: unknown): Board | null {
    const board = sanitizeBoard(value);
    if (!board || board.pictureVersion === 4) return board;
    const previousVersion = board.pictureVersion;
    function fill(words: Word[], defaults: Word[]) {
        for (const word of words) {
            if (word.w === 'too' && word.k === 'describe' && word.e === '🥛💦' && !word.s) {
                delete word.e;
                word.s = 'scene_too';
            }
            if (previousVersion === 3) continue;
            if (word.w === 'arrive' && word.k === 'verb' && word.e === '🛬' && !word.s) {
                delete word.e;
                word.s = 'scene_arrive';
            }
            if (previousVersion === 2) continue;
            if (!word.w || word.e) continue;
            if (word.s && !word.s.startsWith('bliss_')) continue;
            if (!word.s && previousVersion !== undefined) continue;
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
        fill(page.words, original?.words ?? []);
    }
    linkCoreWords(board);
    board.pictureVersion = 4;
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

// The board to show now, or null when it has not changed or the server could not be reached. Every answer also
// says whether Fix is on, for onStatus (null from an older server, which says it at /api/status instead).
// warmVoice: the board has just opened, so the Worker may wake the voice bridge.
export async function fetchBoard(knownRevision?: string, { warmVoice = false, onStatus }: {
    warmVoice?: boolean; onStatus?: (status: Status | null) => void;
} = {}): Promise<({ board: Board; custom: boolean } & BoardSync) | null> {
    try {
        const response = await fetch(warmVoice ? '/api/board?warmVoice=1' : '/api/board', {
            headers: knownRevision ? { 'If-None-Match': `"${knownRevision}"` } : {},
            signal: AbortSignal.timeout(8000)
        });
        onStatus?.(readStatus(response.headers.get('X-Status')));
        if (response.status === 304) return null;
        if (!response.ok) return null;
        const { board: raw, revision, sync } = await response.json();
        const board = readBoard(raw);
        try {
            if (board) localStorage.setItem(CACHE, JSON.stringify(board));
            else localStorage.removeItem(CACHE);
        } catch { /* private window: nothing is kept */ }
        return { board: board ?? DEFAULT_BOARD, custom: !!board, revision, sync };
    } catch {
        return null;
    }
}
