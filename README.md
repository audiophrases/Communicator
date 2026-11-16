# Communicator

An AAC (augmentative and alternative communication) board for people who are learning English.
Tap words or type broken English, press **Fix** to get the correct sentence, and **Speak** says it in a natural voice.
Hold any button (or point at it with a mouse) to see it in Catalan.

`I` `want` `go` `doctor` `tomorrow` → ✨ **I want to go to the doctor tomorrow.** 🔊

## Run it

Double-click `start.bat` (it opens <http://localhost:8790>), or:

```sh
npm install
npm run start        # builds, then serves http://localhost:8787
```

Copy `.dev.vars.example` to `.dev.vars` and fill in:

- `OPENAI_API_KEY` for Fix, the natural voice, and AI Catalan in the editor. Without it the board still works: the
  device's own voice speaks and Fix is hidden.
- `CREATE_PASSWORD_HASH` for the teacher's editor: the same value as PinPlay, HelloChat and Pixel Plaza, so it is the
  same password.

While changing the code: `npm run dev:worker` in one terminal and `npm run dev` in another.
`npm test` runs the Worker tests. `npm run deploy` puts it online; first set the secrets with
`npx wrangler secret put OPENAI_API_KEY`, `… CREATE_PASSWORD_HASH` and, to protect the key, `… ACCESS_CODE`.

## The teacher's editor: /create

Open `/create` and sign in with the teacher password. There you can:

- change any button's English word, emoji, Catalan and colour, move it, or remove it;
- add buttons, add, rename, reorder and delete topic pages, and edit the quick phrases;
- press ✨ next to a Catalan box, or **Fill missing Catalan** for everything at once, to translate with AI, then check
  and correct it;
- **Save** for everyone (students get it when they open or reload the board), **Undo changes**, or **Reset to built-in**.

Removing a core word with **Empty this slot** keeps its place empty, so the words around it do not move.

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Board | `src/vocab.ts`, `src/App.tsx` | Built-in board: 60 core words that never move, 8 topic pages, 30 quick phrases, each with Catalan; saved and recent phrases |
| Catalan tooltips | `src/tooltip.ts` | Any button with `data-ca` shows its Catalan on hover, or on a half-second hold on touch screens (the hold does not press the button) |
| Editor | `src/Create.tsx`, `worker/store.ts`, `worker/teacher.ts` | `/create`; the board is kept in a Durable Object; sessions are signed and last 12 hours |
| Board rules | `shared/board.ts` | One `sanitizeBoard` for the page and the Worker: sizes, colours, empty core slots |
| Fix | `worker/phrase.ts` | One chat-model call (default `gpt-4o-mini`) with a strict JSON schema: the sentence, up to 2 other meanings, a one-line note, and a Catalan translation when chosen |
| Translate | `worker/translate.ts` | Teacher only: Catalan for new buttons, using the word type and page to pick the meaning |
| Speak | `worker/speech.ts`, `src/speech.ts` | OpenAI `gpt-4o-mini-tts`, 13 voices; spoken phrases are kept in memory so repeating is instant; falls back to the device voice |
| Key safety | `worker/index.ts` | The key stays in the Worker; 40 calls a minute per visitor; optional `ACCESS_CODE`; password guesses rate-limited |

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
  changed in very simple English, so each fix is also a small lesson. "My language" (Catalan for now) shows the
  sentence translated, so the speaker can check the meaning before saying it out loud. Catalan tooltips let a learner
  check a word without adding it to the message.
- **Nothing is censored and nothing is stored.** It is the speaker's own voice, so there is no moderation step.
  Saved and recent phrases live only in the browser; the Worker never logs what was said.
- **Emoji as symbols.** They need no licence and no downloads. A proper symbol set such as ARASAAC would be clearer
  for abstract words, but it is CC BY-NC-SA: attribution required and no commercial use.
