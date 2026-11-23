// /create: the teacher adds, changes and removes the board's buttons, then saves them for everyone.

import { useEffect, useMemo, useRef, useState } from 'react';
import { KINDS, LIMITS, pageKind, sanitizeBoard, type Board, type Kind, type Word } from '../shared/board.ts';
import { ONLINE_BOARD_URL, type BoardSync, type TeacherSettings } from '../shared/options.ts';
import { fetchBoard } from './boardData.ts';
import { Key, Picture } from './Key.tsx';
import { findButtons, type Hit } from './search.ts';
import { coreFull, coreSlot, joinStarred, linkStars, star, unstar, unstarRemoved } from './stars.ts';
import { SymbolPicker } from './SymbolPicker.tsx';
import { DraftImages, previewImage, type DraftImage } from './uploadImage.ts';
import { isUploadedImage } from '../shared/images.ts';
import { DEFAULT_BOARD } from './vocab.ts';

const TOKEN = 'teacher-session';
const BATCH = 60; // MAX_ITEMS in worker/translate.ts

// Tells the translator which meaning a word has.
const HINT: Record<Kind, string> = {
    person: 'person word', verb: 'verb', describe: 'describing word', noun: 'noun', question: 'question word',
    social: 'social word', no: 'yes/no answer or negation', little: 'small function word'
};

type Target = { text: string; hint: string; apply: (draft: Board, ca: string) => void };

// Every button, page name and phrase that has no Catalan yet. apply() only fills it if it is still unchanged.
function missingCatalan(board: Board): Target[] {
    const targets: Target[] = [];
    board.core.forEach((word, i) => {
        if (word.w && !word.ca) targets.push({ text: word.w, hint: `${HINT[word.k]}, core word`, apply: (draft, ca) => {
            const item = draft.core[i];
            if (item?.w === word.w && !item.ca) item.ca = ca;
        } });
    });
    board.pages.forEach((page, p) => {
        if (!page.ca) targets.push({ text: page.name, hint: 'name of a page of buttons', apply: (draft, ca) => {
            const item = draft.pages[p];
            if (item?.name === page.name && !item.ca) item.ca = ca;
        } });
        page.words.forEach((word, i) => {
            // A starred button is translated once, as a core word.
            if (word.w && !word.ca && !board.core.includes(word)) targets.push({ text: word.w, hint: `${HINT[word.k]} on the ${page.name} page`, apply: (draft, ca) => {
                const item = draft.pages[p]?.words[i];
                if (item?.w === word.w && !item.ca) item.ca = ca;
            } });
        });
    });
    board.quick.forEach((phrase, i) => {
        if (!phrase.ca) targets.push({ text: phrase.t, hint: 'phrase', apply: (draft, ca) => {
            const item = draft.quick[i];
            if (item?.t === phrase.t && !item.ca) item.ca = ca;
        } });
    });
    return targets;
}

const FoundKey = ({ hit, onClick }: { hit: Hit; onClick: () => void }) => (
    <button className={`found-key k-${hit.word.k}`} onClick={onClick}>
        <Picture word={hit.word} className="found-pic" />
        <span className="found-word">{hit.word.w} <small className="found-page">· {hit.pageName}</small></span>
        {hit.word.ca && <span className="found-ca" lang="ca">{hit.word.ca}</span>}
    </button>
);

// An empty Core slot is filled by starring a button from a page into it.
function StarSlot({ board, onPick }: { board: Board; onPick: (hit: Hit) => void }) {
    const [text, setText] = useState('');
    const hits = text.trim() ? findButtons(board, text, { distinct: false, limit: 30 }).filter(hit => hit.page !== 'core' && coreSlot(board, hit.word) < 0) : [];
    return (
        <>
            <label>Star a button into this slot
                <input value={text} autoFocus placeholder="Find it: English or Catalan" onChange={event => setText(event.target.value)} />
            </label>
            {text.trim() && (
                <div className="find-results">
                    {hits.length === 0 && <p className="hint">No unstarred button matches “{text.trim()}”. A new word goes on a page first.</p>}
                    {hits.map(hit => <FoundKey key={`${hit.page}-${hit.index}`} hit={hit} onClick={() => onPick(hit)} />)}
                </div>
            )}
        </>
    );
}

