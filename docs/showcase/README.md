# Gameplay showcase

The public showcase uses the current games, original generic pastel SVG scenes, an independently invented mapmaker and a plush fox. No household profiles, pictures, drawings, chapters, recordings or private paintings are inputs. The Book demo is an authored fictional chapter. [Illustration provenance](../../hub/public/book-art/).

## Fictional preview

Run `node docs/showcase/demo-server.mjs`, then open `http://localhost:5710/`. Castle Kingdom and Book preview state stays in memory. The World uses native walking, conversations, maps, inventory, challenges and opening doors. Walking paths stay open; real tool locks still apply. A separate `reveal=1` state demonstrates the treasure door with synthetic progress.

Landscape and portrait scenes use the public pastel library. Each room has its own fallback when a local picture is missing. The documentation cast remains the public mapmaker and fox. Household scenery, personal vocabulary, likeness art and voice recordings are supplied separately by each installation.

## Capture and encoding

Use configured Chrome for Testing, empty isolated storage and Admin practice. Start the preview and an isolated hub first. Never use household endpoints or the everyday browser. Optional Playwright and ffmpeg are documentation tools, not runtime dependencies. Close the capture browser when finished.

`capture-visuals.mjs` captures World walking, conversation, map and treasure; three Book pages; Admin home; pictured 12×12 Word Search, its finish screen and Expert view; Word Blocks; and free build. Set `CAPTURE_DIR` outside the repository, `PLAYWRIGHT_MODULE`, `CHROME`, the World and hub port overrides. The driver completes a fictional setup without photos, then uses Admin. It earns the large garden through synthetic Admin play; no child save receives test results. Static Book/World captures use native reduced motion. Video uses normal motion and native controls.

`capture-v3.mjs` with `SHOWCASE_GAMES_ONLY=1` refreshes the other games from the same isolated servers. Use separate capture directories or preserve each clip manifest before running the next driver. `SHOWCASE_PORTS` supplies the six game ports, hub and World preview ports. The new chess screenshots use the public tower companion; the other games retain the generic vector coach.

`render-v3.mjs` composes the 1280 × 640 social preview from current native screenshots. `encode-v3.mjs` reads `CAPTURE_DIR/clips.json` and joins World, Book, Word Search, Word Blocks and free build with gentle dissolves into a silent 35-second, 1280 × 720 MP4 at 25 fps and a 640-wide GIF. It holds the last native frame if a recording ends slightly early. Limits are 10 MB for MP4 and 8 MB for GIF.

Review every exported image at full size, the social card at README width and decoded video/GIF frames. Strip metadata with the publication tools, then run `npm run check:privacy`. Synthetic scores and illustrations are demonstrations, not evidence of learning outcomes. Browser narration varies by device; the silent showcase makes no offline speech promise.
