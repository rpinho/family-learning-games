# Maze Garden

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer.

```sh
npm start
```

Open http://localhost:4322/?player=beginner or http://localhost:4322/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `MAZE_DATA_DIR` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/maze-garden/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests.

## Hints and progress

In puzzle mode, Explorer's checkpoint markers stay hidden so their locations do not reveal the route. The spoken puzzle still opens on arrival; Beginner retains visible markers.

**Make a Maze** is the fourth Maze Garden choice in the hub and opens directly at `#maze-garden/maker`. It uses the existing Maze Garden profile and saves. It offers 9×9, 13×13 and 19×19 boards, initially chosen from the player's regular maze level, plus a 25×25 Biggest board that permits 200 drawn squares instead of 115. An unfinished drawing can grow to a larger board without losing its trail, and the chosen size persists for the next creation. Draw a connected route across at most 32% of the board; the sketch seeds a walled maze with branches and a detour, so a straight sketch is not a straight solution. Play by dragging continuously through corridors. The draft, current challenge and up to five previous creations are saved separately from the regular adventure; older 7×7 creations remain playable. At the goal, a short letter or word choice can be heard, answered or skipped.
New word stops draw from 33 short words in 11 three-choice families and avoid the previous five answers. Existing creations retain their saved stop.

First help circles the next junction. After five seconds, More help marks only its outgoing branch. Replaying a junction cue does not inflate assistance. The next maze starts with help off and available on request. Every completion earns three stars; hints alone do not automatically lower the chosen level. Independent completions and substantial extra exploration still inform the provisional difficulty heuristic. Existing boards, previous stars and histories are retained; assistance is recorded separately from completion.

Requested hints enlarge dense boards to tracing size and center the junction. A white-edged purple arrow makes the next branch visible over the existing trail; a short spoken cue explains when the move goes back. The first hint still withholds the branch, the five-second stronger-help pause remains, and Overview/Find me stay available. Sound respects the existing mute preference.

## Word breaks (2026-09-26)

- Tracing mazes: one break at the finish before *You found the way!* opens. Without puzzle stops, there is also one break when the explorer passes half of the solution (on finger lift).
- Make a Maze: one break when *Play my maze* builds the drawing. The existing sound stop at the flag remains the second checkpoint.
- Each checkpoint happens once per maze per browser session.

Word breaks use the shared `word-break.mjs` (identical copy in Target Trail, Three in a Row, Maze Garden and Word Arcade; tests compare the copies). Each is one short spoken item, always passable: a wrong tap wiggles, and after two misses the answer glows. No hearts, no skip menu. Levels come from a read-only look at Letter Quest's save (`LETTER_QUEST_DATA`; `npm start` points every game at `.data/letter-quest`) through `GET /api/word-break`, which returns only derived letters/levels. Beginner gets a letter break (find the letter among look-alikes, or which letter a picture starts with). Explorer gets a word break (find a word among look-alikes, or build a spoken sentence from shuffled tiles, where names are not always last, said/asked is never second to last, several tiles are capitalised, and from level 2 there is one look-alike extra tile). Results go to the client event log as `word-break`.
