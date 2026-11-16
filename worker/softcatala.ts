// English → Catalan for whole sentences by Softcatalà's neural translator (softcatala.org, the Catalan language
// community's own, free). In a test on 2026-11-16 its sentences were better than gpt-4o-mini's ("No entenc els deures",
// not "No entenc la feina"; no calques such as "Estic feliç de veure't"). It is used for sentences only: a single
// button word gives it no way to tell which meaning is meant ("glass" came back as "vidre").
// Returns null when it does not answer in time, so the caller keeps the model's own translation.
// No Workers-only APIs, so tests run it in node.

export type SoftcatalaEnv = { SOFTCATALA_URL?: string };

const DEFAULT_URL = 'https://api.softcatala.org/v2/nmt/translate';
const TIMEOUT_MS = 3000;
const MAX_TEXT = 500;

export async function toCatalanSentence(text: string, env: SoftcatalaEnv = {}): Promise<string | null> {
    const words = text.trim();
    if (!words || words.length > MAX_TEXT) return null;
    try {
        const url = new URL(env.SOFTCATALA_URL || DEFAULT_URL);
        url.searchParams.set('langpair', 'eng|cat');
        url.searchParams.set('q', words);
        const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) {
            console.log(`softcatala: HTTP ${response.status}`); // never the sentence
            return null;
        }
        const body = await response.json() as { responseStatus?: number; responseData?: { translatedText?: unknown } };
        const translated = body.responseData?.translatedText;
        if (body.responseStatus !== 200 || typeof translated !== 'string') return null;
        const clean = translated.trim().replace(/\s+/g, ' ');
        return clean && clean.length <= MAX_TEXT * 2 ? clean : null;
    } catch {
        return null;
    }
}
