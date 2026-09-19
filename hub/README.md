# One app: Family Learning Games

Run `npm run play` at the repository root, then open **http://localhost:4810/**. This home screen contains nine destinations, including **Guess My Drawing**, **Rook Academy**, **Maze Garden** and **Soccer Club**. Install this home screen once, not each game. Browser installation behavior depends on platform and secure-origin support; plain HTTP on a LAN can retain browser security chrome.

Beginner and Explorer links: `/?player=beginner` and `/?player=explorer`. The hub remembers the selected preset on the device. The name remains large at the top. Use **Grown-ups** on the home screen to change it. The reading-and-code gate adds a deliberate step; it is not authentication.

Games stay inside the hub under `/g/<game>/<player>/`. A loopback-only reverse proxy preserves the original game servers and saves. Same-origin frame permissions are applied only by the hub; standalone apps keep their original protections. Browser preferences are scoped per game/preset. The single installed app has one manifest, icon, scope and start URL. There is no service worker cache, cloud server or offline-play guarantee. Return with **Games**; **Refresh** stays available. Pending writes or unsaved input prompt a confirmation rather than trapping navigation. Initial hub/chess reads have an eight-second deadline with a reconnect screen. If a native game cannot confirm its save within six seconds, Games/Refresh offers an explicit leave-anyway confirmation; staying preserves the pending action, while leaving may lose the last unsaved action.

## Activity families

**Guess My Drawing** opens Number Park’s free-drawing data directly on a wider canvas; Number Park keeps number/shape tracing. Existing pictures and guess history stay in the same backend, while menu activity is attributed to the drawing destination. **Maze Garden** offers tracing mazes, the 3D letter labyrinth, and obstacle rescues. **Soccer Club** offers the three soccer variants below. Each keeps its previous save location; Letter Quest’s former activities still use its backend, with no profile migration. Standalone Letter Quest links remain compatible. Its hub navigation now focuses on literacy and stories, with a book icon. Reading exercises with distinct mechanics in Word Arcade, Number Park and Target Trail remain separate.

**[Rook Academy](CHESS.md)** is the new chess destination: 12 units, 72 short lessons, two difficulty bands, an original speaking coach, spaced review and local practice games. Chess owns the rook icon.

## Personal menu order

Main-menu cards rank separately for each preset from the last 14 days of local play. An actual play action starts a visit; switching game families or returning after ten minutes of inactivity starts another. Each family counts at most six visits per UTC day. Recent visits have more weight (three-day half-life); audio, hints, settings, rejected requests, automated opponent moves and page opens do not earn visits. This estimates play frequency, not enjoyment or mastery. A newly introduced game initially has less history.

Old Number Park free-drawing saves stay in Number Park, while drawing, guessing and correction activity ranks the Guess My Drawing card. Number and shape tracing still ranks Number Park. Old Letter Quest labyrinth and rescue events belong to Maze Garden; its soccer events belong to Soccer Club. The remaining reading/story events stay with Letter Quest. Family variants combine into their main card. Every card remains visible, with stable default order for ties or missing history. The menu opens immediately from a per-preset device cache or the full default catalog. A two-second background request updates preferences for the next menu visit; failure retains the prior order. Cards never move underneath a visible selection. Screenshot/logo preferences are independent of order. The README showcase keeps its fixed educational-first ordering.

For an existing installation, optional private `gameData` config maps game IDs to their existing data directories (the directory containing `logs/`). Without it, the hub reads `.data/<game>/logs/` from the standard launcher. Hub chess/soccer logs come from `FAMILY_DATA/logs/`. A background worker refreshes rankings about once a minute and streams changed files, keeping log parsing off the HTTP thread. The endpoint immediately returns cached ordered IDs and a readiness flag; a cold server uses the full catalog until its first scan completes. A stalled scan is stopped after fifteen seconds, retaining the last successful ranking, with a one-minute retry interval. A warming server never overwrites favorites already cached on the device. No saves are changed and no new external telemetry is added.

## Dribble Duel

The **Soccer Club** picker offers **Live dribbling**, **Feint puzzles** (the original turn-based game), and **Word penalties** (moved from Letter Quest). The activity bar switches between them. Switching saves the current live position and keeps the original puzzle state separately; it does not wait until a whole round finishes. Pending network saves must settle first, with a visible error if they fail. The original version has the Fake left/right and Dribble left/Nutmeg/right controls, eight puzzle difficulties and its earlier saved progress.

In **Live dribbling**, drag anywhere on the pitch to steer your blue player and ball. The faster orange defender predicts from delayed observed movement, cuts off the goal-side route and chases after being beaten. A yellow line telegraphs a committed lunge; a shrinking ring shows recovery. It cannot read the finger, teleport or instantly reverse a committed lunge.

