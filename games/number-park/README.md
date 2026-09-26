# Number Park

## September 26: word breaks and content-first speech

- Word breaks (shared `lib/word-break.mjs`, identical in every game; a test compares the copies). One short item, always passable, no menu. `GET /api/<player>/word-break` returns only the derived letters/levels from a read-only look at Letter Quest's save (`LETTER_QUEST_DATA`). The beginner gets letter breaks, the explorer word/sentence breaks. Where (`lib/word-breaks.mjs`): mid-round after question 3, and at the end of every 6-question round before the finish screen (the recap, story lines and berries follow the break; the recap is spoken once, after it). A wind-down round has no end break, and there are no breaks while resting. Free play has a break at most every 90 s: after a completed trace or shape, after a Plan & Play success, and after the child tells Guess My Drawing what it was. Other speech waits during a break and the latest line is said afterwards.
- Speech rule (`lib/speech-rule.mjs`): content (the question itself, a line naming a number/target, the number or shape to trace, reading sounds/words, counting taps, word-break prompts) always plays, even with the sound button off, and repeats once after ~9 s with no taps. How-to instructions ("Tap and count.", "Find the missing number.", reading how-to prompts, Plan & Play's choose/plan/edit lines) play once per browser session and only with sound on. Mixed prompts are split, e.g. "Put the groups together. How many?" says the first sentence once and the question every time. Recap, story, praise, chimes and Plan & Play narration obey the sound button, which is on by default.

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer. Run `npm ci` and `npm run build` first.

```sh
npm start
```

Open http://localhost:4321/?player=beginner or http://localhost:4321/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `NUMBER_PARK_DATA` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/number-park/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests. Build first: the HTTP tests also check static assets.

### Picture guesses: people, faces and bare trees

The local picture model now includes original authored person/face prototypes and bare-branched trees alongside the existing public Quick, Draw! examples. A bounded trunk-and-branches check corroborates tree guesses without treating letters, combs or ladders as trees. No learner artwork trains the model or leaves the installation. Recognition remains fallible: ambiguous pictures stay uncertain, and free art never loses points. Guesses show picture icons; corrections open picture choices first. New person/face questions use the existing recorded stock voice.
