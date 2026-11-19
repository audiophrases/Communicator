import type { Fix } from '../shared/options.ts';
import { fixPhrase, fixSeed, type PhraseAttempt, type PhraseEnv, type PhraseInput } from './phrase.ts';
import type { BoardStore } from './store.ts';
import { sha256Hex } from './teacher.ts';

type CorrectionStore = Pick<DurableObjectStub<BoardStore>, 'recall' | 'remember' | 'xkiroRetryAt' | 'pauseXkiroUntil'>;
type Correction = { fix: Fix; cache: 'hit' | 'miss' } | 'unavailable' | 'limited';

async function keysFor(input: PhraseInput, env: PhraseEnv) {
    const shared = await sha256Hex(fixSeed(input, env));
    // Linked sentences can change the tense, so their answers need their own key.
    const lookup = input.context ? await sha256Hex(fixSeed(input, env, true)) : shared;
    return { shared, lookup };
}

export async function correctSentence(
    input: PhraseInput,
    primary: PhraseEnv,
    fallback: PhraseEnv | undefined,
    store: CorrectionStore,
    allow: () => Promise<boolean>
): Promise<Correction> {
    async function recall(key: string): Promise<Correction | null> {
        const saved = (await store.recall([key]))[key]?.value;
        return saved ? { fix: JSON.parse(saved), cache: 'hit' } : null;
    }

    async function save(result: PhraseAttempt, { lookup, shared }: { lookup: string; shared: string }): Promise<Correction> {
        if (!result || !('fix' in result)) return 'unavailable';
        const value = JSON.stringify(result.fix);
        await store.remember('fix', lookup, value);
        // Older clients shared a standalone answer when their single preceding sentence had no effect.
        if (lookup !== shared && !Array.isArray(input.context) && !result.contextUsed) {
            await store.remember('fix', shared, value);
        }
        return { fix: result.fix, cache: 'miss' };
    }

    const primaryKeys = await keysFor(input, primary);
    const cached = await recall(primaryKeys.lookup);
    if (cached) return cached;

    let alreadyAllowed = false;
    if (!fallback || await store.xkiroRetryAt() <= Date.now()) {
        if (!(await allow())) return 'limited';
        alreadyAllowed = true;
        const attempt = await fixPhrase(input, primary);
        if (!fallback || !attempt || !('retryAt' in attempt)) return save(attempt, primaryKeys);
        // xKiro uses HTTP 429 for both the daily free-token quota and request rate limits.
        // Share its cooldown across students so the next uncached sentence goes straight to OpenAI.
        await store.pauseXkiroUntil(attempt.retryAt);
    }

    const fallbackKeys = await keysFor(input, fallback);
    const cachedFallback = await recall(fallbackKeys.lookup);
    if (cachedFallback) return cachedFallback;
    if (!alreadyAllowed && !(await allow())) return 'limited';
    return save(await fixPhrase(input, fallback), fallbackKeys);
}