Lift to stop and protect the ball quietly; touch again to continue, with no lifted-finger pause banner. The explicit Pause button remains. **Dribble the ball into a goal with posts and a net**—there is no release-to-shoot action. Reaching the top outside the posts does not score. A brief GOAL celebration and short spoken “Goal!” precede the reading reward. Tackles trigger a short reset. Arrow keys also work. Controls are narrated only once per session, with **Hear again** for replay.

Each live goal offers a **Letter reward**: hear a letter and find it, match uppercase to lowercase, fill a word's first letter, or hear and select a simple word. Beginner starts with uppercase letter recognition; Explorer starts with lowercase matching. The 24-word bank varies simple words including the *at* family. Selecting a letter speaks its name; word choices speak the word. These are letter-name/word prompts, not a validated phoneme course. Stock American female narration is generated locally by the optional voice script; otherwise device speech is used.

Reading adapts independently of defender difficulty: three first-try unassisted answers move up one of four stages; two supported/skipped challenges ease the stage. Wrong answers never remove the earned dribble. **Show me** and automatic help after two errors mark the answer assisted; stars reward completion, not mastery. Correct answers return automatically to soccer. **Keep dribbling** skips the challenge without a penalty. Pending challenges survive Refresh; settings still cancel immediately. Local reading history stores target, stage, errors, help, skips and independent completions; replay clicks are logged separately. Existing games are unchanged—this shared literacy-stop module is currently integrated in soccer only.

**Twelve** instantly selectable live difficulties change reaction delay, movement speed, lunge and recovery. Levels 1–5 keep their initial goal-version movement. Levels 6–12 use closer marking: stronger goal-side positioning, shorter close-range tackles instead of distant dives, and faster recovery. Level 8 is labeled **Close marking**, with speed 429 world units/second; level 12 reaches 520 (the player peaks at 225). Committed lunges and recovery still create beatable openings. Beginner starts at 1 and Explorer at 3; existing chosen levels remain. Three consecutive goals raise difficulty; three tackles lower the next level. A practice attempt ends after 90 active seconds without a loss penalty. Starting positions and four pitch palettes vary. This calibration is not a validated fit for every child.

The server stores a separate `live` record, preserving prior turn-based scores and live dribbles. The `live.goals` count remains separate; old end-zone dribbles are not renamed as goals. Deterministic replays carry their physics rules version: frozen v1 (end-zone) and v2 (initial goal) simulations remain available; close marking is v3. The first new-version start privately archives an unfinished old replay before starting a fresh run, without removing scores or reading progress. Old open clients can continue until that profile upgrades; thereafter they receive a safe Refresh instruction. Replays are checkpointed every five active seconds and on finger lift; reload reconstructs the last saved movement. Finishes are idempotent. Local logs contain rules, replays, outcomes, direction changes, active time, lunges, near encounters and settings. Nothing is uploaded. Failed saves expose **Retry save**; Games/Refresh remain available. A forced quit may lose movement since the last checkpoint.

This is not a physical dribbling trainer or a validated assessment of soccer skill. Pair screen play with slow, safe changes of direction using a soft ball and clear space. No tackling, sliding or jumping over a partner. Original puzzle mode retains the older turn-based rules rather than applying live speed settings to it.

## Existing local installations

The hub can sit in front of existing running games without migrating their save files. Set `FAMILY_CONFIG` to a private JSON file outside this repository:

```json
{
  "players": [{"id":"beginner","name":"Beginner","level":1},{"id":"explorer","name":"Explorer","level":3},{"id":"admin","name":"Admin","level":1}],
  "games": {"letter-quest":4811,"word-arcade":4812,"number-park":4813,"maze-garden":4814,"three-in-a-row":4815,"target-trail":4816},
  "hosts": []
}
```

Player IDs must match the existing game profiles. `games` contains only trusted local ports; arbitrary remote upstreams are not supported. Start `hub/server.mjs` with `PORT`, `HOST`, and `FAMILY_DATA` as appropriate. The root launcher uses `.data/hub/` for new soccer profiles and diagnostics. Existing games retain their own data. Never commit private configuration or data.

Optional prerecorded stock narration: with an existing local Kokoro environment, set `FAMILY_VOICE_MODELS` and `FAMILY_DATA`, then run `scripts/build-voice.py` inside `hub/`. It generates finite original American-English prompts using the stock `af_heart` voice. No cloned person, recording uploads or API key. Without the cache, the app uses the device's American-English speech voices when available. Voice quality varies and offline speech is not guaranteed.

The root `npm test` includes hub rule/proxy tests. A feature-detected read-only WebMCP hook reports the current game/preset where supported; it does not play a child's game or change scores.
