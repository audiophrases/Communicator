import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { BOARD_REFRESH_MS, LANGUAGES, LEVELS, MAX_LINKED_SENTENCES, MAX_TEXT, isLanguage, isLevel, type Fix, type Level, type Status } from '../shared/options.ts';
import { DEFAULT_VOICE, ENGLISH_VOICES, RATES, isEnglishVoice } from '../shared/voices.ts';
import { pageKind, type Board, type Kind, type Word } from '../shared/board.ts';
import { cachedBoard, fetchBoard } from './boardData.ts';
import { Key, Picture } from './Key.tsx';
import { SentenceBar, type Token } from './SentenceBar.tsx';
import { typedQuery, type Hit } from './search.ts';
import { deviceId, say, sayOnDevice, stop } from './speech.ts';

// Board buttons retain their picture and can move as a unit ("bus stop"). Typed words move individually.
let nextId = 0;
const token = (word: Omit<Token, 'id'>): Token => ({ ...word, id: ++nextId });
const typedTokens = (text: string): Token[] => text.trim().split(/\s+/).filter(Boolean).map(w => token({ w, typed: true }));

// "go to the doctor" → "go to the"
const withoutLastWord = (text: string) => text.trimEnd().replace(/\s*\S+$/, '');
// languageChosen: the speaker picked the language in Settings. Until then Fix translates into Catalan, the class's
// language; a device that saved "Do not translate" only because it was the old default goes back to Catalan.
type Settings = { voice: string; voiceChosen?: boolean; rate: number; level: Level; language: string; languageChosen?: boolean; tapSound: boolean };
type FixState = { state: 'loading' } | { state: 'done'; fix: Fix } | { state: 'error'; message: string } | null;

const DEFAULTS: Settings = { voice: DEFAULT_VOICE, rate: 1, level: 'A2', language: 'Catalan', tapSound: true };
const ACCENTS = [...new Set(ENGLISH_VOICES.map(voice => voice.accent))];

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
    const { voice, voiceChosen, rate, level, language, languageChosen, tapSound } = load('settings', DEFAULTS);
    return {
        tapSound: tapSound !== false,
        // A voice the speaker picked stays; any other (the old default, saved just by opening the page) becomes Emma.
        ...(voiceChosen === true && isEnglishVoice(voice) ? { voice, voiceChosen: true } : { voice: DEFAULTS.voice }),
        level: isLevel(level) ? level : DEFAULTS.level,
        ...(languageChosen === true
            ? { language: isLanguage(language) ? language : '', languageChosen: true }
            : { language: DEFAULTS.language }),
        rate: String(rate) in RATES ? rate : 1
    };
}

