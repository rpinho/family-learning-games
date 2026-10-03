# Gameplay showcase

These images show actual gameplay from the public edition, using the isolated **Admin** test preset. No household profiles, names, drawings or logs were used. Scores are demonstration state, not children's performance or evidence of educational effectiveness.

The current 1280-wide browser captures are in `screenshots/`. They cover ten games and the Book's cover, story, counting, letter kick, magic word and Pip choice. The feature cards in `../media/` add framing and descriptions; they do not replace gameplay with illustrated mockups. Book cards are 1280 × 1210; other cards retain the earlier 1440 × 1360 layout. The 1280 × 640 `social-preview.png` includes all ten games and the Book and is ready for GitHub's repository Settings → Social preview. Committing this file does not change that separate repository setting.

To re-render the layouts, install Playwright as optional documentation tooling, then run `node docs/showcase/render.mjs`. Install its Chromium browser first, or set `CHROME_PATH` to a local Chrome executable. `PLAYWRIGHT_MODULE` can point to a separately installed Playwright module. These are not game-runtime dependencies.

For rendering through a connected browser instead, run `SHOWCASE_HTML_DIR=/tmp/family-showcase-render node docs/showcase/render.mjs --html-only`, serve that directory locally, and capture each standalone page.

When recapturing, use a separate local installation and the Admin preset. Open each activity before taking the screenshot: Letter Quest's letter maze, Word Arcade's Letter Blaster, Number Park's Put together, Maze Garden's tracing board, a Three in a Row match after a move, Target Trail's Letters & words round, and Dribble Duel's live pitch. Review every screenshot and its metadata before publishing. Do not use a live child's session or upload private screenshots to issues.


The chess/reading cards and social preview can also be rebuilt without opening a browser: install the optional `@resvg/resvg-js` renderer in your documentation environment, then run `node docs/showcase/render-static.mjs`. `RESVG_MODULE` can point to that module in a separate environment. This uses the already-captured screenshots and preserves their content; it needs no browser or network access. The generated path-world illustration has separate provenance in `hub/public/chess/ART.md`.

## Silent highlight video

`capture.mjs` uses headless test Chrome through Playwright and screenshot sequences at 1280 × 720, ten unique frames per second. All gameplay writes go to a fresh isolated Admin installation. `demo-chapter.mjs` supplies an invented chapter to the read-only Admin Book preview: hero, grown-up, Bo and Pip, with only the repository's generic SVG library. It neither reads private art nor generates voices. The capture driver skips device speech waits; the resulting video has no audio. Browser zoom fits the game controls, while Book scenes use their native full-screen layout. The house doodle is freshly scripted and never loaded from a child's drawing.

With optional Playwright and ffmpeg installed separately, point these tools at your isolated demo:

```sh
DEMO_URL=http://localhost:4810 CAPTURE_DIR=/tmp/family-highlight-frames CHROME_PATH=/path/to/test-chrome node docs/showcase/capture.mjs
CHROME_PATH=/path/to/test-chrome node docs/showcase/render.mjs
CAPTURE_DIR=/tmp/family-highlight-frames node docs/showcase/encode.mjs
```

`PLAYWRIGHT_MODULE` may point to the external module's `index.mjs`; `FFMPEG` may select an existing executable. Capture starts from fresh Admin game state; subsequent runs should use another isolated installation. The 40-second `highlights.mp4` is H.264/yuv420p, 1280 × 720 at 30 fps (repeated source frames), with fast-start playback and no audio. The complete 480-wide, 6 fps `highlights.gif` provides an inline README preview linked to the MP4. Limits: MP4 ≤10 MB, GIF ≤8 MB. Review every unique frame before publishing; PNG image chunks and video metadata are stripped by `encode.mjs`.

**GitHub rendering verified:** the GitHub Markdown API removes `<video>` and renders a bare relative MP4 path as text. The README therefore uses a normal GIF image inside a relative MP4 link. Both resolve against the current repository branch; no external video host or attachment upload is needed. The MP4 is linked for viewing/downloading rather than promised as an inline README player.

**Book scope:** the public player supports ordinary object counting, letter kicks, magic words and Pip's right/wrong choice. Painted-object counting and branching endings have standalone helpers but are not connected to this player. The showcase does not claim to demonstrate those unconnected features or an automatically configured nightly generator.
