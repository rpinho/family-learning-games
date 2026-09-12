# One app: Family Learning Games

Run `npm run play` at the repository root, then open **http://localhost:4810/**. This home screen contains all six existing games plus **Dribble Duel**. Install this home screen once, not each game. Browser installation behavior depends on platform and secure-origin support; plain HTTP on a LAN can retain browser security chrome.

Beginner and Explorer links: `/?player=beginner` and `/?player=explorer`. The hub remembers the selected preset on the device. The name remains large at the top. Use **Grown-ups** on the home screen to change it. This arithmetic gate prevents accidental changes; it is not authentication.

Games stay inside the hub under `/g/<game>/<player>/`. A loopback-only reverse proxy preserves the original game servers and saves. Same-origin frame permissions are applied only by the hub; standalone apps keep their original protections. Browser preferences are scoped per game/preset. The single installed app has one manifest, icon, scope and start URL. There is no service worker cache, cloud server or offline-play guarantee. Return with **Games**; **Refresh** stays available. Leaving with pending writes is blocked; possible unsaved canvas input prompts confirmation.

## Dribble Duel

A turn-based soccer observation puzzle, not a physical dribbling trainer. Left/right always mean **the attacker's screen perspective**:

| Visible defender commitment | Open routes before touchline restrictions |
| --- | --- |
| Blocks your left, feet apart | Through or your right |
| Blocks your right, feet apart | Your left or through |
| Feet together, blocks middle | Your left or your right |

The defender commits before a scored choice. No hidden simultaneous counter-move, timer or unavoidable random loss. Getting past triggers an automatic shot and goal animation. Wrong choices explain the blocked route and let the player retry; a correct retry still celebrates but does not count as independent success.

Levels 1–2: read clear foot positions. Levels 3–4: touchlines can remove an escape route. Levels 5–6: make a pretend move, watch whether the defender follows or holds, then choose. Levels 7–8: read a second visible recovery movement before the goal. Six unassisted completed puzzles raise difficulty; two blocked attempts ease the next puzzle. Manual level changes immediately replace the current puzzle without resetting earned goals. Clues are recorded and do not drive promotion.

This is a deliberately simplified rules system. In real soccer, a defender stepping sideways does not guarantee a nutmeg; the actual gap, distance, balance, ball control and timing matter. Pair screen play with slow, safe practice using a soft ball and a clear space. No tackling, sliding or jumping over a partner. [FIFA's 4–8 dribbling and dueling session](https://www.fifatrainingcentre.com/en/practice/grassroots/4-to-8/dribbling-and-dueling.php) is background inspiration for observing, feinting and 1v1 play, not validation of this app or an affiliation.

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
