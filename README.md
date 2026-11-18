# Communicator

An AAC (augmentative and alternative communication) board for people who are learning English.
Tap words or type broken English, press **Fix** to get the correct sentence, and **Speak** says it in a natural voice.
Hold any button (or point at it with a mouse) to see it in Catalan. Type a few letters, in English or Catalan, and the
matching buttons appear under the text box, narrowing as you type: tap one, or press Tab for the first. `?` stands for
one letter and `*` for any number (`h?t` → hot, `*ppy` → happy); accents are optional (`germa` → germà).

`I` `want` `go` `doctor` `tomorrow` → ✨ **I want to go to the doctor tomorrow.** 🔊

The **?** key in Core makes the words a question: `you` `want` `coffee` says "you want coffee", `you` `want`
`coffee` `?` asks "you want coffee?", and Fix turns it into ✨ **Do you want coffee?**

Press **Ctrl+Enter** to fix and speak the main suggestion. **Shift+Enter** (or **New sentence**) clears the
preview for your next sentence. Turn on **Link sentences** to keep telling the same story. For example, after
“Yesterday I went to the park” and “I saw my friend”, Fix can turn “we play football” into “We played football.”
Turn the toggle off to end the paragraph. Each board session starts with it off.

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
and passes the audio to students over the Wi-Fi. No OpenAI. Students pick one of 18 English voices (Emma, American, by default; also UK, Irish,
Australian and more) and a speed in Settings. `classroom.bat` wakes the bridge while it starts, because Render can
take a while to wake up. The laptop needs internet for these voices; without it, or if the bridge does not answer
within 10 seconds, each device speaks with its own voice. Single tapped words always use the device's voice, which is
instant. `EDGE_TTS_URL` and `EDGE_TTS_SECRET` override the bridge.

## OpenAI: Fix and the editor's Catalan

With `OPENAI_API_KEY` in `.dev.vars`, students can press **Fix**, and the editor can translate new buttons into
Catalan. **Fix for students** in `/create` switches Fix off and on at once, for example during a test; students'
screens follow within 30 seconds. Without a key, Fix is hidden and everything else works.

- **Model:** `gpt-6-luna` with thinking off corrects the English and writes the Catalan in the same call, and
  translates the editor's buttons and phrases: about 1.4 s and 0.01 cents a Fix, so about 5 cents for a busy lesson.
  It is not among the models this account gets free data-sharing tokens for, so it is always billed. It gave the
  best Catalan in side-by-side tests (2026-11-16, described in `worker/model.ts`): every button word right where
  `gpt-4o-mini` got about one in four wrong ("estutja" for "pencil case").
- **Catalan "agradar":** verbs that work backwards from English (agradar, encantar, fer mal, faltar) come with a rule
  in the instructions (`CATALAN_RULE` in `worker/phrase.ts`). `gpt-6-luna` got 12 of 14 hard sentences right,
  "I want to like you more" → "Vull que m'agradis més" included; the free `gpt-5.4-mini` got about 9, varying from
  run to run. To keep it free, put `OPENAI_PHRASE_MODEL=gpt-5.4-mini` in `.dev.vars`.
 [OPENAI-FREE-TOKENS.md](OPENAI-FREE-TOKENS.md) says what the account's data-sharing tokens cover; the same
  note is in the other apps that call OpenAI.

## Saved answers: each question is paid for once

Like PinPlay's voice cache, every answer is kept on the laptop under a fingerprint of what was asked, and reused for
the whole class, across lessons and restarts:

- **Fix**: the same words at the same level and language (capitals, spaces and the final full stop do not matter;
  a question mark does).
  The second student who writes "I want go home" gets "I want to go home." at once, without calling OpenAI. An answer
  made with Link sentences is reused only with the same preceding context.
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
- **find a button** by its English or Catalan (same `?` and `*`): a result opens its page with it selected;
- change any button's English word, emoji, Catalan and colour, move it, or remove it;
- add buttons, add, rename, reorder and delete topic pages, and edit the quick phrases;
- press ✨ next to a Catalan box, or **Fill missing Catalan** for everything at once, to translate with AI, then check
  and correct it;
- **Save** for everyone (students get it when they open or reload the board), or **Undo changes** since the last save.

