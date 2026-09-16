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

First help circles the next junction. After five seconds, More help marks only its outgoing branch. Replaying a junction cue does not inflate assistance. The next maze starts with help off and available on request. Every completion earns three stars; hints alone do not automatically lower the chosen level. Independent completions and substantial extra exploration still inform the provisional difficulty heuristic. Existing boards, previous stars and histories are retained; assistance is recorded separately from completion.
