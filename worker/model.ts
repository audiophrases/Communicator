// The OpenAI model behind Fix and the editor's Catalan for button words.
//
// gpt-4o-mini, because this account shares API traffic with OpenAI and gets complimentary daily tokens for it
// (up to 2.5 million a day across gpt-4o-mini and the other small models on that list; OpenAI dashboard, Data
// controls → Sharing). A test on 2026-11-16 found newer models translate better (gpt-6-luna got every button word
// right where gpt-4o-mini got about one in four wrong), but they are not on the free list. So sentences are put into
// Catalan by Softcatalà instead (softcatala.ts), which beat gpt-4o-mini there, and the teacher checks button words.
// OPENAI_PHRASE_MODEL in .dev.vars overrides the model, e.g. OPENAI_PHRASE_MODEL=gpt-6-luna (paid, about 5 cents for
// a busy lesson).

export const DEFAULT_MODEL = 'gpt-4o-mini';

export const modelOf = (env: { OPENAI_PHRASE_MODEL?: string }) => env.OPENAI_PHRASE_MODEL || DEFAULT_MODEL;

// The gpt-6 models think before answering: "low" was quicker and cheaper than their default, with the best Catalan of
// the settings tried. Older models reject the setting, so they do not get it.
export const thinking = (model: string): { reasoning_effort?: 'low' } => /^gpt-6/.test(model) ? { reasoning_effort: 'low' } : {};
