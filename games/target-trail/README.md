# Target Trail

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer.

```sh
npm start
```

Open http://localhost:4324/?player=beginner or http://localhost:4324/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `TARGET_DATA` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/target-trail/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests.

## Sling Shot and word breaks (2026-09-26)

- **Sling Shot** lives in this app at `/?mode=sling` (hub tile *Sling Shot*). Pull the stone back, let go, hit the balloon that matches the spoken prompt. Five stones per round, saved in `profile.sling`, separate from arrows. Content rotates automatically per child, with no picker. Beginner: letters (from his Letter Quest letters), numbers, and complete-the-pattern (colours/shapes). Explorer: times tables and spelling (hit the next letter of a spoken word). Admin mixes all five. Physics are deterministic and shared (`sling.mjs`); the server rescores every stone. Beginner gets larger balloons, a wider hit margin and a full aiming arc that stops at the balloon it would hit. Explorer gets a shorter arc. Non-letter stages rise after 4/5 and ease after 3 wrong hits.
- **Word breaks**: archery and sling each pause once mid-way through the first round of a visit (after arrow/stone 2 or 3) and after every round.

Word breaks use the shared `word-break.mjs` (identical copy in Target Trail, Three in a Row, Maze Garden and Word Arcade; tests compare the copies). Each is one short spoken item, always passable: a wrong tap wiggles, and after two misses the answer glows. No hearts, no skip menu. Levels come from a read-only look at Letter Quest's save (`LETTER_QUEST_DATA`; `npm start` points every game at `.data/letter-quest`) through `GET /api/word-break`, which returns only derived letters/levels. Beginner gets a letter break (find the letter among look-alikes, or which letter a picture starts with). Explorer gets a word break (find a word among look-alikes, or build a spoken sentence from shuffled tiles, where names are not always last, said/asked is never second to last, several tiles are capitalised, and from level 2 there is one look-alike extra tile). Results go to the client event log as `word-break`.
