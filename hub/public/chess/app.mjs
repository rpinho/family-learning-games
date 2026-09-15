import { UNITS, LESSONS, lessonFor, NAMES, VOICE } from "./curriculum.mjs";
import { coach, landscape, piece } from "./art.mjs";
import { mountBoard } from "./board.mjs";
import { Chess } from "./rules.mjs";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const btn = (text, id, kind = "secondary", extra = "") =>
  `<button class="ac-button ${kind}" data-do="${id}" ${extra}>${text}</button>`;
export function mountChess(root, { player, name, event = () => {} }) {
  let profile = null,
    view = "path",
    unit = 0,
    alive = true,
    busy = false,
    error = "",
    pending = null,
    inflight = null,
    boardDispose = null,
    analysisView = false,
    voiceManifest = {},
    clip = null;
  const priorScrollRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  const endpoint = "/api/chess?player=" + encodeURIComponent(player);
  const utterance = () => {
    speechGeneration++;
    clip?.pause();
    clip = null;
    root.querySelector(".academy-coach")?.classList.remove("talking");
  };
  let voiceReady = fetch("/chess-voice/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => (voiceManifest = m.clips || {}))
      .catch(() => {}),
    speechGeneration = 0;
  async function say(text, { force = false } = {}) {
    if ((!profile?.settings.sound && !force) || !text) return;
    utterance();
    const generation = speechGeneration;
    await voiceReady;
    if (!alive || generation !== speechGeneration) return;
    const source = voiceManifest[text];
    if (!source) {
      event("chess_voice_unavailable", "missing original clip");
      return;
    }
    const puppet = root.querySelector(".academy-coach");
    clip = new Audio(source);
    clip.preload = "auto";
    const done = () => puppet?.classList.remove("talking");
    clip.onplaying = () => {
      puppet?.classList.add("talking");
      event("chess_voice_play", source);
    };
    clip.onended = () => {
      done();
      event("chess_voice_end", source);
    };
    clip.onerror = () => {
      done();
      event("chess_voice_unavailable", "clip playback failed");
    };
    clip.play().catch(() => {
      done();
      event("chess_voice_unavailable", "playback needs a tap");
    });
  }
  function clickSound(win = false) {
    if (!profile?.settings.sound) return;
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const o = a.createOscillator(),
        g = a.createGain();
      o.connect(g);
      g.connect(a.destination);
      o.frequency.value = win ? 660 : 420;
      g.gain.setValueAtTime(0.035, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.14);
      o.start();
      o.stop(a.currentTime + 0.15);
      o.onended = () => a.close();
    } catch {}
  }
  async function load() {
    try {
      const r = await fetch(endpoint);
      if (!r.ok) throw Error("The chess server is unavailable.");
      profile = (await r.json()).profile;
      const active = profile.session;
      if (profile.current === "game" && profile.game) {
        view = "game";
      } else if (active && !["summary"].includes(active.phase)) {
        view = "lesson";
        unit = lessonFor(active.lesson)?.unit || 0;
      } else {
        const next = LESSONS.find((l) => !profile.completed[l.id]);
        unit = next?.unit || 0;
      }
      error = "";
      render();
      window.scrollTo(0, 0);
    } catch (e) {
      error = e.message;
      render();
    }
  }
  async function send(type, extra = {}) {
    if (busy) return;
    pending = {
      type,
      ...extra,
      revision: profile.revision,
      requestId: crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now() + "-" + Math.random().toString(36).slice(2),
    };
    return execute();
  }
  async function execute() {
    busy = true;
    error = "";
    analysisView = false;
    utterance();
    render();
    const body = pending;
    inflight = (async () => {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(18000),
        });
        const data = await r.json();
        if (!r.ok)
          throw Object.assign(Error(data.error || "The move did not save."), {
            status: r.status,
          });
        if (alive && data.result?.moves)
          await boardDispose?.animate?.(data.result.moves);
        if (alive && data.result?.correct === false && data.result.attempted)
          await boardDispose?.rejectMove?.(data.result.attempted);
        profile = data.profile;
        pending = null;
        if (!alive) return;
        if (body.type === "start" || body.type === "begin") view = "lesson";
        if (body.type === "game-start") view = "game";
        busy = false;
        render();
        if (["start", "begin", "next", "game-start"].includes(body.type))
          window.scrollTo(0, 0);
        if (["move", "game-move"].includes(body.type))
          clickSound(
            body.type === "move" && profile.session?.phase === "solved",
          );
        const text = ["begin", "next"].includes(body.type)
          ? profile.session?.phase === "summary"
            ? VOICE.checkpoint
            : currentUnit().question
          : body.type === "game-hint"
            ? VOICE.gameHint
            : body.type === "move" || body.type === "hint"
              ? profile.session?.feedback?.voice || VOICE.progress
              : body.type === "start"
                ? currentUnit().idea
                : null;
        if (text) say(text);
        event("chess_action", body.type);
      } catch (e) {
        if (!alive) return;
        error = e.message;
        busy = false;
        render();
      } finally {
        busy = false;
      }
    })();
    return inflight;
  }
  function currentUnit() {
    return UNITS.find((u) => u.id === profile?.session?.unit) || UNITS[unit];
  }
  function nav() {
    return `<nav class="academy-nav" aria-label="Chess sections"><a href="#" data-do="path" class="academy-brand"><img src="/chess/icon.svg" alt=""> <span>rook<span>academy</span></span></a><div>${btn("Lesson path", "path", view === "path" || view === "lesson" ? "tab active" : "tab")}${btn("Practice games", "play", view === "play" || view === "game" ? "tab active" : "tab")}${btn("My notebook", "notebook", view === "notebook" ? "tab active" : "tab")}</div>${btn(profile?.settings.sound ? "♪ Sound on" : "♩ Sound off", "sound", "sound", `aria-label="${profile?.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</nav>`;
  }
  function render() {
    if (!alive) return;
    boardDispose?.();
    boardDispose = null;
    if (!profile) {
      root.innerHTML = `<section class="academy loading-academy">${coach()}<h1>${error ? "Let’s reconnect." : "Opening the academy…"}</h1><p>${esc(error || "Your next good move is waiting.")}</p>${error ? btn("Try again", "reload", "primary") : ""}</section>`;
      bind();
      return;
    }
    root.innerHTML = `<div class="academy" style="--unit:${UNITS[unit].color}">${nav()}${error ? `<div class="ac-error" role="alert"><strong>${esc(error)}</strong>${btn("Retry save", "retry", "primary")}${btn("Reload progress", "reload")}</div>` : ""}<div class="ac-content" ${busy ? 'aria-busy="true"' : ""}>${view === "lesson" ? lessonView() : view === "game" ? gameView() : view === "play" ? playView() : view === "notebook" ? notebookView() : pathView()}</div><div class="ac-saving" role="status">${busy ? "Saving your move…" : ""}</div></div>`;
    bind();
    const mount = root.querySelector("#chess-board");
    if (mount) {
      const s = profile.session,
        g = profile.game,
        inGame = view === "game";
      let fen = inGame ? g.fen : s.puzzle.fen,
        lastMoves = inGame
          ? g.lastMoves
          : s.feedback?.moves || s.puzzle.lastMoves.slice(-2);
      if (analysisView && s.feedback?.refutation) {
        const b = new Chess(s.puzzle.fen);
        for (const m of s.feedback.refutation)
          b.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
        fen = b.fen();
        lastMoves = s.feedback.refutation;
      }
      boardDispose = mountBoard(mount, {
        fen,
        side: inGame ? g.side : s.puzzle.side,
        disabled:
          busy ||
          !!pending ||
          analysisView ||
          (inGame ? !!g.result : s.phase !== "puzzle"),
        lastMoves,
        hintFrom: inGame ? g.hint?.from : s.hintFrom,
        hintTo: inGame ? g.hint?.to : s.hintTo,
        onMove: (from, to, promotion) =>
          send(inGame ? "game-move" : "move", { from, to, promotion }),
        onSelect: (text) => {
          const el = root.querySelector("#board-selection");
          if (el) el.textContent = text;
        },
      });
    }
  }
  function pathView() {
    const u = UNITS[unit],
      lessons = LESSONS.filter((l) => l.unit === unit),
      done = lessons.filter((l) => profile.completed[l.id]).length,
      next = lessons.find((l) => !profile.completed[l.id]),
      resume = profile.session && !["summary"].includes(profile.session.phase);
    return `<div class="academy-layout"><section class="academy-path"><header class="unit-selector"><label for="academy-unit">CHAPTER 1 · BEYOND THE BASICS</label><select id="academy-unit" aria-label="Choose a chess unit">${UNITS.map((x, i) => `<option value="${i}" ${i === unit ? "selected" : ""}>${i + 1}. ${x.name}</option>`).join("")}</select><span>Unit ${unit + 1} of ${UNITS.length} · ${done}/6 lessons explored</span></header><section class="unit-hero"><div><span class="ac-eyebrow">YOUR NEXT CHESS ADVENTURE</span><h1>${u.name}</h1><p>${u.subtitle}</p></div><img class="world-banner" src="/chess/academy-world.png" alt=""></section>${resume ? `<div class="resume-strip"><span>A lesson is waiting where you left it.</span>${btn("Continue lesson →", "resume", "primary")}</div>` : ""}<div class="lesson-path"><svg viewBox="0 0 440 660" preserveAspectRatio="none" aria-hidden="true" class="path-track"><path d="M220 50C380 80 375 165 235 174S70 240 148 280S360 340 270 405S70 460 157 516S285 575 220 620"/></svg>${lessons
      .map((l, i) => {
        const completed = profile.completed[l.id],
          current = next?.id === l.id;
        return `<div class="path-stop stop-${i} ${current ? "current" : ""}"><div class="node-label">${current ? "<small>YOUR NEXT STEP</small>" : ""}<strong>${l.name}</strong><span>${l.kind === "checkpoint" ? (l.unit ? "Mixed check · 5 positions" : "Checkpoint · 5 positions") : "5 short positions"}</span></div><button class="path-node ${completed ? "complete" : ""} ${current ? "current" : ""}" data-do="lesson:${l.id}" aria-label="${completed ? "Review" : "Start"} ${l.name}"><span>${completed ? "✓" : l.kind === "checkpoint" ? "♜" : i === 0 ? "✦" : i === 2 ? "◇" : "★"}</span></button>${completed ? `<span class="node-stars" aria-label="${completed.best} of 5 independently solved">${"●".repeat(completed.best)}${"○".repeat(5 - completed.best)}</span>` : ""}</div>`;
      })
      .join(
        "",
      )}<div class="path-finish"><span>✧</span><strong>${unit === UNITS.length - 1 ? "Every ending opens another game." : "A new idea around the bend."}</strong>${unit < UNITS.length - 1 ? btn("Explore next unit →", "next-unit") : btn("Mixed review →", "review")}</div></div></section><aside class="academy-sidebar"><section class="coach-card">${coach()}<span class="ac-eyebrow">A NOTE FROM ROOK</span><h2>Take your time,<br>${esc(name)}.</h2><p>${u.idea}</p>${btn("♪ Hear the idea", "hear-unit", "text")}</section><section class="review-card"><span class="review-icon">↺</span><div><h3>A little review goes far.</h3><p>${profile.reviewDue ? `${profile.reviewDue} positions ready to revisit.` : "Come back to the tricky ideas and make them familiar."}</p></div>${btn("Practice & remember", "review")}</section><section class="practice-level"><label for="chess-band">Position difficulty</label><select id="chess-band"><option value="stretch" ${profile.settings.band !== "guided" ? "selected" : ""}>Stretch · deeper calculation</option><option value="guided" ${profile.settings.band === "guided" ? "selected" : ""}>Guided · clearer patterns</option></select><p>The same advanced ideas, with simpler positions when you need them. Applies to your next lesson.</p></section><section class="academy-tip"><span>♜</span><p><strong>Already know this idea?</strong><br>Choose any unit. The path is a guide, and you can move ahead.</p></section></aside></div>`;
  }
  function lessonView() {
    const s = profile.session;
    if (!s) return pathView();
    const u = currentUnit(),
      l = lessonFor(s.lesson),
      title = l?.name || "Practice & remember";
    if (s.phase === "intro")
      return `<section class="lesson-intro"><button class="ac-back" data-do="path">← Lesson path</button><div class="intro-art">${coach()}<span>${u.symbol}</span></div><span class="ac-eyebrow">${s.lesson === "review" ? "REVIEW YOUR IDEAS" : `UNIT ${(l?.unit || 0) + 1} · ${l?.kind === "checkpoint" ? "CHECKPOINT" : "SHORT CHESS LESSON"}`}</span><h1>${title}</h1><p>${l?.kind === "checkpoint" ? "Keep the earlier ideas in mind. Look at the whole board and work out which pattern matters." : u.idea}</p><div class="intro-question">${l?.kind === "checkpoint" ? "Checks, captures, threats — and what comes next?" : u.question}</div><div class="lesson-chips"><span>${s.total} short positions</span><span>${s.band === "guided" ? "Guided" : "Stretch"} practice</span><span>No timer</span><span>Hints welcome</span></div>${btn("Let’s think →", "begin", "primary large")}${btn("♪ Hear the idea", "hear", "text")}</section>`;
    if (s.phase === "summary") {
      const clean = s.results.filter((r) => r.independent).length;
      return `<section class="lesson-summary"><div class="summary-celebration"><span class="confetti c1">✦</span><span class="confetti c2">✧</span>${coach("happy")}<span class="confetti c3">✦</span><span class="confetti c4">✧</span></div><span class="ac-eyebrow">LESSON COMPLETE</span><h1>One idea stronger.</h1><p>${title} is in your notebook.</p><div class="summary-stats"><div><strong>${s.results.length}</strong><span>positions explored</span></div><div><strong>${clean}</strong><span>without help</span></div><div><strong>${s.results.length - clean}</strong><span>worth revisiting</span></div></div><p class="summary-lesson">${u.idea}</p>${btn("Back to my path →", "path", "primary large")}${btn("Play from this position", "position:" + s.puzzle.id)}<p class="fine-print">Practice tells us what to review. It does not measure your chess Elo.</p></section>`;
    }
    const f = s.feedback,
      solved = s.phase === "solved";
    return `<section class="chess-lesson">
      <header class="lesson-header">${btn("← Path", "path", "text")}<div><span class="ac-eyebrow">${title}</span><div class="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuenow="${s.index + (solved ? 1 : 0)}" aria-valuemin="0" aria-valuemax="${s.total}"><span style="width:${((s.index + (solved ? 1 : 0)) / s.total) * 100}%"></span></div></div><span>${s.index + 1} / ${s.total}</span>${btn(profile.settings.sound ? "♪" : "♩", "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header>
      <div class="lesson-arena"><div class="board-column">
        <div class="rook-dialogue"><div class="coach-stage">${coach(solved ? "happy" : f?.kind === "incorrect" ? "thinking" : "idle")}</div><div class="coach-bubble" aria-live="polite"><span class="ac-eyebrow">ROOK</span><h1>${s.puzzle.goal}</h1><p>${esc(analysisView ? f?.reply : f?.text || (l?.kind === "checkpoint" ? "Compare checks, captures and threats. Calculate their best reply." : u.question))}</p>${btn("♪", "hear", "replay", 'aria-label="Hear Rook again"')}</div></div>
        <div class="position-heading"><div><span class="turn-disc ${s.puzzle.side === "w" ? "white" : "black"}"></span><strong>${s.puzzle.side === "w" ? "White" : "Black"} to move</strong></div><span>${s.puzzle.check ? "Your king is in check" : analysisView ? "Your alternative line" : "Tap or drag a piece"}</span></div>
        <div id="chess-board"></div><div id="board-selection" class="board-selection" aria-live="polite">Choose a piece. The dots show its legal moves.</div>
      </div><aside class="lesson-coach lesson-help">
        ${!solved ? `<div class="thinking-card"><div class="hint-art">${piece("n", "w")}<span>?</span></div><span class="ac-eyebrow">A NUDGE FROM ROOK</span><h2>Need a little help?</h2><p>${l?.kind === "checkpoint" ? "Which idea helps in this position?" : u.question}</p><div class="hint-steps"><span class="${s.hints >= 1 ? "on" : ""}">1 · Idea</span><span class="${s.hints >= 2 ? "on" : ""}">2 · Piece</span><span class="${s.hints >= 3 ? "on" : ""}">3 · Move</span></div>${btn(s.hints === 0 ? "Give me a hint" : s.hints === 1 ? "Show the piece" : s.hints >= 3 ? "Follow the arrow" : "Show the move", "hint", "secondary", busy || s.hints >= 3 ? "disabled" : "")}</div>` : `<div class="solved-card">${coach("happy")}<h2>You found it!</h2><p>${f.independent ? "All your own thinking." : "A little help. A new idea."}</p></div><details class="solution-recap"><summary>See the whole idea</summary><p>${u.idea}</p><ol>${s.solution.map((m) => `<li><b>${m.who}:</b> ${esc(m.text)}</li>`).join("")}</ol></details>`}
        <div class="lesson-tools">${f?.refutation ? btn(analysisView ? "Back to the puzzle" : "See the opponent’s reply", "explain", "text") : ""}${!solved ? btn("↺ Try this position again", "restart", "text") : ""}</div><details class="position-source"><summary>About this position</summary><p>Lichess puzzle ${s.puzzle.id} · puzzle rating ${s.puzzle.rating}. Puzzle ratings describe the exercise, not the player. Position data: CC0; coaching: original.</p></details>
      </aside></div>
      <footer class="lesson-feedback ${solved ? "success" : f?.kind === "incorrect" ? "try-again" : ""}"><div><span>${solved ? "✓" : f?.kind === "incorrect" ? "↺" : "♜"}</span><p><strong>${solved ? "One good idea. Nicely played." : f?.kind === "incorrect" ? "Back we go. Try another idea." : "Find their reply. Then your next move."}</strong><small>${solved ? (f.independent ? "Solved independently." : "This position joins your review.") : "No timer. Take all the thinking time you need."}</small></p></div>${solved ? btn(s.index + 1 === s.total ? "Finish lesson →" : "Next position →", "next", "primary") : ""}</footer>
    </section>`;
  }
  function miniBoard(fen) {
    const board = new Chess(fen);
    return `<div class="practice-board" aria-hidden="true">${board
      .board()
      .flat()
      .map(
        (p, i) =>
          `<span class="${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"}">${p ? piece(p.type, p.color) : ""}</span>`,
      )
      .join("")}</div>`;
  }
  function playView() {
    return `<section class="practice-lobby"><div class="practice-heading"><div><span class="ac-eyebrow">TAKE THE IDEAS TO THE BOARD</span><h1>A little more room to think.</h1><p>Try a position first, or settle in for a whole game.</p></div>${coach()}</div><label class="opponent-select">Rook’s playing strength <select id="chess-strength"><option value="friendly" ${profile.settings.strength === "friendly" ? "selected" : ""}>Friendly</option><option value="club" ${profile.settings.strength === "club" ? "selected" : ""}>Club</option><option value="challenge" ${profile.settings.strength === "challenge" ? "selected" : ""}>Challenge</option></select></label><div class="practice-cards"><article><div class="practice-preview">${miniBoard(profile.session?.puzzle?.startFen || "4r1k1/pp3ppp/2p2n2/3p4/3P4/2PB1N2/PP3PPP/4R1K1 w - - 0 1")}</div><h2>Continue a position</h2><p>Eight turns from the latest lesson. Find a plan and respond to a real opponent.</p>${profile.session?.puzzle ? btn("Play this position", "position:" + profile.session.puzzle.id, "primary") : btn("Explore a lesson first", "path", "primary")}</article><article><div class="practice-preview">${miniBoard()}</div><h2>Play a full game</h2><p>Start from the opening. Takebacks and coaching are available whenever you need them.</p><div>${btn("Play White", "full:w", "primary")}${btn("Play Black", "full:b")}</div></article></div>${profile.game ? `<div class="resume-strip"><span>${profile.game.result || "Your practice game is saved."}</span>${btn("Return to board →", "game", "primary")}</div>` : ""}<p class="fine-print">The opponent runs locally with Stockfish. These strength settings are practice choices, not a measurement of your rating.</p></section>`;
  }
  function gameView() {
    const g = profile.game;
    if (!g) return playView();
    return `<section class="chess-lesson practice-game"><header class="lesson-header">${btn("← Practice", "play", "text")}<strong>${g.mode === "position" ? `Position practice · ${g.turns} / ${g.target} turns` : "A game with Rook"}</strong><span>${g.strength}</span>${btn(profile.settings.sound ? "♪" : "♩", "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header>
      <div class="lesson-arena"><div class="board-column"><div class="rook-dialogue"><div class="coach-stage">${coach(g.result ? "happy" : busy ? "thinking" : "idle")}</div><div class="coach-bubble"><span class="ac-eyebrow">ROOK</span><h1>${g.result || "What is your plan?"}</h1><p>${esc(g.result ? g.assessment || "Let’s keep the useful ideas from this game." : g.hint?.text || "What is your opponent threatening? Check that before choosing your next move.")}</p>${btn("♪", "hear", "replay", 'aria-label="Hear Rook again"')}</div></div><div class="position-heading"><div><span class="turn-disc ${g.side === "w" ? "white" : "black"}"></span><strong>You play ${g.side === "w" ? "White" : "Black"}</strong></div><span>${g.result ? "Game complete" : busy ? "Rook is thinking…" : "Your move"}</span></div><div id="chess-board"></div><div id="board-selection" class="board-selection" aria-live="polite">Tap or drag to move. Every completed turn is saved.</div></div>
      <aside class="lesson-coach lesson-help game-help"><div class="thinking-card"><div class="hint-art">${piece("r", "w")}<span>?</span></div><span class="ac-eyebrow">YOUR PRACTICE TABLE</span><h2>Think it through.</h2><p>Try an idea. Take it back. Learn what happens.</p>${!g.result ? btn("Coach me", "game-hint", "secondary") : ""}</div>${btn("Take back a turn", "game-undo", "secondary", g.turns < 1 ? "disabled" : "")}${btn("Choose another game", "play", "text")}<details class="game-notebook"><summary>Move notebook</summary><p class="move-notebook">${gameNotation(g)}</p></details><p class="fine-print">${g.help} coaching aids or takebacks. Practice games do not change lesson progress.</p></aside></div></section>`;
  }
  function gameNotation(g) {
    try {
      const b = new Chess(g.startFen);
      return g.moves
        .map((m) => {
          const x = b.move({
            from: m.slice(0, 2),
            to: m.slice(2, 4),
            promotion: m[4],
          });
          return esc(x.san);
        })
        .join(" · ");
    } catch {
      return "";
    }
  }
  function notebookView() {
    return `<section class="academy-notebook"><span class="ac-eyebrow">YOUR CHESS NOTEBOOK</span><h1>Ideas you can come back to.</h1><p>Your best independent result stays recorded when you review a lesson.</p><div class="notebook-grid">${UNITS.map(
      (u, i) => {
        const ls = LESSONS.filter((l) => l.unit === i),
          n = ls.filter((l) => profile.completed[l.id]).length;
        return `<button class="notebook-unit" data-do="unit:${i}" style="--unit:${u.color}"><span>${u.symbol}</span><div><strong>${u.name}</strong><small>${n}/6 lessons explored</small></div><b>→</b></button>`;
      },
    ).join("")}</div><section class="recent-lessons"><h2>Recent practice</h2>${
      profile.history.length
        ? profile.history
            .slice()
            .reverse()
            .slice(0, 10)
            .map(
              (h) =>
                `<div><span>${esc(lessonFor(h.lesson)?.name || "Review")} · ${h.band === "guided" ? "Guided" : "Stretch"}</span><strong>${h.independent}/${h.total} without help</strong></div>`,
            )
            .join("")
        : "<p>Your first lesson will appear here.</p>"
    }</section>${btn("Review tricky positions →", "review", "primary")}</section>`;
  }
  function bind() {
    root.querySelectorAll("[data-do]").forEach(
      (el) =>
        (el.onclick = async (e) => {
          e.preventDefault();
          if (busy) return;
          const [action, arg] = el.dataset.do.split(":");
          if (pending && !["retry", "reload", "hear"].includes(action)) return;
          if (action === "reload") {
            pending = null;
            await load();
            return;
          }
          if (action === "retry") {
            await execute();
            return;
          }
          if (["path", "play", "notebook", "game"].includes(action)) {
            view = action;
            utterance();
            render();
            window.scrollTo(0, 0);
            return;
          }
          if (action === "resume") {
            view = "lesson";
            render();
            window.scrollTo(0, 0);
            return;
          }
          if (action === "unit") {
            unit = +arg;
            view = "path";
            render();
            window.scrollTo(0, 0);
            return;
          }
          if (action === "next-unit") {
            unit = Math.min(UNITS.length - 1, unit + 1);
            render();
            window.scrollTo(0, 0);
            return;
          }
          if (action === "hear-unit") {
            say(UNITS[unit].idea, { force: true });
            return;
          }
          if (action === "hear") {
            say(
              analysisView
                ? VOICE.alternative
                : view === "game"
                  ? (profile.game?.hint ? VOICE.gameHint : null) ||
                    "What is your opponent threatening? Check that before choosing your next move."
                  : profile.session?.feedback?.voice || currentUnit().idea,
              { force: true },
            );
            return;
          }
          if (action === "sound") {
            await send("settings", { sound: !profile.settings.sound });
            return;
          }
          if (action === "explain") {
            analysisView = !analysisView;
            render();
            window.scrollTo(0, 0);
            return;
          }
          if (action === "lesson" || action === "review") {
            const active = profile.session;
            if (
              active &&
              !["summary"].includes(active.phase) &&
              !confirm(
                "Start a different lesson? Completed progress is kept; the unfinished lesson will be replaced.",
              )
            )
              return;
            await send("start", {
              lesson: action === "review" ? "review" : arg,
            });
            return;
          }
          if (action === "full" || action === "position") {
            if (
              profile.game &&
              !profile.game.result &&
              !confirm(
                "Start a new practice game? Your unfinished practice game will be replaced.",
              )
            )
              return;
            await send(
              "game-start",
              action === "full" ? { side: arg } : { puzzle: arg },
            );
            return;
          }
          if (action === "restart") {
            await send("retry-puzzle");
            return;
          }
          if (
            ["begin", "hint", "next", "game-hint", "game-undo"].includes(action)
          )
            await send(action);
        }),
    );
    const selector = root.querySelector("#academy-unit");
    if (selector)
      selector.onchange = () => {
        unit = +selector.value;
        render();
      };
    const band = root.querySelector("#chess-band");
    if (band) band.onchange = () => send("settings", { band: band.value });
    const strength = root.querySelector("#chess-strength");
    if (strength)
      strength.onchange = () => send("settings", { strength: strength.value });
  }
  const onVisibility = () => {
    if (document.hidden) utterance();
  };
  document.addEventListener("visibilitychange", onVisibility);
  load();
  const dispose = () => {
    document.removeEventListener("visibilitychange", onVisibility);
    history.scrollRestoration = priorScrollRestoration;
    alive = false;
    boardDispose?.();
    utterance();
  };
  dispose.busy = () => busy || !!pending;
  dispose.prepareLeave = async () => {
    if (inflight) await inflight;
    if (pending)
      throw Error(
        "Your chess move has not saved. Use Retry save before leaving.",
      );
  };
  return dispose;
}