export default function App() {
    const [board, setBoard] = useState<Board>(cachedBoard);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [draft, setDraft] = useState('');
    const [selectedWord, setSelectedWord] = useState<number | null>(null);
    const [insertAt, setInsertAt] = useState<number | null>(null);
    const [chosenTab, setTab] = useState('core');
    const [fix, setFix] = useState<FixState>(null);
    // The last status this device saw, so the Fix button is there from the first frame and the board does not jump
    // down a row when the answer arrives (a tap meant for one word would land on the one above).
    const [status, setStatus] = useState<Status>(() => load('status', { fix: false }));
    const [settings, setSettings] = useState<Settings>(loadSettings);
    const [saved, setSaved] = useState<string[]>(() => load('saved', []));
    const [recent, setRecent] = useState<string[]>(() => load('recent', []));
    const [speaking, setSpeaking] = useState(false);
    const [notice, setNotice] = useState('');
    const typing = useRef<HTMLInputElement>(null);
    const originalWord = useRef<Token | null>(null);
    const [linked, setLinked] = useState(false);
    const paragraph = useRef<string[]>([]);
    const spokenChoice = useRef('');
    const pendingFix = useRef<{ play: boolean } | null>(null);

    function resetFix() {
        pendingFix.current = null;
        spokenChoice.current = '';
        setFix(null);
    }

    useEffect(() => { save('settings', settings); }, [settings]);
    useEffect(() => { save('saved', saved); }, [saved]);
    useEffect(() => { save('recent', recent); }, [recent]);
    useEffect(() => { save('status', status); }, [status]);
    // The keyboard's Backspace at the end of the typed text takes away the last whole word, like ⌫. Caught as the
    // text box is about to change, so tablet keyboards (which often do not say which key it was) do the same. With
    // the cursor moved back into the text, Backspace deletes one letter as usual, to fix a typo. On an empty box the
    // key is handled in onKeyDown below.
    // Backspace anywhere on the board does what ⌫ does: after clicking word buttons the keyboard's focus is on the last
    // button, not the text box. In a text box or a Settings menu, Backspace keeps its usual job.
    const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
        if (event.isComposing || event.defaultPrevented || event.altKey || event.metaKey) return;
        const target = event.target as HTMLElement | null;
        if (target !== typing.current && target?.closest('input:not(.linked input), textarea, select, [contenteditable="true"]')) return;
        if (event.key === 'Enter' && event.ctrlKey !== event.shiftKey) {
            event.preventDefault();
            if (event.repeat) return;
            if (event.ctrlKey) void askFix(true);
            else newSentence();
        } else if (event.key === 'Backspace' && !event.ctrlKey && target !== typing.current) {
            event.preventDefault();
            backspace();
        }
    });
    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    useEffect(() => {
        const input = typing.current;
        if (!input) return;
        const onBeforeInput = (event: InputEvent) => {
            if (event.inputType !== 'deleteContentBackward' || originalWord.current) return;
            const { value, selectionStart, selectionEnd } = input;
            if (!value.trim() || selectionStart !== selectionEnd || selectionEnd !== value.length) return;
            event.preventDefault();
            const rest = withoutLastWord(value);
            setDraft(rest ? `${rest} ` : '');
            resetFix();
        };
        input.addEventListener('beforeinput', onBeforeInput);
        return () => input.removeEventListener('beforeinput', onBeforeInput);
    }, []);
    useEffect(() => {
        const check = () => fetch('/api/status').then(response => response.json()).then((value: Status) => {
            if (typeof value.fix === 'boolean') updateStatus(value);
        }).catch(() => {});
        let active = true;
        let loadingBoard = false;
        let revision: string | undefined;
        const refresh = async () => {
            void check();
            if (loadingBoard) return;
            loadingBoard = true;
            const result = await fetchBoard(revision);
            loadingBoard = false;
            if (active && result) {
                revision = result.revision;
                setBoard(result.board);
            }
        };
        const onVisible = () => { if (!document.hidden) void refresh(); };
        void refresh();
        // Both addresses check at the same half-minute boundaries, including tabs opened at different times.
        let timer: number;
        const schedule = () => {
            timer = window.setTimeout(() => { onVisible(); schedule(); }, BOARD_REFRESH_MS - Date.now() % BOARD_REFRESH_MS);
        };
        schedule();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            active = false;
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    function updateStatus(value: Status) {
        setStatus(value);
        if (!value.fix) {
            paragraph.current = [];
            setLinked(false);
            resetFix();
        }
    }

    // Catalan for a whole phrase, when it is one of the board's quick phrases.
    const phraseCa = useMemo(() => new Map(board.quick.filter(item => item.ca).map(item => [item.t, item.ca!])), [board]);

    // A question mark sits on the word before it, as it is written: "you want coffee?".
    const cursor = insertAt ?? tokens.length;
    const message = [...tokens.slice(0, cursor).map(t => t.w), draft.trim(), ...tokens.slice(cursor).map(t => t.w)]
        .filter(Boolean).join(' ').replace(/ \?/g, '?');
    // Buttons matching what is being typed (English or Catalan; ? one letter, * any letters).
    const found = useMemo(() => {
        if (!draft.trim()) return null;
        // Keep multiword search ("bus st") across the boundary between finished words and the text field.
        let start = cursor;
        while (start > 0 && cursor - start < 2 && tokens[start - 1].typed) start--;
        return typedQuery(board, [...tokens.slice(start, cursor).map(t => t.w), draft].join(' '));
    }, [board, tokens, cursor, draft]);
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));

    async function speak(text: string) {
        if (!text) return;
        setSpeaking(true);
        setNotice('');
        setRecent(current => [text, ...current.filter(item => item !== text)].slice(0, 30));
        if (pendingFix.current) pendingFix.current.play = false;
        const used = await say(text, { voice: settings.voice, rate: settings.rate });
        setSpeaking(false);
        if (used === 'device') setNotice('The natural voice did not answer, so this device spoke.');
    }

    function speakWord(word: string) {
        if (!settings.tapSound || word === '?') return;
        if (status.naturalWordVoice) void say(word, settings);
        else { stop(); void sayOnDevice(word, settings.rate, settings.voice); }
    }

    function draftWords(text = draft) {
        const original = originalWord.current;
        return original && original.w === text.trim() ? [original] : typedTokens(text);
    }

    function insertWords(words: Token[], replaceBefore = 0) {
        originalWord.current = null;
        setTokens([...tokens.slice(0, cursor - replaceBefore), ...words, ...tokens.slice(cursor)]);
        if (insertAt !== null) setInsertAt(cursor === tokens.length ? null : cursor - replaceBefore + words.length);
        setSelectedWord(null);
        setDraft('');
    }

    function changeDraft(value: string, atEnd: boolean) {
        setSelectedWord(null);
        resetFix();
        const completed = atEnd && !originalWord.current && value.match(/^([\s\S]*\s)(\S*)$/);
        if (completed) {
            insertWords(typedTokens(completed[1]));
            setDraft(completed[2]);
        } else setDraft(value);
    }

    function materializeDraft() {
        const pending = draftWords();
        const words = [...tokens.slice(0, cursor), ...pending, ...tokens.slice(cursor)];
        originalWord.current = null;
        setDraft('');
        return { words, indexOf: (index: number) => index + (cursor <= index ? pending.length : 0) };
    }

    function selectWord(index: number, after: boolean) {
        const { words, indexOf } = materializeDraft();
        setTokens(words);
        setSelectedWord(indexOf(index));
        setInsertAt(indexOf(index) + Number(after));
    }

    function moveWord(index: number, gap: number) {
        if (gap === index || gap === index + 1) return;
        const { words: next, indexOf } = materializeDraft();
        const from = indexOf(index);
        const target = indexOf(gap) - Number(from < indexOf(gap));
        const [moved] = next.splice(from, 1);
        next.splice(target, 0, moved);
        setTokens(next);
        setSelectedWord(target); setInsertAt(target + 1);
        resetFix();
    }

    function startInsertion(gap: number, text = '') {
        const { words, indexOf } = materializeDraft();
        setTokens(words);
        setInsertAt(gap === tokens.length ? null : indexOf(gap));
        setSelectedWord(null);
        setDraft(text);
        if (text) resetFix();
        typing.current?.focus();
    }

    function editWord(index: number) {
        const { words, indexOf } = materializeDraft();
        const position = indexOf(index);
        const [word] = words.splice(position, 1);
        originalWord.current = word;
        setTokens(words); setInsertAt(position); setSelectedWord(null); setDraft(word.w);
        typing.current?.focus();
        requestAnimationFrame(() => typing.current?.select());
    }

    function deleteWord(index: number) {
        setTokens(tokens.filter((_, i) => i !== index));
        if (insertAt !== null && index < insertAt) setInsertAt(insertAt - 1);
        setSelectedWord(null);
        resetFix();
    }

    function tap(word: Word) {
        if (!word.w) return;
        // ? makes the words so far a question ("you want coffee" → "you want coffee?"): Speak asks it, Fix makes a
        // question of it. It needs words before it, and once is enough; ⌫ takes it away.
        const preceding = draft.trim() || tokens[cursor - 1]?.w;
        if (word.w === '?' && (!preceding || preceding.endsWith('?') || tokens[cursor]?.w === '?')) return;
        insertWords([...draftWords(), token({ w: word.w, e: word.e, s: word.s })]);
        resetFix();
        speakWord(word.w);
    }

    // A button found by typing: it takes the place of the letters typed for it, and earlier typed words stay.
    function pick(hit: Hit, typedWords: number) {
        const parts = draft.trim().split(/\s+/);
        const before = parts.slice(0, -typedWords).join(' ');
        insertWords([...typedTokens(before), token({ w: hit.word.w, e: hit.word.e, s: hit.word.s })],
            Math.max(0, typedWords - parts.length));
        resetFix();
        speakWord(hit.word.w);
        typing.current?.focus(); // keep typing
    }

    function finishEditing() {
        insertWords(draftWords());
        setInsertAt(null);
    }

    // ⌫ takes away the last word: from what is being typed first, then from the bar.
    function backspace() {
        if (selectedWord !== null) { deleteWord(selectedWord); return; }
        resetFix();
        if (draft.trim()) {
            const rest = withoutLastWord(draft);
            setDraft(rest ? `${rest} ` : ''); // the space lets the next word be typed straight on
            return;
        }
        setDraft('');
        if (cursor === 0) return;
        deleteWord(cursor - 1);
    }

    function newSentence() {
        if (linked && message) {
            const lines = paragraph.current;
            if (lines.length === MAX_LINKED_SENTENCES) lines.splice(1, 1);
            lines.push((spokenChoice.current || message).slice(0, MAX_TEXT));
        }
        resetFix();
        setTokens([]); setDraft(''); setNotice('');
        originalWord.current = null;
        setSelectedWord(null); setInsertAt(null);
        typing.current?.focus();
    }

    async function askFix(play = false) {
        if (!message || !status.fix) return;
        if (play && fix?.state === 'done') { hear(fix.fix.sentence); return; }
        if (pendingFix.current) {
            if (play) pendingFix.current.play = true;
            return;
        }
        const request = { play };
        pendingFix.current = request;
        setFix({ state: 'loading' });
        try {
            const response = await fetch('/api/fix', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-device': deviceId() },
                body: JSON.stringify({ text: message, level: settings.level, language: settings.language,
                    ...(linked && paragraph.current.length ? { context: paragraph.current } : {}) }),
                signal: AbortSignal.timeout(20_000)
            });
            const body = await response.json();
            if (pendingFix.current !== request) return;
            if (response.status === 403) { updateStatus({ fix: false }); return; }
            setFix(response.ok ? { state: 'done', fix: body as Fix } : { state: 'error', message: body.error || 'No suggestion right now.' });
            if (response.ok && request.play) hear((body as Fix).sentence);
        } catch {
            if (pendingFix.current === request) setFix({ state: 'error', message: 'No suggestion right now. You can still speak your words.' });
        } finally {
            if (pendingFix.current === request) pendingFix.current = null;
        }
    }

    // Tapping a suggestion only says it: the speaker's own words stay in the bar, and the suggestions stay open to
    // hear again. Tapping or typing another word closes them.
    function hear(sentence: string) {
        spokenChoice.current = sentence;
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
            <button className="icon" onClick={() => { originalWord.current = null; setTokens(typedTokens(text)); setDraft(''); setSelectedWord(null); setInsertAt(null); resetFix(); setTab('core'); }} aria-label="Edit"
                data-ca="Edita la frase">✏️</button>
        </div>
    );

    const inlineInput = <input key="typing" ref={typing}
        className={selectedWord !== null ? 'typing parked' : insertAt !== null && cursor < tokens.length ? 'typing middle' : 'typing'}
        value={draft} maxLength={MAX_TEXT} aria-label="Type words"
        placeholder={tokens.length || insertAt !== null ? '' : 'Tap words, or type to find them'}
        onFocus={() => setSelectedWord(null)}
        onChange={event => changeDraft(event.target.value, !(event.nativeEvent as InputEvent).isComposing
            && event.target.selectionEnd === event.target.value.length)}
        onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
            if (event.key === 'Escape' && originalWord.current) {
                event.preventDefault();
                insertWords([originalWord.current]);
            } else if (event.key === 'Tab' && found) { event.preventDefault(); pick(found.hits[0], found.words); }
            else if (event.key === 'Enter') {
                event.preventDefault();
                if (insertAt === null) hear(message);
                finishEditing();
            } else if (event.key === 'Backspace' && !draft) { event.preventDefault(); backspace(); }
        }}
    />;

    return (
        <div className="app" onClick={event => {
            // Commit after the tap lands. Collapsing the field on blur can move the tapped control before pointerup.
            if (originalWord.current && event.target instanceof Element && !event.target.closest('.bar, .erase')) finishEditing();
        }}>
            <header className="top">
                <SentenceBar words={tokens} cursor={cursor} selected={selectedWord} input={inlineInput}
                    select={selectWord} edit={editWord} move={moveWord} insert={startInsertion} remove={deleteWord} />
                <div className="actions">
                    <button className="act erase" onClick={backspace} disabled={!message}
                        aria-label={selectedWord !== null ? 'Delete selected word' : insertAt !== null ? 'Delete preceding word' : 'Delete last word'}
                        data-ca="Esborra una paraula">⌫</button>
                    <button className="act" onClick={newSentence} disabled={!message} title="New sentence (Shift+Enter)"
                        aria-keyshortcuts="Shift+Enter" data-ca="Frase nova">New sentence</button>
                    <button className="act save" onClick={() => toggleSaved(message)} disabled={!message} aria-label="Save this phrase"
                        data-ca={saved.includes(message) ? 'Treu-la de les desades' : 'Desa aquesta frase'}>{saved.includes(message) ? '★' : '☆'}</button>
                    {status.fix && <label className="act linked" title="Keep the tense across sentences">
                        <input type="checkbox" checked={linked} onChange={event => {
                            setLinked(event.target.checked);
                            paragraph.current = [];
                            resetFix();
                        }} /> Link sentences
                    </label>}
                    {status.fix && <button className="act fix" onClick={() => void askFix()} disabled={!message || fix?.state === 'loading'}
                        title="Review suggestion (Ctrl+Enter to fix and speak)" data-ca="Corregeix la frase">✨ Fix</button>}
                    <button className="act speak" onClick={() => speaking ? (stop(), setSpeaking(false)) : hear(message)} disabled={!message && !speaking}
                        data-ca={speaking ? 'Atura' : 'Parla'}>{speaking ? '⏹ Stop' : '🔊 Speak'}</button>
                </div>
                {found && (
                    <div className="found" aria-label={`Buttons for "${found.query}"`}>
                        {found.hits.map(hit => (
                            <button key={`${hit.page}-${hit.index}`} className={`found-key k-${hit.word.k}`} onClick={() => pick(hit, found.words)}
                                data-ca={hit.word.ca || undefined} title={hit.page === 'core' ? 'Core' : hit.pageName}>
                                <Picture word={hit.word} className="found-pic" />
                                <span className="found-word">{hit.word.w}</span>
                                {hit.word.ca && <span className="found-ca" lang="ca">{hit.word.ca}</span>}
                            </button>
                        ))}
                    </div>
                )}
                {fix?.state === 'loading' && <div className="fixbox">Thinking…</div>}
                {fix?.state === 'error' && <div className="fixbox warn">{fix.message}</div>}
                {fix?.state === 'done' && (
                    <div className="fixbox">
                        <button className="suggest main" onClick={() => hear(fix.fix.sentence)} data-ca={fix.fix.translation ? undefined : 'Escolta aquesta frase'}>
                            <span className="say" aria-hidden="true">🔊</span>
                            <span className="en">{fix.fix.sentence}</span>
                            {fix.fix.translation && <span className="ca" lang="ca">{fix.fix.translation}</span>}
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
                                <select value={settings.voice} onChange={event => { const voice = event.target.value; setSettings(current => ({ ...current, voice, voiceChosen: true })); }}>
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
                            <select value={settings.level} onChange={event => { resetFix(); set('level', event.target.value as Level); }}>
                                {LEVELS.map(level => <option key={level}>{level}</option>)}
                            </select>
                            <small>{status.fix ? 'Fix uses words for this level.' : 'Fix is switched off by your teacher.'}</small>
                        </label>
                        <label>My language
                            <select value={settings.language} onChange={event => { const language = event.target.value; resetFix(); setSettings(current => ({ ...current, language, languageChosen: true })); }}>
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
                        <p className="hint">Ctrl+Enter fixes and speaks. Shift+Enter starts a new sentence. Turn on Link sentences to carry the tense into the next sentence. Turn it off to end the paragraph.</p>
                        <p className="hint">Type a few letters, in English or Catalan, to find a button: tap it or press Tab. ? stands for one letter and * for any number (h?t, *ppy).</p>
                        <p className="credit"><a href="https://mulberrysymbols.org" target="_blank" rel="noopener">Mulberry Symbols</a> © Steve Lee.
                            {' '}<a href="https://blissymbolics.org/index.php/bci-av-2026" target="_blank" rel="noopener">Blissymbols</a> © Blissymbolics Communication International (cropped).
                            {' '}Both sets use <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.
                            {' '}Picture scenes include adapted <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji graphics</a> by Twitter and contributors
                            {' '}(<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>). Other emoji by your device.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
