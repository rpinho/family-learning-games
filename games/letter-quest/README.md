# Letter Quest

## Literacy identity — September 15, 2026

Letter Quest uses reading and word-game imagery throughout navigation, lesson paths, rewards and saved standings. The former Matches tab is labeled Word games; existing routes and progress remain compatible. The header shows the practice level without the old rating number. Rook and existing narration stay. Chess is a separate game in the family hub.

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer.

```sh
npm start
```

Open http://localhost:4318/?player=beginner or http://localhost:4318/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `LETTER_QUEST_DATA` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/letter-quest/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests.
