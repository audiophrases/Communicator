import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, LEVELS, MAX_TEXT, VOICES, type Fix, type Level, type Status, type Voice } from '../shared/options.ts';
import { CORE, PAGES, QUICK, type Word } from './vocab.ts';
import { say, sayOnDevice, stop } from './speech.ts';

type Token = { w: string; e?: string };
type Settings = { voice: Voice; rate: number; level: Level; language: string; tapSound: boolean; code: string };
type FixState = { state: 'loading' } | { state: 'done'; fix: Fix } | { state: 'error'; message: string } | null;

const DEFAULTS: Settings = { voice: 'coral', rate: 1, level: 'A2', language: '', tapSound: true, code: '' };

function load<T>(key: string, fallback: T): T {
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null');
        return value == null ? fallback : Array.isArray(fallback) ? value : { ...fallback, ...value };
    } catch { return fallback; }
}
function save(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: nothing is kept */ }
}

function Key({ word, onTap }: { word: Word; onTap: (word: Word) => void }) {
    return (
        <button className={`key k-${word.k}`} onClick={() => onTap(word)}>
            {word.e && <span className="key-pic" aria-hidden="true">{word.e}</span>}
            <span className="key-word">{word.w}</span>
        </button>
    );
}

export default function App() {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [draft, setDraft] = useState('');
    const [tab, setTab] = useState('core');
    const [fix, setFix] = useState<FixState>(null);
    const [status, setStatus] = useState<Status>({ ai: false, locked: false });
    const [settings, setSettings] = useState<Settings>(() => load('settings', DEFAULTS));
    const [saved, setSaved] = useState<string[]>(() => load('saved', []));
    const [recent, setRecent] = useState<string[]>(() => load('recent', []));
    const [speaking, setSpeaking] = useState(false);
    const [notice, setNotice] = useState('');
    const typing = useRef<HTMLInputElement>(null);

    useEffect(() => { save('settings', settings); }, [settings]);
    useEffect(() => { save('saved', saved); }, [saved]);
    useEffect(() => { save('recent', recent); }, [recent]);
    useEffect(() => {
        fetch('/api/status').then(response => response.json()).then((value: Status) => setStatus(value)).catch(() => {});
    }, []);

    const message = [...tokens.map(token => token.w), draft.trim()].filter(Boolean).join(' ');
    const ai = status.ai && (!status.locked || !!settings.code);
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));

    async function speak(text: string) {
        if (!text) return;
        setSpeaking(true);
        setNotice('');
        setRecent(current => [text, ...current.filter(item => item !== text)].slice(0, 30));
        const used = await say(text, { voice: settings.voice, rate: settings.rate, ai, code: settings.code });
        setSpeaking(false);
        if (ai && used === 'device') setNotice('The natural voice did not answer, so this device spoke.');
    }

    function tap(word: Word) {
        setTokens(current => [...current, { w: word.w, e: word.e }]);
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

    async function askFix() {
        if (!message || !ai) return;
        setFix({ state: 'loading' });
        try {
            const response = await fetch('/api/fix', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': settings.code },
                body: JSON.stringify({ text: message, level: settings.level, language: settings.language, context: recent[0] ?? '' }),
                signal: AbortSignal.timeout(12_000)
            });
            const body = await response.json();
            setFix(response.ok ? { state: 'done', fix: body as Fix } : { state: 'error', message: body.error || 'No suggestion right now.' });
        } catch {
            setFix({ state: 'error', message: 'No suggestion right now. You can still speak your words.' });
        }
    }

    // The speaker picked a suggestion: it becomes the message and is spoken.
    function choose(sentence: string) {
        setTokens([{ w: sentence }]); setDraft(''); setFix(null);
        void speak(sentence);
    }

    const toggleSaved = (text: string) => setSaved(current => current.includes(text) ? current.filter(item => item !== text) : [text, ...current]);

    const page = PAGES.find(item => item.id === tab);
    const tabs = [{ id: 'core', name: 'Core', icon: '🔤' }, { id: 'quick', name: 'Quick', icon: '⚡' }, ...PAGES, { id: 'saved', name: 'Saved', icon: '⭐' }, { id: 'settings', name: 'Settings', icon: '⚙️' }];

    const phraseRow = (text: string) => (
        <div className="phrase-row" key={text}>
            <button className="phrase" onClick={() => void speak(text)}>{text}</button>
            <button className="icon" onClick={() => toggleSaved(text)} aria-label={saved.includes(text) ? 'Remove from saved' : 'Save'}>{saved.includes(text) ? '★' : '☆'}</button>
            <button className="icon" onClick={() => { setTokens([{ w: text }]); setDraft(''); setFix(null); setTab('core'); }} aria-label="Edit">✏️</button>
        </div>
    );

    return (
        <div className="app">
            <header className="top">
                <div className="bar" onClick={() => typing.current?.focus()}>
                    {tokens.map((token, index) => (
                        <span className="chip" key={index}>{token.e && <span aria-hidden="true">{token.e} </span>}{token.w}</span>
                    ))}
                    <input
                        ref={typing} className="typing" value={draft} maxLength={MAX_TEXT} aria-label="Type words"
                        placeholder={tokens.length ? '' : 'Tap words, or type here'}
                        onChange={event => { setDraft(event.target.value); setFix(null); }}
                        onKeyDown={event => {
                            if (event.key === 'Enter') { event.preventDefault(); void speak(message); commitDraft(); }
                            else if (event.key === 'Backspace' && !draft) { event.preventDefault(); backspace(); }
                        }}
                        onBlur={() => commitDraft()}
                    />
                </div>
                <div className="actions">
                    <button className="act" onClick={backspace} disabled={!message} aria-label="Delete last word">⌫</button>
                    <button className="act" onClick={clear} disabled={!message}>Clear</button>
                    <button className="act save" onClick={() => toggleSaved(message)} disabled={!message} aria-label="Save this phrase">{saved.includes(message) ? '★' : '☆'}</button>
                    {status.ai && <button className="act fix" onClick={() => void askFix()} disabled={!message || !ai || fix?.state === 'loading'}>✨ Fix</button>}
                    <button className="act speak" onClick={() => speaking ? (stop(), setSpeaking(false)) : void speak(message)} disabled={!message}>{speaking ? '⏹ Stop' : '🔊 Speak'}</button>
                </div>
                {fix?.state === 'loading' && <div className="fixbox">Thinking…</div>}
                {fix?.state === 'error' && <div className="fixbox warn">{fix.message}</div>}
                {fix?.state === 'done' && (
                    <div className="fixbox">
                        <button className="suggest main" onClick={() => choose(fix.fix.sentence)}>🔊 {fix.fix.sentence}</button>
                        {fix.fix.translation && <div className="translation" dir="auto">{fix.fix.translation}</div>}
                        {fix.fix.note && <div className="note">💡 {fix.fix.note}</div>}
                        {fix.fix.alternatives.length > 0 && <div className="or">Or did you mean:</div>}
                        {fix.fix.alternatives.map(text => <button className="suggest" key={text} onClick={() => choose(text)}>🔊 {text}</button>)}
                        <button className="keep" onClick={() => setFix(null)}>Keep my words</button>
                    </div>
                )}
                {notice && <div className="notice">{notice}</div>}
            </header>

            <nav className="tabs">
                {tabs.map(item => (
                    <button key={item.id} className={`tab${tab === item.id ? ' on' : ''}`} onClick={() => setTab(item.id)}>
                        <span aria-hidden="true">{item.icon}</span> {item.name}
                    </button>
                ))}
            </nav>

            <main className="board">
                {tab === 'core' && <div className="grid core">{CORE.map((word, index) => <Key key={index} word={word} onTap={tap} />)}</div>}
                {page && <div className="grid">{page.words.map((word, index) => <Key key={index} word={word} onTap={tap} />)}</div>}
                {tab === 'quick' && <div className="phrases">{QUICK.map(phraseRow)}</div>}
                {tab === 'saved' && (
                    <div className="phrases">
                        {saved.length === 0 && recent.length === 0 && <p className="hint">Phrases you speak appear here. Press ☆ to keep one.</p>}
                        {saved.length > 0 && <h2>Saved</h2>}
                        {saved.map(phraseRow)}
                        {recent.some(text => !saved.includes(text)) && <h2>Recent <button className="link" onClick={() => setRecent([])}>clear</button></h2>}
                        {recent.filter(text => !saved.includes(text)).map(phraseRow)}
                    </div>
                )}
                {tab === 'settings' && (
                    <div className="settings">
                        {!status.ai && <p className="hint warn">No OpenAI key is set up, so Fix is off and this device's own voice speaks. See README.</p>}
                        {status.locked && (
                            <label>Access code
                                <input type="password" value={settings.code} onChange={event => set('code', event.target.value)} placeholder="Ask the person who set this up" />
                            </label>
                        )}
                        <label>Voice
                            <span className="inline">
                                <select value={settings.voice} onChange={event => set('voice', event.target.value as Voice)} disabled={!ai}>
                                    {VOICES.map(voice => <option key={voice} value={voice}>{voice[0].toUpperCase() + voice.slice(1)}</option>)}
                                </select>
                                <button className="act" onClick={() => void say('Hello! This is my voice.', { voice: settings.voice, rate: settings.rate, ai, code: settings.code })}>▶ Listen</button>
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
                            <small>Fix uses words for this level.</small>
                        </label>
                        <label>My language
                            <select value={settings.language} onChange={event => set('language', event.target.value)}>
                                <option value="">Do not translate</option>
                                {LANGUAGES.map(language => <option key={language}>{language}</option>)}
                            </select>
                            <small>Fix shows the sentence in your language, so you can check the meaning.</small>
                        </label>
                        <label className="check">
                            <input type="checkbox" checked={settings.tapSound} onChange={event => set('tapSound', event.target.checked)} />
                            Say each word when I tap it
                        </label>
                    </div>
                )}
            </main>
        </div>
    );
}
