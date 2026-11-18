// Choices the page offers and the Worker accepts.

export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export type Level = typeof LEVELS[number];
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

// The speaker's own language: Fix shows the sentence in it, so they can check the meaning before speaking.
// Catalan only for now; phrase.ts can translate into any language named here.
export const LANGUAGES = ['Catalan'] as const;
export const isLanguage = (value: unknown): value is typeof LANGUAGES[number] => LANGUAGES.includes(value as typeof LANGUAGES[number]);

export const MAX_TEXT = 300;
// In longer paragraphs keep the opening sentence, which often establishes the time, and the latest sentences.
export const MAX_LINKED_SENTENCES = 8;

export type Fix = { sentence: string; alternatives: string[]; translation: string };
// fix: the teacher has Fix switched on and there is an OpenAI key.
export type Status = { fix: boolean };
export type BoardSync = { revision?: string; sync?: 'synced' | 'offline' | 'conflict' };
// Answers kept on the laptop so the same question is not paid for twice: corrections, Catalan, voice clips.
export type Saved = { fix: number; ca: number; speech: number; reused: number };
// What /create shows: whether there is a key, the switch, the address students open, and what is saved.
export type TeacherSettings = { key: boolean; fixOn: boolean; lanUrl: string; saved: Saved };
