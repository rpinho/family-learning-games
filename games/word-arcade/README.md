# Word Arcade

## September 27: word breaks for an early reader use CVC words

Shared `word-break.mjs` v5 (identical in every game): the words track uses only CVC words (at/an/ig/op/ug/in families), with two look-alikes that start with the same letter and differ in the vowel or the last letter (mat / map / man). No sentences until Letter Quest shows sentences built independently; a device's own history no longer unlocks them. The letters track is unchanged.

## September 27: Letter Slalom (3D)

A calm downhill ski run in the Arcade tab. The child steers a skier (finger or mouse: the skier goes where the finger is; optional tilt; arrow keys) through eight gate rows of two or three gates, each carrying a letter or a word. The question is spoken as each row approaches, and the skier glides slowly until it has been said.

- **Letters track (`beginner`):** "Find the letter F." among look-alikes, or "Which letter does fox start with?" with a picture; letters come from Letter Quest (read-only). Pairs first, then triplets.
- **Words track (`explorer`), CVC words only:** "Find the word mat." among look-alikes that start with the same letter and differ only in the vowel or the last letter (mat / map / man), from the at/an/ig/op/ug/in families, so guessing by the first letter never works. After each gate the word is sounded out (with a pre-rendered voice the private install renders each sound, then the word; device speech says the word). The next word of a spoken sentence appears only once Letter Quest shows sentences built independently.
- **No score, no streaks, no fail state.** A missed gate names the answer and the run continues; the next triplet becomes a pair. About 75–90 seconds, then a spoken recap, the shared word break and a calm finish card.
- **Calm wind-down (`lib/rest.mjs`):** after 20 minutes of continuous play, the mission or run that is finishing is the last one for an hour; grown-ups can hold the button on the calm screen to keep playing.
- **3D, kept light for low-end Chromebooks and phones:** three.js, loaded only when a run starts; everything procedural (valley, instanced pines, one merged ridge mesh, clouds, gate rows with one small atlas texture and two draw calls each, skier, ski tracks, spray, sun shadows); no post-processing. Tiers: low (no shadows, fewer trees, 0.72x resolution, ~62 draw calls), medium (1024 shadow map, ~77), high (2048 shadows, ~77). Touch devices and 4 GB machines start on low and step up once only when their own frames are fast; any device lowers resolution and then tier when frames average slower than ~48 fps. Rendering stops while paused or hidden and winds down after the finish. `?slalomQuality=low|medium|high` forces a tier. Without WebGL a simple 2D version with the same gates is shown.
- **Optional finish-line friends:** a household can put small rigged GLB models (with a `cheer` animation) in `FAMILY_ASSETS3D` and list them per player in `companions.json`; two wait at the bottom and cheer. They load only after the finish line; nothing is served unless listed.
- **Check:** `node scripts/check-slalom-browser.mjs --base http://localhost:4319 --player beginner [--mobile --size 390x844] [--miss 2] [--shots dir] [--record]` skis a full run in headless Chrome (muted), steering with real pointer or touch input.

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
