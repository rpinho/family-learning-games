import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { Chess } from "../public/chess/rules.mjs";
import { freshChess, actChess, publicChess } from "../chess-state.mjs";
import { chooseCoachMove, nextRating, coachStyle, resultOf, hintIdea, matchBoard, pickMoment, RATING_MIN, RATING_MAX } from "../chess-match.mjs";
import { MATCH_VOICE, matchVoiceLines } from "../public/chess/match-voice.mjs";
import { wordBreakLines } from "../public/word-break.mjs";
import { LocalEngine } from "../stockfish.mjs";

const spoken = new Set(JSON.parse(execFileSync(process.execPath, [new URL("../../scripts/chess-voice-lines.mjs", import.meta.url).pathname], { encoding: "utf8" })));
const VALUE = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
const uci = (m) => m.from + m.to + (m.promotion || "");
// Deterministic stand-in engine: a scripted move when given, otherwise material after one ply.
function fakeEngine(script = []) {
  return {
    calls: 0,
    async analyze(fen, { multipv = 1 } = {}) {
      this.calls++;
      const b = new Chess(fen), moves = b.moves({ verbose: true });
      const next = script.shift();
      if (next) return { best: next, pvs: [{ line: [next], score: 0, mate: null }] };
      const pvs = moves.map((m) => ({ line: [uci(m)], score: m.captured ? VALUE[m.captured] : 0, mate: null }))
        .sort((a, c) => c.score - a.score).slice(0, multipv);
      return { best: pvs[0]?.line[0], pvs };
    },
  };
}
let n = 0;
async function act(p, type, extra = {}, opts = {}) {
  return actChess(p, { type, revision: p.revision, requestId: `match-test-${++n}`, ...extra }, { now: 1000 + n, rng: () => 0.99, ...opts });
}
const move = (p, u, opts) => act(p, "match-move", { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }, opts);
const strong = { matchRating: 1800 };

test("Every new spoken line has a clip in the coach voice set, including the word break", () => {
  for (const line of [...matchVoiceLines(), ...wordBreakLines()]) assert.ok(spoken.has(line), line);
  assert.ok(!matchVoiceLines().some((l) => /\bRook\b/.test(l)), "lines never say the coach's name");
});

test("Legal moves only: an illegal move is refused and changes nothing", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: strong });
  const before = JSON.stringify(p);
  await assert.rejects(move(p, "e2e5", { engine: fakeEngine(), settings: strong }), /not legal/);
  assert.equal(JSON.stringify(p), before);
  await move(p, "e2e4", { engine: fakeEngine(["e7e5"]), settings: strong });
  assert.deepEqual(p.match.game.moves, ["e2e4", "e7e5"]);
  assert.equal(p.current, "match");
});

test("Checkmate wins and losses finish the game, move the rating and alternate colours", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: { matchRating: 700 } });
  assert.equal(p.match.game.side, "w");
  await move(p, "e2e4", { engine: fakeEngine(["f7f6"]), settings: strong });
  await move(p, "d2d4", { engine: fakeEngine(["g7g5"]), settings: strong });
  const r = await move(p, "d1h5", { engine: fakeEngine(), settings: strong });
  assert.equal(r.result, "win");
  const g = p.match.game;
  assert.deepEqual([g.result.kind, g.result.reason, g.result.ratingBefore, g.result.ratingAfter], ["win", "checkmate", 700, 740]);
  assert.equal(g.react.kind, "youWin");
  assert.ok(g.recap?.moment, "a moment to replay");
  await assert.rejects(move(p, "a2a3", { engine: fakeEngine(), settings: strong }), /Start a game/);
  await act(p, "match-ack", { wordBreak: { kind: "sentence", misses: 1 } });
  assert.equal(p.match.history.at(-1).wordBreak.misses, 1);
  // Second game: the child has Black; the coach opens and mates.
  await act(p, "match-start", {}, { engine: fakeEngine(["e2e4"]), settings: strong });
  assert.equal(p.match.game.side, "b");
  assert.deepEqual(p.match.game.moves, ["e2e4"]);
  await move(p, "f7f6", { engine: fakeEngine(["d2d4"]), settings: strong });
  const lost = await move(p, "g7g5", { engine: fakeEngine(["d1h5"]), settings: strong });
  assert.equal(lost.result, "loss");
  assert.equal(p.match.game.react.kind, "meWin");
  assert.equal(p.match.rating, 700);
  await act(p, "match-ack");
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: strong });
  assert.equal(p.match.game.side, "w", "colours alternate every game");
  assert.deepEqual(p.match.record, { win: 1, loss: 1, draw: 0 });
});

