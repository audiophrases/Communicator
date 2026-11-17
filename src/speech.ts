// Speaks with the Edge voice the laptop fetches, or with this device's own voice when that is not available.

import { DEFAULT_VOICE } from '../shared/voices.ts';

export type SpeakOptions = { voice: string; rate: number };

const WAIT_MS = 10_000; // a sleeping bridge can take longer; the device's voice speaks instead
const cache = new Map<string, string>(); // "voice|rate|text" -> object URL, so repeating a phrase is instant
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

async function audioUrl(text: string, options: SpeakOptions): Promise<string | null> {
    const key = `${options.voice}|${options.rate}|${text}`;
    const cached = cache.get(key);
    if (cached) return cached;
    try {
        const response = await fetch('/api/speak', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-device': deviceId() },
            body: JSON.stringify({ text, voice: options.voice, rate: options.rate }), signal: AbortSignal.timeout(WAIT_MS)
        });
        if (!response.ok || !(response.headers.get('Content-Type') || '').startsWith('audio/')) return null;
        const url = URL.createObjectURL(await response.blob());
        if (cache.size >= 60) {
            const [oldest, oldUrl] = cache.entries().next().value!;
            URL.revokeObjectURL(oldUrl);
            cache.delete(oldest);
        }
        cache.set(key, url);
        return url;
    } catch {
        return null;
    }
}

// Resolves when the speech ends. Says which voice spoke, so the page can tell the speaker.
export async function say(text: string, options: SpeakOptions): Promise<'natural' | 'device'> {
    stop();
    const mine = turn;
    const url = await audioUrl(text, options);
    if (mine !== turn) return 'natural';
    if (url) {
        const audio = new Audio(url);
        playing = audio;
        try {
            await audio.play();
            await new Promise<void>(resolve => { audio.onended = audio.onpause = audio.onerror = () => resolve(); });
            return 'natural';
        } catch { /* the browser refused to play: use the device voice */ }
        if (mine !== turn) return 'natural';
    }
    await sayOnDevice(text, options.rate, options.voice);
    return 'device';
}
