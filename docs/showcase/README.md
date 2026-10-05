# Gameplay showcase

The social preview is **1280 × 640**. Its main image is the current Book player: an original mapmaker in a detailed castle garden, opening doors, a painted treasure chest and the actual reading puzzle. The guide occupies about 40% of the **1280 × 720** story frame. Game tiles are native gameplay captures. Older social-layout alternatives were removed.

## Fictional art

The showcase uses an independently invented silver-haired mapmaker and an original painted fox explorer. There are no child stand-ins. The castle garden was generated from a text-only description; the other scenery is reviewed generic fantasy painting. Neither characters nor places use family photographs, likenesses, private locations or franchise references. [Provenance and exact prompts](../../hub/public/book-art/ART.md#public-visuals-refresh).

The volcano counting page has no figures: the painting and tappable stones carry the scene. The treehouse page shows the actual arithmetic choices without a small stand-in figure. No controls are painted into screenshots or hidden for capture. The static captures use the player's native reduced-motion preference.

## Castle Kingdom

`node docs/showcase/demo-server.mjs` opens a public-safe, loopback-only preview at `http://localhost:5710/`. Its Castle Kingdom uses the world client's walking, approach, friend conversation, goal ribbon, inventory, fog map, challenge rules and animated castle doors. The original fox and mapmaker form its fictional cast. State is held in memory; restarting clears it. No household configuration, save, chapter, notes, recordings or private artwork is read. The Book demo is an authored fictional chapter.

The normal world demonstrates a fictional partially restored map. A separate `reveal=1` demo state shows the working treasure door. This is synthetic demonstration progress. Four extra room backgrounds reuse generic public paintings; this preview does not distribute the household's full art collection. The world remains separate from the standard hub's home screen.

## Edition differences

The public sync includes the live calm theme, both home pages, balance and pattern activities, and the World and quest engines. The Book retains the original fictional painted cast and scenery. Runtime World demos use independently authored geometric counting scenes, while this showcase retains its standalone fictional Castle Kingdom presentation.

Scores, drawings and map progress in captures are synthetic. Household profiles, play history, daily quests, recordings and artwork are excluded. Optional private narration and installation configuration are supplied locally; the silent showcase does not claim voice or audio parity.

## Capture and encoding

Use the configured test Chrome, never the household's everyday Chrome. Always close the browser and isolated servers. Optional Playwright and ffmpeg are documentation tools, not game runtime dependencies.

`capture-visuals.mjs` captures World walk, conversation, map and treasure, the three Book pages, and the current Admin home. Start `demo-server.mjs` and an isolated hub first. Set `CAPTURE_DIR` outside the repository, `PLAYWRIGHT_MODULE` if needed, `CHROME`, `SHOWCASE_WORLD_PORT` and `SHOWCASE_HUB_PORT`. The hub must use empty isolated storage: the driver completes a fictional, photo-free setup. It never uses household data. `SHOWCASE_PRIOR_CLIPS` can name an existing private clip manifest; only game clips are retained, while every World/Book clip is replaced. The earlier capture drivers remain available for the other game activities.

`render-v3.mjs` writes the single social preview from native captures; `SHOWCASE_HTML_DIR` optionally preserves its HTML privately. `encode-v3.mjs` joins native browser recordings with gentle dissolves, holding the last native frame when a recording ends before its edit interval, to create the silent 34-second, 1280 × 720 highlight at 25 fps and a 640-wide GIF. Neither animation contains the old child stand-ins. Limits are 10 MB for MP4 and 8 MB for GIF.

Review every exported image at full size, the social card at README width, and every decoded MP4/GIF frame before publication. Run the relevant Book tests and the full `npm run -s check:privacy` gate after staging. Content-bound illustration/video reviews are recorded only in the private local policy. Committing this image does not change GitHub's separate Social preview setting or publish anything to LinkedIn.