test("Draws are detected: repetition in play, stalemate and bare kings", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: strong });
  const script = ["g8f6", "f6g8", "g8f6", "f6g8"];
  for (const u of ["g1f3", "f3g1", "g1f3", "f3g1"]) await move(p, u, { engine: fakeEngine([script.shift()]), settings: strong });
  assert.deepEqual([p.match.game.result.kind, p.match.game.result.reason], ["draw", "repetition"]);
  assert.equal(p.match.rating, 1800, "a draw leaves the rating alone");
  assert.deepEqual(resultOf(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), "w", 10), { kind: "draw", reason: "stalemate" });
  assert.deepEqual(resultOf(new Chess("8/8/4k3/8/8/3K4/8/8 w - - 0 1"), "w", 10), { kind: "draw", reason: "insufficient" });
  assert.equal(resultOf(new Chess(), "w", 300).reason, "limit");
});

test("One take-back per game; a new game gets a fresh one", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: strong });
  await assert.rejects(act(p, "match-undo"), /Make a move first/);
  await move(p, "e2e4", { engine: fakeEngine(["e7e5"]), settings: strong });
  await move(p, "g1f3", { engine: fakeEngine(["b8c6"]), settings: strong });
  await act(p, "match-undo");
  assert.deepEqual(p.match.game.moves, ["e2e4", "e7e5"]);
  assert.equal(p.match.game.fen, matchBoard(p.match.game).fen());
  assert.equal(p.match.game.react.line, MATCH_VOICE.takeback[0]);
  await move(p, "d2d4", { engine: fakeEngine(["e5d4"]), settings: strong });
  await assert.rejects(act(p, "match-undo"), /already used/);
  await act(p, "match-resign");
  assert.deepEqual([p.match.game.result.kind, p.match.game.result.reason], ["loss", "resign"]);
  await act(p, "match-ack");
  await act(p, "match-start", {}, { engine: fakeEngine(["e2e4"]), settings: strong });
  assert.equal(p.match.game.undoLeft, 1);
});

test("Every move autosaves: a reloaded save resumes the same unfinished game", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: strong });
  await move(p, "e2e4", { engine: fakeEngine(["e7e5"]), settings: strong });
  const saved = JSON.parse(JSON.stringify(p));
  const view = publicChess(saved, Date.now(), { opponent: "Buddy" });
  assert.equal(saved.current, "match");
  assert.equal(view.match.opponent, "Buddy");
  assert.equal(view.match.game.fen, p.match.game.fen);
  assert.equal(view.match.game.result, null);
  await move(saved, "g1f3", { engine: fakeEngine(["b8c6"]), settings: strong });
  assert.deepEqual(saved.match.game.moves, ["e2e4", "e7e5", "g1f3", "b8c6"]);
  assert.equal(publicChess(freshChess()).match.opponent, "Rook", "the public default name");
  assert.equal(publicChess(freshChess(), 0, { opponent: "<b>x</b>" }).match.opponent, "Rook");
});

