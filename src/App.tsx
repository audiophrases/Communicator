import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BOARD_REFRESH_MS, LANGUAGES, LEVELS, MAX_LINKED_SENTENCES, MAX_TEXT, isLanguage, isLevel, type Fix, type Level, type Status } from '../shared/options.ts';
import { DEFAULT_VOICE, ENGLISH_VOICES, RATES, isEnglishVoice } from '../shared/voices.ts';
import { pageKind, type Board, type Kind, type Word } from '../shared/board.ts';
import { cachedBoard, fetchBoard } from './boardData.ts';
import { copyText } from './copyText.ts';
import { Key, Picture } from './Key.tsx';
import { SentenceBar, type Token } from './SentenceBar.tsx';
import { sentenceWords, typedQuery, type Hit } from './search.ts';
import { deviceId, say, sayOnDevice, stop } from './speech.ts';

// Board buttons retain their picture and can move as a unit ("bus stop"). Typed words move individually.
let nextId = 0;
const token = (word: Omit<Token, 'id'>): Token => ({ ...word, id: ++nextId });
const typedTokens = (text: string): Token[] => text.trim().split(/\s+/).filter(Boolean).map(w => token({ w, typed: true }));

// "go to the doctor" → "go to the"
const withoutLastWord = (text: string) => text.trimEnd().replace(/\s*\S+$/, '');
// languageChosen: the speaker picked the language in Settings. Until then Fix translates into Catalan, the class's
// language; a device that saved "Do not translate" only because it was the old default goes back to Catalan.
type Settings = { voice: string; voiceChosen?: boolean; rate: number; level: Level; language: string; languageChosen?: boolean; tapSound: boolean; keySize: number };
// − and + make the word buttons smaller or bigger, nothing else. On a screen with room for the core's 10 a row,
// each step is one more or one fewer a row (14 down to 3).
const KEY_SIZES = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 2, 2.5, 3];
type FixState = { state: 'loading' } | { state: 'done'; fix: Fix } | { state: 'error'; message: string } | null;

const DEFAULTS: Settings = { voice: DEFAULT_VOICE, rate: 1, level: 'A2', language: 'Catalan', tapSound: true, keySize: 1 };
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
// A finished sentence of the story: the version kept (the fixed one while Fix is on) and its translation, shown as
// its tooltip. pending: Fix is still working on it.
type StoryLine = { id: number; text: string; ca?: string; pending?: boolean };
let nextLineId = 0;
const storyLine = (text: string, ca?: string, pending = false): StoryLine =>
    ({ id: ++nextLineId, text, ...(ca ? { ca } : {}), ...(pending ? { pending } : {}) });
function loadStory(): StoryLine[] | null {
    try {
        const value: unknown = JSON.parse(localStorage.getItem('story') ?? 'null');
        if (!Array.isArray(value)) return null;
        return value.flatMap(item => {
            const { text, ca } = (typeof item === 'string' ? { text: item } : item ?? {}) as { text?: unknown; ca?: unknown };
            return typeof text === 'string' && text ? [storyLine(text, typeof ca === 'string' ? ca : undefined)] : [];
        });
    } catch { return null; }
}
type FixAnswer = { fix: Fix } | { error: string } | { off: true };
// What Ctrl+Z goes back to: the sentence being made and the story.
type Snapshot = { tokens: Token[]; draft: string; insertAt: number | null; story: StoryLine[] | null; openLine: number | null };
// Fix reads the story's opening sentence (it usually sets the time) and the latest ones.
const storyContext = (lines: string[]) =>
    lines.length > MAX_LINKED_SENTENCES ? [lines[0], ...lines.slice(1 - MAX_LINKED_SENTENCES)] : lines;
