# Communicator

An AAC (augmentative and alternative communication) board for people who are learning English.
Tap words or type broken English and press **Fix** to get the correct sentence: tap it to hear it in a natural voice.
While the teacher has Fix switched off, **Speak** takes its place and says the words as they are.
Hold any button (or point at it with a mouse) to see it in Catalan. Type a few letters, in English or Catalan, and the
matching buttons appear under the text box, narrowing as you type. Letters typed anywhere on the board go into the
text box, even right after tapping buttons. Tap a match, or press **Enter** for the highlighted one: the first,
or another chosen with **→** and **←**. **Ctrl+Z** undoes the last change to the sentence or the story (a word added,
typed, moved or deleted, a sentence finished), and **Ctrl+Y** redoes it. `?` stands for
one letter and `*` for any number (`h?t` → hot, `*ppy` → happy); accents are optional (`germa` → germà). A Catalan
verb's forms find its button too (`plou`, `plovia` → rain, whose Catalan shows only `pluja / ploure`;
[src/catalanVerbs.ts](src/catalanVerbs.ts)). After the matches come up to four buttons spelt nearly like the word
(`watter` → water, `plutja` → rain), with nothing to mark them. When only those are found, none is highlighted and
**Enter** keeps the word as typed, so `went` does not become `want`.

`I` `want` `go` `doctor` `tomorrow` → ✨ **I want to go to the doctor tomorrow.** 🔊

The **?** key in Core makes the words a question: `you` `want` `coffee` says "you want coffee", `you` `want`
`coffee` `?` asks "you want coffee?", and Fix turns it into ✨ **Do you want coffee?**

✏️ next to a suggestion brings it into the bar, to change it or keep building on it, with or without Story. Its words
come back as buttons: a word that is a button keeps its picture (`I`, `bus stop`, `?`), and a form no button has
(`went`, `friends`) comes back as a typed word without one. The same goes for a story sentence tapped to change it
and for ✏️ on a quick or saved phrase. If Fix has no answer, the box offers the speaker's own words to say instead.

Press **Ctrl+Enter** to fix and speak the main suggestion. Once a fix is showing, **Ctrl+C** copies it (or the
suggestion you last tapped) when nothing is highlighted. **Shift+Enter** (or **New sentence**) clears the
preview for your next sentence. Turn on **Story** to keep telling the same story. For example, after
“Yesterday I went to the park” and “I saw my friend”, Fix can turn “we play football” into “We played football.”
While **Story** is on, **New sentence** (**Shift+Enter**) adds the sentence to the story above the bar, fixed:
the fix already showing is used, otherwise Fix is asked and its answer replaces the words when it arrives. Point at
a story sentence (or hold it) to see its Catalan. Tap one to change it in the bar: **New sentence** puts it back in
its place, and **⌫** on the emptied bar takes it out of the story. **⌫** on an empty bar opens the last sentence.
▶ (**Ctrl+Shift+Enter**) plays the whole story, and ⏹ stops it. With no fix showing, **Ctrl+C** copies the story. The story stays
on the device after a reload. Turning **Story** off asks first, then deletes the story.

