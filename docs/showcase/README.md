# Gameplay showcase

These images show actual gameplay from the public edition, using the isolated **Admin** test preset. No household profiles, names, drawings or logs were used. Scores are demonstration state, not children's performance or evidence of educational effectiveness.

The six original, unretouched browser captures are in `screenshots/`. The feature cards in `../media/` add HTML/CSS framing and descriptions; they do not replace gameplay with illustrated mockups. The 1280 × 640 `social-preview.png` is intended for GitHub's repository Settings → Social preview and a LinkedIn Featured link.

To re-render the layouts, install Playwright as optional documentation tooling, then run `node docs/showcase/render.mjs`. Install its Chromium browser first, or set `CHROME_PATH` to a local Chrome executable. `PLAYWRIGHT_MODULE` can point to a separately installed Playwright module. These are not game-runtime dependencies.

When recapturing, use a separate local installation and the Admin preset. Open each activity before taking the screenshot: Letter Quest's letter maze, Word Arcade's Letter Blaster, Number Park's Put together, Maze Garden's tracing board, a Three in a Row match after a move, and Target Trail's Letters & words round. Review every screenshot and its metadata before publishing. Do not use a live child's session or upload private screenshots to issues.
