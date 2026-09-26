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

## Sling aim and speech (2026-09-26, `sling-2026-09-26-2`)

- **Aim is one decision, like a commercial tablet slingshot game.** Targets stand in one column at the same distance. Power is fixed; only the pull *direction* matters (pull straight away from the balloon you want). Drag anywhere on the canvas: the pull is measured from where the finger lands. A full dotted arc ends on the balloon it will hit, and that balloon glows before you let go. Beginner (letters track): 3 big balloons and a magnet (any aim at the column goes to the nearest balloon). Explorer: 4 balloons and a small margin only. Pulling toward the balloons costs no stone. Flight ~0.9 s.
- Simulated pulls toward the right balloon with a wobbly angle hit 92% (beginner, ±12°) and 99% (explorer, ±6°); see `tests/sling.test.mjs`.
- Pages opened before this change send free 2D pulls; the server scores those with the frozen `sling-legacy.mjs` until the page is refreshed. New pages reload themselves between rounds when the server has a newer sling.
- **Speech.** CONTENT (what to hit: the letter, number, pattern, times-table question, spelling step, the word-break question, and naming the right answer after a mistake) always plays automatically on every new target, even with the toggle off, and repeats gently after ~6.5 s of waiting (at most twice). INSTRUCTIONS ("Pull back and let go.") are said once per session and obey the toggle. Praise and effects obey the toggle, now labelled "Effects". If the browser blocks audio before the first touch, the page shows "Ready? ▶ Let's play" and the prompt plays on that tap (archery replays it on the next touch). Speech uses the browser's voice.
