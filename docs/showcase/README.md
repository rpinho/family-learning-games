# Gameplay showcase v3

The hero is a real Book frame: painted doors open onto a treasure chest, with a large fictional guide pointing toward the opening, an explorer reacting, a sister carrying a map, and a plush fox reaching. The figures use three-quarter action poses, different depths, and soft contact shadows. The Book's preview-only `capture` option removes its chrome in the player; no controls are painted over.

Three **1280 × 640** social layouts are saved in `docs/media/`: `social-preview-v3-gallery.png`, `social-preview-v3-cream.png`, and `social-preview-v3-cinematic.png`. The gallery version is selected as `social-preview.png`. Its exact title is “Family Learning Games — a story world and ten calm learning games”. Gameplay tiles use actual **2560 × 1440** captures, cropped for legibility. The Rook Academy tile frames the complete board beside Rook Classic, with glasses and pencil; `tiles/chess-full@2x.png` preserves its raw capture. Full screenshots and README images are **1280 × 720** and preserve the gameplay frame.

## Fictional art

Six action candidates were generated for each of four original characters. The guide's reaching candidate crossed a sprite boundary and was rejected. Accepted poses include walking, pointing, kicking, reaching, kneeling to count, carrying a map, and cheering. Alpha extraction separates the selected figures; contact shadows are part of scene composition. The explorer, sister and guide share textured gouache, clothing, reflected sunlight and expressive faces; the fox remains a consistent original felt companion. Real people, photographs, toys and household objects were never generation inputs. [Provenance and prompts](../../hub/public/book-art/ART.md).

## Castle Kingdom

`node docs/showcase/demo-server.mjs` opens a public-safe, loopback-only preview at `http://localhost:5710/`. Its Castle Kingdom uses the world client's walking, approach, friend conversation, goal ribbon, inventory, fog map, challenge rules and animated castle doors. The fictional cast replaces every private character. State is held in memory; restarting clears it. No household configuration, save, chapter, notes, recordings or private artwork is read. The Book demo is an authored fictional chapter.

The normal world demonstrates a fictional partially restored map. A separate `reveal=1` demo state shows the working treasure door. This is synthetic demonstration progress. Four extra room backgrounds reuse generic public paintings; this preview does not distribute the household's full art collection. The world remains separate from the standard hub's home screen.

## Edition differences

The public sync includes the live calm theme, both home pages, balance and pattern activities, and the World and quest engines. The Book retains the original fictional painted cast and scenery. Runtime World demos use independently authored geometric counting scenes, while this showcase retains its standalone fictional Castle Kingdom presentation.

Scores, drawings and map progress in captures are synthetic. Household profiles, play history, daily quests, recordings and artwork are excluded. Optional private narration and installation configuration are supplied locally; the silent showcase does not claim voice or audio parity.

## Capture and encoding

Use the configured test Chrome, never an automated launch of the household's everyday Chrome. Always close browsers and the isolated preview processes. Optional Playwright and ffmpeg are documentation tools, not game runtime dependencies.

The main driver is `capture-v3.mjs`; `capture-detail.mjs` selects the Letter Study and newer Balance scale gameplay. Set `CAPTURE_DIR` outside the repository, `PLAYWRIGHT_MODULE` if needed, and `CHROME` to test Chrome. `SHOWCASE_PORTS` maps game IDs to isolated loopback ports. `SHOWCASE_PRIVATE_LABELS` supplies labels to replace in text/JSON before rendering, including uppercase forms; those labels must never be committed. `SHOWCASE_NUMBER_PLAYER` selects the isolated older demo preset. Start from empty data before each full capture. Partial world/game/still recapture flags support review iterations.

`SHOWCASE_CHESS_ONLY=1` replaces only the chess clip in an existing private `clips.json`, verifies Classic's glasses and pencil artwork, and captures the same “Find the fork” position. In the reviewed live build, the picture is chosen by the deployed `chess/rook.mjs` module, not a player setting. For the isolated chess recapture, restore that module from the public source and add the preview's `rook-local` layout class so Classic uses the existing beside-board geometry. `SHOWCASE_LETTER_ONLY=1` in `capture-detail.mjs` similarly refreshes the Letter Quest clip; restore its public `rook.mjs` in the isolated preview first. Keep all preview data directories empty and separate from household saves. Rook Warm names a voice; Rook Classic and Rook Pink name pictures. Both Rook appearances in the MP4 and GIF now show Classic.

`render-v3.mjs` writes the three layouts from actual captures; `SHOWCASE_HTML_DIR` optionally preserves the layouts privately. `encode-v3.mjs` trims continuous native browser video, joins it with 0.36-second dissolves, and creates the silent **34-second**, 1280 × 720, native **25 fps** H.264 highlight. Its sequence is Castle Kingdom walk/talk/map, world treasure, Book door opening, volcano counting, then Letter Quest, Balance scale, Maze Garden, Rook Academy and Target Trail. The **640-wide, 8 fps** GIF is linked to the MP4 in the README. Limits are **10 MB** for MP4 and **8 MB** for GIF.

Every exported image and every decoded MP4/GIF frame must be visually reviewed before publication. The private contact sheet includes images, all decoded frames, cast studies and privacy results. Strip descriptive media metadata, run the relevant Book tests, and run `npm run -s check:privacy` after staging. Committing the image files does not change GitHub's separate Social preview setting or publish anything to LinkedIn.
