// Speaks with the Edge voice the laptop fetches, or with this device's own voice when that is not available.

import { DEFAULT_VOICE } from '../shared/voices.ts';

export type SpeakOptions = { voice: string; rate: number };

const WAIT_MS = 10_000; // a sleeping bridge can take longer; the device's voice speaks instead
const cache = new Map<string, Blob>(); // "voice|rate|text" -> clip, so repeating a phrase is instant
const KEEP_IN_MEMORY = 300; // more than a page of buttons, so moving between pages finds the clips again
const STORED = 'voice-clips';
const KEEP_STORED = 1500;
let trimmed = false;
let playing: HTMLAudioElement | null = null;
let turn = 0; // only the newest request may speak

// A random id for this device, so the laptop can tell students apart. Not crypto.randomUUID():
// the laptop's address is plain http, where browsers do not offer it.
export function deviceId(): string {
    try {
        let id = localStorage.getItem('device');
        if (!id) {
            id = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
            localStorage.setItem('device', id);
        }
        return id;
    } catch {
        return 'unknown';
    }
}

export function stop() {
    turn++;
    playing?.pause();
    playing = null;
    window.speechSynthesis?.cancel();
}

// The device's own English voice with the accent of the chosen voice ("en-US-EmmaMultilingualNeural" → en-US):
// a natural-sounding one if there is one, any with that accent, or any English one.
function deviceVoice(lang: string): SpeechSynthesisVoice | undefined {
    const english = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
    const accent = english.filter(voice => voice.lang.replace('_', '-') === lang);
    const natural = (list: SpeechSynthesisVoice[]) => list.find(voice => /natural|google|samantha/i.test(voice.name));
    return natural(accent) ?? accent[0] ?? natural(english) ?? english[0];
}

// The device's voice: instant and offline, used for single words and as the fallback. voiceId is the chosen Edge
// voice, whose accent the device voice follows.
export function sayOnDevice(text: string, rate = 1, voiceId = DEFAULT_VOICE): Promise<void> {
    return new Promise(resolve => {
        if (!window.speechSynthesis) return resolve();
        const utterance = new SpeechSynthesisUtterance(text);
        const lang = /^en-[A-Z]{2}/.exec(voiceId)?.[0] ?? 'en-US';
        utterance.lang = lang;
        utterance.rate = rate;
        const voice = deviceVoice(lang);
        if (voice) utterance.voice = voice;
        utterance.onend = utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}

// The clips heard this visit, the most recently heard last.
function keep(key: string, clip: Blob) {
    cache.delete(key);
    cache.set(key, clip);
    if (cache.size > KEEP_IN_MEMORY) cache.delete(cache.keys().next().value!);
}

// Clips also stay in the browser between visits, so a word heard before asks the server nothing: on the online
// board, each ask counts against the day's free allowance. Browsers keep such storage only for https pages, so this
// is the online board's; on the school Wi-Fi address it is simply not there. The name is only a key in that storage.
const storedName = (key: string) => `/voice-clips/${encodeURIComponent(key)}`;

async function storedClip(key: string): Promise<Blob | null> {
    try {
        const found = await (await globalThis.caches?.open(STORED))?.match(storedName(key));
        return found ? await found.blob() : null;
    } catch { return null; }
}

async function storeClip(key: string, clip: Blob) {
    try {
        const store = await globalThis.caches?.open(STORED);
        if (!store) return;
        await store.put(storedName(key), new Response(clip, { headers: { 'Content-Type': clip.type } }));
        if (trimmed) return;
        trimmed = true; // once a visit, as listing the stored clips takes a moment: the oldest beyond 1500 go
        const names = await store.keys();
        await Promise.all(names.slice(0, Math.max(0, names.length - KEEP_STORED)).map(name => store.delete(name)));
    } catch { /* full or unavailable: the clip is asked for again next time */ }
}

async function audioClip(text: string, options: SpeakOptions): Promise<Blob | null> {
    const key = `${options.voice}|${options.rate}|${text}`;
    const known = cache.get(key) ?? await storedClip(key);
    if (known) { keep(key, known); return known; }
    try {
        const response = await fetch('/api/speak', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-device': deviceId() },
            body: JSON.stringify({ text, voice: options.voice, rate: options.rate }), signal: AbortSignal.timeout(WAIT_MS)
        });
        if (!response.ok || !(response.headers.get('Content-Type') || '').startsWith('audio/')) return null;
        const clip = await response.blob();
        keep(key, clip);
        void storeClip(key, clip);
        return clip;
    } catch {
        return null;
    }
}

// Edge's clips are MP3 at 24 kHz, 48 kbit/s: 144-byte frames of 24 ms each. A frame with the clip's header and only
// zeros after it is 24 ms of silence, so enough of them go before the clip. A clip in another format stays as it is.
const FRAME_MS = 24;
async function withSilenceBefore(clip: Blob, ms: number): Promise<Blob> {
    const head = new Uint8Array(await clip.slice(0, 4).arrayBuffer());
    if (head[0] !== 0xff || head[1] !== 0xf3 || (head[2] & 0xfd) !== 0x64) return clip;
    const frame = new Uint8Array(144);
    frame.set([0xff, 0xf3, 0x64, head[3]]);
    return new Blob([...Array<Uint8Array<ArrayBuffer>>(Math.ceil(ms / FRAME_MS)).fill(frame), clip], { type: clip.type });
}

// Resolves when the speech ends. Says which voice spoke, so the page can tell the speaker.
// A 'word' is a button tap. Multilingual voices such as Emma swallow a short word said on its own ("it" comes out
// as a 40 ms blip, "I" barely heard): in quotes they say it in full, and the other voices sound the same either way.
// A quarter second of silence goes first, for a speaker that has gone quiet and wakes up at the start of a sound.
export async function say(text: string, options: SpeakOptions, kind: 'sentence' | 'word' = 'sentence'): Promise<'natural' | 'device'> {
    stop();
    const mine = turn;
    let clip = await audioClip(kind === 'word' ? `"${text}"` : text, options);
    if (clip && kind === 'word') clip = await withSilenceBefore(clip, 250);
    if (mine !== turn) return 'natural';
    if (clip) {
        const url = URL.createObjectURL(clip);
        const audio = new Audio(url);
        playing = audio;
        try {
            await audio.play();
            await new Promise<void>(resolve => { audio.onended = audio.onpause = audio.onerror = () => resolve(); });
            return 'natural';
        } catch { /* the browser refused to play: use the device voice */ } finally {
            URL.revokeObjectURL(url);
        }
        if (mine !== turn) return 'natural';
    }
    await sayOnDevice(text, options.rate, options.voice);
    return 'device';
}