Students can use the school Wi-Fi address during class or the
[always-online student board](https://communicator-online.eugenime.workers.dev) from anywhere.
Publish buttons and pictures from the teacher's laptop. Both boards use the same published content.

## In class

1. Double-click `classroom.bat` and keep the window open. The first time it sets up `.dev.vars`: it copies the teacher
   password and the OpenAI key from HelloChat or Pixel Plaza next to this folder, or asks for them. Windows asks once
   whether Node.js may use the network: allow it on **private** networks.
2. It opens the teacher editor on the laptop (<http://localhost:8790/create>) and prints the address for students,
   such as `http://192.168.1.20:8790`. The editor shows it too.
3. Students open that address on the school Wi-Fi. Nothing to sign in to.

With Git installed and authenticated, the classroom launcher shares teacher edits through `classroom-board.json` on
`origin/main`. The Fix switch, voice clips, AI cache and credentials stay on the laptop.
It uses port 8790, so Pixel Plaza can run on 8787 at the same time; `PORT` changes it and `COMMUNICATOR_LAN_URL`
overrides the detected address (for a laptop on more than one network). The address is plain HTTP, so sign in to
`/create` on the laptop itself, not from a student device.

While changing the code: `npm run dev:worker` in one terminal and `npm run dev` in another.
`npm test` runs the Worker tests.

### Always-online student board

The Cloudflare Worker serves the board while the laptop is off. **Fix** corrects English and translates
the result into Catalan using xKiro's free `qwen/qwen3.8-max:free` (`XKIRO_MODEL` in `wrangler.jsonc`; the xKiro key
is refused xKiro's paid models). The laptop uses OpenAI's `gpt-6-luna` by default. When xKiro fails, online Fix uses
OpenAI's `gpt-4o-mini` with a separate key. After a quota or rate limit (429) it waits for xKiro's retry interval. After
a refused key or model (another 4xx: xKiro answers 404 for a model it has dropped, as it did with Mistral in November
2026, and 403 for a paid one) it waits ten minutes. Any other failure uses the backup for that sentence only. Each
failure is logged with the model, never the words (`phrase: qwen/qwen3.8-max:free HTTP 404`, `… TimeoutError`,
`… unusable answer`), so a Fix with no `phrase:` line was answered by xKiro. Saved corrections are reused by model.
Online, both word taps and sentences use PinPlay's English Edge TTS voices, with device speech as a fallback.
A tapped word is sent to the voice in quotes: Emma and the other multilingual voices otherwise swallow short words
such as "I" and "it".
Opening the online board sends a background health check to wake the voice bridge.
The laptop's Fix switch applies to the school Wi-Fi session. Online corrections and voice clips have their own cache.

The online board is built to stay within Cloudflare's free daily allowance, which every Worker on the account
shares (PinPlay, HelloChat and Pixel Plaza included):

- each browser keeps the last 300 voice clips it played, and online the last 1500 between visits too, so tapping
  a word heard before asks the Worker nothing;
- reading a saved clip or correction writes nothing to storage: when it was last used is noted once a day, and the
  editor's "reused" count is saved every 50 reuses;
- an open board's half-minute check returns the board (or "unchanged") and whether Fix is on, in one request.

For button changes, save in the laptop editor. Once the save reaches GitHub, open student boards check on the
same 30-second schedule. They keep the sentence in progress. The Worker keeps the last board it fetched if
GitHub is temporarily unavailable. Uploaded pictures are verified against their content hashes and cached as used.
An offline laptop save reaches the online address after Git sync succeeds.

For app code, push changes to `main` and launch `classroom.bat` from that updated checkout.
It serves the local build and publishes the matching release through the laptop's Wrangler login, as PinPlay does.
Unpublished source changes stay local. Running `npm run deploy:online` publishes a release manually.
The hosted Worker uses the `online` environment in `wrangler.jsonc`. Set or rotate its server-side key with
`npx wrangler secret put XKIRO_API_KEY --env online`. Set or rotate the backup key with
`npx wrangler secret put OPENAI_API_KEY --env online`. If the bridge requires authentication, set
`EDGE_TTS_SECRET` the same way. The teacher password belongs only in the laptop's `.dev.vars`.

### Board sync

Save in `/create` commits the board layout, buttons, translations, uploaded pictures, symbol choices and quick phrases to the public
`main` branch. Each laptop fetches the board at startup and every minute while running. Open student boards
refresh automatically. Reload the editor to start from the latest saved version. A normal `git pull` also downloads the JSON file. If the repository has no
shared board yet, the first online laptop with an existing saved teacher board supplies it.

The launcher uses this checkout's Git credentials. Each teacher laptop needs push access to `origin/main`.
An offline save stays usable locally and retries while the launcher is running, including after a restart.
Each board commit includes `classroom-board.json` and any new pictures used by its buttons in `classroom-images/`.
Identical uploads share one file. Removing the last button that uses a picture removes it from the current board commit.
Previously published pictures stay in the public Git history.

If two laptops edit the same board, Save reports a stale draft and lets you keep the tab open while reviewing the
latest board in another tab. If both made offline commits, sync pauses with both versions intact. On the laptop
reporting the conflict, stop the launcher and run `git branch recovered-classroom-board refs/communicator/pending-board`.
In a clean checkout of main, pull the latest changes, merge that recovery branch, resolve any conflicts in
`classroom-board.json`, and push the result. After verifying it, clear the pending ref with
`git update-ref -d refs/communicator/pending-board` on that laptop and restart the launcher.

## Voices

Speech goes through PinPlay's Edge TTS bridge on Render, as in HelloChat and Pixel Plaza: the laptop asks the bridge
and passes the audio to students over the Wi-Fi. No OpenAI. Students pick one of 18 English voices (Emma, American, by default; also UK, Irish,
Australian and more) and a speed in Settings. `classroom.bat` wakes the bridge while it starts, because Render can
take a while to wake up. The laptop needs internet for these voices; without it, or if the bridge does not answer
within 10 seconds, each device speaks with its own voice. On the laptop version, single taps use the device's voice, which is
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
  made with Story on is reused only with the same preceding context.
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
- select or add a button, choose **Upload image**, and preview a GIF, JPG/JPEG, PNG or SVG up to 5 MiB.
  **Save** shares it with the class. **Replace image**, **Remove** and **Undo changes** also work before saving.
  GIFs keep their animation and SVGs keep their original resolution.
- or choose **Photos** or **GIFs** under **Picture** to search Pexels or GIPHY through PinPlay's API
  (`pinplay-api.eugenime.workers.dev`, which holds the keys). The search starts from the button's English word.
  Clicking a result downloads it on the laptop (photos at 320 pixels) and adds it like an uploaded image.
  GIPHY allows PinPlay 100 searches an hour, shared with PinPlay itself; each search is asked only once per session.
- add buttons, add, rename, reorder and delete topic pages, and edit the quick phrases;
- press ✨ next to a Catalan box, or **Fill missing Catalan** for everything at once, to translate with AI, then check
  and correct it;
- **Save** for everyone, or **Undo changes** since the last save.

Core (⭐) is the starred buttons. Every button lives on a page; **☆ Star** puts it on Core too, in the first empty
slot, and ★ marks it on its page. It is one button in both places, so a change in either changes both. To fill an
empty Core slot, click it and find the button to star into it. **☆ Unstar** keeps its place empty, so the words around
it do not move, and the button stays on its page. Removing a starred button from its page takes it off Core too.

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Board | `src/vocab.ts`, `src/App.tsx` | 60 fixed core buttons, 20 pages with about 2,650 words and expressions, and 38 quick phrases, all with Catalan |
| Catalan tooltips | `src/tooltip.ts` | Any button with `data-ca` shows its Catalan on hover, or on a half-second hold on touch screens (the hold does not press the button) |
| Editor | `src/Create.tsx`, `src/stars.ts`, `scripts/board-sync.mjs`, `worker/teacher.ts` | Teacher boards sync through Git. The Fix switch and saved answers use local Durable Object storage. Signed sessions last 12 hours. |
| Board rules | `shared/board.ts` | One `sanitizeBoard` for the page and the Worker: sizes, colours, empty core slots, core words and their page copies kept alike |
| Fix | `worker/phrase.ts`, `worker/model.ts` | One chat-model call returns the sentence, up to 2 other meanings, and its Catalan |
| Translate | `worker/translate.ts` | Teacher only: Catalan for new buttons and phrases, told the word type and page to pick the meaning |
| Speak | `worker/speech.ts`, `src/speech.ts`, `shared/voices.ts` | The serving Worker fetches English audio from PinPlay's Edge TTS bridge and caches clips for repeat playback |
| Classroom | `classroom.bat`, `scripts/classroom.mjs`, `scripts/setup-laptop.mjs`, `scripts/warm-speech.mjs` | Serves the school Wi-Fi from the laptop, sets up `.dev.vars`, wakes the voice bridge, refuses to start twice |
| Limits | `worker/index.ts` | The key stays on the laptop; 40 Fix and 40 voice requests a minute per student device; password guesses rate-limited |

## Design choices, and the AAC practice behind them

- **Core words stay put.** About 200 to 400 core words make up most of what anyone says. Keeping each one in a fixed
  place lets the hand learn the route (motor planning), so the home page is core words, not topic nouns.
  The core is 10 keys a row with room for it. Zooming in (Ctrl and +) or a narrower screen moves one key at a time to
  the next row, down to 5 a row, so the order stays the same as the keys grow. The editor always shows the 10 a row
  layout (5 on a narrow screen). **−** and **+** at the end of the page tabs make only the word buttons smaller or
  bigger, from 67% to 300%, and each device keeps its choice. The sentence bar and the other controls keep their size.
  With room for 10 a row, each step is one key more or fewer a row, from 14 down to 3.
- **Colour by word type** (modified Fitzgerald key): people yellow, verbs green, describing words blue, things orange,
  questions purple, social pink, "yes/no/not" red (yes and no as one pair of answers), little words grey. Published charts differ on the exact colours; being
  consistent is what matters. Page tabs take the colour of most of their words.
- **Core is the starred buttons.** Every core word lives on the page of its colour, and leads it (pronouns on People,
  core verbs on Actions, describing words on Describe, "now" on Time, little words on Little words), so a sentence can be
  built on one page without going back to Core. Question words and yes/no/not/please, whose colours had no page, have
  **Ask & answer**. Starring puts the most used ones on Core as well: the same button, with the same picture and
  Catalan. The saved board keeps a copy in each place, and `sanitizeBoard` keeps them alike.
- **Fix suggests, the speaker decides.** The Fix button opens suggestions for review. Ctrl+Enter explicitly asks
  to speak the main suggestion. Tapping a suggestion says it aloud, so the speaker can hear it, compare it
  with their own attempt and try again, or bring it into the bar with ✏️ to change it. While Fix is on there is
  no Speak button for the words as typed: it was the biggest button and said the unfixed English, the step a
  learner should check first. It comes back when Fix is off, the only way to say a whole sentence on a tablet. Tapping or typing another word closes the suggestions. The prompt
  forbids adding ideas or politeness the speaker did not choose, and the Worker drops answers far longer than the input.
- **Story** keeps the sentences on the device until the speaker turns it off, even if the teacher switches Fix off. New sentence
  keeps the fixed version (or the suggestion the speaker tapped), with its translation. It keeps their own words
  when Fix is off or does not answer. Fix receives the story's opening sentence and up to seven other sentences
  before the one being fixed. A new time cue in the current
  sentence takes precedence, and immediate requests or needs keep their intended tense.
- **The A1, A2 and B1 words are all there.** The pages hold the CEFR A1 to B1 vocabulary: the A1, A2 and B1 words of the
  [Oxford 3000](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000) (about 2,400 words) and
  Cambridge's [A1 Movers](https://www.cambridgeenglish.org/Images/351850-a1-movers-word-list-2018.pdf) word list. Most
  sit on the page of their topic (Numbers & shopping, Clothes & colours, Nature & weather, Animals, School, Free time,
  Work); verbs, describing words and little words that fit no topic go on Actions, Describe and Little words, so
  Actions and Describe are big pages of about 300 buttons each. The A2 and B1 words (`src/vocabMore.ts`) follow each
  page's first words, so those keep their place. Two pages at the end hold the rest: Society (government, law,
  religion, the news) and Ideas (abstract nouns such as *advantage* or *decision*). Left out: alcohol, CDs and DVDs; second spellings or forms of a word already there
  (bicycle for bike, telephone for phone, cannot for can't, photograph for photo, everybody for everyone); American words
  for ones the board has (vacation, soccer, pants, truck); and rare second meanings (a river bank, a coal mine).
  Spelling is British: organise, realise, summarise.
- **Everyday A2–B1 conversations.** Learners can borrow a pencil, ask which platform they need, describe a headache,
  request a refund or explain why they disagree. Languages and countries share a page. On Places, students can
  also find Catalonia, Barcelona and Madrid. Quick phrases include “I need an interpreter” and “Please let me finish.”
- **Built for ESL.** The level setting (A1 to B2) keeps suggestions in words the speaker knows. "My language" (Catalan, on by default on every device; a student can choose "Do not translate") shows the
  sentence translated, so the speaker can check the meaning before saying it out loud. Catalan tooltips let a learner
  check a word without adding it to the message.
- **Nothing is censored, and nothing says who said what.** It is the speaker's own voice, so there is no moderation
  step. Saved and recent phrases live only in each student's browser, and the server never logs what was said. The
  laptop keeps the saved answers above (the sentences and their corrections, translations and clips), with no name or
  device attached; **Forget them** in `/create` deletes them. Fix sends student text to xKiro or OpenAI, depending on the
  board and provider availability. With this account's data sharing on, OpenAI may use that text to train its models.
  Spoken sentences go to the voice bridge.
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
