# One app: Family Learning Games

Run `npm run play` at the repository root, then open **http://localhost:4810/**. This home screen contains all six existing games plus **Dribble Duel**. Install this home screen once, not each game. Browser installation behavior depends on platform and secure-origin support; plain HTTP on a LAN can retain browser security chrome.

Beginner and Explorer links: `/?player=beginner` and `/?player=explorer`. The hub remembers the selected preset on the device. The name remains large at the top. Use **Grown-ups** on the home screen to change it. This arithmetic gate prevents accidental changes; it is not authentication.

Games stay inside the hub under `/g/<game>/<player>/`. A loopback-only reverse proxy preserves the original game servers and saves. Same-origin frame permissions are applied only by the hub; standalone apps keep their original protections. Browser preferences are scoped per game/preset. The single installed app has one manifest, icon, scope and start URL. There is no service worker cache, cloud server or offline-play guarantee. Return with **Games**; **Refresh** stays available. Pending writes or unsaved input prompt a confirmation rather than trapping navigation.

## Dribble Duel

A **real-time drag-to-dribble game**. Drag anywhere on the pitch to steer your blue player and ball. The orange defender tracks your past position with limited acceleration: pull them one way, then change direction. A yellow line telegraphs a lunge; a shrinking ring shows recovery. The defender cannot read the finger, teleport or instantly reverse a committed lunge.

Lift to pause and protect the ball; there is **no shot**. Win by carrying the ball across the far line beyond the defender. Tackles trigger a short reset, not a long explanation. Arrow keys also work. Controls are narrated only once per session, with **Hear again** for replay.

Eight instantly selectable difficulties change reaction delay, movement speed, lunge and recovery. Levels 7–8 narrow the space. Beginner starts at 1 and Explorer at 3, independently of old puzzle levels. Three consecutive wins raise difficulty; three tackles lower the next level. A practice attempt ends after 90 seconds of active movement without a loss penalty. Starting positions and four pitch palettes vary across attempts. This is a first real-time calibration, not a claim that these levels fit every child.

The server stores a separate `live` record, preserving all prior goals, turn-based dribbles, levels and history. Deterministic steering replays are checkpointed every five active seconds and on finger lift; reload reconstructs the last saved movement, paused. Completed replays are validated by the same simulation on the server. Finishes are idempotent. Local logs contain replays, outcomes, direction changes, elapsed active time, lunges, near encounters and setting/cancellation events. Nothing is uploaded. Failed saves pause play and expose **Retry save**, while Games/Refresh still offer an exit. A forced quit may lose movement since the last checkpoint.

This is not a physical dribbling trainer or a validated assessment of soccer skill. Pair screen play with slow, safe changes of direction using a soft ball and clear space. No tackling, sliding or jumping over a partner. The older turn-based API remains compatible with already-open tabs; Refresh opens the real-time version.

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
