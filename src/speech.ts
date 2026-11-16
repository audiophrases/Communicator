// Speaks with the Edge voice the laptop fetches, or with this device's own voice when that is not available.

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

function deviceVoice(): SpeechSynthesisVoice | undefined {
    const english = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
    return english.find(voice => /natural|google|samantha/i.test(voice.name)) ?? english.find(voice => voice.lang === 'en-GB') ?? english[0];
}

// The device's voice: instant and offline, used for single words and as the fallback.
export function sayOnDevice(text: string, rate = 1): Promise<void> {
    return new Promise(resolve => {
        if (!window.speechSynthesis) return resolve();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-GB';
        utterance.rate = rate;
        const voice = deviceVoice();
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
    await sayOnDevice(text, options.rate);
    return 'device';
}
