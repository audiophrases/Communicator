// The board's buttons as data: the page shows it, the teacher edits it at /create, and the Worker keeps it.
// Colours follow the modified Fitzgerald key.

export type Kind = 'person' | 'verb' | 'describe' | 'noun' | 'little' | 'question' | 'social' | 'no';
// w: the English word ('' is an empty core slot, so the words around it keep their place). e: emoji. ca: Catalan.
// s: a Mulberry symbol (its file name in mulberry-symbols/EN-symbols, served at /symbols/<s>.svg); shown instead of e.
export type Word = { w: string; e?: string; k: Kind; ca?: string; s?: string };
export type Page = { id: string; name: string; ca?: string; icon: string; words: Word[] };
export type Phrase = { t: string; ca?: string };
export type Board = { core: Word[]; pages: Page[]; quick: Phrase[] };

export const KINDS: { kind: Kind; name: string }[] = [
    { kind: 'person', name: 'People (yellow)' }, { kind: 'verb', name: 'Actions (green)' },
    { kind: 'describe', name: 'Describing (blue)' }, { kind: 'noun', name: 'Things and places (orange)' },
    { kind: 'question', name: 'Questions (purple)' }, { kind: 'social', name: 'Social (pink)' },
    { kind: 'no', name: 'No and not (red)' }, { kind: 'little', name: 'Little words (grey)' }
];

// A page's colour for its tab: the colour most of its words have (on a tie, the one that comes first), so a page
// of actions is green like its buttons. None for an empty page.
export function pageKind(words: Word[]): Kind | undefined {
    const counts = new Map<Kind, number>();
    for (const word of words) if (word.w) counts.set(word.k, (counts.get(word.k) ?? 0) + 1);
    let best: Kind | undefined;
    let most = 0;
    for (const [kind, count] of counts) if (count > most) { best = kind; most = count; }
    return best;
}

export const LIMITS = { core: 80, pages: 16, words: 120, quick: 80, word: 40, emoji: 16, ca: 80, phrase: 200, phraseCa: 300, name: 24, json: 120_000 };

const isKind = (value: unknown): value is Kind => KINDS.some(item => item.kind === value);
const str = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';

// Mulberry file names: letters, digits, "_", ",", "-" and spaces (e.g. "glass_,_drinking", "shoe_-_mans"). Nothing that
// could leave /symbols/.
export const isSymbolName = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_,\- ]{1,80}$/.test(value);
export const symbolUrl = (name: string) => `/symbols/${encodeURIComponent(name)}.svg`;

function word(value: unknown, allowEmpty: boolean): Word | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    const w = str(item.w, LIMITS.word);
    if (!w && !allowEmpty) return null;
    const e = str(item.e, LIMITS.emoji);
    const ca = str(item.ca, LIMITS.ca);
    const s = isSymbolName(item.s) ? item.s : '';
    return { w, k: isKind(item.k) ? item.k : 'noun', ...(e && w ? { e } : {}), ...(ca && w ? { ca } : {}), ...(s && w ? { s } : {}) };
}

// A clean copy of a board from the network or storage, or null when it is not a board.
export function sanitizeBoard(value: unknown): Board | null {
    if (!value || typeof value !== 'object') return null;
    const input = value as Record<string, unknown>;
    if (!Array.isArray(input.core) || !Array.isArray(input.pages) || !Array.isArray(input.quick)) return null;
    const core = input.core.slice(0, LIMITS.core).map(item => word(item, true)).filter((item): item is Word => !!item);
    const ids = new Set<string>();
    const pages: Page[] = [];
    for (const raw of input.pages.slice(0, LIMITS.pages)) {
        if (!raw || typeof raw !== 'object') continue;
        const page = raw as Record<string, unknown>;
        const name = str(page.name, LIMITS.name);
        let id = str(page.id, 40).replace(/[^\w-]/g, '') || 'page';
        if (!name || !Array.isArray(page.words)) continue;
        while (ids.has(id)) id += '-2';
        ids.add(id);
        const ca = str(page.ca, LIMITS.name);
        pages.push({
            id, name, icon: str(page.icon, LIMITS.emoji) || '📄', ...(ca ? { ca } : {}),
            words: page.words.slice(0, LIMITS.words).map(item => word(item, false)).filter((item): item is Word => !!item)
        });
    }
    const quick: Phrase[] = [];
    for (const raw of input.quick.slice(0, LIMITS.quick)) {
        const t = str((raw as Phrase)?.t, LIMITS.phrase);
        const ca = str((raw as Phrase)?.ca, LIMITS.phraseCa);
        if (t) quick.push({ t, ...(ca ? { ca } : {}) });
    }
    // Trailing empty core slots hold nothing in place.
    while (core.length && !core[core.length - 1].w) core.pop();
    return { core, pages, quick };
}