test("Hints suggest an idea, then the piece; gentle profiles get the piece, then an arrow; never a move", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: strong });
  await act(p, "match-hint", {}, { engine: fakeEngine(["e2e4"]), settings: strong });
  let h = publicChess(p).match.game.hint;
  assert.equal(h.stage, 1);
  assert.equal(h.from, undefined);
  assert.ok(Object.values(MATCH_VOICE.idea).includes(h.voice));
  await act(p, "match-hint", {}, { engine: fakeEngine(), settings: strong });
  h = publicChess(p).match.game.hint;
  assert.deepEqual([h.stage, h.from, h.to], [2, "e2", undefined]);
  assert.ok(spoken.has(h.voice), h.voice);
  const r = await act(p, "match-hint", {}, { engine: fakeEngine(), settings: strong });
  assert.equal(r.advanced, false);
  assert.deepEqual(p.match.game.moves, [], "a hint never plays a move");
  const q = freshChess(), gentle = { matchRating: 100, bigHints: true };
  await act(q, "match-start", {}, { engine: fakeEngine(), settings: gentle });
  await act(q, "match-hint", {}, { engine: fakeEngine(["g1f3"]), settings: gentle });
  assert.equal(q.match.game.hint.from, "g1");
  await act(q, "match-hint", {}, { engine: fakeEngine(), settings: gentle });
  assert.deepEqual([q.match.game.hint.to, q.match.game.hint.voice], ["f3", MATCH_VOICE.arrow]);
  assert.equal(q.match.game.hintedTurns, 1);
});

