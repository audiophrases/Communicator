import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, LEVELS, MAX_TEXT, isLanguage, isLevel, type Fix, type Level, type Status } from '../shared/options.ts';
import { DEFAULT_VOICE, ENGLISH_VOICES, RATES, isEnglishVoice } from '../shared/voices.ts';
import { pageKind, type Board, type Kind, type Word } from '../shared/board.ts';
import { cachedBoard, fetchBoard } from './boardData.ts';
import { Key, Picture } from './Key.tsx';
import { deviceId, say, sayOnDevice, stop } from './speech.ts';

type Token = { w: string; e?: string; s?: string };
type Settings = { voice: string; rate: number; level: Level; language: string; tapSound: boolean };
type FixState = { state: 'loading' } | { state: 'done'; fix: Fix } | { state: 'error'; message: string } | null;

const DEFAULTS: Settings = { voice: DEFAULT_VOICE, rate: 1, level: 'A2', language: '', tapSound: true };
const ACCENTS = [...new Set(ENGLISH_VOICES.map(voice => voice.accent))];
const STATUS_EVERY_MS = 30_000; // so the teacher's Fix switch reaches students without a reload
const CONTEXT_MS = 2 * 60_000; // a sentence said within this time counts as part of the same conversation

function load<T>(key: string, fallback: T): T {
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null');
        return value == null ? fallback : Array.isArray(fallback) ? value : { ...fallback, ...value };
    } catch { return fallback; }
}
function save(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: nothing is kept */ }
}
function loadSettings(): Settings {
    const { voice, rate, level, language, tapSound } = load('settings', DEFAULTS);
    return {
        tapSound: tapSound !== false,
        voice: isEnglishVoice(voice) ? voice : DEFAULTS.voice,
        level: isLevel(level) ? level : DEFAULTS.level,
        language: isLanguage(language) ? language : '',
        rate: String(rate) in RATES ? rate : 1
    };
}

