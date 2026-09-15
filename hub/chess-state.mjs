import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Chess } from "./public/chess/rules.mjs";
import {
  UNITS,
  LESSONS,
  lessonFor,
  NAMES,
  moveWords,
  COURSE_VERSION,
  VOICE,
  pieceHint,
} from "./public/chess/curriculum.mjs";
export const GROUPS = JSON.parse(
  await readFile(new URL("./chess-puzzles.json", import.meta.url), "utf8"),
);
export const GUIDED = JSON.parse(
  await readFile(new URL("./chess-guided.json", import.meta.url), "utf8"),
);
export const PUZZLES = Object.fromEntries(
  [...Object.values(GROUPS).flat(), ...Object.values(GUIDED).flat()].map(
    (p) => [p.id, p],
  ),
);
const fail = (text, status = 400) => {
  throw Object.assign(Error(text), { status });
};
export const freshChess = () => ({
  schema: 1,
  revision: 0,
  completed: {},
  review: {},
  history: [],
  session: null,
  game: null,
  requests: [],
  settings: { sound: true, strength: "friendly", band: "stretch" },
  course: COURSE_VERSION,
});
export function lessonPuzzles(id, band = "stretch") {
  const l = lessonFor(id);
  if (!l) return [];
  const groups = band === "guided" ? GUIDED : GROUPS;
  const own = groups[UNITS[l.unit].theme].slice(l.step * 5, l.step * 5 + 5);
  // Checkpoints interleave earlier ideas without revealing the motif first.
  if (l.step === 5 && l.unit > 0) {
    own[3] = groups[UNITS[l.unit - 1].theme][27];
    own[4] = groups[UNITS[Math.max(0, l.unit - 2)].theme][28];
  }
  return own.map((p) => p.id);
}
function boardAt(s) {
  const p = PUZZLES[s.ids[s.index]],
    b = new Chess(p.fen);
  for (const u of p.line.slice(0, s.ply))
    b.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return b;
}
function playUci(b, u) {
  return b.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
}
const colorName = (c) => (c === "w" ? "White" : "Black");
function specificFeedback(b, m) {
  if (b.isCheckmate()) return "Checkmate. The king has no safe escape.";
  const attacked = b
    .board()
    .flat()
    .filter(
      (p) =>
        p &&
        p.color !== m.color &&
        ["q", "r", "k"].includes(p.type) &&
        b.attackers(p.square, m.color).includes(m.to),
    );
  if (attacked.length >= 2)
    return `A fork: your ${NAMES[m.piece]} attacks ${attacked.map((p) => "the " + NAMES[p.type] + " on " + p.square.toUpperCase()).join(" and ")}.`;
  if (b.isCheck()) return `${moveWords(m)} gives check.`;
  if (m.captured)
    return `You captured the ${NAMES[m.captured]} on ${m.to.toUpperCase()}. Keep track of what is still defended.`;
  if (m.promotion)
    return `Your pawn promotes to a ${NAMES[m.promotion]}. The promotion changes the position.`;
  return `${moveWords(m)}. You kept the plan working.`;
}
function advancePuzzle(p) {
  const s = p.session;
  s.ply = 0;
  s.hints = 0;
  s.errors = 0;
  s.feedback = null;
  s.finalFen = null;
  s.phase = "puzzle";
}
function finishPuzzle(p, now) {
  const s = p.session,
    id = s.ids[s.index],
    independent = s.hints === 0 && s.errors === 0;
  s.results.push({
    id,
    independent,
    hints: s.hints,
    errors: s.errors,
    at: now,
  });
  const previous = p.review[id];
  p.review[id] = {
    successes: (previous?.successes || 0) + (independent ? 1 : 0),
    due:
      now +
      (independent
        ? Math.min(14, 2 ** (previous?.successes || 0)) * 86400000
        : 86400000),
    needsPractice: !independent,
  };
  s.phase = "solved";
  const spoken = PUZZLES[id].terminal
    ? VOICE.mate
    : independent
      ? VOICE.solved
      : VOICE.assisted;
  s.feedback = {
    ...(s.feedback || {}),
    kind: "solved",
    voice: spoken,
    independent,
    text:
      (s.feedback?.text || "You found the combination.") +
      (independent
        ? " Solved without help."
        : " Good practice. This one will return in review."),
  };
}
function finishLesson(p, now) {
  const s = p.session;
  s.phase = "summary";
  const clean = s.results.filter((r) => r.independent).length;
  const before = p.completed[s.lesson];
  if (s.lesson !== "review")
    p.completed[s.lesson] = {
      times: (before?.times || 0) + 1,
      best: Math.max(before?.best || 0, clean),
      last: now,
      band: s.band,
      bestByBand: {
        ...before?.bestByBand,
        [s.band]: Math.max(before?.bestByBand?.[s.band] || 0, clean),
      },
    };
  p.history.push({
    lesson: s.lesson,
    band: s.band,
    at: now,
    independent: clean,
    total: s.results.length,
  });
  p.history = p.history.slice(-100);
}
export function publicChess(p) {
  const s = p.session;
  let session = null;
  if (s) {
    const puzzle = PUZZLES[s.ids[s.index]],
      unit = UNITS.find((u) => u.theme === puzzle?.theme) || UNITS[0];
    session = {
      id: s.id,
      lesson: s.lesson,
      band: s.band,
      phase: s.phase,
      index: s.index,
      total: s.ids.length,
      results: s.results,
      ply: s.ply,
      hints: s.hints,
      errors: s.errors,
      feedback: s.feedback,
      unit: unit.id,
    };
    if (puzzle && ["solved", "summary"].includes(s.phase)) {
      const replay = new Chess(puzzle.fen);
      session.solution = puzzle.line.map((uci, i) => ({
        who: i % 2 ? "Opponent" : "You",
        text: moveWords(playUci(replay, uci)),
      }));
    }
    if (puzzle) {
      const b = s.finalFen ? new Chess(s.finalFen) : boardAt(s);
      session.puzzle = {
        id: puzzle.id,
        fen: b.fen(),
        startFen: puzzle.fen,
        side: new Chess(puzzle.fen).turn(),
        goal:
          s.phase === "solved" || s.phase === "summary"
            ? b.isCheckmate()
              ? "Checkmate. You found it!"
              : "Combination complete!"
            : puzzle.terminal
              ? `Find checkmate in ${Math.ceil((puzzle.line.length - s.ply) / 2)} ${Math.ceil((puzzle.line.length - s.ply) / 2) === 1 ? "move" : "moves"}`
              : puzzle.theme === "defensiveMove"
                ? "Find the best defense"
                : "Find the strongest continuation",
        lastMoves: puzzle.line.slice(0, s.ply),
        check: b.isCheck(),
        rating: puzzle.rating,
      };
      if (s.hints >= 2) {
        const next = puzzle.line[s.ply];
        session.hintFrom = next?.slice(0, 2);
        if (s.hints >= 3) session.hintTo = next?.slice(2, 4);
      }
    }
  }
  return {
    revision: p.revision,
    current: p.current,
    course: p.course,
    completed: p.completed,
    reviewDue: Object.values(p.review).filter(
      (r) => r.due <= Date.now() || r.needsPractice,
    ).length,
    history: p.history.slice(-20),
    session,
    game: p.game,
    settings: p.settings,
  };
}
export async function actChess(p, input, { engine, now = Date.now() } = {}) {
  if (!input || typeof input !== "object") fail("Choose a chess action.");
  if (
    typeof input.requestId !== "string" ||
    !/^[-\w]{8,80}$/.test(input.requestId)
  )
    fail("A request identifier is required.");
  if (p.requests.includes(input.requestId)) return { duplicate: true };
  if (input.revision !== p.revision)
    fail("Another tab has newer progress. Refresh to continue.", 409);
  let result = {};
  const s = p.session;
  if (input.type === "start") {
    let ids = lessonPuzzles(input.lesson, p.settings.band);
    if (input.lesson === "review") {
      ids = Object.entries(p.review)
        .filter(([id, r]) => PUZZLES[id] && (r.due <= now || r.needsPractice))
        .sort(
          (a, b) =>
            Number(b[1].needsPractice) - Number(a[1].needsPractice) ||
            a[1].due - b[1].due,
        )
        .slice(0, 5)
        .map(([id]) => id);
      if (!ids.length)
        ids = Object.values(PUZZLES)
          .filter((x) => p.review[x.id])
          .slice(-5)
          .map((x) => x.id);
      if (!ids.length) ids = lessonPuzzles(LESSONS[0].id, p.settings.band);
    }
    if ((ids.length !== 5 && input.lesson !== "review") || !ids.length)
      fail("Choose a lesson on the path.");
    p.session = {
      id: randomUUID(),
      lesson: input.lesson,
      band: p.settings.band || "stretch",
      ids,
      index: 0,
      ply: 0,
      hints: 0,
      errors: 0,
      results: [],
      phase: "intro",
      feedback: null,
    };
  } else if (input.type === "settings") {
    if (input.band !== undefined) {
      if (!["guided", "stretch"].includes(input.band))
        fail("Choose a practice level.");
      p.settings.band = input.band;
    }
    if (typeof input.sound === "boolean") p.settings.sound = input.sound;
    if (input.strength !== undefined) {
      if (!["friendly", "club", "challenge"].includes(input.strength))
        fail("Choose an opponent level.");
      p.settings.strength = input.strength;
    }
  } else if (input.type === "begin") {
    if (!s || s.phase !== "intro") fail("Open a lesson first.");
    advancePuzzle(p);
  } else if (input.type === "hint") {
    if (!s || s.phase !== "puzzle")
      fail("Hints are available during a puzzle.");
    s.hints = Math.min(3, s.hints + 1);
    const u = UNITS.find((u) => u.theme === PUZZLES[s.ids[s.index]].theme);
    const puzzle = PUZZLES[s.ids[s.index]],
      next = puzzle.line[s.ply],
      hintBoard = boardAt(s);
    const text =
      s.hints === 1
        ? u.hints[0]
        : s.hints === 2
          ? pieceHint(hintBoard.get(next.slice(0, 2)).type, next.slice(0, 2))
          : VOICE.hintMove;
    s.feedback = { kind: "hint", text, voice: text };
  } else if (input.type === "move") {
    if (!s || s.phase !== "puzzle") fail("Open a puzzle before moving.");
    const puzzle = PUZZLES[s.ids[s.index]],
      b = boardAt(s);
    let m;
    try {
      m = b.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion || "q",
      });
    } catch {
      fail("That move is not legal. Try another square.");
    }
    const uci = m.from + m.to + (m.promotion || "");
    if (uci !== puzzle.line[s.ply] && !b.isCheckmate()) {
      s.errors++;
      s.feedback = {
        kind: "incorrect",
        text: "A legal move, but there is a stronger continuation. Recheck the forcing moves.",
        tried: uci,
      };
      if (engine) {
        try {
          const analysis = await engine.analyze(b.fen(), { ms: 180 });
          const reply = analysis.best;
          if (reply && reply !== "(none)") {
            const rm = playUci(b, reply);
            s.feedback.refutation = [uci, reply];
            s.feedback.reply = `The opponent can answer ${rm.san}${rm.captured ? " and take your " + NAMES[rm.captured] : b.isCheck() ? " with check" : ""}.`;
          }
        } catch {
          /* The curated drill works even if optional analysis is unavailable. */
        }
      }
      s.feedback.voice = VOICE.mistakes[(s.errors - 1) % VOICE.mistakes.length];
      result = { correct: false, attempted: uci };
    } else {
      let text = specificFeedback(b, m);
      const spoken = text.startsWith("A fork")
        ? VOICE.fork
        : b.isCheckmate()
          ? VOICE.mate
          : b.isCheck()
            ? VOICE.check
            : m.promotion
              ? VOICE.promotion
              : m.captured
                ? VOICE.capture
                : VOICE.progress;
      text = text[0].toUpperCase() + text.slice(1);
      s.ply++;
      const accepted = [uci];
      if (s.ply < puzzle.line.length && !b.isCheckmate()) {
        const reply = playUci(b, puzzle.line[s.ply]);
        text += ` They answered ${moveWords(reply)}. What comes next?`;
        accepted.push(puzzle.line[s.ply]);
        s.ply++;
      }
      s.feedback = { kind: "correct", text, voice: spoken, moves: accepted };
      result = { correct: true, moves: accepted };
      if (s.ply >= puzzle.line.length || b.isCheckmate()) {
        if (b.isCheckmate()) {
          s.finalFen = b.fen();
          s.ply = puzzle.line.length;
        }
        finishPuzzle(p, now);
      }
    }
  } else if (input.type === "next") {
    if (!s || s.phase !== "solved") fail("Finish this puzzle first.");
    if (s.index + 1 === s.ids.length) finishLesson(p, now);
    else {
      s.index++;
      advancePuzzle(p);
    }
  } else if (input.type === "retry-puzzle") {
    if (!s || !["puzzle", "solved"].includes(s.phase))
      fail("Open a puzzle first.");
    if (s.phase === "solved") fail("Use Review to replay a finished puzzle.");
    s.ply = 0;
    s.hints = Math.max(1, s.hints);
    s.feedback = {
      kind: "hint",
      text: "Back to the starting position. Your earlier help stays recorded.",
      voice: VOICE.restart,
    };
  } else if (input.type === "game-start") {
    const puzzle = input.puzzle ? PUZZLES[input.puzzle] : null;
    if (input.puzzle && !puzzle) fail("That practice position is unavailable.");
    const b = new Chess(puzzle?.fen),
      side = puzzle ? b.turn() : input.side === "b" ? "b" : "w";
    const game = {
      id: randomUUID(),
      startFen: b.fen(),
      fen: b.fen(),
      side,
      moves: [],
      mode: puzzle ? "position" : "full",
      target: puzzle ? 8 : null,
      turns: 0,
      result: null,
      help: 0,
      strength: p.settings.strength,
    };
    if (b.turn() !== side) {
      if (!engine) fail("Chess opponent is unavailable.", 503);
      const a = await engine.analyze(b.fen(), {
        ms: 250,
        elo: strength(game.strength),
      });
      const m = playUci(b, a.best);
      game.moves.push(m.from + m.to + (m.promotion || ""));
      game.fen = b.fen();
    }
    p.game = game;
  } else if (input.type === "game-move") {
    const g = p.game;
    if (!g || g.result) fail("Start a practice game first.");
    if (!engine) fail("Chess opponent is unavailable.", 503);
    const b = gameBoard(g);
    if (b.turn() !== g.side) fail("Wait for the opponent.");
    let m;
    try {
      m = b.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion || "q",
      });
    } catch {
      fail("That move is not legal.");
    }
    g.hint = null;
    g.moves.push(m.from + m.to + (m.promotion || ""));
    g.turns++;
    let reply = null;
    if (!b.isGameOver()) {
      const a = await engine.analyze(b.fen(), {
        ms: 300,
        elo: strength(g.strength),
      });
      const rm = playUci(b, a.best);
      reply = rm.from + rm.to + (rm.promotion || "");
      g.moves.push(reply);
    }
    g.fen = b.fen();
    g.lastMoves = [
      m.from + m.to + (m.promotion || ""),
      ...(reply ? [reply] : []),
    ];
    g.result = outcome(b, g.side);
    if (!g.result && g.mode === "position" && g.turns >= g.target) {
      const a = await engine.analyze(b.fen(), { ms: 300 });
      g.result = "Practice complete";
      g.assessment =
        a.score === undefined
          ? "Review the position and compare your plan."
          : `Engine view: ${Math.abs(a.score / 100).toFixed(1)} pawns ${a.score >= 0 ? "in favor of" : "against"} the side to move. This is a position estimate, not a player rating.`;
    }
    if (g.moves.length >= 400 && !g.result) g.result = "Practice limit reached";
    result = { moves: g.lastMoves };
  } else if (input.type === "game-undo") {
    const g = p.game;
    if (!g || g.moves.length < 2) fail("Play a turn before taking it back.");
    g.moves.splice(-(gameBoard(g).turn() === g.side ? 2 : 1));
    g.turns = Math.max(0, g.turns - 1);
    g.help++;
    g.hint = null;
    g.result = null;
    g.assessment = null;
    g.fen = gameBoard(g).fen();
    g.lastMoves = [];
  } else if (input.type === "game-hint") {
    const g = p.game;
    if (!g || g.result) fail("Start a practice game first.");
    if (!engine) fail("Chess coach is unavailable.", 503);
    const a = await engine.analyze(g.fen, { ms: 350 });
    const b = new Chess(g.fen),
      m = playUci(b, a.best);
    g.help++;
    g.hint = {
      from: m.from,
      to: m.to,
      text: `Consider ${moveWords(m)}. What would the opponent do next?`,
    };
  } else fail("Unknown chess action.");
  if (input.type.startsWith("game-")) p.current = "game";
  else if (
    ["start", "begin", "move", "hint", "next", "retry-puzzle"].includes(
      input.type,
    )
  )
    p.current = "lesson";
  p.revision++;
  p.requests.push(input.requestId);
  p.requests = p.requests.slice(-120);
  return result;
}
export function gameBoard(g) {
  const b = new Chess(g.startFen);
  for (const m of g.moves) playUci(b, m);
  return b;
}
function strength(s) {
  return { friendly: 1320, club: 1600, challenge: 1900 }[s] || 1600;
}
function outcome(b, side) {
  if (b.isCheckmate())
    return b.turn() === side ? "Checkmate · Rook wins" : "Checkmate · you win";
  if (b.isStalemate()) return "Draw · stalemate";
  if (b.isThreefoldRepetition()) return "Draw · repetition";
  if (b.isInsufficientMaterial()) return "Draw · insufficient material";
  if (b.isDraw()) return "Draw";
  return null;
}