test("Hint ideas name the right idea", () => {
  const idea = (fen, u) => hintIdea(new Chess(fen), new Chess(fen).moves({ verbose: true }).find((m) => uci(m) === u));
  assert.equal(idea("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a8"), "mate");
  assert.equal(idea("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", "d1d5"), "free");
  assert.equal(idea("r3k3/8/8/8/8/8/8/4K1N1 w - - 0 1", "g1f3"), "develop");
  assert.equal(idea("4k3/8/8/8/8/8/4q3/4K3 w - - 0 1", "e1e2"), "inCheck");
  assert.equal(idea("r3k3/8/8/8/8/8/5N2/4K3 w - - 0 1", "f2d3"), "threat");
  assert.equal(idea("4k3/8/2q1r3/8/3N4/8/8/K7 w - - 0 1", "d4e6"), "free");
  assert.equal(idea("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "b5c7"), "fork");
});

test("Reactions stay rare and every spoken reaction is a real clip", async () => {
  const p = freshChess();
  await act(p, "match-start", {}, { engine: fakeEngine(), settings: { matchRating: 300 } });
  let rng = 1, reactions = 0, learnerMoves = 0;
  const random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
  while (!p.match.game.result && learnerMoves < 120) {
    const b = matchBoard(p.match.game), moves = b.moves({ verbose: true });
    const m = moves[Math.floor(random() * moves.length)];
    await move(p, uci(m), { engine: fakeEngine(), settings: { matchRating: 300 }, rng: random });
    learnerMoves++;
    const r = p.match.game.react;
    if (r && !p.match.game.result) {
      reactions++;
      assert.ok(spoken.has(r.line), r.line);
    }
  }
  assert.ok(reactions <= Math.ceil(learnerMoves / 2), `${reactions} reactions in ${learnerMoves} moves`);
  for (const rec of p.match.game.records) assert.ok(new Chess(rec.fen).move(rec.uci.length > 4 ? { from: rec.uci.slice(0, 2), to: rec.uci.slice(2, 4), promotion: rec.uci[4] } : { from: rec.uci.slice(0, 2), to: rec.uci.slice(2, 4) }));
});

test("The coach's move choice: gentle ratings slip more, strong ratings play the best move", () => {
  const legal = ["a2a3", "b2b3", "c2c3", "d2d4", "e2e4", "f2f3", "g1f3"];
  const pvs = [["e2e4", 40], ["d2d4", 35], ["g1f3", 20], ["c2c3", -60], ["b2b3", -250], ["a2a3", -500], ["f2f3", -900]]
    .map(([u, s]) => ({ line: [u, "e7e5"], score: s, mate: null }));
  let seed = 7;
  const rng = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const avgLoss = (rating) => {
    let loss = 0;
    for (let i = 0; i < 3000; i++) {
      const c = chooseCoachMove(pvs, rating, legal, rng);
      assert.ok(legal.includes(c.uci));
      loss += 40 - (pvs.find((p) => p.line[0] === c.uci)?.score ?? -300);
    }
    return loss / 3000;
  };
  const [gentle, middle, strongLoss] = [avgLoss(100), avgLoss(600), avgLoss(1800)];
  assert.ok(gentle > middle && middle > strongLoss, `${gentle} > ${middle} > ${strongLoss}`);
  assert.ok(strongLoss < 30);
  // A mate in one is usually taken, more reliably at higher ratings.
  const mate = [{ line: ["d1h5"], score: 99999, mate: 1 }, { line: ["e2e4"], score: 20, mate: null }];
  const taken = (r) => Array.from({ length: 1000 }, () => chooseCoachMove(mate, r, ["d1h5", "e2e4"], rng).uci === "d1h5").filter(Boolean).length;
  assert.ok(taken(1800) === 1000 && taken(100) < taken(1000));
  assert.ok(coachStyle(100).slip > coachStyle(600).slip && coachStyle(600).slip > coachStyle(1500).slip);
});

test("Rating goes up after a win and down after a loss, so wins settle near half", () => {
  assert.equal(nextRating(600, 1, [], 0), 640);
  assert.equal(nextRating(600, 0, [], 0), 560);
  assert.equal(nextRating(600, 0.5, [], 9), 600);
  assert.equal(nextRating(600, 1, [1, 1], 9), 638, "streaks move faster");
  assert.equal(nextRating(RATING_MIN, 0, [], 9), RATING_MIN);
  assert.equal(nextRating(RATING_MAX, 1, [], 9), RATING_MAX);
  // A child of fixed strength against the staircase: the rating finds him and he wins about half.
  let seed = 11;
  const rng = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (const skill of [300, 700]) {
    let rating = 600, history = [], wins = 0;
    for (let gno = 0; gno < 400; gno++) {
      const win = rng() < 1 / (1 + 10 ** ((rating - skill) / 400)) ? 1 : 0;
      if (gno >= 100) wins += win;
      rating = nextRating(rating, win, history, gno);
      history.push(win);
    }
    assert.ok(Math.abs(wins / 300 - 0.5) < 0.1, `skill ${skill}: won ${wins}/300`);
  }
});

test("The replayed moment is the child's best move after a win, the turning point after a loss", () => {
  const g = { records: [
    { fen: "a", uci: "e2e4", san: "e4", loss: 0, expect: "d2d4" },
    { fen: "b", uci: "d1d8", san: "Qxd8", captured: "q", loss: 10, expect: "d1d8" },
    { fen: "c", uci: "a2a3", san: "a3", loss: 600, expect: "c1g5" },
  ] };
  assert.equal(pickMoment(g, { kind: "win", reason: "resign" }).played, "d1d8");
  assert.deepEqual(pickMoment(g, { kind: "loss", reason: "checkmate" }), { kind: "turn", fen: "c", played: "a2a3", san: "a3", better: "c1g5" });
  assert.equal(pickMoment({ records: [] }, { kind: "draw" }), null);
});

test("A full game against the real local engine ends properly", { timeout: 120000 }, async () => {
  const engine = new LocalEngine(), p = freshChess();
  let seed = 5;
  const rng = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  try {
    await act(p, "match-start", {}, { engine, settings: strong, rng });
    while (!p.match.game.result) {
      const b = matchBoard(p.match.game), moves = b.moves({ verbose: true });
      await move(p, uci(moves[Math.floor(rng() * moves.length)]), { engine, settings: strong, rng });
    }
  } finally { engine.close(); }
  const g = p.match.game;
  assert.equal(g.result.kind, "loss", "a strong coach beats random moves");
  assert.equal(g.result.reason, "checkmate");
  assert.ok(matchBoard(g).isCheckmate());
  assert.ok(g.recap?.moment?.fen);
  assert.ok(p.match.rating < 1800);
});
