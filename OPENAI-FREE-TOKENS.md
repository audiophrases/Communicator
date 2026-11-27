# OpenAI: free daily tokens on this account

What the OpenAI dashboard showed on 2026-11-16 (organization "Personal" → Settings → Data controls → Sharing). Look
there again before relying on it: the offer and its list of models can change.

- **Sharing is on for all projects.** Both settings on that page say *Enabled for all projects*, including *Share
  inputs and outputs with OpenAI*: OpenAI may use what the apps send (students' text included) and what it answers to
  improve and train its models.
- **"You're enrolled for complimentary daily tokens."** Free daily usage on traffic shared with OpenAI:
  - up to **250 thousand tokens a day** across gpt-5.4, gpt-5.2, gpt-5.1, gpt-5, gpt-4.1, gpt-4o, o1 and o3;
  - up to **2.5 million tokens a day** across gpt-5.4-mini, gpt-5.4-nano, gpt-5-mini, gpt-5-nano, gpt-4.1-mini,
    gpt-4.1-nano, gpt-4o-mini, o3-mini and o4-mini.
- *"Usage beyond these limits, as well as usage for other models, will be billed at standard rates. Some limitations
  apply."*

## What it means for the apps

- **Free:** a model on the 2.5 million list, within the day's amount. HelloChat, Pixel Plaza and Communicator's online board use `gpt-4o-mini`. Communicator uses the billed `gpt-6-luna` on the laptop. A grammar
  correction or hint is about 700 tokens, so the free amount covers a few thousand a day, shared by every app on the
  account.
- **Billed:** every model not on those lists, such as `gpt-6-luna`, `gpt-5.6-*` and `gpt-6.1-*`, and audio and
  image models such as `whisper-1`. Moderation (`omni-moderation-latest`) costs nothing either way.
- **Before switching a model**, check it is on the list: a newer model can be better without being free. Prices on
  developers.openai.com/api/docs/pricing on 2026-11-16, per million tokens in / out: gpt-4o-mini $0.15 / $0.60, gpt-5.4-mini $0.75 / $4.50, gpt-5.4 $2.50 / $15.00,
  gpt-6-luna $0.10 / $0.50, gpt-6.1-terra $1.00 / $5.00.
- **To keep students' text out of training**, choose *Enabled for selected projects* and leave out the OpenAI project
  whose key the classroom apps use (its calls then get no free tokens), or disable sharing.

The same note is in every project that calls the OpenAI API: Communicator, HelloChat, Pixel Plaza, PinPlay and
Phone Mirror.

## In this project

- **Online student Fix and Catalan** (open to anyone, 24/7): `gpt-4o-mini` on the online Worker's key, **free** within
  the 2.5 million list, shared with HelloChat and Pixel Plaza. Past the day's amount it is billed at $0.15 / $0.60 per
  million tokens (about 0.02 cents a Fix). Saved answers cost nothing.
- **Laptop Fix** (`worker/phrase.ts`: the correction and its Catalan) and the editor's translation (`worker/translate.ts`):
  `gpt-6-luna` with thinking off, **billed** ($0.10 / $0.50 per million tokens): about 0.01 cents a Fix, so about
  5 cents for a busy lesson. Chosen after side-by-side tests on 2026-11-16 (`worker/model.ts`): it got Catalan
  "agradar" right most often (12 of 14 hard sentences). `OPENAI_PHRASE_MODEL=gpt-5.4-mini` keeps it **free** (2.5
  million list, about 700 tokens a Fix), with about 9 of 14.
- **Voices**: PinPlay's Edge TTS bridge, not OpenAI.
