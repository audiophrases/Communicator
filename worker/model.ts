// The OpenAI model behind Fix (the correction and its Catalan) and the editor's Catalan.
//
// gpt-6-luna with thinking off: about 1.4 s and 0.01 cents a Fix (about 5 cents for a busy lesson). It is not on this
// account's list of free data-sharing models, so it is always billed ($0.10 / $0.50 per million tokens; see
// OPENAI-FREE-TOKENS.md), but it gave the best Catalan in side-by-side tests on 2026-11-16:
//  - button words: all right, where gpt-4o-mini got about one in four wrong ("estutja" for "pencil case");
//  - Catalan "agradar" (who likes whom, CATALAN_RULE in phrase.ts): 12 of 14 hard sentences right, including
//    "I want to like you more" → "Vull que m'agradis més". Free gpt-5.4-mini got about 9 and varied from run to run;
//    with "low" thinking gpt-6-luna got 12–13 but took about 2 s.
// OPENAI_PHRASE_MODEL in .dev.vars overrides it, e.g. OPENAI_PHRASE_MODEL=gpt-5.4-mini to keep it free.
// The online board, open to anyone 24/7, uses gpt-4o-mini instead: free within the daily data-sharing tokens
// (OPENAI_PHRASE_MODEL in wrangler.jsonc).

export const DEFAULT_MODEL = 'gpt-6-luna';

export const modelOf = (env: { OPENAI_PHRASE_MODEL?: string }) => env.OPENAI_PHRASE_MODEL || DEFAULT_MODEL;

// How much a model thinks before answering: off for the gpt-5.4 and gpt-6 models (see above), also by xKiro's name
// ("openai/gpt-6-luna", which otherwise thinks at "medium"). Older models reject the setting, so they do not get it.
export function thinking(model: string): { reasoning_effort?: 'none' } {
    return /^(openai\/)?gpt-(5\.4|6)/.test(model) ? { reasoning_effort: 'none' } : {};
}
