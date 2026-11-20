// /create: choose a picture for a button: a symbol, a photo or a GIF. It searches for the button's English word
// first, so a new button usually has its picture one click away. Symbols are searched here (their names and tags);
// photos and GIFs online, through PinPlay.

import { useEffect, useMemo, useRef, useState } from 'react';
import { symbolUrl } from '../shared/board.ts';
import { isUploadedImage } from '../shared/images.ts';
import { downloadPicture, searched, searchPictures, type FoundPicture, type OnlineSource } from './pictureSearch.ts';
import { usePictureUrl } from './uploadImage.ts';

type Source = 'symbols' | OnlineSource;
const SOURCES: { id: Source; name: string; placeholder: string }[] = [
    { id: 'symbols', name: 'Symbols', placeholder: 'Search symbols, e.g. apple, run, because' },
    { id: 'photos', name: 'Photos', placeholder: 'Search photos, e.g. apple, beach' },
    { id: 'gifs', name: 'GIFs', placeholder: 'Search GIFs, e.g. happy, dance' }
];
// The kind of picture chosen last stays selected for the next button.
let lastSource: Source = 'symbols';

type Entry = { n: string; t: string; c: string };

let index: Promise<Entry[]> | null = null;
const loadIndex = () => index ??= fetch('/symbols/index.json').then(response => response.ok ? response.json() : []).catch(() => []);

// "eat_,_to" → "eat (to …)", "shoe_-_mans" → "shoe - mans"
const symbolLabel = (name: string) => name.replace(/^(?:scene|bliss)_/, '').replace(/_,_to$/, ' (to …)').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

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

export function SymbolPicker({ value, word, onPick, onUpload, shared }: {
    value?: string; word: string; onPick: (name: string | undefined) => void; onUpload: (file: File) => void; shared: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const src = usePictureUrl(value);
    const uploaded = value?.startsWith('blob:') || isUploadedImage(value);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [query, setQuery] = useState<string | null>(null); // null: follow the button's English word
    const [source, setSource] = useState<Source>(lastSource);
    useEffect(() => { void loadIndex().then(setEntries); }, []);
    const shown = query ?? word;
    const results = useMemo(() => search(entries, shown), [entries, shown]);

    // Online, a search starts once typing pauses.
    const online = source === 'symbols' ? '' : shown.trim().toLowerCase().replace(/\s+/g, ' ');
    const [found, setFound] = useState<{ key: string; pictures?: FoundPicture[]; error?: string } | null>(null);
    useEffect(() => {
        if (source === 'symbols' || online.length < 2) return;
        let live = true;
        const timer = setTimeout(() => searchPictures(source, online).then(
            pictures => { if (live) setFound({ key: `${source}:${online}`, pictures }); },
            (error: Error) => { if (live) setFound({ key: `${source}:${online}`, error: error.message }); }
        ), searched(source, online) ? 0 : 600);
        return () => { live = false; clearTimeout(timer); };
    }, [source, online]);
    const current = found?.key === `${source}:${online}` ? found : null;
    const [adding, setAdding] = useState('');
    const [problem, setProblem] = useState('');
    async function add(picture: FoundPicture) {
        setAdding(picture.url);
        setProblem('');
        try { onUpload(await downloadPicture(picture)); }
        catch (error) { setProblem((error as Error).message); }
        finally { setAdding(''); }
    }

    return (
        <div className="symbol-picker">
            <div className="symbol-head">
                <b>Picture</b>
                {value
                    ? <span className="symbol-now"><img src={src} alt="" /> {uploaded ? 'Uploaded image' : symbolLabel(value)} <button className="link" onClick={() => onPick(undefined)}>Remove</button></span>
                    : <span className="symbol-now none">None: the emoji is shown</span>}
            </div>
            <input ref={input} type="file" hidden accept=".gif,.jpg,.jpeg,.png,.svg,image/gif,image/jpeg,image/png,image/svg+xml"
                aria-label="Choose image file" onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (file) onUpload(file);
                }} />
            <button type="button" onClick={() => input.current?.click()}>{uploaded ? 'Replace image' : 'Upload image'}</button>
            <small className="hint">GIF, JPG, PNG or SVG · Up to 5 MiB.{shared && ' Save publishes the picture to the public classroom repository.'}</small>
            <div className="picker-sources" role="group" aria-label="Kind of picture">
                {SOURCES.map(item => (
                    <button key={item.id} type="button" aria-pressed={source === item.id}
                        onClick={() => { setSource(item.id); lastSource = item.id; setProblem(''); }}>{item.name}</button>
                ))}
            </div>
            <input value={shown} onChange={event => setQuery(event.target.value)} placeholder={SOURCES.find(item => item.id === source)!.placeholder}
                aria-label={`Search ${source}`} />
            {source === 'symbols' ? (
                entries.length === 0 ? <p className="hint">Loading symbols…</p>
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
                )
            ) : online.length < 2 ? <p className="hint">Type a word to search.</p>
                : !current ? <p className="hint">Searching…</p>
                : current.error ? <p className="hint warn">{current.error}</p>
                : !current.pictures?.length ? <p className="hint">Nothing found. Try another word.</p>
                : (
                    <div className={`symbol-grid ${source}`} aria-busy={!!adding}>
                        {current.pictures.map(picture => (
                            <button key={picture.url} className={`symbol-choice web${adding === picture.url ? ' adding' : ''}`} title={picture.title}
                                disabled={!!adding} onClick={() => void add(picture)} aria-label={picture.title || 'Use this picture'}>
                                <img src={picture.thumb} alt="" loading="lazy" />
                            </button>
                        ))}
                    </div>
                )}
            {source !== 'symbols' && problem && <p className="hint warn">{problem}</p>}
            {source === 'photos' && <small className="hint">Photos from <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a>.</small>}
            {source === 'gifs' && <small className="hint">Powered by GIPHY.</small>}
        </div>
    );
}
