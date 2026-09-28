// Full games against the coach ("Play Rook"; a private install may show another name).
// Strength adapts per player: the coach plays a limited local Stockfish (few candidate moves,
// short search, occasional deliberate slips) set by the child's rating, which goes up after a
// win and down after a loss, so the child wins about half the time.
import { randomUUID } from "node:crypto";
import { Chess } from "./public/chess/rules.mjs";
import { pieceHint } from "./public/chess/curriculum.mjs";
import { MATCH_VOICE as V } from "./public/chess/match-voice.mjs";

export const RATING_MIN = 50, RATING_MAX = 1800, DEFAULT_RATING = 400, MOVE_LIMIT = 300;
export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const fail = (text, status = 400) => { throw Object.assign(Error(text), { status }); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uciOf = (m) => m.from + m.to + (m.promotion || "");
const play = (b, u) => b.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

// Install settings (private config) for this player: display name, starting rating, hint size.
export function matchSettings(s = {}) {
  const name = typeof s.opponent === "string" && /^[\p{L}][\p{L} '-]{0,19}$/u.test(s.opponent) ? s.opponent : "Rook";
  const start = Number.isFinite(s.matchRating) ? clamp(Math.round(s.matchRating), RATING_MIN, RATING_MAX) : DEFAULT_RATING;
  return { opponent: name, startRating: start, bigHints: s.bigHints === true, coachChatter: s.coachChatter === 'lively' ? 'lively' : 'quiet' };
}
export function freshMatch(settings = {}) {
  const { startRating } = matchSettings(settings);
  return { rating: startRating, startRating, games: 0, record: { win: 0, loss: 0, draw: 0 }, nextSide: "w", history: [], game: null };
}

// Piecewise-linear over rating anchors.
function curve(points, r) {
  if (r <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i], [x0, y0] = points[i - 1];
    if (r <= x1) return y0 + ((y1 - y0) * (r - x0)) / (x1 - x0);
  }
  return points.at(-1)[1];
}
// How the coach plays at a rating. slip = chance of a deliberate weaker move; window = centipawns
// within the best move that count as a normal choice; slipMax = the largest mistake a slip may be;
// random = chance of any legal move (only for the very gentlest levels).
export function coachStyle(rating) {
  const r = clamp(rating, RATING_MIN, RATING_MAX);
  return {
    slip: curve([[50, 0.6], [300, 0.45], [600, 0.28], [900, 0.16], [1200, 0.08], [1600, 0.03], [1800, 0.02]], r),
    window: curve([[50, 300], [300, 180], [600, 110], [900, 70], [1200, 40], [1600, 20], [1800, 12]], r),
    slipMax: curve([[50, 2500], [300, 900], [600, 500], [900, 350], [1200, 250], [1600, 150], [1800, 100]], r),
    random: curve([[50, 0.3], [300, 0.12], [500, 0.03], [700, 0]], r),
    takeMate: curve([[50, 0.45], [600, 0.8], [1200, 0.97], [1800, 1]], r),
    // Chance of not noticing a mate-in-one threat (the Scholar's Mate and other rookie traps).
    // (the gentlest levels only: from about 800 the coach no longer falls for the Scholar's Mate)
    trapFall: curve([[50, 0.9], [300, 0.7], [600, 0.3], [800, 0]], r),
    multipv: r < 1000 ? 20 : 10,
    ms: r < 600 ? 200 : r < 1200 ? 280 : 350,
  };
}
// Engine score (side to move) as bounded centipawns; mates are large but finite.
export const norm = (pv) => pv.mate != null && pv.mate !== 0
  ? Math.sign(pv.mate) * (3000 - Math.abs(pv.mate) * 10)
  : clamp(pv.score ?? 0, -2500, 2500);
export function candidates(pvs) {
  const seen = new Set(), out = [];
  for (const pv of pvs || []) {
    const uci = pv.line?.[0];
    if (!uci || seen.has(uci)) continue;
    seen.add(uci);
    out.push({ uci, score: norm(pv), mate: pv.mate ?? null, line: pv.line });
  }
  return out.sort((a, b) => b.score - a.score);
}
const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];
// Choose the coach's move from engine candidates (best first) for a rating.
export function chooseCoachMove(pvs, rating, legal, rng = Math.random) {
  const cands = candidates(pvs).filter((c) => legal.includes(c.uci));
  if (!cands.length) return { uci: pick(legal, rng), score: null, line: null, kind: "random" };
  const st = coachStyle(rating), best = cands[0];
  const mateIn1 = cands.find((c) => c.mate === 1);
  if (mateIn1 && rng() < st.takeMate) return { ...mateIn1, kind: "best" };
  const pool = mateIn1 ? cands.filter((c) => c !== mateIn1) : cands;
  if (!pool.length) return { ...mateIn1, kind: "best" };
  const top = pool[0];
  if (rng() < st.random) {
    const uci = pick(legal, rng), c = cands.find((x) => x.uci === uci);
    return { uci, score: c ? c.score : null, line: c?.line || null, kind: "random" };
  }
  if (rng() < st.slip) {
    const slips = pool.filter((c) => c.score < top.score - st.window && c.score >= top.score - st.slipMax);
    if (slips.length) return { ...pick(slips, rng), kind: "slip" };
  }
  const ok = pool.filter((c) => c.score >= top.score - st.window);
  // Nearer the best is a little more likely, but any sensible move can appear.
  const weights = ok.map((c) => 0.5 + (c.score - (top.score - st.window)) / st.window);
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ok.length; i++) if ((roll -= weights[i]) <= 0) return { ...ok[i], kind: ok[i] === best ? "best" : "good" };
  return { ...ok[0], kind: "best" };
}
// Up after a win, down faster after a loss (faster still at first and on streaks), so the child
// wins a little more than half: 60% while calibrating, about 58% after.
// Wins climb faster than losses fall back (2026-09-28: six wins in a row felt "too easy, lemon squeezy"):
// +60 a win (+40 after six games), x1.5 after two wins in a row, x2 after three or more, x1.25 for a quick mate.
export function nextRating(rating, outcome, previous = [], games = 0, plies = null) {
  if (outcome === 0.5) return rating;
  let delta = outcome === 1 ? (games < 6 ? 60 : 40) : -(games < 6 ? 60 : 35);
  let run = 0; for (let i = previous.length - 1; i >= 0 && previous[i] === outcome; i--) run++;
  if (run >= 3 && outcome === 1) delta *= 2; else if (run >= 2) delta *= 1.5;
  if (outcome === 1 && plies != null && plies <= 30) delta *= 1.25;
  return clamp(Math.round(rating + delta), RATING_MIN, RATING_MAX);
}
export function matchBoard(g) {
  const b = new Chess(g.startFen);
  for (const u of g.moves) play(b, u);
  return b;
}
export function resultOf(b, side, plies) {
  if (b.isCheckmate()) return b.turn() === side ? { kind: "loss", reason: "checkmate" } : { kind: "win", reason: "checkmate" };
  if (b.isStalemate()) return { kind: "draw", reason: "stalemate" };
  if (b.isThreefoldRepetition()) return { kind: "draw", reason: "repetition" };
  if (b.isInsufficientMaterial()) return { kind: "draw", reason: "insufficient" };
  if (b.isDraw()) return { kind: "draw", reason: "fifty" };
  if (plies >= MOVE_LIMIT) return { kind: "draw", reason: "limit" };
  return null;
}
// Pieces of the other side (worth 3+, or the king) that the piece now on `square` attacks.
function targets(b, square) {
  const p = b.get(square);
  if (!p) return [];
  return b.board().flat().filter((q) => q && q.color !== p.color && (VALUE[q.type] >= 3 || q.type === "k") &&
    b.attackers(q.square, p.color).includes(square));
}
const attacked = (b, square, by) => b.attackers(square, by).length > 0;
// The idea behind the engine's suggestion, as one of a few spoken sentences.
export function hintIdea(board, move) {
  if (board.isCheck()) return "inCheck";
  const after = new Chess(board.fen());
  const m = play(after, uciOf(move));
  const them = m.color === "w" ? "b" : "w";
  if (after.isCheckmate()) return "mate";
  if (m.promotion) return "promote";
  if (m.captured && (VALUE[m.captured] >= VALUE[m.piece] || !attacked(after, m.to, them))) return "free";
  if (m.flags.includes("k") || m.flags.includes("q")) return "castle";
  if (!attacked(after, m.to, them) && targets(after, m.to).length >= 2) return "fork";
  if (after.isCheck()) return "check";
  if (m.piece !== "p" && m.piece !== "k" && attacked(board, m.from, them)) return "danger";
  if (["n", "b"].includes(m.piece) && m.from[1] === (m.color === "w" ? "1" : "8")) return "develop";
  return "threat";
}
function line(g, kind) {
  const list = Array.isArray(V[kind]) ? V[kind] : [V[kind]];
  g.voiceTurn ??= {};
  const seed = [...(g.id || '')].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const i = g.voiceTurn[kind] ?? seed % list.length;
  g.voiceTurn[kind] = (i + 1) % list.length;
  return list[i % list.length];
}
// Lively installs react to more board events. The client supplies breathing room
// in seconds as well, so quick consecutive moves never become a speech backlog.
export function reactionFor(g, rec, reply, result, settings = {}) {
  const n = g.records.length, since = n - (g.spokeAt ?? -10);
  const lively = settings.coachChatter === 'lively';
  let kind = null;
  const scholar = result?.kind === "win" && result.reason === "checkmate" && rec.piece === "q" && rec.captured === "p" &&
    rec.uci.slice(2, 4) === (g.side === "w" ? "f7" : "f2") && g.moves.length <= 24;
  if (scholar) kind = "scholar";
  else if (result) kind = result.kind === "win" ? "youWin" : result.kind === "loss" ? "meWin" : result.reason === "stalemate" ? "stalemate" : "draw";
  else if (rec.captured === 'q') kind = 'youQueen';
  else if (lively && reply?.captured === 'q') kind = 'meQueen';
  else if (reply?.captured && VALUE[reply.captured] >= 3 && rec.loss >= 250) kind = "pounce";
  else if (rec.promotion) kind = "youPromote";
  else if (reply?.promotion) kind = "mePromote";
  else if (since >= (lively ? 1 : 2)) {
    if (rec.captured && reply?.captured) kind = 'trade';
    else if (reply?.captured && (lively || VALUE[reply.captured] >= 3 || since >= 4)) kind = 'meCapture';
    else if (rec.captured && (lively || VALUE[rec.captured] >= 3 || since >= 4)) kind = 'youCapture';
    else if (rec.uci === rec.expect && rec.loss < 40 && rec.fork) kind = "good";
    else if (rec.check && (lively || since >= 4)) kind = "youCheck";
    else if (reply?.check && (lively || since >= 4)) kind = "meCheck";
    else if (lively && rec.castle) kind = 'castle';
    else if (lively && since >= 4) kind = 'thinking';
  }
  if (!kind) {
    // A capture still gets a visible reaction when the speech cooldown is on.
    const motion = reply?.captured ? 'meCapture' : rec.captured ? 'youCapture' : null;
    return motion ? {kind:motion,line:null,ply:g.moves.length} : null;
  }
  g.spokeAt = n;
  return { kind, line: line(g, kind), ply: g.moves.length };
}
// One instructive moment: the child's best move, or the turning point with a better move.
export function pickMoment(g, result) {
  const recs = g.records || [];
  const finalMate = result?.kind === "win" && result.reason === "checkmate" ? recs.at(-1) : null;
  const score = (r) => (r.captured ? VALUE[r.captured] * 100 : 0) + (r.fork ? 250 : 0) + (r.check ? 60 : 0) + (r.uci === r.expect ? 120 : 0);
  const best = recs.filter((r) => r !== finalMate && r.loss <= 60 && score(r) >= 300).sort((a, b) => score(b) - score(a))[0];
  const turn = recs.filter((r) => r.loss >= 200).sort((a, b) => b.loss - a.loss)[0];
  const asBest = (r) => r && { kind: "best", fen: r.fen, played: r.uci, san: r.san };
  const asTurn = (r) => r && { kind: "turn", fen: r.fen, played: r.uci, san: r.san, better: r.expect && r.expect !== r.uci ? r.expect : null };
  if (result?.kind === "win") return asBest(best) || asBest(finalMate) || null;
  return asTurn(turn) || asBest(best) || null;
}
function sanOf(fen, uci) {
  try { return play(new Chess(fen), uci).san; } catch { return null; }
}
export function mateInOne(b) {
  return b.moves({ verbose: true }).filter((m) => { const t = new Chess(b.fen()); play(t, uciOf(m)); return t.isCheckmate(); });
}
// Would the other side mate in one if the side to move did nothing?
export function mateThreat(b) {
  if (b.isCheck()) return false;
  const f = b.fen().split(" ");
  f[1] = f[1] === "w" ? "b" : "w";
  f[3] = "-";
  try { return mateInOne(new Chess(f.join(" "))).length > 0; } catch { return false; }
}
// Natural-looking moves that miss the threat: developing pieces and pawn moves first.
export function trapMoves(b) {
  return b.moves({ verbose: true }).filter((m) => { const t = new Chess(b.fen()); play(t, uciOf(m)); return mateInOne(t).length > 0; })
    .map((m) => ({ m, w: ["n", "b"].includes(m.piece) ? 3 : m.piece === "p" ? 2 : m.piece === "q" || m.piece === "k" ? 0.3 : 1 }));
}
// The coach's move at a rating, without changing any game state.
export async function coachChoice(b, rating, engine, rng = Math.random) {
  const st = coachStyle(rating);
  if (mateThreat(b) && rng() < st.trapFall) {
    const traps = trapMoves(b);
    if (traps.length) {
      let roll = rng() * traps.reduce((a, t) => a + t.w, 0);
      const t = traps.find((x) => (roll -= x.w) <= 0) || traps[0];
      return { choice: { uci: uciOf(t.m), score: -2990, line: null, kind: "trap" }, best: null };
    }
  }
  const a = await engine.analyze(b.fen(), { ms: st.ms, multipv: st.multipv });
  const legal = b.moves({ verbose: true }).map(uciOf);
  return { choice: chooseCoachMove(a.pvs, rating, legal, rng), best: candidates(a.pvs)[0] || null };
}
async function coachMove(g, b, rating, engine, rng) {
  const { choice, best } = await coachChoice(b, rating, engine, rng);
  const m = play(b, choice.uci);
  g.moves.push(uciOf(m));
  g.evalLearner = choice.score == null ? null : -choice.score;
  g.expect = choice.line?.[1] || null;
  g.slips = (g.slips || 0) + (["slip", "random", "trap"].includes(choice.kind) ? 1 : 0);
  return { move: m, bestScore: best ? best.score : null, kind: choice.kind };
}
function finish(m, g, result, now) {
  const outcome = result.kind === "win" ? 1 : result.kind === "loss" ? 0 : 0.5;
  const before = m.rating;
  const previous = m.history.map((h) => (h.kind === "win" ? 1 : h.kind === "loss" ? 0 : 0.5));
  m.rating = nextRating(before, outcome, previous, m.games, (g.moves || []).length);
  m.games++;
  m.record[result.kind]++;
  g.result = { ...result, ratingBefore: before, ratingAfter: m.rating };
  g.finishedAt = now;
  g.hint = null;
  g.coach = null;
  const moment = pickMoment(g, result);
  g.recap = moment ? { line: moment.kind === "best" ? V.recapBest : V.recapTurn, moment } : null;
  m.history.push({ id: g.id, at: now, side: g.side, kind: result.kind, reason: result.reason, plies: g.moves.length,
    ratingBefore: before, ratingAfter: m.rating, hintedTurns: g.hintedTurns || 0, takeback: g.undoLeft < 1, slips: g.slips || 0 });
  m.history = m.history.slice(-60);
}
// A full game against the coach left unfinished counts as a loss for the rating (only the rating).
export function recordAbandoned(p, settings = {}, { id, side, plies }, now = Date.now()) {
  p.match ??= freshMatch(settings);
  const m = p.match, before = m.rating;
  m.rating = nextRating(before, 0, m.history.map((h) => (h.kind === "win" ? 1 : h.kind === "loss" ? 0 : 0.5)), m.games);
  m.games++;
  m.record.loss++;
  m.history.push({ id, at: now, side, kind: "loss", reason: "abandoned", plies, ratingBefore: before, ratingAfter: m.rating });
  m.history = m.history.slice(-60);
}
// The coach's strength: the child's rating, plus a step for a current winning streak (+100 per win beyond two in a
// row), so a run of easy wins is answered at once without rewriting the child's saved rating.
export function coachRating(p, settings = {}) {
  const r = p.match?.rating ?? matchSettings(settings).startRating, h = p.match?.history || [];
  let run = 0; for (let i = h.length - 1; i >= 0 && h[i].kind === "win"; i--) run++;
  return clamp(r + Math.max(0, run - 2) * 100, RATING_MIN, RATING_MAX);
}
// Friendly practice plays a step above the full-game coach (practice is where he stretches).
export const practiceRating = (p, settings = {}) => clamp(coachRating(p, settings) + 150, RATING_MIN, RATING_MAX);
const publicHint = (h) => h && { stage: h.stage, idea: h.idea, text: h.voice, voice: h.voice, from: h.from, to: h.to };
export function publicMatch(p, settings = {}) {
  const s = matchSettings(settings), m = p.match || freshMatch(settings), g = m.game;
  return {
    opponent: s.opponent, bigHints: s.bigHints, rating: m.rating, games: m.games, record: m.record, nextSide: m.nextSide,
    history: m.history.slice(-5),
    game: g && {
      id: g.id, side: g.side, startFen: g.startFen, fen: g.fen, moves: g.moves, lastMoves: g.lastMoves || [],
      turns: g.records.length, undoLeft: g.undoLeft, result: g.result, hint: publicHint(g.hint), react: g.react,
      recap: g.recap, acknowledged: !!g.acknowledged, maxHint: 2,
    },
  };
}
export async function actMatch(p, input, { engine, settings = {}, now = Date.now(), rng = Math.random } = {}) {
  const s = matchSettings(settings);
  p.match ??= freshMatch(settings);
  const m = p.match;
  let g = m.game;
  if (input.type === "match-start") {
    if (g && !g.result) fail("Finish or resign the current game first.");
    if (!engine) fail("Chess opponent is unavailable.", 503);
    const side = m.nextSide === "b" ? "b" : "w";
    m.nextSide = side === "w" ? "b" : "w";
    g = m.game = { id: randomUUID(), side, startFen: START, fen: START, moves: [], records: [], undoLeft: 1,
      hint: null, coach: null, evalLearner: side === "w" ? 30 : null, expect: null, spokeAt: -10, voiceTurn: {},
      hintedTurns: 0, slips: 0, startedAt: now, result: null, react: null, lastMoves: [] };
    const b = new Chess(START);
    if (side === "b") {
      const r = await coachMove(g, b, coachRating({ match: m }), engine, rng);
      g.lastMoves = [uciOf(r.move)];
    }
    g.fen = b.fen();
    g.react = { kind: side === "w" ? "startWhite" : "startBlack", line: side === "w" ? V.startWhite : V.startBlack, ply: g.moves.length };
    return { started: g.id, side, moves: g.lastMoves };
  }
  if (input.type === "match-ack") {
    if (!g || !g.result) fail("Finish the game first.");
    g.acknowledged = true;
    const wb = input.wordBreak;
    const h = m.history.find((x) => x.id === g.id);
    if (h && wb && typeof wb === "object") h.wordBreak = { kind: String(wb.kind || "").slice(0, 20), misses: Math.min(99, Number(wb.misses) || 0) };
    return {};
  }
  if (!g || g.result) fail("Start a game first.");
  const b = matchBoard(g);
  if (input.type === "match-move") {
    if (!engine) fail("Chess opponent is unavailable.", 503);
    if (b.turn() !== g.side) fail("Wait for your opponent.");
    const fenBefore = b.fen();
    let mv;
    try { mv = b.move({ from: input.from, to: input.to, promotion: input.promotion || "q" }); }
    catch { fail("That move is not legal."); }
    const rec = { ply: g.moves.length, fen: fenBefore, uci: uciOf(mv), san: mv.san, piece: mv.piece, captured: mv.captured || null,
      promotion: mv.promotion || null, castle: mv.flags.includes('k') || mv.flags.includes('q'), check: b.isCheck(), mate: b.isCheckmate(), fork: targets(b, mv.to).length >= 2 && !attacked(b, mv.to, b.turn()),
      expect: g.expect, before: g.evalLearner, after: null, loss: 0, hinted: !!g.hint };
    g.moves.push(rec.uci);
    g.records.push(rec);
    g.hint = null;
    g.coach = null;
    let reply = null, result = resultOf(b, g.side, g.moves.length);
    if (!result) {
      const r = await coachMove(g, b, coachRating({ match: m }), engine, rng);
      reply = r.move;
      if (r.bestScore != null) rec.after = -r.bestScore;
      result = resultOf(b, g.side, g.moves.length);
    } else rec.after = result.kind === "win" ? 3000 : 0;
    if (rec.before != null && rec.after != null) rec.loss = Math.max(0, clamp(rec.before, -1500, 1500) - clamp(rec.after, -1500, 1500));
    g.fen = b.fen();
    g.lastMoves = [rec.uci, ...(reply ? [uciOf(reply)] : [])];
    if (result) {
      finish(m, g, result, now);
      // The one engine look a turning point may still need: the better move at that moment.
      const mo = g.recap?.moment;
      if (mo?.kind === "turn" && !mo.better) {
        try {
          const a = await engine.analyze(mo.fen, { ms: 300 });
          if (a.best && a.best !== mo.played && a.best !== "(none)") mo.better = a.best;
        } catch { /* The replay still shows the move that was played. */ }
      }
      if (mo?.better) mo.betterSan = sanOf(mo.fen, mo.better);
    }
    g.react = reactionFor(g, rec, reply && { captured: reply.captured, promotion: reply.promotion, check: b.isCheck() && !b.isCheckmate() }, g.result, s);
    return { moves: g.lastMoves, react: g.react?.kind || null, result: g.result?.kind || null };
  }
  if (input.type === "match-undo") {
    if (g.undoLeft < 1) fail("You already used your take-back this game.");
    const rec = g.records.pop();
    if (!rec) fail("Make a move first.");
    g.moves.length = rec.ply;
    g.evalLearner = rec.before;
    g.expect = rec.expect;
    g.undoLeft--;
    g.hint = null;
    g.coach = null;
    g.fen = matchBoard(g).fen();
    g.lastMoves = [];
    g.react = { kind: "takeback", line: line(g, "takeback"), ply: g.moves.length };
    return { undone: rec.uci };
  }
  if (input.type === "match-hint") {
    if (!engine) fail("Chess coach is unavailable.", 503);
    if (b.turn() !== g.side) fail("Wait for your opponent.");
    const stage = Math.min(2, (g.hint?.stage || 0) + 1);
    if (g.hint && stage === g.hint.stage) return { hint: stage, advanced: false };
    if (!g.coach) {
      const a = await engine.analyze(g.fen, { ms: 350 });
      const mv = b.moves({ verbose: true }).find((x) => uciOf(x) === a.best) || b.moves({ verbose: true })[0];
      g.coach = { from: mv.from, to: mv.to, piece: mv.piece, idea: hintIdea(b, mv) };
    }
    if (stage === 1) g.hintedTurns = (g.hintedTurns || 0) + 1;
    const c = g.coach, idea = V.idea[c.idea];
    // Gentle profiles see the piece straight away, then the arrow; others get the idea, then the piece.
    g.hint = s.bigHints
      ? stage === 1 ? { stage, idea: c.idea, voice: idea, from: c.from } : { stage, idea: c.idea, voice: V.arrow, from: c.from, to: c.to }
      : stage === 1 ? { stage, idea: c.idea, voice: idea } : { stage, idea: c.idea, voice: pieceHint(c.piece, c.from), from: c.from };
    return { hint: stage, advanced: true };
  }
  if (input.type === "match-resign") {
    finish(m, g, { kind: "loss", reason: "resign" }, now);
    g.react = { kind: "resign", line: line(g, "resign"), ply: g.moves.length };
    return { result: "loss" };
  }
  fail("Unknown chess action.");
}
