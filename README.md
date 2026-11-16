# Communicator

An AAC (augmentative and alternative communication) board for people who are learning English.
Tap words or type broken English, press **Fix** to get the correct sentence, and **Speak** says it in a natural voice.

`I` `want` `go` `doctor` `tomorrow` → ✨ **I want to go to the doctor tomorrow.** 🔊

## Run it

Double-click `start.bat` (it opens http://localhost:8790), or:

```
npm install
npm run start        # builds, then serves http://localhost:8787
```

For Fix and the natural voice, copy `.dev.vars.example` to `.dev.vars` and fill in `OPENAI_API_KEY`.
Without a key the board still works: the device's own voice speaks and Fix is hidden.

While changing the code: `npm run dev:worker` in one terminal and `npm run dev` in another.
`npm test` runs the Worker tests; `npm run deploy` puts it online (set `OPENAI_API_KEY` and, to protect the key,
`ACCESS_CODE` with `npx wrangler secret put …` first).

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Board | `src/vocab.ts`, `src/App.tsx` | 60 core words that never move, 8 topic pages, 30 quick phrases, saved and recent phrases |
| Fix | `worker/phrase.ts` | One chat-model call (default `gpt-4o-mini`) with a strict JSON schema: the sentence, up to 2 other meanings, a one-line note, and a translation |
| Speak | `worker/speech.ts`, `src/speech.ts` | OpenAI `gpt-4o-mini-tts`, 13 voices; spoken phrases are kept in memory so repeating is instant; falls back to the device voice |
| Key safety | `worker/index.ts` | The key stays in the Worker; 40 calls a minute per visitor; optional `ACCESS_CODE` |

## Design choices, and the AAC practice behind them

- **Core words stay put.** About 200 to 400 core words make up most of what anyone says. Keeping each one in a fixed
  place lets the hand learn the route (motor planning), so the home page is core words, not topic nouns.
- **Colour by word type** (modified Fitzgerald key): people yellow, verbs green, describing words blue, things orange,
  questions purple, social pink, "not/no" red, little words grey. Published charts differ on the exact colours; being
  consistent is what matters.
- **Fix suggests, the speaker decides.** AAC users must keep authorship of their words. Fix never speaks on its own,
  "Keep my words" is always there, and the prompt forbids adding ideas or politeness the speaker did not choose.
  The Worker also drops answers that are far longer than the input.
- **The last sentence is sent as context**, because research on AI message expansion found that one turn of context
  roughly doubles accuracy.
- **Built for ESL.** The level setting (A1 to B2) keeps suggestions in words the speaker knows. The note says what
  changed in very simple English, so each fix is also a small lesson. "My language" shows the sentence translated, so
  the speaker can check the meaning before saying it out loud.
- **Nothing is censored and nothing is stored.** It is the speaker's own voice, so there is no moderation step.
  Saved and recent phrases live only in the browser; the Worker never logs what was said.
- **Emoji as symbols.** They need no licence and no downloads. A proper symbol set such as ARASAAC would be clearer
  for abstract words, but it is CC BY-NC-SA: attribution required and no commercial use.
