# Unmodified Stockfish.js 18.0.8

This directory distributes the lite single-threaded engine from the official `stockfish@18.0.8` npm package. It runs as a separate local process over UCI; it is not bundled into the game's browser JavaScript.

- Upstream: https://github.com/nmrugg/stockfish.js
- Exact source commit: `93c994592dcf3b4b21052ab925e9b534df9c0918`
- License: GNU GPL version 3, included in `COPYING.txt`.
- Copyright: Stockfish contributors and Chess.com, LLC; see the source archive's `AUTHORS`.
- Unmodified corresponding source and build scripts: `stockfish-source-93c9945.tar.gz`, downloaded from https://codeload.github.com/nmrugg/stockfish.js/tar.gz/93c994592dcf3b4b21052ab925e9b534df9c0918
- Required lite evaluation network: `nn-9067e33176e8.nnue`, also included. SHA-256: `9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d`. Upstream download: https://tests.stockfishchess.org/api/nn/nn-9067e33176e8.nnue

To rebuild, extract the source archive, place the included network in its `src/` directory, install the Emscripten toolchain specified by upstream, and run `node build.js --lite --single-threaded`. See the archive's README and `node build.js --help` for platform prerequisites and build options. The application does not need these build tools to run the included engine.

`package.json` only tells Node to treat the unmodified upstream `.js` file as CommonJS. No upstream engine source or binary has been changed. This notice applies to the Stockfish component; it does not relicense the other games or artwork.
