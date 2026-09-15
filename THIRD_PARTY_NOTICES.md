# Third-party notices and asset provenance

## Rook Academy chess components

- **chess.js 1.4.0:** unmodified rules module, BSD-2-Clause; [included license](hub/public/chess/CHESS-JS-LICENSE.txt).
- **Stockfish.js 18.0.8:** unmodified local UCI engine, GPL-3.0; [license, corresponding source, network and build instructions](hub/vendor/stockfish/README.md).
- **Lichess puzzle database:** CC0 positions, with source puzzle identifiers and validation documented in [the chess guide](hub/CHESS.md). Player names and game URLs are not included.
- **Original character and scene artwork:** [provenance](hub/public/chess/ART.md). Optional stock voice generation is documented in the chess guide; no Duolingo character art or recordings are distributed.


## Quick, Draw! derived model

`games/number-park/data/doodle-model.json` contains reduced numeric feature vectors derived from eight categories of **The Quick, Draw! Dataset**, made available by **Google, Inc.** under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

- Source and licensing: https://github.com/googlecreativelab/quickdraw-dataset#license
- License: https://creativecommons.org/licenses/by/4.0/
- Changes: bounded samples of simplified drawings were normalized into feature vectors and norms by `games/number-park/scripts/build-doodle-model.mjs`; original timestamps, country codes and contributor identifiers are not retained. This is not an endorsed Google product.

The separate `symbol-model.json` uses authored manuscript centerlines and geometric variants, not household handwriting examples. Recognition is fallible and not an assessment.

## Laser effects

`games/word-arcade/public/audio/laser-{pulse,retro,plasma}-v2.wav` are adapted from **Kenney's Sci-fi Sounds**, released under **CC0 1.0**.

- Source: https://kenney.nl/assets/sci-fi-sounds
- License: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: converted to mono, shortened and faded.

Other supplied music loops are original synthesized compositions; their generator is included. No third-party songs or extracted pronunciation demonstrations are distributed.

## Artwork and software

The game logos, coach artwork and spaceship artwork were created for these games (including AI-generated artwork), not copied third-party character art or family photographs. Emoji appearance is supplied by the viewer's platform. This project is not affiliated with or endorsed by other learning-game brands.

npm dependencies retain their respective licenses in the installed packages. Vendored UI primitives follow the shadcn component system; see https://github.com/shadcn-ui/ui/blob/main/LICENSE.md (MIT). There is no blanket claim of ownership over those components or third-party assets.

### shadcn UI license (vendored components)

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
