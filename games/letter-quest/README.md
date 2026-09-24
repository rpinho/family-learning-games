# Letter Quest

## September 23: quiet return to the rescue exit

After the last friend is rescued, Rook announces the exit objective once instead of restarting it on every forward move. The objective remains visible and available through replay; Help, resume and completion still speak. Existing saves and movement rules are unchanged.

## September 16: reliable reading saves and accessible help

Reading actions lock before pending ink saves finish, so repeated taps cannot submit competing answers. Revision conflicts refresh the same activity without automatically replaying an answer; pending handwriting stays available for a deliberate retry. Other-screen activity changes leave unsaved writing on its current page.

The old shared reveal balance no longer blocks help. Reading offers a spoken cue immediately, then its answer model after five seconds; replay does not extend the pause, and a new question gets immediate help. Assistance remains separate from independent success. Other Letter Quest activities retain their existing supported-practice scoring and no longer exhaust a shared hint allowance. Older hint-budget notes below are historical.

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
