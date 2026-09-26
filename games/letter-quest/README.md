# Letter Quest

## September 26: word breaks, varied Sentence studio, content-first speech

- Word breaks (shared `public/word-break.mjs`, identical in every family game; a test compares the copies and checks the file is on the served allow-list). One short item, always passable: wrong taps wiggle, two misses make the answer glow, no menu. The level comes from this save (read only): The beginner gets letter breaks (their Letter Quest letters, look-alikes, or which letter a picture starts with); the explorer gets word breaks (look-alike words or a spoken sentence from shuffled tiles). Where: Rook's Rescue when the first of several friends is saved and when a rescue is complete (or before the next rescue if that break was missed, e.g. after a reload); Story when a chapter is won; Soccer at half time (after shot 3) and full time. Never during the calm wind-down. Results go to diagnostics as `word_break`.
- Sentence studio uses the shared varied bank (12 per level): names first, middle or last, said/asked never second to last, most sentences with several capitalised tiles. Tiles are a seeded shuffle, never in order or a rotation, with no punctuation tile (the end mark shows only when the sentence is full). From level 2 there is one look-alike extra tile. Questions saved before this change keep their original tiles.
- Speech rule: content (the question, the letter/word to find, letter names on taps, reading prompts that name the word) always plays, even with the sound setting off, and repeats once after ~9 s with no taps. How-to instructions (reading decode/act/story prompts, the story move instructions, maze intro, rescue lines, soccer intro/whistle, rest line) play once per browser session and only with sound on. Recap, Bo's story, praise, chimes and soccer effects obey the sound setting. Sound stays on by default.

## September 24: answer timing survives clock corrections

Answer durations use the browser’s monotonic clock, so a device clock adjustment cannot produce negative timing and reject a valid tap. The same bounded timer covers lessons, the labyrinth, reading and word penalties. Server validation, saved progress, assistance and difficulty rules remain unchanged. Refresh an existing tab to load the fix.

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
