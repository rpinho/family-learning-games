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

First help circles the next junction. After five seconds, More help marks only its outgoing branch. Replaying a junction cue does not inflate assistance. The next maze starts with help off and available on request. Every completion earns three stars; hints alone do not automatically lower the chosen level. Independent completions and substantial extra exploration still inform the provisional difficulty heuristic. Existing boards, previous stars and histories are retained; assistance is recorded separately from completion.

Requested hints enlarge dense boards to tracing size and center the junction. A white-edged purple arrow makes the next branch visible over the existing trail; a short spoken cue explains when the move goes back. The first hint still withholds the branch, the five-second stronger-help pause remains, and Overview/Find me stay available. Sound respects the existing mute preference.
