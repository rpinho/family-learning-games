import { UNITS, LESSONS, lessonFor, NAMES, VOICE } from "./curriculum.mjs";
import { coach, piece } from "./art.mjs";
import { mountBoard } from "./board.mjs";
import { Chess } from "./rules.mjs";
import { narrationFor, createNarrationGate } from "./narration.mjs";
import { pathProgress } from "./path.mjs";
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
    clip = null,
    captions = false,
    reaction = "idle",
    finishTimer = null,
    completedNotice = "";
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
  const allowNarration = createNarrationGate();
  async function say(text, { force = false, kind = "automatic" } = {}) {
    if ((!profile?.settings.sound && !force) || !text) return;
    if (!allowNarration(text, { force, kind })) return;
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
    const done = () =>
      root.querySelector(".academy-coach")?.classList.remove("talking");
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
        const next = pathProgress(profile).find((l) => l.current);
        unit = next?.unit || 0;
      }
      error = "";
      render();
      if (view === "path") scrollPath();
      else window.scrollTo(0, 0);
      queueLessonFinish();
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
    clearTimeout(finishTimer);
    busy = true;
    error = "";
    analysisView = false;
    utterance();
    const body = pending;
    const moving = ["move", "game-move"].includes(body.type) && boardDispose;
    let preview = null;
    if (moving) {
      boardDispose.lock(true);
      root.querySelector(".ac-content")?.setAttribute("aria-busy", "true");
      root.querySelectorAll("[data-do]").forEach((el) => (el.disabled = true));
      preview = boardDispose.preview(
        body.from + body.to + (body.promotion || ""),
      );
    } else render();
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
        if (preview) await preview;
        if (alive && data.result?.correct === false && data.result.attempted) {
          react("retry");
          await boardDispose?.rollback?.();
        } else if (alive && data.result?.moves) {
          await boardDispose?.animate?.(
            preview ? data.result.moves.slice(1) : data.result.moves,
          );
        }
        const newlyCompleted = body.type === "next" && profile.session?.lesson !== "review" && !profile.completed[profile.session?.lesson];
        profile = data.profile;
        pending = null;
        if (!alive) return;
        if (body.type === "start" || body.type === "begin") view = "lesson";
        if (body.type === "game-start") view = "game";
        if (body.type === "next" && profile.session?.phase === "summary") {
          completedNotice = newlyCompleted ? profile.session.lesson : "";
          view = "path";
        }
        busy = false;
        reaction =
          data.result?.correct === false
            ? "retry"
            : ["move", "game-move"].includes(body.type)
              ? (profile.session?.phase === "solved" && body.type === "move") ||
                (body.type === "game-move" && profile.game?.result)
                ? "celebrate"
                : "nod"
              : "idle";
        render();
        react(reaction);
        if (["start", "begin", "next", "game-start"].includes(body.type))
          view === "path" ? scrollPath() : window.scrollTo(0, 0);
        queueLessonFinish();
        if (
          ["move", "game-move"].includes(body.type) &&
          data.result?.correct !== false
        )
          clickSound(
            body.type === "move" && profile.session?.phase === "solved",
          );
        const narration = narrationFor(body.type, profile, currentUnit().cue);
        if (narration) say(narration.text, { kind: narration.kind });
        event("chess_action", body.type);
      } catch (e) {
        if (preview) await preview.catch(() => {});
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
    return `<nav class="academy-nav" aria-label="Chess sections"><a href="#" data-do="path" class="academy-brand"><img src="/chess/icon.svg" alt=""> <span>rook<span>academy</span></span></a><div>${btn("Lesson path", "path", view === "path" || view === "lesson" ? "tab active" : "tab")}${btn("Practice games", "play", view === "play" || view === "game" ? "tab active" : "tab")}${btn("My notebook", "notebook", view === "notebook" ? "tab active" : "tab")}</div>${btn(glyph(profile?.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile?.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</nav>`;
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
    if (clip && !clip.paused)
      root.querySelector(".academy-coach")?.classList.add("talking");
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
        onMotion: (kind) => {
          react(kind);
        },
        onSelect: (text) => {
          const el = root.querySelector("#board-selection");
          if (el) el.textContent = text;
        },
      });
    }
  }
  function react(kind) {
    const puppet = root.querySelector(".academy-coach");
    if (!puppet) return;
    puppet.classList.remove(
      "react-nod",
      "react-celebrate",
      "react-retry",
      "react-think",
      "react-capture",
      "react-select",
    );
    if (!kind || kind === "idle" || kind === "land") return;
    void puppet.getBoundingClientRect();
    puppet.classList.add("react-" + kind);
  }
  const uiIcon = (paths) =>
    `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const glyph = (kind) =>
    ({
      hear: uiIcon(
        '<path d="M11 4 6 8H3v8h3l5 4Z"/><path d="M15 8q4 4 0 8m3-11q7 7 0 14"/>',
      ),
      muted: uiIcon(
        '<path d="M11 4 6 8H3v8h3l5 4Z"/><path d="m16 9 6 6m0-6-6 6"/>',
      ),
      lock: uiIcon('<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
      hint: uiIcon(
        '<path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7Z"/><path d="M9 20h6m-5 3h4M9 9q0-3 3-3"/>',
      ),
      undo: "↶",
      close: "×",
      next: "➜",
      captions: "CC",
    })[kind];
  function iconButton(kind, action, label, extra = "") {
    return btn(
      glyph(kind),
      action,
      "icon-button " + kind,
      `aria-label="${label}" title="${label}" ${extra}`,
    );
  }
  function spokenText() {
    if (view === "game")
      return (
        profile.game?.hint?.text ||
        "What is your opponent threatening? Check that before choosing your next move."
      );
    return analysisView
      ? profile.session?.feedback?.reply
      : profile.session?.feedback?.text || currentUnit().cue;
  }
  function shortPrompt() {
    const s = profile.session;
    if (s?.phase === "solved") return "You found it!";
    if (s?.feedback?.kind === "incorrect") return "Try again";
    if (s?.hints >= 3) return "Follow the arrow";
    if (s?.hints === 2) return "Try this piece";
    return s?.ply > 0 ? "Keep going" : currentUnit().task;
  }
  function arenaHead(status, mood = "idle") {
    return `<div class="arena-coach"><button class="rook-replay" data-do="hear" aria-label="Hear Rook again">${coach(mood)}<span class="speaker-badge" aria-hidden="true">${glyph("hear")}</span></button><div class="arena-prompt" aria-live="polite"><span class="feedback-symbol" aria-hidden="true">${mood === "happy" ? "✓" : mood === "thinking" ? "↶" : ""}</span><h1>${esc(status)}</h1></div><div class="caption-control">${iconButton("captions", "captions", captions ? "Hide captions" : "Show captions", `aria-pressed="${captions}"`)}</div></div>${captions ? `<div class="spoken-caption" aria-live="polite">${esc(spokenText())}</div>` : `<div class="sr-only" aria-live="polite">${esc(spokenText())}</div>`}`;
  }
  function scrollPath(target) {
    requestAnimationFrame(() => {
      const node = target !== undefined ? root.querySelector(`[data-unit="${target}"]`) :
        root.querySelector(".path-stop.current") || root.querySelector(".course-finish");
      node?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }
  function queueLessonFinish() {
    clearTimeout(finishTimer);
    const s = profile?.session;
    if (view !== "lesson" || s?.phase !== "solved" || s.index + 1 !== s.total) return;
    const id = s.id;
    finishTimer = setTimeout(() => {
      if (alive && !busy && !pending && view === "lesson" && profile.session?.id === id && profile.session.phase === "solved") void send("next");
    }, 1400);
  }
  function pathView() {
    const progress = pathProgress(profile);
    return `<div class="academy-layout continuous-layout"><section class="academy-path" aria-label="Chess learning path">${profile.session && profile.session.phase !== "summary" ? `<div class="resume-strip">${btn("Continue ➜", "resume", "primary")}</div>` : ""}${UNITS.map((u, ui) => `<section class="path-unit" data-unit="${ui}" aria-label="Unit ${ui + 1}: ${esc(u.name)}" style="--unit-color:${u.color}"><header class="unit-heading"><div><small>UNIT ${ui + 1}</small><h2>${esc(u.name)}</h2></div>${btn(glyph("hear"), "hear-unit:" + ui, "text", `aria-label="Hear unit ${ui + 1}"`)}</header><div class="lesson-path"><svg viewBox="0 0 440 660" preserveAspectRatio="none" aria-hidden="true" class="path-track"><path d="M220 50C380 80 375 165 235 174S70 240 148 280S360 340 270 405S70 460 157 516S285 575 220 620"/></svg>${progress.filter(l => l.unit === ui).map((l, i) => `<div class="path-stop stop-${i} ${l.current ? "current" : ""}"><button class="path-node ${l.complete ? "complete" : ""} ${l.current ? "current" : ""} ${l.locked ? "locked" : ""}" data-do="lesson:${l.id}" ${l.locked ? "disabled" : ""} ${l.current ? 'aria-current="step"' : ""} aria-label="${l.locked ? "Locked" : l.complete ? "Review" : "Start"} ${esc(l.name)}"><span>${l.locked ? glyph("lock") : l.complete ? "✓" : l.kind === "checkpoint" ? "♜" : "★"}</span></button><div class="node-label"><strong>${esc(l.name)}</strong>${l.complete ? `<span>${"●".repeat(l.complete.best)}${"○".repeat(5 - l.complete.best)}</span>` : l.current ? `<span class="next-ready">${completedNotice ? "Unlocked!" : "Start here"}</span>` : ""}</div></div>`).join("")}</div></section>`).join("")}<div class="course-finish">${btn("↻ Review", "review", "primary")}</div></section><aside class="academy-sidebar"><div class="path-rook">${coach()}${btn(glyph("hear"), "hear-unit", "text", 'aria-label="Hear Rook explain this unit"')}</div><details class="practice-level"><summary>Practice settings</summary><label for="chess-band">Challenge</label><select id="chess-band"><option value="stretch" ${profile.settings.band !== "guided" ? "selected" : ""}>Stretch</option><option value="guided" ${profile.settings.band === "guided" ? "selected" : ""}>Guided</option></select></details>${btn("↻ Review", "review")}</aside></div>`;
  }
  function lessonView() {
    const s = profile.session;
    if (!s) return pathView();
    const u = currentUnit(),
      l = lessonFor(s.lesson),
      title = l?.name || "Review";
    if (s.phase === "intro")
      return `<section class="lesson-intro">${coach()}<h1>${title}</h1>${btn("▶", "begin", "primary large", 'aria-label="Start the puzzles"')}${btn(glyph("hear"), "hear", "text", 'aria-label="Hear the idea"')}</section>`;
    if (s.phase === "summary")
      return `<section class="lesson-summary">${coach("happy")}<h1>Lesson complete!</h1><div class="summary-stars" aria-label="${s.results.length} positions completed, ${s.results.filter((r) => r.independent).length} without help">${s.results.map((r) => r.independent ? "★" : "☆").join(" ")}</div>${btn("Continue ➜", "path", "primary large")}<details><summary>Practice notes</summary><p>${s.results.filter((r) => r.independent).length} of ${s.results.length} without hints.</p><p>${u.idea}</p></details></section>`;
    const f = s.feedback,
      solved = s.phase === "solved";
    return `<section class="chess-lesson"><header class="lesson-header">${iconButton("close", "path", "Back to lesson path")}<div class="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuenow="${s.index + (solved ? 1 : 0)}" aria-valuemin="0" aria-valuemax="${s.total}"><span style="width:${((s.index + (solved ? 1 : 0)) / s.total) * 100}%"></span></div>${btn(glyph(profile.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header><div class="play-table ${solved ? "solved" : ""}">${arenaHead(shortPrompt(), solved ? "happy" : f?.kind === "incorrect" ? "thinking" : "idle")}<div id="chess-board"></div><div id="board-selection" class="sr-only" aria-live="polite"></div><footer class="board-controls">${iconButton("undo", "restart", "Restart this position", solved ? "disabled" : "")}${solved ? btn("➜", "next", "primary next-puzzle", `aria-label="${s.index + 1 === s.total ? "Finish lesson" : "Next position"}"`) : `<div class="hint-control">${btn(glyph("hint") + "<span>Hint</span>", "hint", "hint-button", s.hints >= 3 ? 'disabled aria-label="All hints shown"' : 'aria-label="Get a hint"')}<span class="hint-dots" aria-label="${s.hints} of 3 hints used">${[1, 2, 3].map((n) => `<i class="${s.hints >= n ? "on" : ""}"></i>`).join("")}</span></div>`}<details class="board-more"><summary aria-label="More options">•••</summary><div>${f?.refutation ? btn(analysisView ? "Back to puzzle" : "See the reply", "explain", "text") : ""}<p>${esc(title)}</p><p>${esc(s.puzzle.goal)}</p>${solved ? `<ol>${s.solution.map((m) => `<li>${esc(m.text)}</li>`).join("")}</ol>` : ""}<small>Lichess ${s.puzzle.id} · CC0</small></div></details></footer></div></section>`;
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
    return `<section class="practice-lobby"><div class="practice-heading"><div><h1>Play with Rook</h1></div>${coach()}</div><label class="opponent-select">Rook’s playing strength <select id="chess-strength"><option value="friendly" ${profile.settings.strength === "friendly" ? "selected" : ""}>Friendly</option><option value="club" ${profile.settings.strength === "club" ? "selected" : ""}>Club</option><option value="challenge" ${profile.settings.strength === "challenge" ? "selected" : ""}>Challenge</option></select></label><div class="practice-cards"><article><div class="practice-preview">${miniBoard(profile.session?.puzzle?.startFen || "4r1k1/pp3ppp/2p2n2/3p4/3P4/2PB1N2/PP3PPP/4R1K1 w - - 0 1")}</div><h2>Position game</h2>${profile.session?.puzzle ? btn("Play this position", "position:" + profile.session.puzzle.id, "primary") : btn("Explore a lesson first", "path", "primary")}</article><article><div class="practice-preview">${miniBoard()}</div><h2>Full game</h2><div>${btn("Play White", "full:w", "primary")}${btn("Play Black", "full:b")}</div></article></div>${profile.game ? `<div class="resume-strip"><span>${profile.game.result || "Your practice game is saved."}</span>${btn("Return to board →", "game", "primary")}</div>` : ""}<p class="fine-print">The opponent runs locally with Stockfish. These strength settings are practice choices, not a measurement of your rating.</p></section>`;
  }
  function gameView() {
    const g = profile.game;
    if (!g) return playView();
    return `<section class="chess-lesson practice-game"><header class="lesson-header">${iconButton("close", "play", "Back to practice games")}<span class="game-title">${g.mode === "position" ? `${g.turns} / ${g.target}` : "Rook"}</span>${btn(glyph(profile.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header><div class="play-table">${arenaHead(g.result || "Your move", g.result ? "happy" : "idle")}<div id="chess-board"></div><div id="board-selection" class="sr-only" aria-live="polite"></div><footer class="board-controls">${iconButton("undo", "game-undo", "Take back a turn", g.turns < 1 ? "disabled" : "")}${g.result ? btn("➜", "play", "primary next-puzzle", 'aria-label="Choose another game"') : btn(glyph("hint") + "<span>Hint</span>", "game-hint", "hint-button", 'aria-label="Get a hint"')}<details class="board-more"><summary aria-label="More options">•••</summary><div>${btn("Choose another game", "play", "text")}<p>${gameNotation(g)}</p><p>${esc(g.assessment || "")}</p></div></details></footer></div></section>`;
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
            if (view === "path") scrollPath();
            else window.scrollTo(0, 0);
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
            scrollPath(unit);
            return;
          }
          if (action === "captions") {
            captions = !captions;
            render();
            return;
          }
          if (action === "hear-unit") {
            say(UNITS[arg === undefined ? unit : +arg].idea, { force: true });
            return;
          }
          if (action === "hear") {
            say(
              analysisView
                ? VOICE.alternative
                : view === "game"
                  ? (profile.game?.hint ? VOICE.gameHint : null) ||
                    "What is your opponent threatening? Check that before choosing your next move."
                  : profile.session?.feedback?.voice || currentUnit().cue,
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
            if (action === "lesson" && pathProgress(profile).find(l => l.id === arg)?.locked) return;
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
            if (!pending && profile.session?.phase === "intro")
              await send("begin");
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
    clearTimeout(finishTimer);
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