function readToken() {
    try { return sessionStorage.getItem(TOKEN) ?? ''; } catch { return ''; }
}
function keepToken(token: string) {
    try { if (token) sessionStorage.setItem(TOKEN, token); else sessionStorage.removeItem(TOKEN); } catch { /* kept for this page only */ }
}

export default function Create() {
    const [token, setToken] = useState(readToken);
    const [password, setPassword] = useState('');
    const [board, setBoard] = useState<Board | null>(null); // the draft
    const [images] = useState(() => new Map<string, DraftImage>());
    const [savedJson, setSavedJson] = useState('');
    const [custom, setCustom] = useState(false);
    const [boardSync, setBoardSync] = useState<BoardSync>({});
    const [settings, setSettings] = useState<TeacherSettings | null>(null);
    const ai = !!settings?.key; // the editor's ✨ Catalan needs the OpenAI key, whatever the students' switch says
    const [tab, setTab] = useState('core');
    const [selected, setSelected] = useState<number | null>(null);
    const [findText, setFindText] = useState('');
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

    const dirty = !!board && JSON.stringify(board) !== savedJson;
    useEffect(() => {
        if (!images.size) return;
        const used = new Set(board && [...board.core, ...board.pages.flatMap(page => page.words)].map(word => word.s));
        for (const url of images.keys()) if (!used.has(url)) {
            URL.revokeObjectURL(url);
            images.delete(url);
        }
    }, [board, images]);
    useEffect(() => () => { for (const url of images.keys()) URL.revokeObjectURL(url); }, [images]);
    const missing = useMemo(() => board ? missingCatalan(board) : [], [board]);
    // The button just left may have become a starred one (see joinStarred).
    const here = useRef<{ tab: string; index: number } | null>(null);
    useEffect(() => {
        const left = here.current;
        here.current = selected === null ? null : { tab, index: selected };
        if (left) setBoard(current => current && joinStarred(current, left.tab, left.index));
    }, [tab, selected]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    function start(next: Board, isCustom: boolean, { revision, sync }: BoardSync) {
        const clean = sanitizeBoard(next) ?? DEFAULT_BOARD;
        setBoard(linkStars(structuredClone(clean)));
        setSavedJson(JSON.stringify(clean));
        setCustom(isCustom);
        setBoardSync({ revision, sync });
    }
    // The board to edit, or a message saying why there is none.
    async function loadBoard(): Promise<string | void> {
        const result = await fetchBoard();
        if (!result) throw new Error('Could not load the board. Check the connection and reload.');
        start(result.board, result.custom, result);
    }
    // Already signed in from earlier in this tab.
    useEffect(() => {
        const saved = readToken();
        if (!saved) return;
        void fetch('/api/teacher/settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-teacher-session': saved }, body: '{}' })
            .then(response => response.ok ? response.json() : null).then(result => { if (result) setSettings(result as TeacherSettings); }).catch(() => {});
        void fetchBoard().then(result => {
            if (!result) return setMessage({ text: 'Could not load the board. Check the connection and reload.', bad: true });
            start(result.board, result.custom, result);
        });
    }, []);

    function signOut(text?: string) {
        keepToken('');
        setToken('');
        if (text) setMessage({ text, bad: true });
    }

    async function call(path: string, body: unknown, session = token): Promise<any> {
        const response = await fetch(path, {
            method: 'POST', headers: { 'content-type': body instanceof Blob ? body.type : 'application/json', 'x-teacher-session': session },
            body: body instanceof Blob ? body : JSON.stringify(body)
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 401 && path !== '/api/teacher/login') {
            signOut('Your session ended. Sign in again: your changes are still here.');
            throw new Error('');
        }
        if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
        return result;
    }

    async function run(label: string, task: () => Promise<string | void>) {
        setBusy(label);
        setMessage(null);
        try {
            const text = await task();
            if (text) setMessage({ text });
        } catch (error) {
            if ((error as Error).message) setMessage({ text: (error as Error).message, bad: true });
        } finally {
            setBusy('');
        }
    }

    const login = () => run('Signing in…', async () => {
        const { token: next } = await call('/api/teacher/login', { password });
        keepToken(next);
        setToken(next);
        setPassword('');
        setSettings(await call('/api/teacher/settings', {}, next));
        if (!board) await loadBoard(); // after a session ends mid-edit, the draft is kept
    });

    // For a saved answer that turned out wrong: everything is asked again the next time it is needed.
    const forget = () => {
        if (!confirm('Forget every saved correction, translation and voice clip on this laptop? They will be fetched again (and paid for again) when needed.')) return;
        void run('Forgetting…', async () => {
            setSettings(await call('/api/teacher/forget', {}));
            return 'Forgotten. New answers will be saved as students use Fix and Speak.';
        });
    };
    // Saved at once, not with the board: it is about the lesson, not the buttons.
    const toggleFix = () => run('Saving…', async () => {
        const next = await call('/api/teacher/settings', { fixOn: !settings?.fixOn }) as TeacherSettings;
        setSettings(next);
        return next.fixOn ? 'Fix is on: students can correct their sentences with AI.' : 'Fix is off: students only see their own words. Their screens update within 30 seconds.';
    });

    if (!token) {
        return (
            <div className="create login">
                <form className="login-card" onSubmit={event => { event.preventDefault(); void login(); }}>
                    <h1>Communicator <span>Create</span></h1>
                    <p>Change the board's buttons for everyone. Use your PinPlay teacher password.</p>
                    <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Teacher password" autoFocus aria-label="Teacher password" />
                    <button className="primary" disabled={!password || !!busy}>{busy || 'Sign in'}</button>
                    {message && <p className={message.bad ? 'msg bad' : 'msg'}>{message.text}</p>}
                    <a href="/">← Back to the board</a>
                </form>
            </div>
        );
    }
    if (!board) return <div className="create login"><p className={message?.bad ? 'msg bad' : 'msg'}>{message?.text || busy || 'Loading…'}</p></div>;

    // Every change goes through here: a copy of the draft, changed, becomes the draft.
    const edit = (change: (draft: Board) => void) => setBoard(current => {
        if (!current) return current;
        const next = structuredClone(current);
        change(next);
        return next;
    });

    const pageIndex = board.pages.findIndex(page => page.id === tab);
    const page = pageIndex >= 0 ? board.pages[pageIndex] : null;
    const words = tab === 'core' ? board.core : page?.words ?? null;
    const listOf = (draft: Board) => tab === 'core' ? draft.core : draft.pages[pageIndex].words;
    const word = words && selected !== null ? words[selected] : undefined;
    // Where a starred button is: its Core slot (from 1, or 0) and the page it lives on, even while its English is
    // cleared to type another (an empty Core slot has no page, so it offers buttons to star).
    const slot = word ? coreSlot(board, word) + 1 : 0;
    const home = word && board.pages.find(item => item.words.includes(word));
    const limit = tab === 'core' ? LIMITS.core : LIMITS.words;

    const choose = (id: string) => { setTab(id); setSelected(null); };
    // A starred button is one object in Core and on its page (see stars.ts), so this changes it in both.
    const setWord = (fields: Partial<Word>) => edit(draft => { Object.assign(listOf(draft)[selected!], fields); });
    const toggleStar = () => edit(draft => {
        const item = listOf(draft)[selected!];
        if (coreSlot(draft, item) >= 0) unstar(draft, item);
        else star(draft, item);
    });
    const starInto = (hit: Hit) => edit(draft => { draft.core[selected!] = draft.pages.find(item => item.id === hit.page)!.words[hit.index]; });
    function moveWord(delta: number) {
        const to = selected! + delta;
        if (!words || to < 0 || to >= words.length) return;
        edit(draft => { const list = listOf(draft); [list[selected!], list[to]] = [list[to], list[selected!]]; });
        setSelected(to);
    }
    // keepSlot: Core's Unstar, which leaves the slot empty. A button removed from its page leaves Core too.
    function removeWord(keepSlot: boolean) {
        if (keepSlot) return edit(draft => { draft.core[selected!] = { w: '', k: draft.core[selected!].k }; });
        edit(draft => { unstarRemoved(draft, listOf(draft).splice(selected!, 1)); });
        setSelected(words!.length > 1 ? Math.min(selected!, words!.length - 2) : null);
    }
    function addWord() {
        if (!words || words.length >= limit) return;
        const blank = tab === 'core' ? words.findIndex(item => !item.w) : -1;
        if (blank >= 0) return setSelected(blank); // fill an empty core slot first
        const kind = words.at(-1)?.k ?? 'noun';
        edit(draft => { listOf(draft).push({ w: '', k: kind }); });
        setSelected(words.length);
    }

    function addPage() {
        if (board!.pages.length >= LIMITS.pages) return;
        const id = `p${Date.now().toString(36)}`;
        edit(draft => { draft.pages.push({ id, name: 'New page', icon: '📄', words: [] }); });
        choose(id);
    }
    function movePage(delta: number) {
        const to = pageIndex + delta;
        if (to < 0 || to >= board!.pages.length) return;
        edit(draft => { [draft.pages[pageIndex], draft.pages[to]] = [draft.pages[to], draft.pages[pageIndex]]; });
    }
    function deletePage() {
        const starred = page?.words.filter(item => coreSlot(board!, item) >= 0).length;
        if (!page || !confirm(`Delete the page "${page.name}" and its ${page.words.length} buttons?`
            + (starred ? ` ${starred} of them ${starred === 1 ? 'is' : 'are'} starred and will leave Core too.` : ''))) return;
        edit(draft => { unstarRemoved(draft, draft.pages.splice(pageIndex, 1)[0].words); });
        choose('core');
    }

    const translate = (targets: Target[]) => run('Translating…', async () => {
        for (let i = 0; i < targets.length; i += BATCH) {
            const batch = targets.slice(i, i + BATCH);
            const { ca } = await call('/api/teacher/translate', { items: batch.map(({ text, hint }) => ({ text, hint })) }) as { ca: string[] };
            edit(draft => batch.forEach((target, j) => { if (ca[j]) target.apply(draft, ca[j]); }));
        }
        return targets.length > 1 ? `Added Catalan to ${targets.length} items. Check them, then Save.` : '';
    });
    // The ✨ next to one Catalan box: translate just that item, replacing what is there.
    const translateOne = (text: string, hint: string, apply: (draft: Board, ca: string) => void) => translate([{ text, hint, apply }]);

    const save = () => run('Saving…', async () => {
        const empty = board.pages.reduce((sum, item) => sum + item.words.filter(entry => !entry.w).length, 0)
            + board.quick.filter(item => !item.t.trim()).length;
        const next = structuredClone(selected === null ? board : joinStarred(board, tab, selected));
        for (const word of [...next.core, ...next.pages.flatMap(page => page.words)]) {
            if (!word.w.trim() || !word.s?.startsWith('blob:')) continue;
            const image = images.get(word.s);
            if (!image) throw new Error('Choose the image file again before saving.');
            if (!image.name) {
                const { name } = await call('/api/teacher/image', image.file);
                if (!isUploadedImage(name)) throw new Error('The picture could not be saved. Try again.');
                image.name = name;
            }
            word.s = image.name;
        }
        const result = await call('/api/teacher/board', { board: next, revision: boardSync.revision }) as { board: Board } & BoardSync;
        start(result.board, true, result);
        setSelected(null);
        const saved = result.sync === 'synced' ? 'Saved to Git on main.' : result.sync === 'offline'
            ? 'Saved on this laptop. Git sync will retry automatically.' : 'Saved.';
        return `${saved} Open student boards refresh automatically.${empty ? ` ${empty} empty button${empty === 1 ? ' was' : 's were'} left out.` : ''}`;
    });
    // Coloured as on the students' board (see App.tsx).
    const tabs: { id: string; name: string; icon: string; kind?: Kind }[] = [{ id: 'core', name: 'Core', icon: '⭐' },
        { id: 'quick', name: 'Quick phrases', icon: '⚡', kind: 'social' }, ...board.pages.map(page => ({ ...page, kind: pageKind(page.words) }))];

    const editor = (
        <div className="create">
            <header className="create-top">
                <h1>Communicator <span>Create</span></h1>
                <span className={`state${dirty ? ' dirty' : ''}`}>{busy || (dirty ? 'Unsaved changes' : boardSync.sync === 'conflict' ? 'Git sync conflict'
                    : boardSync.sync === 'offline' ? 'Git sync offline' : custom ? 'Saved' : 'Built-in board')}</span>
                <div className="create-actions">
                    {ai && <button onClick={() => void translate(missing)} disabled={!missing.length || !!busy}
                        title="Translate every button, page name and phrase that has no Catalan">✨ Fill missing Catalan{missing.length ? ` (${missing.length})` : ''}</button>}
                    <button onClick={() => { setBoard(linkStars(JSON.parse(savedJson))); setSelected(null); }} disabled={!dirty || !!busy}>Undo changes</button>
                    <a className="button" href="/" target="_blank" rel="noopener">Open the board ↗</a>
                    <button disabled={!!busy} onClick={() => { if (!dirty || confirm('Sign out and lose the unsaved changes?')) { signOut(); setBoard(null); } }}>Sign out</button>
                    <button className="primary" onClick={() => void save()} disabled={!dirty || !!busy}
                        title={boardSync.revision !== undefined ? 'Save the board and quick phrases to the public main branch' : undefined}>Save</button>
                </div>
            </header>
            <div className="lesson">
                {settings?.lanUrl && <span>📶 Students open <b className="address">{settings.lanUrl}</b> on the school Wi-Fi</span>}
                <a href={ONLINE_BOARD_URL} target="_blank" rel="noopener">Always-online student board ↗</a>
                {settings && (settings.key ? (
                    <button className={`switch${settings.fixOn ? ' on' : ''}`} role="switch" aria-checked={settings.fixOn} onClick={() => void toggleFix()} disabled={!!busy}
                        title="Whether students can press Fix to correct their sentence with OpenAI">
                        <span className="knob" aria-hidden="true" /> ✨ Fix for students: <b>{settings.fixOn ? 'On' : 'Off'}</b>
                    </button>
                ) : <span className="state">No OpenAI key in .dev.vars, so Fix is off.</span>)}
                {settings && (
                    <span className="saved" title="Each correction, translation and voice clip is fetched once and then reused for everyone, like PinPlay's voice cache">
                        ♻️ Saved on this laptop: {settings.saved.fix} corrections, {settings.saved.ca} translations, {settings.saved.speech} voice clips
                        {' · '}reused {settings.saved.reused} times
                        <button className="link" onClick={() => void forget()} disabled={!!busy || !(settings.saved.fix + settings.saved.ca + settings.saved.speech)}>Forget them</button>
                    </span>
                )}
            </div>
            {message && <div className={message.bad ? 'msg bad' : 'msg'} role="status">{message.text}</div>}

            {/* Find a button by its English or Catalan; a result opens its page with it selected. Every place a word is
                (Core and its page) is listed: a starred button is one button in both, so either changes it. */}
            <div className="find">
                <input value={findText} onChange={event => setFindText(event.target.value)} aria-label="Find a button"
                    placeholder="🔍 Find a button: English or Catalan (? one letter, * any letters)"
                    onKeyDown={event => { if (event.key === 'Escape') setFindText(''); }} />
                {findText.trim() && (() => {
                    const hits = findButtons(board, findText, { distinct: false, limit: 30 });
                    return (
                        <div className="find-results">
                            {hits.length === 0 && <p className="hint">No button matches “{findText.trim()}”.</p>}
                            {hits.map(hit => <FoundKey key={`${hit.page}-${hit.index}`} hit={hit}
                                onClick={() => { setTab(hit.page); setSelected(hit.index); setFindText(''); }} />)}
                        </div>
                    );
                })()}
            </div>

            <nav className="tabs">
                {tabs.map(item => (
                    <button key={item.id} className={`tab ${item.kind ? `k-${item.kind}` : 'plain'}${tab === item.id ? ' on' : ''}`} onClick={() => choose(item.id)}>
                        <span aria-hidden="true">{item.icon}</span> {item.name}
                    </button>
                ))}
                <button className="tab plain add" onClick={addPage} disabled={!!busy || board.pages.length >= LIMITS.pages}>+ Page</button>
            </nav>

            <fieldset className="create-body" disabled={!!busy}>
                <section className="create-main">
                    {page && (
                        <div className="page-edit">
                            <label className="short">Icon<input value={page.icon} maxLength={LIMITS.emoji} onChange={event => edit(draft => { draft.pages[pageIndex].icon = event.target.value; })} /></label>
                            <label>Page name<input value={page.name} maxLength={LIMITS.name} onChange={event => edit(draft => { draft.pages[pageIndex].name = event.target.value; })} /></label>
                            <label>Catalan
                                <span className="inline">
                                    <input lang="ca" value={page.ca ?? ''} maxLength={LIMITS.name} onChange={event => edit(draft => { draft.pages[pageIndex].ca = event.target.value; })} />
                                    {ai && <button onClick={() => void translateOne(page.name, 'name of a page of buttons', (draft, ca) => { if (draft.pages[pageIndex]) draft.pages[pageIndex].ca = ca; })}
                                        disabled={!page.name.trim()} title="Translate with AI">✨</button>}
                                </span>
                            </label>
                            <span className="inline end">
                                <button onClick={() => movePage(-1)} disabled={pageIndex === 0} title="Move the page left">◀</button>
                                <button onClick={() => movePage(1)} disabled={pageIndex === board.pages.length - 1} title="Move the page right">▶</button>
                                <button className="danger" onClick={deletePage}>Delete page</button>
                            </span>
                        </div>
                    )}

                    {words && (
                        <div className={`grid${tab === 'core' ? ' core' : ''}`}>
                            {words.map((item, index) => <Key key={index} word={item} selected={index === selected} onTap={() => setSelected(index)}
                                starred={tab !== 'core' && coreSlot(board, item) >= 0} />)}
                            <button className="key add" onClick={addWord} disabled={words.length >= limit}>+ Add</button>
                        </div>
                    )}

                    {tab === 'quick' && (
                        <div className="quick-edit">
                            {board.quick.map((item, index) => (
                                <div className="quick-row" key={index}>
                                    <input value={item.t} maxLength={LIMITS.phrase} placeholder="English phrase" aria-label="English phrase"
                                        onChange={event => edit(draft => { draft.quick[index].t = event.target.value; })} />
                                    <input lang="ca" value={item.ca ?? ''} maxLength={LIMITS.phraseCa} placeholder="Catalan" aria-label="Catalan"
                                        onChange={event => edit(draft => { draft.quick[index].ca = event.target.value; })} />
                                    <span className="inline">
                                        {ai && <button onClick={() => void translateOne(item.t, 'phrase', (draft, ca) => { if (draft.quick[index]) draft.quick[index].ca = ca; })}
                                            disabled={!item.t.trim()} title="Translate with AI">✨</button>}
                                        <button onClick={() => edit(draft => { [draft.quick[index - 1], draft.quick[index]] = [draft.quick[index], draft.quick[index - 1]]; })}
                                            disabled={index === 0} title="Move up">↑</button>
                                        <button onClick={() => edit(draft => { [draft.quick[index + 1], draft.quick[index]] = [draft.quick[index], draft.quick[index + 1]]; })}
                                            disabled={index === board.quick.length - 1} title="Move down">↓</button>
                                        <button className="danger" onClick={() => edit(draft => { draft.quick.splice(index, 1); })} title="Remove">✕</button>
                                    </span>
                                </div>
                            ))}
                            <button className="add-phrase" onClick={() => edit(draft => { draft.quick.push({ t: '' }); })} disabled={board.quick.length >= LIMITS.quick}>+ Add phrase</button>
                        </div>
                    )}
                </section>

                {words && (
                    <aside className="create-side">
                        {!word ? (
                            <div className="side-help">
                                <h2>{tab === 'core' ? 'Core words' : page?.name}</h2>
                                <p>Click a button to change it, or <b>+ Add</b> for a new one. Saved changes reach students when they open or reload the board.</p>
                                {tab === 'core' ? <>
                                    <p>Core is the starred buttons. Each lives on a page: <b>☆ Star</b> it there, or click an empty slot here to star one into it. It is the same button in both places.</p>
                                    <p>Core words keep their places so hands learn where they are. <b>☆ Unstar</b> leaves the slot empty: the others stay put.</p>
                                </> : <p>★ marks a button that is starred on Core.</p>}
                                <p>Every button shows its Catalan when students hold it, or point at it with a mouse.</p>
                                <p>Choose a symbol, a photo or a GIF, upload a picture, or enter an emoji.</p>
                            </div>
                        ) : (
                            <div className="word-edit" key={`${tab}-${selected}`}>
                                <h2>{tab === 'core' ? `Core slot ${selected! + 1}` : `Button ${selected! + 1}`}</h2>
                                {tab === 'core' && !word.w && !home ? <StarSlot board={board} onPick={starInto} /> : <>
                                {tab !== 'core' ? (
                                    <button className={`star${slot ? ' on' : ''}`} onClick={toggleStar} disabled={!word.w || (!slot && coreFull(board))}
                                        title={slot ? 'Take it off Core. It stays on this page, and its Core slot stays empty so the other core words keep their places.'
                                            : coreFull(board) ? 'Core is full: unstar or empty a slot first' : 'Put it on Core too, in the first empty slot'}>
                                        {slot ? `★ On Core, slot ${slot}: unstar` : '☆ Star: add to Core'}
                                    </button>
                                ) : home ? (
                                    <p className="hint">Starred from <button className="link" onClick={() => { setTab(home.id); setSelected(home.words.indexOf(word)); }}>{home.name}</button>:
                                        the same button, so a change here changes it there too.</p>
                                ) : <p className="hint">On no page yet: a core word from before Core was the starred buttons.</p>}
                                <div className="preview"><Key word={word.w ? word : { ...word, w: '…' }} onTap={() => {}} /></div>
                                <label>English
                                    <input value={word.w} maxLength={LIMITS.word} autoFocus placeholder="Type a word"
                                        onChange={event => setWord({ w: event.target.value })} />
                                </label>
                                <SymbolPicker value={word.s} word={word.w} shared={boardSync.revision !== undefined} onPick={s => setWord({ s })}
                                    onUpload={file => void run('Opening image…', async () => {
                                        const preview = await previewImage(file);
                                        images.set(preview.url, preview);
                                        setWord({ s: preview.url });
                                    })} />
                                <label>{word.s ? 'Fallback emoji' : 'Emoji'}
                                    <input value={word.e ?? ''} maxLength={LIMITS.emoji} placeholder="Optional. Windows: press Win + ." onChange={event => setWord({ e: event.target.value })} />
                                </label>
                                <label>Catalan
                                    <span className="inline">
                                        <input lang="ca" value={word.ca ?? ''} maxLength={LIMITS.ca} onChange={event => setWord({ ca: event.target.value })} />
                                        {ai && <button disabled={!word.w.trim()} title="Translate with AI" onClick={() => {
                                            const at = selected!;
                                            const where = page ?? home;
                                            void translateOne(word.w, `${HINT[word.k]}${where ? ` on the ${where.name} page` : ', core word'}`, (draft, ca) => {
                                                const item = listOf(draft)[at];
                                                if (item) item.ca = ca;
                                            });
                                        }}>✨</button>}
                                    </span>
                                </label>
                                <label>Colour
                                    <select value={word.k} onChange={event => setWord({ k: event.target.value as Kind })}>
                                        {KINDS.map(item => <option key={item.kind} value={item.kind}>{item.name}</option>)}
                                    </select>
                                </label>
                                </>}
                                <span className="inline">
                                    <button onClick={() => moveWord(-1)} disabled={selected === 0}>◀ Move</button>
                                    <button onClick={() => moveWord(1)} disabled={selected === words.length - 1}>Move ▶</button>
                                </span>
                                {tab === 'core' ? (
                                    <span className="inline">
                                        {word.w && <button onClick={() => removeWord(true)}
                                            title={`Its slot stays empty, so the other core words keep their places.${home ? ` It stays on ${home.name}.` : ''}`}>
                                            {home ? '☆ Unstar' : 'Empty this slot'}</button>}
                                        <button className="danger" onClick={() => removeWord(false)} title="The words after it move back one place">Remove slot</button>
                                    </span>
                                ) : <button className="danger" onClick={() => removeWord(false)} title={slot ? 'It leaves Core too' : undefined}>Remove button</button>}
                                <button className="link" onClick={() => setSelected(null)}>Done</button>
                            </div>
                        )}
                    </aside>
                )}
            </fieldset>
        </div>
    );
    return <DraftImages.Provider value={images}>{editor}</DraftImages.Provider>;
}
