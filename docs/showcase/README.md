# Gameplay showcase

The showcase uses actual **1280 × 720**, native-scale gameplay from a freshly built public edition and an isolated **Admin** installation. Screenshots are in `screenshots/`; feature cards preserve the full screenshot in a 1280 × 860 layout. Scores and the scripted house doodle are invented demonstration state, not children's performance.

The **1280 × 640** social preview makes the painted Book the hero, with four larger game tiles: Letter Quest, Word Arcade, Number Park and Rook Academy. The four social tiles crop into the captured activity for a clearer preview; full screenshots and feature cards preserve the complete frame. The exact copy is “Family Learning Games — ten games and a story Book that plays”. This file is ready for review; committing it does not change GitHub's separate Social preview setting.

## Painted Book

`demo-chapter.mjs` supplies an authored fictional chapter to the existing read-only Admin preview. Its curious boy, older sister, guide and plush fox are newly generated fictional cutouts, each with idle and cheer poses. Seven original painted scenes have landscape and portrait variants. The demo shows three keys flying into the painted castle doors, an opening onto a generic treasure chest, counting the volcano's twelve painted stones, and helping the fox correct a sum. No household chapters, notes, profiles, photos, voices, toys or other personal objects are used. [Art provenance and generation prompts](../../hub/public/book-art/ART.md).

Painted counting and the `gate-open` effect are connected to this public player. The fox page is a right/wrong learning choice; it does not demonstrate branching endings. Nightly generation and optional narration still require separate setup. The capture driver skips device speech waits and produces silent footage; it does not synthesize or copy voices.

## Build and capture

Use a separate local installation with fresh `.data` and free ports. Build with `npm run setup`, then start it with `BASE_PORT=5611 HUB_PORT=5610 npm start`. Never use a household installation or child preset. Five embedded apps are captured through their isolated Admin proxy URL to use the entire frame at native scale. Three in a Row retains the hub frame and its compact layout; hub games and the Book keep their own UI. Target Trail is scrolled to its active range; Three in a Row and Soccer Club are scrolled to keep the board and pitch visible. No browser zoom, colour wash, gameplay replacement or private-live screenshot is used.

With optional Playwright and ffmpeg installed separately:

```sh
DEMO_URL=http://localhost:5610 CAPTURE_DIR=/path/to/private-frames CHROME_PATH=/path/to/test-chrome node docs/showcase/capture.mjs
CHROME_PATH=/path/to/test-chrome node docs/showcase/render.mjs
CAPTURE_DIR=/path/to/private-frames FFMPEG=/path/to/ffmpeg node docs/showcase/encode.mjs
```

`PLAYWRIGHT_MODULE` can select a separately installed Playwright `index.mjs`. On a machine with a configured test Chrome, use its executable; always close the browser. The renderer closes Chrome even on failure. `SHOWCASE_HTML_DIR=/path/to/render-pages node docs/showcase/render.mjs --html-only` writes standalone layouts without launching it. Optional tooling is not a game-runtime dependency.

Open activities before taking their screenshots, and wait for start overlays and entrance animations to settle. The capture driver records the Book first, then all ten games: Word transformer, Letter Blaster, Put together, a new drawing, a tracing maze, an active tic-tac-toe match, live arrow and sling ranges, a chess lesson, and live dribbling. All interaction writes belong to isolated Admin data. Book preview makes no progress writes. Supplemental painted letter-kick and magic-word stills are recaptured after the video sequence.

## Edition differences — October 3, 2026

The game source matches public main at `271282a`, which includes the current calm layouts. Both React apps were rebuilt for these captures. Public Number Park's **Balance** layout still has the earlier 660-pixel stage and emoji cards; the household release has a larger stage and later visual polish. This showcase captures public **Put together**, without substituting private Balance footage. Letter Quest's visual stylesheet matches the current release apart from a sanitized comment; Word Arcade, Maze Garden, Three in a Row and Target Trail's visual sources match the current releases. Household identity/configuration and optional prerecorded speech differ. This cache-free Letter Quest demo can display the existing “Rook’s voice is not ready” notice after a letter tap; no narration cache was fabricated or copied to hide it. This is a visual showcase, not a claim of audio equivalence or full household feature parity.

## Silent highlights and review

The **38-second** video starts with the painted Book and includes all ten games. Capture uses ten distinct JPEG frames per second. `highlights.mp4` is silent H.264/yuv420p, 1280 × 720 at 30 fps (repeated source frames), with fast-start playback and a **≤10 MB** limit. `highlights.gif` is a looping 480-wide, 6 fps preview linked to the MP4, **≤8 MB**. GitHub's Markdown renderer does not support an inline `<video>` here, so the README uses the GIF as a normal image link.

Review **every** source frame before encoding/publication, including transitions, overlay text and all characters/props. Review final cards and social preview too. The encoder strips PNG ancillary chunks and descriptive video metadata; WebP cutouts and paintings are re-encoded without EXIF/XMP. Run `npm run -s check:privacy` after staging so new assets are scanned. Keep frame manifests, diagnostic output, installation data and review contact sheets outside public history.
