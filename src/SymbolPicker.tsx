// /create: choose a Mulberry symbol for a button. It searches the symbols' names and tags, starting with the
// button's English word, so a new button usually has its symbol one click away.

import { useEffect, useMemo, useState } from 'react';
import { symbolUrl } from '../shared/board.ts';

type Entry = { n: string; t: string; c: string };

let index: Promise<Entry[]> | null = null;
const loadIndex = () => index ??= fetch('/symbols/index.json').then(response => response.ok ? response.json() : []).catch(() => []);

// "eat_,_to" → "eat (to …)", "shoe_-_mans" → "shoe - mans"
const symbolLabel =(name: string) => name.replace(/_,_to$/, ' (to …)').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

function search(entries: Entry[], query: string): Entry[] {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!q) return [];
    const scored: { entry: Entry; score: number }[] = [];
    for (const entry of entries) {
        const name = symbolLabel(entry.n).toLowerCase();
        const words = name.split(/[\s(),.-]+/);
        let score = 0;
        if (name === q || name === `${q} (to …)`) score = 100;
        else if (words.includes(q)) score = 60;
        else if (name.startsWith(q)) score = 40;
        else if (name.includes(q)) score = 20;
        else if (entry.t.toLowerCase().split(/\s+/).includes(q)) score = 10;
        else if (entry.c.toLowerCase().includes(q)) score = 5;
        if (score) scored.push({ entry, score: score - name.length / 100 });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 48).map(item => item.entry);
}

export function SymbolPicker({ value, word, onPick }: { value?: string; word: string; onPick: (name: string | undefined) => void }) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [query, setQuery] = useState<string | null>(null); // null: follow the button's English word
    useEffect(() => { void loadIndex().then(setEntries); }, []);
    const shown = query ?? word;
    const results = useMemo(() => search(entries, shown), [entries, shown]);

    return (
        <div className="symbol-picker">
            <div className="symbol-head">
                <b>Symbol</b>
                {value
                    ? <span className="symbol-now"><img src={symbolUrl(value)} alt="" /> {symbolLabel(value)} <button className="link" onClick={() => onPick(undefined)}>Remove</button></span>
                    : <span className="symbol-now none">None: the emoji is shown</span>}
            </div>
            <input value={shown} onChange={event => setQuery(event.target.value)} placeholder="Search Mulberry symbols, e.g. apple, run, happy" aria-label="Search symbols" />
            {entries.length === 0 ? <p className="hint">Loading symbols…</p>
                : results.length === 0 ? <p className="hint">{shown.trim() ? 'No symbol found. Try another word, or keep the emoji.' : 'Type a word to find a symbol.'}</p>
                : (
                    <div className="symbol-grid">
                        {results.map(entry => (
                            <button key={entry.n} className={`symbol-choice${entry.n === value ? ' on' : ''}`} onClick={() => onPick(entry.n)} title={`${symbolLabel(entry.n)} · ${entry.c}`}>
                                <img src={symbolUrl(entry.n)} alt="" loading="lazy" />
                                <span>{symbolLabel(entry.n)}</span>
                            </button>
                        ))}
                    </div>
                )}
        </div>
    );
}
