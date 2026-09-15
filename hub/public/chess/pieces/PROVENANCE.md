# Chess pieces

RhosGFX, sourced from [Lichess at d9f9744af7667f93d2640484f43f2ec163364c66](https://github.com/lichess-org/lila/tree/d9f9744af7667f93d2640484f43f2ec163364c66/public/piece/rhosgfx). [Upstream license inventory](https://github.com/lichess-org/lila/blob/d9f9744af7667f93d2640484f43f2ec163364c66/COPYING.md#L43): CC0 1.0. [Legal text](https://creativecommons.org/publicdomain/zero/1.0/legalcode).

The twelve SVG files here retain their unchanged source bytes. `../pieces.mjs` embeds a derived version: self-contained fills (no shared CSS classes or IDs), ivory/slate palette, and a diagonal mitre split on each bishop to distinguish it from the round-headed pawn. The bishop’s chevron surface shadow is removed to keep the split unambiguous. Other silhouettes and shading remain. Rebuild the module with `python3 scripts/build-chess-pieces.py`. No Duolingo artwork is included.
