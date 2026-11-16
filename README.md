# Communicator

An AAC (augmentative and alternative communication) board for people who are learning English.
Tap words or type broken English, press **Fix** to get the correct sentence, and **Speak** says it in a natural voice.
Hold any button (or point at it with a mouse) to see it in Catalan.

`I` `want` `go` `doctor` `tomorrow` → ✨ **I want to go to the doctor tomorrow.** 🔊

It runs on the teacher's laptop during class, like Pixel Plaza on the laptop: students open the laptop's address
over the school Wi-Fi. Nothing is put online.

## In class

1. Double-click `classroom.bat` and keep the window open. The first time it sets up `.dev.vars`: it copies the teacher
   password and the OpenAI key from HelloChat or Pixel Plaza next to this folder, or asks for them. Windows asks once
   whether Node.js may use the network: allow it on **private** networks.
2. It opens the teacher editor on the laptop (<http://localhost:8790/create>) and prints the address for students,
   such as `http://192.168.1.20:8790`. The editor shows it too.
3. Students open that address on the school Wi-Fi. Nothing to sign in to.

The board, your buttons and the Fix switch are kept on the laptop in `.wrangler/classroom` (not in git).
It uses port 8790, so Pixel Plaza can run on 8787 at the same time; `PORT` changes it and `COMMUNICATOR_LAN_URL`
overrides the detected address (for a laptop on more than one network). The address is plain HTTP, so sign in to
`/create` on the laptop itself, not from a student device.

While changing the code: `npm run dev:worker` in one terminal and `npm run dev` in another.
`npm test` runs the Worker tests.

## Voices

Speech goes through PinPlay's Edge TTS bridge on Render, as in HelloChat and Pixel Plaza: the laptop asks the bridge
and passes the audio to students over the Wi-Fi. No OpenAI. Students pick one of 18 English voices (UK, US, Irish,
Australian and more) and a speed in Settings. `classroom.bat` wakes the bridge while it starts, because Render can
take a while to wake up. The laptop needs internet for these voices; without it, or if the bridge does not answer
within 10 seconds, each device speaks with its own voice. Single tapped words always use the device's voice, which is
instant. `EDGE_TTS_URL` and `EDGE_TTS_SECRET` override the bridge.

## OpenAI: only Fix and the editor's Catalan

With `OPENAI_API_KEY` in `.dev.vars`, students can press **Fix** (`gpt-4o-mini`), and the editor can translate new
buttons into Catalan. **Fix for students** in `/create` switches Fix off and on at once, for example during a test;
students' screens follow within 30 seconds. Without a key, Fix is hidden and everything else works.

## Saved answers: each question is paid for once

Like PinPlay's voice cache, every answer is kept on the laptop under a fingerprint of what was asked, and reused for
the whole class, across lessons and restarts:

- **Fix**: the same words at the same level and language (capitals, spaces and the final full stop do not matter).
  The second student who writes "I want go home" gets "I want to go home." at once, without calling OpenAI. An answer
  that depended on the sentence said before is reused only after that same sentence (see the design notes below).
- **Catalan in the editor**: only buttons never translated before are sent.
- **Voice clips**: the same text, voice and speed (as PinPlay: `voice::rate::text`) comes from the bridge once.

Saved answers do not count against a student's limit. `/create` shows how many are saved and how often they were
reused. **Forget them** clears them all, for example if a saved correction was wrong (otherwise every student would
keep getting it). Unused answers are dropped after 60 days, and at most 5,000 corrections, 5,000 translations and
3,000 clips are kept. Changing the prompt in `worker/phrase.ts` or `worker/translate.ts` should come with a new
`FIX_VERSION` or `CA_VERSION`, so old answers are not reused.

## The teacher's editor: /create

Open `/create` and sign in with the teacher password. There you can:

- switch **Fix for students** on or off, and see the address students open;
- change any button's English word, emoji, Catalan and colour, move it, or remove it;
- add buttons, add, rename, reorder and delete topic pages, and edit the quick phrases;
- press ✨ next to a Catalan box, or **Fill missing Catalan** for everything at once, to translate with AI, then check
  and correct it;
- **Save** for everyone (students get it when they open or reload the board), **Undo changes**, or **Reset to built-in**.

Removing a core word with **Empty this slot** keeps its place empty, so the words around it do not move.

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Board | `src/vocab.ts`, `src/App.tsx` | Built-in board: 60 core words that never move, 9 topic pages, 30 quick phrases, each with Catalan; saved and recent phrases |
| Catalan tooltips | `src/tooltip.ts` | Any button with `data-ca` shows its Catalan on hover, or on a half-second hold on touch screens (the hold does not press the button) |
| Editor | `src/Create.tsx`, `worker/store.ts`, `worker/teacher.ts` | `/create`; the board, the Fix switch and the saved answers are kept in a Durable Object (SQLite); sessions are signed and last 12 hours |
| Board rules | `shared/board.ts` | One `sanitizeBoard` for the page and the Worker: sizes, colours, empty core slots |
| Fix | `worker/phrase.ts` | One chat-model call (default `gpt-4o-mini`) with a strict JSON schema: the sentence, up to 2 other meanings, and a Catalan translation when chosen |
| Translate | `worker/translate.ts` | Teacher only: Catalan for new buttons, using the word type and page to pick the meaning |
| Speak | `worker/speech.ts`, `src/speech.ts`, `shared/voices.ts` | PinPlay's Edge TTS bridge through the laptop; spoken phrases are kept in memory so repeating is instant; falls back to the device voice |
| Classroom | `classroom.bat`, `scripts/classroom.mjs`, `scripts/setup-laptop.mjs`, `scripts/warm-speech.mjs` | Serves the school Wi-Fi from the laptop, sets up `.dev.vars`, wakes the voice bridge, refuses to start twice |
| Limits | `worker/index.ts` | The key stays on the laptop; 40 Fix and 40 voice requests a minute per student device; password guesses rate-limited |

## Design choices, and the AAC practice behind them

- **Core words stay put.** About 200 to 400 core words make up most of what anyone says. Keeping each one in a fixed
  place lets the hand learn the route (motor planning), so the home page is core words, not topic nouns.
- **Colour by word type** (modified Fitzgerald key): people yellow, verbs green, describing words blue, things orange,
  questions purple, social pink, "not/no" red, little words grey. Published charts differ on the exact colours; being
  consistent is what matters. Page tabs take the colour of most of their words.
- **Core words are on their pages too.** Each core word also leads the page of its colour (pronouns on People, core
  verbs on Actions, describing words on Describe, "now" on Time, little words on Things), so a sentence can be built
  on one page without going back to Core. Question words and yes/no/not/please, whose colours had no page, have
  **Ask & answer**. It is the same button: same picture, same Catalan.
- **Fix suggests, the speaker decides.** AAC users must keep authorship of their words. Fix never speaks on its own
  and never replaces the speaker's words: tapping a suggestion only says it aloud, so they can hear it, compare it
  with their own attempt and try again. Tapping or typing another word closes the suggestions. The prompt
  forbids adding ideas or politeness the speaker did not choose, and the Worker drops answers far longer than the input.
- **Fix sees the sentence said just before (within 2 minutes)**, for one common ESL mistake: setting the time once and
  going back to the present ("Yesterday I went to the park." then "I eat ice cream" → "I ate ice cream."; "Next week I
  have an exam." then "I study a lot" → "I will study a lot."). It changes the time only when the sentence before
  names one, never for questions or needs about now, and never copies words from it. OpenAI says whether the sentence
  before changed the answer: if not, the answer is shared with the whole class; if so, it is saved only for that pair,
  and a student with a different sentence before gets a fresh answer.
- **Built for ESL.** The level setting (A1 to B2) keeps suggestions in words the speaker knows. "My language" (Catalan for now) shows the
  sentence translated, so the speaker can check the meaning before saying it out loud. Catalan tooltips let a learner
  check a word without adding it to the message.
- **Nothing is censored, and nothing says who said what.** It is the speaker's own voice, so there is no moderation
  step. Saved and recent phrases live only in each student's browser, and the server never logs what was said. The
  laptop keeps the saved answers above (the sentences and their corrections, translations and clips), with no name or
  device attached; **Forget them** in `/create` deletes them.
- **Mulberry symbols where they say more than an emoji.** Each word was compared by eye with its Mulberry candidates.
  95 words use a Mulberry symbol: actions (an emoji of a chair for "sit" shows the chair, Mulberry shows someone
  sitting), question words, family relations (who to whom), time words that emoji show as media buttons (⏭️ for
  "tomorrow"), body parts, pairs such as open/closed and hungry/thirsty, and words that had no picture. Emoji stay
  where they are clear: feelings, most food and things, call, wait, write. No two different words share a picture
  (a test checks it). Pronouns and little words (you, the, because…) have no Mulberry symbol and stay as text or emoji.

## Symbols

The [Mulberry Symbols](https://mulberrysymbols.org) (`mulberry-symbols/`, version in `VERSION.txt`) are © Steve Lee,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); Settings credits them. The build copies them to
`dist/symbols/` with a search index, leaving out the six the set marks as rated (anatomy), so `mulberry-symbols/` must
be present to build. The built-in choices are in `src/vocab.ts` (`SYMBOLS`). In `/create`, each button has a symbol
search that starts from its English word; a symbol replaces the emoji on that button.
