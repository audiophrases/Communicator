// The OpenAI model behind Fix and the editor's Catalan.
//
// gpt-6-luna with a little thinking won a side-by-side test on 20 sentences, 22 button words and 10 learner inputs
// (2026-11-16). gpt-4o-mini, used before, got about one word in four wrong ("estutja" for "pencil case", "tauler" for a
// classroom board, "errar" for "miss") and translated "homework" as "feina". gpt-6-luna got them right, costs less
// per Fix ($0.10 / $0.50 per million tokens against $0.15 / $0.60), and takes about 1.3 s instead of 1.0 s.
// OPENAI_PHRASE_MODEL in .dev.vars overrides it, e.g. OPENAI_PHRASE_MODEL=gpt-4o-mini to go back.

export const DEFAULT_MODEL = 'gpt-6-luna';

export const modelOf = (env: { OPENAI_PHRASE_MODEL?: string }) => env.OPENAI_PHRASE_MODEL || DEFAULT_MODEL;

// The gpt-6 models think before answering. "low" is enough for this: quicker and cheaper than the default, and its
// Catalan was the best of the settings tried. Older models reject the setting, so they do not get it.
export const thinking = (model: string): { reasoning_effort?: 'low' } => /^gpt-6/.test(model) ? { reasoning_effort: 'low' } : {};
