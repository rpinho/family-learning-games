# Word Arcade

## September 26: word breaks and Sentence Express without position cues

- Word break after round 4 of every mission except Sentence Express, and when a mission is complete. Pixel Studio pauses at 2 and 6 minutes.
- Sentence Express now uses the shared varied sentence bank (12 per level). Carriages are a seeded shuffle, never the sentence order or a rotation. There are no punctuation tiles (a full stop used to mark the last carriage). From level 2 there is one look-alike extra carriage, and slot count follows the sentence (`q.slots`). Older saved questions keep their original tiles.

Word breaks use the shared `word-break.mjs` (identical copy in Target Trail, Three in a Row, Maze Garden and Word Arcade; tests compare the copies). Each is one short spoken item, always passable: a wrong tap wiggles, and after two misses the answer glows. No hearts, no skip menu. Levels come from a read-only look at Letter Quest's save (`LETTER_QUEST_DATA`; `npm start` points every game at `.data/letter-quest`) through `GET /api/word-break`, which returns only derived letters/levels. Beginner gets a letter break (find the letter among look-alikes, or which letter a picture starts with). Explorer gets a word break (find a word among look-alikes, or build a spoken sentence from shuffled tiles, where names are not always last, said/asked is never second to last, several tiles are capitalised, and from level 2 there is one look-alike extra tile). Results go to the client event log as `word-break`.

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer. Run `npm ci` and `npm run build` first.

```sh
npm start
```

Open http://localhost:4319/?player=beginner or http://localhost:4319/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `WORD_ARCADE_DATA` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/word-arcade/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests.
