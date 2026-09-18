# Rook Academy

Open **http://localhost:4810/#chess** after the normal collection setup. An original chess continuation for learners who already know the rules, basic tactics and checkmate. It uses a winding lesson path, short developed positions, a speaking animated coach, and occasional practice games. It is independent of Duolingo and has no connection to a Duolingo account.

## Small steps

Choose **Small steps** in Practice settings for a continuous 12-unit path: **36 five-position lessons, 180 practice positions and 36 separate animated examples**. The first four units retain their original 60 sparse capture/check/mate/knight-fork positions. Eight further units teach capture choices, escaping attacks, rook/bishop/queen double threats, pinned defenders, skewers and check-then-mate in two moves. Their 120 distinct practice boards and 24 examples are reproducibly composed with explicit goal checks; later units add opposing pieces and two-move decisions. A completed unit 4 unlocks unit 5 without replay, changing settings or resetting achievements. Continue opens the next unlocked lesson even after a completed review. Examples use the same optional Rook voice.

Any legal move that meets the stated one-move goal is accepted, not only the authored example line. Wrong legal moves return to the board; after two mistakes a similar example is one tap away. Hints remain available and assisted success remains distinct from independent success. The example does not award progress. The final checking lesson demonstrates an unsafe check being captured, then a safe check on the same example board. Its first hint highlights the opposing king and explains the rook or bishop checking direction without revealing a destination. An unsafe checking attempt offers **Why?**, an animated legal capture followed by a return to the original puzzle. Demonstrations do not write progress; mistakes and requested hints remain recorded. These are teaching exercises, not rated engine puzzles or measured player Elo. The finite position set includes reflected/rotated variations of authored patterns; it is not an unlimited adaptive curriculum. Progress never automatically switches a learner into the advanced course.

Changing the challenge level takes effect in the active lesson immediately. The previous unfinished lesson is parked separately by level and can be restored by switching back; completed work and full games are retained. Small steps has its own path and completion IDs. A new generic Beginner installation starts here; existing profiles keep their settings until changed.

## Learning path

Twelve units, six lessons per unit, five positions per lesson. Most positions require two to four learner moves, with the opponent's replies played automatically. Themes progress through forcing calculation, deflection, removing defenders, in-between moves, clearance, discovered attacks, mating nets, quiet threats, defense, passed pawns, rook endings and sacrifices. All units share one scrolling path. Portrait screens and narrow windows use one centered column with compact Rook/settings/review controls above it; wide landscape screens keep the side coach. The next lesson unlocks after completion; future steps show locks. Previously reached or active lessons remain available, including older out-of-order progress.

Each unit has an original explanation available on request and a short spoken task cue. Its first five lessons rise through the chosen position band. Checkpoints mix that unit with earlier ideas. The two **position difficulty** choices keep the themes while changing the calculation burden:

- **Stretch:** deeper combinations, selected from roughly 1300–2050 Lichess puzzle ratings.
- **Guided:** clearer patterns, roughly 700–1300 puzzle ratings.

These are **puzzle ratings, not estimates of the child's playing Elo**. Finishing another course does not establish a particular rating. Use the independent results and observed comfort to choose the band; switch before the next lesson. Best results retain their band in saved data, and recent practice labels it.

Hints progress from idea → piece → marked move, with the first cue available immediately and a five-second pause before each stronger cue. The server enforces the pause across refreshes; moves and Rook replay remain available. Each new decision starts with its own small cue, while assistance stays recorded for the whole attempt. At the final stage, Show me animates the suggested move and returns it for the learner to try; it does not submit an answer. An incorrect legal move visibly travels back to its starting square, keeps the original position available and offers a local engine reply to inspect. The board supports click/tap, dragging, arrow keys and Enter/Space, both orientations, castling, en passant and all four promotions. Correct exchanges animate in order; reduced-motion preferences are respected. Solved positions reveal a plain-language recap.

The final correct move in a lesson briefly celebrates, saves completion, returns directly to the path and scrolls to the next step. There is no separate unit-selection screen or extra summary Continue. Failed completion saves retain Retry; leaving cancels the pending visual transition without losing the solved position.

Mistakes and hints mark a result as assisted. Assisted puzzles return in review; independent solves expand the interval up to fourteen days. A subsequent lesson or review includes at most one fresh check: an unseen position with the same theme and difficulty band, chosen near the source puzzle rating when available. It replaces one of five ordinary lesson positions rather than adding homework. Results are recorded separately in My notebook. Help is still available on that check; an independent solve clears the source’s immediate practice flag without erasing its assisted history. Replaying a lesson preserves the best result. There are no lives, point deductions, task time limits, purchases or claimed rating gains. The brief hint pause is adjustable design judgment, not a validated learning optimum.

## Reliable coach playback

Coach speech reuses one audio element, primed by a tap or key press. Moving, switching views or requesting another cue cancels the prior clip cleanly; delayed callbacks from it cannot stop the new coach animation or report a false failure. Actual failures retain the exception name, clip source and media error code in local diagnostics. The speaker button can retry a blocked clip. This does not change the voice assets or add device speech.

## Separate starting levels and quieter coaching

The generic Beginner preset starts Small steps with a Friendly opponent; Explorer starts Stretch with a Club opponent. A private install can specify `chess: {"band":"guided","strength":"friendly"}` on each player in its external configuration. These starting choices apply once; later manual selections stay in control. Changing lesson difficulty parks the previous board and immediately opens or restores the selected level. Existing full games keep their original opponent setting; new practice games use the selected strength; earlier review evidence remains available when returning to its band.

