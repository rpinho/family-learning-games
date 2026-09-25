import test from "node:test";
import { execFileSync } from "node:child_process";
const spokenLines = new Set(
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        new URL("../../scripts/chess-voice-lines.mjs", import.meta.url)
          .pathname,
      ],
      { encoding: "utf8" },
    ),
  ),
);
import assert from "node:assert/strict";
import { Chess } from "../public/chess/rules.mjs";
import { LESSONS, UNITS } from "../public/chess/curriculum.mjs";
import {
  GROUPS,
  GUIDED,
  PUZZLES,
  freshChess,
  actChess,
  publicChess,
  lessonPuzzles,
  gameBoard,
} from "../chess-state.mjs";
import { LocalEngine } from "../stockfish.mjs";
import {
  CATALOG,
  FAMILIES,
  destination,
  movedRoute,
} from "../public/catalog.mjs";
let seq = 0;
const action = (p, type, extra = {}, options = {}) =>
  actChess(
    p,
    {
      type,
      ...extra,
      revision: p.revision,
      requestId: "test-request-" + ++seq,
    },
    options,
  );
const move = (p, uci, options) =>
  action(
    p,
    "move",
    { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] },
    options,
  );
test("Both difficulty bands contain legal, engine-verified short continuations, with no source user metadata", () => {
  for (const groups of [GROUPS, GUIDED])
    for (const unit of UNITS) {
      assert.equal(groups[unit.theme].length, 30);
      for (const p of groups[unit.theme]) {
        const b = new Chess(p.setupFen);
        b.move({
          from: p.setupMove.slice(0, 2),
          to: p.setupMove.slice(2, 4),
          promotion: p.setupMove[4],
        });
        assert.equal(b.fen(), p.fen);
        assert.ok(p.line.length >= 3 && p.line.length <= 7);
        assert.equal(p.checks.length, Math.ceil(p.line.length / 2));
        for (const [i, u] of p.line.entries()) {
          const m = b.move({
            from: u.slice(0, 2),
            to: u.slice(2, 4),
            promotion: u[4],
          });
          assert.equal(m.san, p.san[i]);
        }
        assert.equal(b.isCheckmate(), p.terminal);
        assert.ok(!JSON.stringify(p).includes("GameUrl"));
      }
    }
});
test("Every lesson in both bands completes; checkpoints actually interleave and solutions remain server-side", async () => {
  for (const band of ["guided", "stretch"])
    for (const l of LESSONS) {
      const p = freshChess();
      p.settings.band = band;
      await action(p, "start", { lesson: l.id });
      assert.equal(p.session.ids.length, 5);
      if (l.step === 5 && l.unit > 0)
        assert.ok(
          new Set(p.session.ids.map((id) => PUZZLES[id].theme)).size > 1,
        );
      await action(p, "begin");
      while (p.session.phase !== "summary") {
        if (p.session.phase === "puzzle") {
          const output = publicChess(p);
          assert.equal(output.session.puzzle.line, undefined);
          assert.equal(output.session.ids, undefined);
          if (p.session.ply === 0) {
            const hinted = JSON.parse(JSON.stringify(p));
            for (let step = 0; step < 3; step++) {
              await action(hinted, "hint", {}, {now: 10000 + step * 5000});
              assert.ok(
                spokenLines.has(hinted.session.feedback.voice),
                "A hint must have a Rook clip: " +
                  hinted.session.feedback.voice,
              );
            }
          }
          await move(
            p,
            PUZZLES[p.session.ids[p.session.index]].line[p.session.ply],
          );
          assert.ok(
            spokenLines.has(p.session.feedback.voice),
            "A move reaction must have a Rook clip",
          );
        } else await action(p, "next");
      }
      assert.equal(p.completed[l.id].best, 5);
      assert.equal(p.completed[l.id].bestByBand[band], 5);
      assert.equal(p.history.length, 1);
    }
});
test("Mistakes stay at the same position, hints mark assisted practice, retries are idempotent, and replay preserves best", async () => {
  const p = freshChess();
  await action(p, "start", { lesson: LESSONS[0].id });
  await action(p, "begin");
  const before = publicChess(p).session.puzzle.fen,
    b = new Chess(before),
    expected = PUZZLES[p.session.ids[0]].line[0];
  const bad = b
    .moves({ verbose: true })
    .find((m) => m.from + m.to + (m.promotion || "") !== expected);
  await move(p, bad.from + bad.to + (bad.promotion || ""));
  assert.equal(publicChess(p).session.puzzle.fen, before);
  assert.equal(p.session.errors, 1);
  assert.ok(spokenLines.has(p.session.feedback.voice));
  const id = "same-request-123",
    request = { type: "hint", revision: p.revision, requestId: id };
  await actChess(p, request);
  const revision = p.revision;
  await actChess(p, request);
  assert.equal(p.revision, revision);
  assert.equal(p.session.hints, 1);
  await assert.rejects(
    actChess(p, { type: "hint", revision: 0, requestId: "stale-request-123" }),
    /newer progress/,
  );
  while (p.session.phase === "puzzle")
    await move(p, PUZZLES[p.session.ids[0]].line[p.session.ply]);
  assert.equal(p.session.results[0].independent, false);
  assert.ok(p.review[p.session.ids[0]].needsPractice);
  const saved = JSON.parse(JSON.stringify(p));
  assert.deepEqual(publicChess(saved), publicChess(p));
  await action(p, "start", { lesson: "review" });
  assert.ok(p.session.ids.includes(saved.session.ids[0]));
});
test("Rules handle castling, en passant, underpromotion, pins, draws and alternate mating moves", async () => {
  const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.equal(castle.move("O-O").san, "O-O");
  const ep = new Chess("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  assert.ok(ep.move("exd6").isEnPassant());
  const promotion = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  assert.equal(
    promotion.move({ from: "a7", to: "a8", promotion: "n" }).promotion,
    "n",
  );
  assert.ok(promotion.isInsufficientMaterial());
  const pinned = new Chess("4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1");
  assert.throws(() => pinned.move({ from: "e2", to: "a2" }));
  const id = "test-alternate-mate";
  PUZZLES[id] = {
    id,
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    theme: "mateIn3",
    line: ["f7g7"],
    rating: 1000,
  };
  const p = freshChess();
  p.session = {
    id: "fixture",
    ids: [id],
    index: 0,
    ply: 0,
    hints: 0,
    errors: 0,
    results: [],
    phase: "puzzle",
  };
  await move(p, "f7e8");
  assert.equal(p.session.phase, "solved");
  assert.ok(new Chess(publicChess(p).session.puzzle.fen).isCheckmate());
  delete PUZZLES[id];
});
test("Local opponent handles queued searches, Black starts, saved turns, hints and takebacks", async () => {
  const engine = new LocalEngine();
  try {
    const b = new Chess();
    const results = await Promise.all([
      engine.analyze(b.fen(), { ms: 50 }),
      engine.analyze(b.fen(), { ms: 50, elo: 1320 }),
    ]);
    for (const r of results)
      assert.ok(
        b.moves({ verbose: true }).some((m) => m.from + m.to === r.best),
      );
    const p = freshChess();
    await action(p, "game-start", { side: "b" }, { engine });
    assert.equal(p.game.moves.length, 1);
    assert.equal(gameBoard(p.game).turn(), "b");
    const m = gameBoard(p.game).moves({ verbose: true })[0];
    await action(p, "game-move", { from: m.from, to: m.to }, { engine });
    assert.equal(publicChess(JSON.parse(JSON.stringify(p))).current, "game");
    assert.equal(p.game.moves.length, 3);
    assert.equal(gameBoard(p.game).fen(), p.game.fen);
    await action(p, "game-hint", {}, { engine });
    assert.ok(p.game.hint);
    await action(p, "game-undo");
    assert.equal(p.game.moves.length, 1);
    assert.equal(p.game.hint, null);
    assert.equal(gameBoard(p.game).turn(), "b");
  } finally {
    engine.close();
  }
});
test("A first-turn checkmate can be taken back without removing an opening move", async () => {
  const p = freshChess();
  const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  p.game = {
    id: "mate-fixture",
    startFen: fen,
    fen,
    side: "w",
    moves: [],
    turns: 0,
    mode: "full",
    result: null,
    help: 0,
    strength: "friendly",
  };
  const engine = {
    analyze: async () => {
      throw Error("No search after mate");
    },
  };
  await action(p, "game-move", { from: "f7", to: "e8" }, { engine });
  assert.equal(p.game.moves.length, 1);
  assert.equal(p.game.result, "Checkmate · you win");
  await action(p, "game-undo");
  assert.equal(p.game.fen, fen);
  assert.equal(p.game.result, null);
  assert.equal(p.game.turns, 0);
  assert.equal(p.game.help, 1);
  assert.equal(p.game.moves.length, 0);
});
test("Families keep all choices and legacy storage ownership; soccer stays last", () => {
  assert.equal(movedRoute("letter-quest", "soccer-menu"), "dribble-duel");
  assert.equal(movedRoute("letter-quest", "maze-menu"), "maze-garden");
  assert.equal(movedRoute("letter-quest", "letter-home"), "letter-quest");
  assert.equal(movedRoute("maze-garden", "maze-menu"), "maze-garden");
  assert.equal(FAMILIES["maze-garden"].length, 4);
  const maker = destination("maze-garden/maker");
  assert.equal(maker.type, "frame");
  assert.equal(maker.game, "maze-garden");
  assert.equal(maker.route, "maker");
  assert.equal(CATALOG.length, 9);
  assert.equal(CATALOG.at(-1).id, "dribble-duel");
  for (const [family, modes] of Object.entries(FAMILIES)) {
    assert.equal(destination(family).type, "family");
    for (const mode of modes) {
      const d = destination(family + "/" + mode.id);
      assert.equal(d.mode.id, mode.id);
      if (mode.game === "letter-quest")
        assert.equal(movedRoute(mode.game, mode.route), family + "/" + mode.id);
    }
  }
  const drawing = destination("drawing-studio");
  assert.equal(drawing.type, "frame");
  assert.equal(drawing.game, "number-park");
  assert.equal(drawing.query, "studio=1");
  assert.equal(destination("chess").type, "chess");
  assert.equal(destination("unknown").type, "home");
});
