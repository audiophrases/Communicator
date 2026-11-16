// The OpenAI model behind Fix (the correction and its Catalan) and the editor's Catalan.
//
// gpt-5.4-mini with thinking off. It is on this account's free list: the account shares API traffic with OpenAI
// and gets complimentary daily tokens for it, up to 2.5 million a day across the small models listed (OpenAI
// dashboard, Data controls → Sharing; see OPENAI-FREE-TOKENS.md). A Fix is about 680 tokens.
// Chosen on 2026-11-16 after side-by-side tests: gpt-4o-mini got about one button word in four wrong ("estutja" for
// "pencil case", "tauler" for a classroom board, "errar" for "miss") and translated "homework" as "feina"; Softcatalà's
// translator did well on sentences but not on single words or every phrase ("I like this one more" → "aquest
// altre"). gpt-5.4-mini got them all right. With a little thinking ("low") it was slower and once dropped the
// student's "Yesterday" from a correction, so thinking is off.
// OPENAI_PHRASE_MODEL in .dev.vars overrides the model.

export const DEFAULT_MODEL = 'gpt-5.4-mini';

export const modelOf = (env: { OPENAI_PHRASE_MODEL?: string }) => env.OPENAI_PHRASE_MODEL || DEFAULT_MODEL;

// How much a model thinks before answering. gpt-5.4 models: none (see above). gpt-6 models: "low", the best of the
// settings tried for them. Older models reject the setting, so they do not get it.
export function thinking(model: string): { reasoning_effort?: 'none' | 'low' } {
    if (/^gpt-5\.4/.test(model)) return { reasoning_effort: 'none' };
    if (/^gpt-6/.test(model)) return { reasoning_effort: 'low' };
    return {};
}