export default function App() {
    const [board, setBoard] = useState<Board>(cachedBoard);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [draft, setDraft] = useState('');
    const [chosenTab, setTab] = useState('core');
    const [fix, setFix] = useState<FixState>(null);
    const [status, setStatus] = useState<Status>({ fix: false });
    const [settings, setSettings] = useState<Settings>(loadSettings);
    const [saved, setSaved] = useState<string[]>(() => load('saved', []));
    const [recent, setRecent] = useState<string[]>(() => load('recent', []));
    const [speaking, setSpeaking] = useState(false);
    const [notice, setNotice] = useState('');
    const typing = useRef<HTMLInputElement>(null);
    // The last sentence spoken and when: Fix sends it along while it is recent (see CONTEXT_MS).
    const lastSaid = useRef<{ text: string; at: number } | null>(null);

    useEffect(() => { save('settings', settings); }, [settings]);
    useEffect(() => { save('saved', saved); }, [saved]);
    useEffect(() => { save('recent', recent); }, [recent]);
    useEffect(() => {
        const check = () => fetch('/api/status').then(response => response.json()).then((value: Status) => setStatus(value)).catch(() => {});
        void check();
        void fetchBoard().then(result => { if (result) setBoard(result.board); });
        const timer = window.setInterval(check, STATUS_EVERY_MS);
        return () => window.clearInterval(timer);
    }, []);

    // Catalan for a whole phrase, when it is one of the board's quick phrases.
    const phraseCa = useMemo(() => new Map(board.quick.filter(item => item.ca).map(item => [item.t, item.ca!])), [board]);

    const message = [...tokens.map(token => token.w), draft.trim()].filter(Boolean).join(' ');
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));

    async function speak(text: string) {
        if (!text) return;
        setSpeaking(true);
        setNotice('');
        setRecent(current => [text, ...current.filter(item => item !== text)].slice(0, 30));
        lastSaid.current = { text, at: Date.now() };
        const used = await say(text, { voice: settings.voice, rate: settings.rate });
        setSpeaking(false);
        if (used === 'device') setNotice('The natural voice did not answer, so this device spoke.');
    }

    function tap(word: Word) {
        if (!word.w) return;
        // Typed words go first, so the message keeps the order they were added in.
        const typed = draft.trim();
        setTokens(current => [...current, ...(typed ? [{ w: typed }] : []), { w: word.w, e: word.e, s: word.s }]);
        setDraft('');
        setFix(null);
        if (settings.tapSound) { stop(); void sayOnDevice(word.w, settings.rate); }
    }

    function commitDraft(text = draft) {
        const words = text.trim();
        if (words) setTokens(current => [...current, { w: words }]);
        setDraft('');
    }

    function backspace() {
        setFix(null);
        if (draft) setDraft('');
        else setTokens(current => current.slice(0, -1));
    }

    function clear() {
        stop();
        setTokens([]); setDraft(''); setFix(null); setNotice('');
    }

    // The sentence said just before, so Fix can keep its tense ("Yesterday I went…" then "I eat…" → "I ate…").
    // Only while recent: an old sentence is not part of this conversation any more.
    function recentContext(words: string): string {
        const last = lastSaid.current;
        return last && Date.now() - last.at < CONTEXT_MS && last.text !== words ? last.text : '';
    }

    async function askFix() {
        if (!message || !status.fix) return;
        setFix({ state: 'loading' });
        try {
            const response = await fetch('/api/fix', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-device': deviceId() },
                body: JSON.stringify({ text: message, level: settings.level, language: settings.language, context: recentContext(message) }),
                signal: AbortSignal.timeout(12_000)
            });
            const body = await response.json();
            if (response.status === 403) { setFix(null); setStatus({ fix: false }); return; } // the teacher just switched it off
            setFix(response.ok ? { state: 'done', fix: body as Fix } : { state: 'error', message: body.error || 'No suggestion right now.' });
        } catch {
            setFix({ state: 'error', message: 'No suggestion right now. You can still speak your words.' });
        }
    }

    // Tapping a suggestion only says it: the speaker's own words stay in the bar, and the suggestions stay open to
    // hear again. Tapping or typing another word closes them.
    function hear(sentence: string) {
        void speak(sentence);
    }

    const toggleSaved = (text: string) => setSaved(current => current.includes(text) ? current.filter(item => item !== text) : [text, ...current]);

    // Each tab has the colour of what is on it: a page the colour of most of its words, the phrase lists pink like
    // their buttons. Core (every colour) and Settings stay plain.
    const tabs: { id: string; name: string; ca?: string; icon: string; kind?: Kind }[] = [
        { id: 'core', name: 'Core', ca: 'Paraules bàsiques', icon: '🔤' }, { id: 'quick', name: 'Quick', ca: 'Frases ràpides', icon: '⚡', kind: 'social' },
        ...board.pages.map(page => ({ ...page, kind: pageKind(page.words) })),
        { id: 'saved', name: 'Saved', ca: 'Frases desades', icon: '⭐', kind: 'social' }, { id: 'settings', name: 'Settings', ca: 'Configuració', icon: '⚙️' }
    ];
    // Back to Core when the teacher removed the page this device was on.
    const tab = tabs.some(item => item.id === chosenTab) ? chosenTab : 'core';
    const page = board.pages.find(item => item.id === tab);

    const phraseRow = (text: string) => (
        <div className="phrase-row" key={text}>
            <button className="phrase" onClick={() => void speak(text)} data-ca={phraseCa.get(text)}>{text}</button>
            <button className="icon" onClick={() => toggleSaved(text)} aria-label={saved.includes(text) ? 'Remove from saved' : 'Save'}
                data-ca={saved.includes(text) ? 'Treu-la de les desades' : 'Desa aquesta frase'}>{saved.includes(text) ? '★' : '☆'}</button>
            <button className="icon" onClick={() => { setTokens([{ w: text }]); setDraft(''); setFix(null); setTab('core'); }} aria-label="Edit"
                data-ca="Edita la frase">✏️</button>
        </div>
    );

    return (
        <div className="app">
            <header className="top">
                <div className="bar" onClick={() => typing.current?.focus()}>
                    {tokens.map((token, index) => (
                        <span className="chip" key={index}><Picture word={token} className="chip-pic" />{token.w}</span>
                    ))}
                    <input
                        ref={typing} className="typing" value={draft} maxLength={MAX_TEXT} aria-label="Type words"
                        placeholder={tokens.length ? '' : 'Tap words, or type here'}
                        onChange={event => { setDraft(event.target.value); setFix(null); }}
                        onKeyDown={event => {
                            if (event.key === 'Enter') { event.preventDefault(); void speak(message); commitDraft(); }
                            else if (event.key === 'Backspace' && !draft) { event.preventDefault(); backspace(); }
                        }}
                    />
                </div>
                <div className="actions">
                    <button className="act" onClick={backspace} disabled={!message} aria-label="Delete last word" data-ca="Esborra l'última paraula">⌫</button>
                    <button className="act" onClick={clear} disabled={!message} data-ca="Esborra-ho tot">Clear</button>
                    <button className="act save" onClick={() => toggleSaved(message)} disabled={!message} aria-label="Save this phrase"
                        data-ca={saved.includes(message) ? 'Treu-la de les desades' : 'Desa aquesta frase'}>{saved.includes(message) ? '★' : '☆'}</button>
                    {status.fix && <button className="act fix" onClick={() => void askFix()} disabled={!message || fix?.state === 'loading'}
                        data-ca="Corregeix la frase">✨ Fix</button>}
                    <button className="act speak" onClick={() => speaking ? (stop(), setSpeaking(false)) : void speak(message)} disabled={!message}
                        data-ca={speaking ? 'Atura' : 'Parla'}>{speaking ? '⏹ Stop' : '🔊 Speak'}</button>
                </div>
                {fix?.state === 'loading' && <div className="fixbox">Thinking…</div>}
                {fix?.state === 'error' && <div className="fixbox warn">{fix.message}</div>}
                {fix?.state === 'done' && (
                    <div className="fixbox">
                        <button className="suggest main" onClick={() => hear(fix.fix.sentence)} data-ca={fix.fix.translation ? undefined : 'Escolta aquesta frase'}>
                            <span className="say" aria-hidden="true">🔊</span>
                            <span className="en">{fix.fix.sentence}</span>
                            {fix.fix.translation && <span className="ca" lang="ca"><span className="badge" aria-hidden="true">CA</span>{fix.fix.translation}</span>}
                        </button>
                        {fix.fix.alternatives.length > 0 && <div className="or">Or did you mean:</div>}
                        {fix.fix.alternatives.map(text => (
                            <button className="suggest" key={text} onClick={() => hear(text)} data-ca="Escolta aquesta frase">
                                <span className="say" aria-hidden="true">🔊</span><span className="en">{text}</span>
                            </button>
                        ))}
                    </div>
                )}
                {notice && <div className="notice">{notice}</div>}
            </header>

            <nav className="tabs">
                {tabs.map(item => (
                    <button key={item.id} className={`tab ${item.kind ? `k-${item.kind}` : 'plain'}${tab === item.id ? ' on' : ''}`} onClick={() => setTab(item.id)} data-ca={item.ca || undefined}>
                        <span aria-hidden="true">{item.icon}</span> {item.name}
                    </button>
                ))}
            </nav>

            <main className="board">
                {tab === 'core' && <div className="grid core">{board.core.map((word, index) => <Key key={index} word={word} onTap={() => tap(word)} />)}</div>}
                {page && <div className="grid">{page.words.map((word, index) => <Key key={index} word={word} onTap={() => tap(word)} />)}</div>}
                {tab === 'quick' && <div className="phrases">{board.quick.map(item => phraseRow(item.t))}</div>}
                {tab === 'saved' && (
                    <div className="phrases">
                        {saved.length === 0 && recent.length === 0 && <p className="hint">Phrases you speak appear here. Press ☆ to keep one.</p>}
                        {saved.length > 0 && <h2>Saved</h2>}
                        {saved.map(phraseRow)}
                        {recent.some(text => !saved.includes(text)) && <h2>Recent <button className="link" onClick={() => setRecent([])} data-ca="Esborra les recents">clear</button></h2>}
                        {recent.filter(text => !saved.includes(text)).map(phraseRow)}
                    </div>
                )}
                {tab === 'settings' && (
                    <div className="settings">
                        <label>Voice
                            <span className="inline">
                                <select value={settings.voice} onChange={event => set('voice', event.target.value)}>
                                    {ACCENTS.map(accent => (
                                        <optgroup key={accent} label={accent}>
                                            {ENGLISH_VOICES.filter(voice => voice.accent === accent).map(voice => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
                                        </optgroup>
                                    ))}
                                </select>
                                <button className="act" onClick={() => void say('Hello! This is my voice.', { voice: settings.voice, rate: settings.rate })} data-ca="Escolta la veu">▶ Listen</button>
                            </span>
                        </label>
                        <label>Speed
                            <select value={settings.rate} onChange={event => set('rate', Number(event.target.value))}>
                                <option value={0.8}>Slow</option><option value={1}>Normal</option><option value={1.15}>Fast</option>
                            </select>
                        </label>
                        <label>My English level
                            <select value={settings.level} onChange={event => set('level', event.target.value as Level)}>
                                {LEVELS.map(level => <option key={level}>{level}</option>)}
                            </select>
                            <small>{status.fix ? 'Fix uses words for this level.' : 'Fix is switched off by your teacher.'}</small>
                        </label>
                        <label>My language
                            <select value={settings.language} onChange={event => set('language', event.target.value)}>
                                <option value="">Do not translate</option>
                                {LANGUAGES.map(language => <option key={language} value={language}>{language === 'Catalan' ? 'Catalan (català)' : language}</option>)}
                            </select>
                            <small>Fix shows the sentence in your language, so you can check the meaning.</small>
                        </label>
                        <label className="check">
                            <input type="checkbox" checked={settings.tapSound} onChange={event => set('tapSound', event.target.checked)} />
                            Say each word when I tap it
                        </label>
                        <p className="hint">Hold a button (or point at it with the mouse) to see it in Catalan.</p>
                        <p className="credit">Symbols: <a href="https://mulberrysymbols.org" target="_blank" rel="noopener">Mulberry Symbols</a> © Steve Lee,{' '}
                            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. Emoji by your device.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