Rook automatically gives short task cues, with repeated cues suppressed for 90 seconds and other automatic speech spaced at least 15 seconds apart. Routine correct moves, mistakes, restarts and assisted finishes use visual feedback without automatic commentary. Requested hints still speak; the same hint line is suppressed for 20 seconds. Tapping Rook always replays the guidance, including when coaching is muted. Lesson stars distinguish independent solves (filled) from assisted practice (outlined); hints never cost lives or block play.

## Practice games

Continue any lesson's starting position for eight turns or play a full game as White or Black. A bundled local Stockfish process supplies the opponent and optional coaching. Friendly, Club and Challenge are engine settings, not calibrated human ratings. Takebacks are available; help is counted separately from lesson progress. Game hints now use threat-check → piece → move stages too. New records count one helped turn rather than every repeated hint tap; older help totals retain their original meaning. Full-game results include checkmate, stalemate, repetition and insufficient material.

Every completed turn and lesson action saves per player in `FAMILY_DATA/chess/<player>.json`. Writes are serialized and atomically renamed. Duplicate request IDs do not award progress twice; stale tabs receive a reload instruction. A failed request retains its original ID for **Retry save**. Games/Refresh await pending saves. Force-closing a browser before a request reaches the server can lose that last action.

## Position provenance and checks

The appended Small steps drills live in `chess-continuation.json`; `node scripts/build-chess-continuation.mjs` reproducibly authors them with a fixed seed. One-move goals accept all legal qualifying answers. For the final two units, exhaustive three-ply search verifies the goal against every legal opponent reply, selects a reply with the fewest winning finishes, and accepts alternative qualifying checks and finishes. This verifies the short stated task, not long-term engine-optimal play or a measured learner rating. These are finite composed exercises, not an endless/adaptive curriculum; real learner response remains necessary to judge difficulty.

The 720 entries (360 per band) come from the [Lichess puzzle database](https://database.lichess.org/#puzzles), released as CC0. The September 2026 extraction filtered established puzzles by popularity ≥85, at least 300 plays and rating deviation ≤85. Source game URLs and player metadata are omitted. The source's first move is the opponent's setup move; the learner starts from the resulting FEN.

Every continuation was independently checked with python-chess and the bundled Stockfish 18 Lite engine, up to 300,000 nodes/depth 22, clearing its search history before each learner position per learner move. Each expected move was the top choice with at least a 65-centipawn gap to the next candidate, except immediate mates. Any legal immediate checkmate is accepted, even when it differs from the stored final move. Finite engine analysis is evidence of a sound exercise, not a mathematical proof. Reports are `chess-validation.json` and `chess-guided-validation.json`; `scripts/verify-chess.py` reruns the checks.

`node --test hub/tests/chess*.test.mjs` plays every lesson in both bands and checks legality, state recovery, player isolation, repeated requests, special rules and the actual local opponent.

## Original art and narration

The established Rook character and icon use original SVG artwork. The playing pieces in `public/chess/tokens.mjs` are original SVG geometry with shared light/dark silhouettes and layered shading. The earlier CC0 RhosGFX assets and their attribution remain in the repository as historical assets. The board-first interface has no decorative scenery; retained historical art and current asset provenance are in `public/chess/ART.md`. Coaching and interface text are original. No Duolingo character art, scripts or recordings are included. The optional cache uses the stock Kokoro `am_michael` voice; it is not a clone of an actor. To generate the finite teaching and feedback clips using an existing local Kokoro environment:

```sh
python scripts/build-chess-voice.py --models /path/to/kokoro-models --data /path/to/hub-data
```

Generated clips stay outside source control under `chess-voice/`. Every spoken prompt uses this cache, including piece-and-square hints and short original reactions. There is no device-speech fallback: installations without the cache can show the coaching text with the captions button. Automatic sound can be disabled; explicit replay still plays Rook. Audio stops when leaving the game or hiding its tab. The game sends no text to an AI service.

## Dependencies and design references

- [chess.js 1.4.0](https://jhlywa.github.io/chess.js/): legal moves and rules; BSD-2-Clause notice in `public/chess/CHESS-JS-LICENSE.txt`.
- [Stockfish.js 18.0.8](https://github.com/nmrugg/stockfish.js): separate local UCI process. GPLv3 notice, exact corresponding source archive, network and rebuilding information in `vendor/stockfish/`.
- [Duolingo's chess teaching overview](https://blog.duolingo.com/chess-course/) and [choosing the next move](https://blog.duolingo.com/how-to-pick-your-next-chess-move/): references for short contextual exercises and checking the opponent's reply. The shipped curriculum and implementation are independent.

## Play presentation

Lessons open directly on a large board with a short task cue. Original sculpted vector pieces use distinct pawn, slotted bishop, horse, tower, crown and cross silhouettes on a quiet cream-and-teal board. Selected pieces lift, legal drag destinations light up, moves arc and settle, and captured pieces disappear on arrival. Accepted lesson solves add a small check and brief spark burst at the destination; speculative attempts never receive that celebration. Rook follows selection with his eyes, cheers with his pencil and smiles on a solve, including muted play. Rook narrates the task; detailed text is available through optional captions and practice notes. Piece selection, movement, capture, wrong-move return and completion have distinct motion, with reduced-motion support. Dragged pieces settle from the pointer position rather than jumping back to their starting square. Rook responds visually during muted play too. Rules, puzzle data and progress remain independent of these presentation changes.
