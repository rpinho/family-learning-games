# Letter Quest

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer.

```sh
npm start
```

Open http://localhost:4318/?player=beginner or http://localhost:4318/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `LETTER_QUEST_DATA` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/letter-quest/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests.
