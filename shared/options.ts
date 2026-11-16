// Choices the page offers and the Worker accepts.

// OpenAI's built-in voices for gpt-4o-mini-tts.
export const VOICES = ['coral', 'marin', 'cedar', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'] as const;
export type Voice = typeof VOICES[number];
export const isVoice = (value: unknown): value is Voice => VOICES.includes(value as Voice);

export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export type Level = typeof LEVELS[number];
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

// The speaker's own language: Fix shows the sentence in it, so they can check the meaning before speaking.
// Catalan only for now; phrase.ts can translate into any language named here.
export const LANGUAGES = ['Catalan'] as const;
export const isLanguage = (value: unknown): value is typeof LANGUAGES[number] => LANGUAGES.includes(value as typeof LANGUAGES[number]);

export const MAX_TEXT = 300;

export type Fix = { sentence: string; alternatives: string[]; note: string; translation: string };
export type Status = { ai: boolean; locked: boolean };