Removing a core word with **Empty this slot** keeps its place empty, so the words around it do not move.

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Board | `src/vocab.ts`, `src/App.tsx` | Built-in board: 60 core words that never move, 15 topic pages (about 880 words, covering CEFR A1), 30 quick phrases, each with Catalan; saved and recent phrases |
| Catalan tooltips | `src/tooltip.ts` | Any button with `data-ca` shows its Catalan on hover, or on a half-second hold on touch screens (the hold does not press the button) |
| Editor | `src/Create.tsx`, `worker/store.ts`, `worker/teacher.ts` | `/create`; the board, the Fix switch and the saved answers are kept in a Durable Object (SQLite); sessions are signed and last 12 hours |
| Board rules | `shared/board.ts` | One `sanitizeBoard` for the page and the Worker: sizes, colours, empty core slots |
| Fix | `worker/phrase.ts` | One chat-model call (`gpt-6-luna`, `worker/model.ts`) with a strict JSON schema: the sentence, up to 2 other meanings, and its Catalan |
| Translate | `worker/translate.ts` | Teacher only: Catalan for new buttons and phrases, told the word type and page to pick the meaning |
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
  verbs on Actions, describing words on Describe, "now" on Time, little words on Little words), so a sentence can be built
  on one page without going back to Core. Question words and yes/no/not/please, whose colours had no page, have
  **Ask & answer**. It is the same button: same picture, same Catalan.
- **Fix suggests, the speaker decides.** The Fix button opens suggestions for review. Ctrl+Enter explicitly asks
  to speak the main suggestion. Tapping a suggestion says it aloud, so the speaker can hear it, compare it
  with their own attempt and try again. Tapping or typing another word closes the suggestions. The prompt
  forbids adding ideas or politeness the speaker did not choose, and the Worker drops answers far longer than the input.
- **Link sentences** keeps paragraph context in memory until the speaker turns it off or reloads. New sentence
  carries forward the version they chose to speak, or the words in the preview if they skipped playback.
  Fix receives the opening sentence and up to seven other recent sentences. A new time cue in the current
  sentence takes precedence, and immediate requests or needs keep their intended tense.
- **The A1 words are all there.** The pages hold the CEFR A1 vocabulary: the A1 words of the
  [Oxford 3000](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000) and Cambridge's
  [A1 Movers](https://www.cambridgeenglish.org/Images/351850-a1-movers-word-list-2018.pdf) word list, about 900 words. Most
  sit on the page of their topic (Numbers, Clothes & colours, Nature & weather, School, Free time); verbs, describing
  words and little words that fit no topic go on Actions, Describe and Little words. Left out: alcohol, CDs and DVDs,
  and second spellings of a word already there (bicycle for bike, telephone for phone, cannot for can't). Spelling is
  British, as in the Oxford list.
- **Built for ESL.** The level setting (A1 to B2) keeps suggestions in words the speaker knows. "My language" (Catalan, on by default on every device; a student can choose "Do not translate") shows the
  sentence translated, so the speaker can check the meaning before saying it out loud. Catalan tooltips let a learner
  check a word without adding it to the message.
- **Nothing is censored, and nothing says who said what.** It is the speaker's own voice, so there is no moderation
  step. Saved and recent phrases live only in each student's browser, and the server never logs what was said. The
  laptop keeps the saved answers above (the sentences and their corrections, translations and clips), with no name or
  device attached; **Forget them** in `/create` deletes them. What a student sends to Fix goes to OpenAI, and, with
  this account's data sharing on, OpenAI may use it to train its models. Spoken sentences go to the voice bridge.
- **Every built-in word has a visual cue.** Mulberry pictograms show actions such as sitting and spatial relationships
  such as “between”. Color picture scenes show actions and relationships: for example, “sell” shows a seller,
  an apple leaving the stall, and a coin coming back. Other words use familiar
  emoji or conventional notation, such as € for euro. Tests check coverage and distinguish different words' pictures.

## Symbols

The [Mulberry Symbols](https://mulberrysymbols.org) (`mulberry-symbols/`, version in `VERSION.txt`) are © Steve Lee,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); Settings credits them. The build copies them to
`dist/symbols/` with a search index, leaving out the six the set marks as rated (anatomy), so `mulberry-symbols/` must
be present to build. The built-in choices are in `src/vocab.ts`. In `/create`, each button has a symbol
search that starts from its English word; a symbol replaces the emoji on that button.

Mulberry has no picture for "I", so `own-symbols/I_me.svg` (a person pointing at their own chest, the usual AAC
picture for "I") was drawn for this app in the Mulberry style. Own symbols are listed in `vite.config.ts` (`OWN`),
served and searched like the Mulberry ones.

The SVGs in `scene-symbols/` are bundled locally. They combine original drawings with adapted Twemoji artwork
by Twitter and contributors. [Twemoji](https://github.com/jdecked/twemoji) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The editor also offers selected SVGs from the BCI Authorized Vocabulary in `bliss-symbols/`. The files are named for
their board words, retain their original English gloss in an SVG comment, and have cropped margins for legibility.
© Blissymbolics Communication International. [BCI-AV 2026](https://blissymbolics.org/index.php/bci-av-2026) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