function loadSettings(): Settings {
    const { voice, voiceChosen, rate, level, language, languageChosen, tapSound, keySize } = load('settings', DEFAULTS);
    return {
        tapSound: tapSound !== false,
        keySize: KEY_SIZES.includes(keySize) ? keySize : 1,
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
    const typing = useRef<HTMLInputElement>(null);
    const originalWord = useRef<Token | null>(null);
    // Story on: the sentences finished so far, oldest first (null while Story is off). Kept on the device, so a reload
    // does not lose them.
    const [story, setStory] = useState<StoryLine[] | null>(loadStory);
    // The story sentence being changed in the bar (its id). Finishing the bar's sentence puts it in its place.
    const [openLine, setOpenLine] = useState<number | null>(null);
    const [playingLine, setPlayingLine] = useState<number | null>(null);
    const storyBox = useRef<HTMLDivElement>(null);
    // Whatever is said takes a turn. Speech that finds its turn taken by something said later stops there.
    const speechTurn = useRef(0);
    const spokenChoice = useRef('');
    const pendingFix = useRef<{ play: boolean } | null>(null);
    // A suggestion brought into the bar with ✏️. Still unchanged at New sentence, the story keeps it as Fix wrote it
    // instead of asking Fix again.
    const takenFix = useRef<{ text: string; ca?: string } | null>(null);
    // The found button Enter picks: the first, or another one chosen with → and ←.
    const [foundChoice, setFoundChoice] = useState({ query: '', index: 0 });
    const foundRow = useRef<HTMLDivElement>(null);

    function resetFix() {
        pendingFix.current = null;
        spokenChoice.current = '';
        setFix(null);
    }

    // Ctrl+Z goes back one step and Ctrl+Y forward again: a word added, typed, moved, changed or deleted, a sentence
    // finished or opened, a story ended. Each action first remembers how the sentence and the story were.
    const undoSteps = useRef<Snapshot[]>([]);
    const redoSteps = useRef<Snapshot[]>([]);
    // Each story sentence as Fix last corrected it, so going back does not bring back words Fix has replaced since.
    const fixedLines = useRef(new Map<number, StoryLine>());
    const snapshot = (): Snapshot => ({ tokens, draft, insertAt, story, openLine });
    function remember() {
        const last = undoSteps.current.at(-1);
        if (last && last.tokens === tokens && last.draft === draft && last.insertAt === insertAt && last.story === story
            && last.openLine === openLine) return; // one action calling another
        undoSteps.current.push(snapshot());
        if (undoSteps.current.length > 100) undoSteps.current.shift();
        redoSteps.current = [];
    }
    function restore(from: Snapshot[], to: Snapshot[]) {
        const step = from.pop();
        if (!step) return;
        to.push(snapshot());
        originalWord.current = null;
        setTokens(step.tokens); setDraft(step.draft); setInsertAt(step.insertAt); setSelectedWord(null);
        setStory(step.story && step.story.map(line => fixedLines.current.get(line.id) ?? line));
        setOpenLine(step.openLine);
        resetFix();
    }
    const rememberFromInput = useEffectEvent(remember);

    useEffect(() => { save('settings', settings); }, [settings]);
    useEffect(() => { save('saved', saved); }, [saved]);
    useEffect(() => { save('recent', recent); }, [recent]);
    useEffect(() => { save('status', status); }, [status]);
    useEffect(() => { save('story', story && story.map(({ text, ca }) => ({ text, ca }))); }, [story]);
    // The line being heard or changed in view, otherwise the newest.
    useEffect(() => {
        const box = storyBox.current;
        if (!box || !story) return;
        const shown = playingLine ?? story.findIndex(line => line.id === openLine);
        if (shown >= 0) box.children[shown]?.scrollIntoView({ block: 'nearest' });
        else box.scrollTop = box.scrollHeight;
    }, [story, playingLine, openLine]);
    // The keyboard's Backspace at the end of the typed text takes away the last whole word, like ⌫. Caught as the
    // text box is about to change, so tablet keyboards (which often do not say which key it was) do the same. With
    // the cursor moved back into the text, Backspace deletes one letter as usual, to fix a typo. On an empty box the
    // key is handled in onKeyDown below.
    // Backspace anywhere on the board does what ⌫ does: after clicking word buttons the keyboard's focus is on the last
    // button, not the text box. In a text box or a Settings menu, Backspace keeps its usual job.
    const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
        if (event.isComposing || event.defaultPrevented || event.altKey || event.metaKey) return;
        const target = event.target as HTMLElement | null;
        if (target !== typing.current && target?.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === 'Enter' && (event.ctrlKey || event.shiftKey)) {
            event.preventDefault();
            if (event.repeat) return;
            if (event.ctrlKey && event.shiftKey) void playStory();
            else if (event.ctrlKey) void askFix(true);
            else newSentence();
        } else if (event.key === 'Backspace' && !event.ctrlKey && target !== typing.current) {
            event.preventDefault();
            backspace(event.repeat);
        } else if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'c'
            && !(target instanceof HTMLInputElement && target.selectionStart !== target.selectionEnd) && !window.getSelection()?.toString()) {
            // Ctrl+C with nothing highlighted copies the fixed sentence (or the suggestion the speaker last tapped);
            // with no fix showing, the whole story. Highlighted text copies as usual.
            const text = fix?.state === 'done'
                ? fix.fix.alternatives.includes(spokenChoice.current) ? spokenChoice.current : fix.fix.sentence
                : story?.map(line => line.text).join('\n');
            if (!text) return;
            event.preventDefault();
            copyText(text);
        } else if (event.ctrlKey && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
            event.preventDefault();
            if (event.key.toLowerCase() === 'y' || event.shiftKey) restore(redoSteps.current, undoSteps.current);
            else restore(undoSteps.current, redoSteps.current);
        } else if (!event.ctrlKey && target !== typing.current && (event.key === 'Dead' || event.key.length === 1 && event.key.trim())) {
            // A letter typed anywhere on the board goes into the sentence: after clicking word buttons, the
            // keyboard's focus is on the last one. Moving the focus now lets the letter land in the text box.
            const input = typing.current;
            if (!input) return;
            input.focus({ preventScroll: true });
            input.setSelectionRange(input.value.length, input.value.length);
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
            rememberFromInput();
            const rest = withoutLastWord(value);
            setDraft(rest ? `${rest} ` : '');
            resetFix();
        };
        input.addEventListener('beforeinput', onBeforeInput);
        return () => input.removeEventListener('beforeinput', onBeforeInput);
    }, []);
    useEffect(() => {
        // Only for a server older than this page, whose board check does not say whether Fix is on.
        const check = (warmVoice: boolean) => fetch(warmVoice ? '/api/status?warmVoice=1' : '/api/status').then(response => response.json()).then((value: Status) => {
            if (typeof value.fix === 'boolean') updateStatus(value);
        }).catch(() => {});
        let active = true;
        let loadingBoard = false;
        let revision: string | undefined;
        const refresh = async (warmVoice = false) => {
            if (loadingBoard) return;
            loadingBoard = true;
            const result = await fetchBoard(revision, { warmVoice, onStatus: value => {
                if (!active) return;
                if (value) updateStatus(value);
                else void check(warmVoice);
            } });
            loadingBoard = false;
            if (active && result) {
                revision = result.revision;
                setBoard(result.board);
            }
        };
        const onVisible = () => { if (!document.hidden) void refresh(); };
        void refresh(true);
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
        // A story being told stays when the teacher switches Fix off, and so does its Story button, to end it.
        if (!value.fix) resetFix();
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
    const chosenHit = found && foundChoice.query === found.query ? Math.min(foundChoice.index, found.hits.length - 1) : 0;
    useEffect(() => { foundRow.current?.children[chosenHit]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [found, chosenHit]);
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));
    const keyStep = KEY_SIZES.indexOf(settings.keySize);

    async function speak(text: string) {
        if (!text) return;
        const turn = ++speechTurn.current;
        setPlayingLine(null);
        setSpeaking(true);
        setRecent(current => [text, ...current.filter(item => item !== text)].slice(0, 30));
        if (pendingFix.current) pendingFix.current.play = false;
        await say(text, { voice: settings.voice, rate: settings.rate });
        if (speechTurn.current === turn) setSpeaking(false);
    }

    // ▶ or Ctrl+Shift+Enter: the whole story, one sentence after another, until it ends or something else is said.
    async function playStory() {
        if (!story?.length) return;
        const lines = story.map(line => line.text), turn = ++speechTurn.current;
        if (pendingFix.current) pendingFix.current.play = false;
        setSpeaking(true);
        for (let index = 0; index < lines.length && speechTurn.current === turn; index++) {
            setPlayingLine(index);
            await say(lines[index], { voice: settings.voice, rate: settings.rate });
        }
        if (speechTurn.current === turn) { setPlayingLine(null); setSpeaking(false); }
    }

    function stopSpeaking() {
        speechTurn.current++;
        setPlayingLine(null);
        stop();
        setSpeaking(false);
    }

    function toggleStory() {
        if (story?.length && !confirm('Turn off Story? Your story will be deleted.\n\nVols desactivar la història? S\'esborrarà.')) return;
        if (playingLine !== null) stopSpeaking();
        remember();
        setStory(story ? null : []);
        setOpenLine(null);
        resetFix();
    }

    function speakWord(word: string) {
        if (!settings.tapSound || word === '?') return;
        // The word cuts off whatever was being said.
        speechTurn.current++;
        setPlayingLine(null);
        setSpeaking(false);
        // Online, a tap plays an Edge clip; the laptop board taps with the device's voice.
        if (status.naturalWordVoice) void say(word, settings, 'word');
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
        if (!draft.trim() && value.trim()) remember(); // a typed word is one step back, not one per letter
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
        remember();
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
        remember();
        const { words, indexOf } = materializeDraft();
        const position = indexOf(index);
        const [word] = words.splice(position, 1);
        originalWord.current = word;
        setTokens(words); setInsertAt(position); setSelectedWord(null); setDraft(word.w);
        typing.current?.focus();
        requestAnimationFrame(() => typing.current?.select());
    }

    function deleteWord(index: number) {
        remember();
        setTokens(tokens.filter((_, i) => i !== index));
        if (insertAt !== null && index < insertAt) setInsertAt(insertAt - 1);
        setSelectedWord(null);
        resetFix();
    }

    function tap(word: Word) {
        if (!word.w) return;
        // ? makes the words so far a question ("you want coffee" → "you want coffee?"): it is said as one, Fix makes a
        // question of it. It needs words before it, and once is enough; ⌫ takes it away.
        const preceding = draft.trim() || tokens[cursor - 1]?.w;
        if (word.w === '?' && (!preceding || preceding.endsWith('?') || tokens[cursor]?.w === '?')) return;
        remember();
        insertWords([...draftWords(), token({ w: word.w, e: word.e, s: word.s })]);
        resetFix();
        speakWord(word.w);
    }

    // A button found by typing: it takes the place of the letters typed for it, and earlier typed words stay.
    function pick(hit: Hit, typedWords: number) {
        remember();
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

    // ⌫ takes away the last word: from what is being typed first, then from the bar. On an empty bar it takes the open
    // story sentence out of the story, or else opens the last one to be changed. Holding the key down does neither, or
    // it would take the story apart line by line.
    function backspace(repeat = false) {
        if (selectedWord !== null) { deleteWord(selectedWord); return; }
        resetFix();
        if (draft.trim()) {
            remember();
            const rest = withoutLastWord(draft);
            setDraft(rest ? `${rest} ` : ''); // the space lets the next word be typed straight on
            return;
        }
        setDraft('');
        if (!message && story && !repeat) {
            if (openLine !== null) { finishSentence(); return; }
            if (story.length) { openStoryLine(story[story.length - 1].id); return; }
        }
        if (cursor === 0) return;
        deleteWord(cursor - 1);
    }

    function newSentence() {
        finishSentence();
        typing.current?.focus();
    }

    // Clears the bar for the next sentence. With Story on, the bar's sentence goes into the story: the fix already
    // showing (or the suggestion the speaker tapped), or else Fix is asked now and its answer replaces the words when
    // it arrives. A sentence opened from the story goes back in its place, or leaves the story if the bar was emptied.
    function finishSentence(): StoryLine[] | null {
        if (message || story && openLine !== null) remember();
        let lines = story;
        if (lines) {
            const open = lines.findIndex(line => line.id === openLine);
            const before = (open < 0 ? lines : lines.slice(0, open)).map(line => line.text);
            const taken = takenFix.current;
            const line = fix?.state === 'done' ? fixedLine(fix.fix)
                : open >= 0 && message === lines[open].text ? lines[open]
                : taken && message === taken.text ? storyLine(taken.text, taken.ca)
                : message ? storyLineFor(message.slice(0, MAX_TEXT), before) : null;
            if (open >= 0) lines = [...lines.slice(0, open), ...line ? [line] : [], ...lines.slice(open + 1)];
            else if (line) lines = [...lines, line];
            setStory(lines);
        }
        setOpenLine(null);
        resetFix();
        setTokens([]); setDraft('');
        originalWord.current = null;
        takenFix.current = null;
        setSelectedWord(null); setInsertAt(null);
        return lines;
    }

    function fixedLine({ sentence, alternatives, translation }: Fix) {
        const alternative = alternatives.includes(spokenChoice.current) ? spokenChoice.current : '';
        return storyLine(alternative || sentence, alternative ? undefined : translation);
    }

    function storyLineFor(text: string, before: string[]): StoryLine {
        if (!status.fix) return storyLine(text);
        const line = storyLine(text, undefined, true);
        void fetchFix(text, before).then(answer => {
            if ('off' in answer) updateStatus({ fix: false });
            const fixed = 'fix' in answer ? answer.fix : null;
            const done: StoryLine = fixed ? { id: line.id, text: fixed.sentence, ...(fixed.translation ? { ca: fixed.translation } : {}) }
                : { id: line.id, text };
            fixedLines.current.set(line.id, done);
            setStory(current => current && current.map(item => item.id === line.id ? done : item));
        });
        return line;
    }

    // A tap on a story sentence: the bar's sentence is finished first, as with New sentence. Then the tapped one comes
    // into the bar to be changed, or emptied to take it out of the story.
    function openStoryLine(id: number) {
        remember();
        const line = finishSentence()?.find(item => item.id === id);
        if (!line) return;
        setTokens(sentenceTokens(line.text));
        setOpenLine(id);
    }

    // A finished sentence back in the bar as buttons: the words that are buttons with their pictures, other forms
    // ("went", "friends") as typed words.
    const sentenceTokens = (text: string) => sentenceWords(board, text).map(token);

    // ✏️ on a suggestion or a phrase: it comes into the bar to be changed or added to, in place of the words there.
    // fixed: it is Fix's answer (with its translation, for the main one), so the story can keep it unchanged.
    function editSentence(text: string, fixed?: { ca?: string }) {
        remember();
        originalWord.current = null;
        setTokens(sentenceTokens(text)); setDraft(''); setSelectedWord(null); setInsertAt(null);
        resetFix();
        takenFix.current = fixed ? { text, ...(fixed.ca ? { ca: fixed.ca } : {}) } : null;
    }

    // The story before the bar's sentence: before the open line, or all of it.
    function storyBefore() {
        if (!story) return [];
        const open = story.findIndex(line => line.id === openLine);
        return (open < 0 ? story : story.slice(0, open)).map(line => line.text);
    }

    async function fetchFix(text: string, before: string[]): Promise<FixAnswer> {
        try {
            const response = await fetch('/api/fix', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-device': deviceId() },
                body: JSON.stringify({ text, level: settings.level, language: settings.language,
                    ...(before.length ? { context: storyContext(before) } : {}) }),
                signal: AbortSignal.timeout(20_000)
            });
            if (response.status === 403) return { off: true };
            const body = await response.json();
            return response.ok ? { fix: body as Fix } : { error: body.error || 'No suggestion right now.' };
        } catch {
            return { error: 'No suggestion right now. You can still speak your words.' };
        }
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
        const answer = await fetchFix(message, storyBefore());
        if (pendingFix.current !== request) return;
        pendingFix.current = null;
        if ('off' in answer) updateStatus({ fix: false });
        else if ('error' in answer) setFix({ state: 'error', message: answer.error });
        else {
            setFix({ state: 'done', fix: answer.fix });
            if (request.play) hear(answer.fix.sentence);
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
        { id: 'core', name: 'Core', ca: 'Paraules bàsiques', icon: '⭐' }, { id: 'quick', name: 'Quick', ca: 'Frases ràpides', icon: '⚡', kind: 'social' },
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
            <button className="icon" onClick={() => { editSentence(text); setTab('core'); }} aria-label="Edit"
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
            } else if ((event.key === 'Enter' || event.key === 'Tab') && found) {
                event.preventDefault();
                pick(found.hits[chosenHit], found.words);
            } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && found
                && event.currentTarget.selectionStart === draft.length && event.currentTarget.selectionEnd === draft.length) {
                // At the end of the typed letters, → and ← choose among the buttons found instead of moving back.
                const next = chosenHit + (event.key === 'ArrowRight' ? 1 : -1);
                if (next < 0 || next >= found.hits.length) return;
                event.preventDefault();
                setFoundChoice({ query: found.query, index: next });
            } else if (event.key === 'Enter') {
                event.preventDefault();
                if (insertAt === null) hear(message);
                finishEditing();
            } else if (event.key === 'Backspace' && !draft) { event.preventDefault(); backspace(event.repeat); }
        }}
    />;

    return (
        <div className="app" style={{ '--key-size': settings.keySize } as CSSProperties} onClick={event => {
            // Commit after the tap lands. Collapsing the field on blur can move the tapped control before pointerup.
            if (originalWord.current && event.target instanceof Element && !event.target.closest('.bar, .erase')) finishEditing();
        }}>
            <header className="top">
                {story && (
                    <div className="story-view">
                        <button className="icon story-play" onClick={() => playingLine === null ? void playStory() : stopSpeaking()}
                            disabled={!story.length} aria-label={playingLine === null ? 'Hear the story' : 'Stop'}
                            title="Ctrl+Shift+Enter" aria-keyshortcuts="Control+Shift+Enter"
                            data-ca={playingLine === null ? 'Escolta la història' : 'Atura'}>{playingLine === null ? '▶' : '⏹'}</button>
                        <div className="story-lines" ref={storyBox}>
                            {story.map((line, index) => (
                                <button key={line.id} onClick={() => openStoryLine(line.id)} data-ca={line.ca || undefined}
                                    className={`story-line${index === playingLine ? ' on' : ''}${line.id === openLine ? ' open' : ''}${line.pending ? ' pending' : ''}`}>
                                    {line.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <SentenceBar words={tokens} cursor={cursor} selected={selectedWord} input={inlineInput}
                    select={selectWord} edit={editWord} move={moveWord} insert={startInsertion} remove={deleteWord} />
                <div className="actions">
                    <button className="act erase" onClick={() => backspace()} disabled={!message && !story?.length}
                        aria-label={!message && openLine !== null ? 'Take this sentence out of the story' : !message && story?.length ? 'Change the last sentence'
                            : selectedWord !== null ? 'Delete selected word' : insertAt !== null ? 'Delete preceding word' : 'Delete last word'}
                        data-ca={!message && openLine !== null ? 'Treu la frase de la història' : !message && story?.length ? 'Canvia l\'última frase' : 'Esborra una paraula'}>⌫</button>
                    <button className="act" onClick={newSentence} disabled={!message && openLine === null}
                        title="Shift+Enter"
                        aria-keyshortcuts="Shift+Enter" data-ca="Frase nova">New sentence</button>
                    <button className="act save" onClick={() => toggleSaved(message)} disabled={!message} aria-label="Save this phrase"
                        data-ca={saved.includes(message) ? 'Treu-la de les desades' : 'Desa aquesta frase'}>{saved.includes(message) ? '★' : '☆'}</button>
                    {(status.fix || story) && <button className="act story" aria-pressed={!!story} title="Keep the tense across sentences"
                        data-ca="Història" onClick={toggleStory}>Story</button>}
                    {status.fix && <button className="act fix" onClick={() => void askFix()} disabled={!message || fix?.state === 'loading'}
                        title="Review suggestion (Ctrl+Enter to fix and speak)" data-ca="Corregeix la frase">✨ Fix</button>}
                    {/* With Fix on, its suggestions are what is said (each one speaks when tapped), so Fix has the place
                        of Speak. Speak is there when the teacher switches Fix off: without it a tablet could not say
                        a whole sentence. */}
                    {!status.fix && <button className="act speak" onClick={() => speaking ? stopSpeaking() : hear(message)} disabled={!message && !speaking}
                        data-ca={speaking ? 'Atura' : 'Parla'}>{speaking ? '⏹ Stop' : '🔊 Speak'}</button>}
                </div>
                {found && (
                    <div className="found" ref={foundRow} aria-label={`Buttons for "${found.query}"`}>
                        {found.hits.map((hit, index) => (
                            <button key={`${hit.page}-${hit.index}`} className={`found-key k-${hit.word.k}${index === chosenHit ? ' on' : ''}`} onClick={() => pick(hit, found.words)}
                                data-ca={hit.word.ca || undefined} title={hit.page === 'core' ? 'Core' : hit.pageName}>
                                <Picture word={hit.word} className="found-pic" />
                                <span className="found-word">{hit.word.w}</span>
                                {hit.word.ca && <span className="found-ca" lang="ca">{hit.word.ca}</span>}
                            </button>
                        ))}
                    </div>
                )}
                {fix?.state === 'loading' && <div className="fixbox">Thinking…</div>}
                {/* No suggestion: the speaker's own words, to say them anyway. */}
                {fix?.state === 'error' && (
                    <div className="fixbox warn">{fix.message}
                        {message && <button className="suggest" onClick={() => hear(message)} data-ca="Digues les teves paraules">
                            <span className="say" aria-hidden="true">🔊</span><span className="en">{message}</span>
                        </button>}
                    </div>
                )}
                {/* 🔊 says a suggestion; ✏️ brings it into the bar to change it or add to it. */}
                {fix?.state === 'done' && (
                    <div className="fixbox">
                        <div className="suggest-row">
                            <button className="suggest main" onClick={() => hear(fix.fix.sentence)} data-ca={fix.fix.translation ? undefined : 'Escolta aquesta frase'}>
                                <span className="say" aria-hidden="true">🔊</span>
                                <span className="en">{fix.fix.sentence}</span>
                                {fix.fix.translation && <span className="ca" lang="ca">{fix.fix.translation}</span>}
                            </button>
                            <button className="icon" onClick={() => editSentence(fix.fix.sentence, { ca: fix.fix.translation })}
                                aria-label="Change this sentence" data-ca="Edita la frase">✏️</button>
                        </div>
                        {fix.fix.alternatives.length > 0 && <div className="or">Or did you mean:</div>}
                        {fix.fix.alternatives.map(text => (
                            <div className="suggest-row" key={text}>
                                <button className="suggest" onClick={() => hear(text)} data-ca="Escolta aquesta frase">
                                    <span className="say" aria-hidden="true">🔊</span><span className="en">{text}</span>
                                </button>
                                <button className="icon" onClick={() => editSentence(text, {})}
                                    aria-label="Change this sentence" data-ca="Edita la frase">✏️</button>
                            </div>
                        ))}
                    </div>
                )}
            </header>

            <div className="tab-row">
                <nav className="tabs">
                    {tabs.map(item => (
                        <button key={item.id} className={`tab ${item.kind ? `k-${item.kind}` : 'plain'}${tab === item.id ? ' on' : ''}`} onClick={() => setTab(item.id)} data-ca={item.ca || undefined}>
                            <span className="tab-icon" aria-hidden="true">{item.icon}</span>{item.name}
                        </button>
                    ))}
                </nav>
                <div className="key-size" role="group" aria-label="Button size">
                    <button onClick={() => set('keySize', KEY_SIZES[keyStep - 1])} disabled={keyStep === 0}
                        aria-label="Smaller buttons" title={`${Math.round(settings.keySize * 100)}%`} data-ca="Botons més petits">−</button>
                    <button onClick={() => set('keySize', KEY_SIZES[keyStep + 1])} disabled={keyStep === KEY_SIZES.length - 1}
                        aria-label="Bigger buttons" title={`${Math.round(settings.keySize * 100)}%`} data-ca="Botons més grans">+</button>
                </div>
            </div>

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
                        <p className="hint">Ctrl+Enter fixes and speaks. Shift+Enter starts a new sentence. Turn on Story to carry the tense into the next sentence. Turn it off to end the story.</p>
                        <p className="hint">Type a few letters, in English or Catalan, to find a button: tap it, or press Enter for the first one (→ chooses the next). ? stands for one letter and * for any number (h?t, *ppy).</p>
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
