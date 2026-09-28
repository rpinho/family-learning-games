import {fetchJSON} from '../save-request.mjs';
import {requestChess} from './request.mjs';
import {FOUNDATION_UNITS,FOUNDATION_VOICE} from './foundations-curriculum.mjs';
import {drawTeachingOverlay,forkTitleIcon,demonstrationMoves} from './teaching.mjs';
import {STEP_UNITS,STEP_VOICE} from './steps-curriculum.mjs';
import { createCoachAudio } from './audio.mjs';
import { UNITS, LESSONS, lessonFor, NAMES, VOICE, unitsForBand } from "./curriculum.mjs";
import { coach, piece } from "./art.mjs";
import { mountBoard } from "./board.mjs";
import { Chess } from "./rules.mjs";
import { narrationFor, createNarrationGate } from "./narration.mjs";
import { pathProgress, shortPracticeLesson } from "./path.mjs";
import { MATCH_VOICE } from "./match-voice.mjs";
import { createBanterPicker, captureReaction } from "./banter.mjs";
import { wordBreak, fetchWordLevel, onceThisSession, DEFAULT_TRACK } from "../word-break.mjs";
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
    exampleView = false,
    voiceManifest = {},
    captions = false,
    reaction = "idle",
    finishTimer = null,
    completedNotice = "",
    matchReplay = null,
    recapRunning = null,
    performanceLine = "",
    receivedAt = Date.now();
  const priorScrollRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  const endpoint = "/api/chess?player=" + encodeURIComponent(player);
  const voice=createCoachAudio({event,talking:on=>root.querySelector('.academy-coach')?.classList.toggle('talking',on)});
  let entryCuePending=true;
  const unlockVoice=(event)=>{
    voice.unlock();
    if(!entryCuePending||!profile)return;
    entryCuePending=false;
    if(view==='lesson'&&!event.target.closest('[data-do]'))queueMicrotask(()=>say(profile.session?.phase==='intro'?FOUNDATION_VOICE.ready:currentUnit().cue,{kind:'task'}));
    const g=profile.match?.game;
    if(view==='match'&&g&&!g.result&&g.turns>0&&onceThisSession('chess-match-resume:'+g.id))queueMicrotask(()=>playLine(MATCH_VOICE.resume));
  };
  root.addEventListener('pointerdown',unlockVoice,{capture:true});
  root.addEventListener('keydown',unlockVoice,{capture:true});
  const utterance = () => {speechGeneration++;voice.stop();};
  let manifestReady=false;
  let voiceReady = fetch("/chess-voice/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => (voiceManifest = m.clips || {}, manifestReady=true))
      .catch(() => {}),
    speechGeneration = 0;
  const allowNarration = createNarrationGate();
  const pickBanter = createBanterPicker();
  let captureReacted = false, lastReactionSpeech = -Infinity;
  const captureKinds = new Set(), captureTurns = {};
  void voiceReady.then(()=>voice.warm(['youQueen','meQueen','youCapture','meCapture','trade','youCheck','meCheck','pounce','good']
    .flatMap(kind=>MATCH_VOICE[kind]).map(text=>voiceManifest[text])));
  async function say(text, { force = false, kind = "automatic" } = {}) {
    if ((!profile?.settings.sound && !force) || !text) return;
    if (!allowNarration(text, { force, kind, scope: profile.session?.id || "practice" })) return;
    utterance();
    const generation = speechGeneration;
    if(!manifestReady)await voiceReady;
    if (!alive || generation !== speechGeneration) return;
    const source = voiceManifest[text];
    if (!source) {
      event("chess_voice_unavailable", "missing original clip");
      return;
    }
    voice.play(source);
    performanceLine = text;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function playLine(text, { force = false, automatic = false, priority = false } = {}) {
    const requestedAt=Date.now();
    if ((!profile?.settings.sound && !force) || !text) return false;
    if(automatic&&!priority&&(Date.now()-lastReactionSpeech<5000||voice.isPlaying()))return false;
    if(automatic)lastReactionSpeech=Date.now();
    utterance();
    const generation = speechGeneration;
    if (!manifestReady) await voiceReady;
    if (!alive || generation !== speechGeneration) return false;
    if(automatic&&Date.now()-requestedAt>1200)return false;
    const source = voiceManifest[text];
    if (!source) { event("chess_voice_unavailable", "missing original clip"); return false; }
    voice.play(source,{maxStartDelayMs:automatic?1200:0});
    performanceLine = text;
    return true;
  }
  async function waitVoice(min = 600) {
    const start = Date.now();
    do await sleep(150);
    while (alive && (Date.now() - start < min || (voice.isPlaying() && Date.now() - start < 9000)));
  }
  async function lineThenWait(text) {
    if (await playLine(text)) await waitVoice();
    else await sleep(900);
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
      const data = await fetchJSON(endpoint,{},8000);
      if(!alive)return;
      profile = data.profile;
      receivedAt = Date.now();
      const active = profile.session;
      if (profile.current === "match" && profile.match?.game && !profile.match.game.acknowledged) {
        view = "match";
      } else if (profile.current === "game" && profile.game) {
        view = "game";
      } else if (active && !["summary"].includes(active.phase)) {
        view = "lesson";
        unit = lessonFor(active.lesson)?.unit || 0;
      } else {
        view = "path";
        const next = pathProgress(profile).find((l) => l.current);
        unit = next?.unit || 0;
      }
      error = "";
      render();
      if (view === "path") scrollPath();
      else window.scrollTo(0, 0);
      queueLessonFinish();
    } catch (e) {
      if(!alive)return;
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
    exampleView = false;
    utterance();
    captureReacted = false;
    performanceLine = "";
    captureKinds.clear();
    const body = pending;
    const moving = ["move", "game-move", "match-move"].includes(body.type) && boardDispose;
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
        const data = await requestChess(endpoint, body, profile, {active:()=>alive});
        if (preview) await preview;
        if (alive && data.result?.correct === false && data.result.attempted) {
          react("retry");
          await boardDispose?.rollback?.();
        } else if (alive && data.result?.moves) {
          const rest = preview ? data.result.moves.slice(1) : data.result.moves;
          // The opponent takes a short breath before answering, like a real player.
          if (body.type === "match-move" && rest.length) await sleep(450);
          await boardDispose?.animate?.(rest);
        }
        const newlyCompleted = body.type === "next" && profile.session?.lesson !== "review" && !profile.completed[profile.session?.lesson];
        profile = data.profile;
        receivedAt = Date.now();
        pending = null;
        if (!alive) return;
        if (body.type === "start" || body.type === "begin" || data.result?.levelChanged) {view = "lesson";unit=lessonFor(profile.session?.lesson)?.unit||0;}
        if (body.type === "game-start") view = "game";
        if (body.type.startsWith("match-")) view = "match";
        if (body.type === "next" && profile.session?.phase === "summary") {
          completedNotice = newlyCompleted ? profile.session.lesson : "";
          view = "path";
        }
        busy = false;
        const matchKind = body.type === 'match-move' ? profile.match?.game?.react?.kind : null;
        reaction = captureReacted && body.type === 'match-move' && !profile.match?.game?.result ? 'idle' :
          data.result?.correct === false
            ? "retry"
            : body.type === 'match-move' && matchKind
              ? ['youQueen', 'youWin', 'scholar'].includes(matchKind)
                ? 'dismay' : ['youCapture', 'youCheck', 'youPromote'].includes(matchKind)
                  ? 'shock' : ['meCapture', 'pounce', 'trade', 'meCheck', 'meWin', 'mePromote'].includes(matchKind)
                  ? 'smug' : 'nod'
            : ["move", "game-move", "match-move"].includes(body.type)
              ? (profile.session?.phase === "solved" && body.type === "move") ||
                (body.type === "game-move" && profile.game?.result)
                ? "celebrate"
                : "nod"
              : "idle";
        render();
        react(reaction);
        if (["start", "begin", "next", "game-start", "match-start", "match-ack"].includes(body.type))
          view === "path" ? scrollPath() : window.scrollTo(0, 0);
        queueLessonFinish();
        if (
          ["move", "game-move", "match-move"].includes(body.type) &&
          data.result?.correct !== false
        )
          clickSound(
            body.type === "move" && profile.session?.phase === "solved",
          );
        if (body.type.startsWith("match-")) void afterMatch(body.type, data.result || {});
        const narration = body.type.startsWith("match-") ? null : narrationFor(body.type, profile, currentUnit().cue);
        if (narration && data.result?.advanced !== false) say(narration.text, { kind: narration.kind });
        else if(!narration){const banter=pickBanter(body.type,profile);if(banter)void playLine(banter,{automatic:true});}
        if(profile.session?.phase==='intro'&&['start','settings'].includes(body.type))say(FOUNDATION_VOICE.ready,{kind:'task'});
        event("chess_action", body.type);
      } catch (e) {
        if (preview) await preview.catch(() => {});
        if (!alive) return;
        error = e.message;
        if(e.latestProfile){
          profile=e.latestProfile;
          receivedAt=Date.now();
          pending=null;
          view=profile.current==='match'&&profile.match?.game&&!profile.match.game.acknowledged?'match':profile.current==='game'&&profile.game?'game':profile.session&&profile.session.phase!=='summary'?'lesson':'path';
          error='Progress updated. Your saved game is ready.';
        }
        busy = false;
        render();
        if(e.latestProfile){
          if(view==='path')scrollPath();else window.scrollTo(0,0);
        }
      } finally {
        busy = false;
      }
    })();
    return inflight;
  }
  function courseUnits(){return unitsForBand(profile?.settings.band);}
  function currentUnit() {
    return [...UNITS,...STEP_UNITS,...FOUNDATION_UNITS].find((u) => u.id === profile?.session?.unit) || courseUnits()[unit] || courseUnits()[0];
  }
  function showingExample(){return view==='lesson'&&profile.session?.example&&(exampleView||profile.session.phase==='intro');}
  function nav() {
    return `<nav class="academy-nav" aria-label="Chess sections"><a href="#" data-do="path" class="academy-brand"><img src="/chess/icon.svg" alt=""> <span>rook<span>academy</span></span></a><div>${btn(`<span class="match-tab-face" aria-hidden="true">${piece("n", "w")}</span><span>Play ${esc(profile?.match?.opponent || "Rook")}</span>`, "match", view === "match" ? "tab match-tab active" : "tab match-tab")}${btn("Lesson path", "path", view === "path" || view === "lesson" ? "tab active" : "tab")}${btn("Practice games", "play", view === "play" || view === "game" ? "tab active" : "tab")}${btn("My notebook", "notebook", view === "notebook" ? "tab active" : "tab")}</div>${btn(glyph(profile?.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile?.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</nav>`;
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
    root.innerHTML = `<div class="academy" style="--unit:${(courseUnits()[unit]||courseUnits()[0]).color}">${nav()}${error ? `<div class="ac-error" role="alert"><strong>${esc(error)}</strong>${pending ? btn("Retry save", "retry", "primary") + btn("Reload progress", "reload") : btn("Continue", "dismiss-error", "primary")}</div>` : ""}<div class="ac-content" ${busy ? 'aria-busy="true"' : ""}>${view === "lesson" ? lessonView() : view === "game" ? gameView() : view === "match" ? matchView() : view === "play" ? playView() : view === "notebook" ? notebookView() : pathView()}</div><div class="ac-saving" role="status">${busy ? "Saving your move…" : ""}</div></div>`;
    bind();
    updateHintClock();
    if (voice.isPlaying())
      root.querySelector(".academy-coach")?.classList.add("talking");
    const mount = root.querySelector("#chess-board");
    if (mount && view === "match" && profile.match?.game) {
      const g = profile.match.game, r = matchReplay;
      const fen = r ? r.fen : g.fen;
      boardDispose = mountBoard(mount, {
        fen,
        side: g.side,
        disabled: busy || !!pending || !!r || !!g.result || new Chess(fen).turn() !== g.side,
        lastMoves: r ? [] : g.lastMoves,
        hintFrom: r ? r.hintFrom : g.hint?.from,
        hintTo: r ? r.hintTo : g.hint?.to,
        showLegalMoves: true,
        onMove: (from, to, promotion) => send("match-move", { from, to, promotion }),
        onMotion: (kind) => {if(!captureReacted || !['nod','think','land','capture'].includes(kind))react(kind);},
        onMoveLanded: matchCaptureLanded,
        onSelect: (text, gaze) => {
          const eyes = root.querySelector(".rook-eyes");
          if (eyes && gaze) eyes.style.transform = `translate(${(gaze.x - .5) * 6}px, ${2 + gaze.y * 3}px)`;
          const el = root.querySelector("#board-selection");
          if (el) el.textContent = text;
        },
      });
    } else if (mount) {
      const s = profile.session,
        g = profile.game,
        inGame = view === "game";
      const example=showingExample()?s.example:null;
      let fen = inGame ? g.fen : example?example.fen:s.puzzle.fen,
        lastMoves = inGame
          ? g.lastMoves
          : example?[]:s.feedback?.moves || s.puzzle.lastMoves.slice(-2);
      if (analysisView && s.feedback?.refutation) {
        const b = new Chess(s.puzzle.fen);
        for (const m of s.feedback.refutation)
          b.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
        fen = b.fen();
        lastMoves = s.feedback.refutation;
      }
      boardDispose = mountBoard(mount, {
        fen,
        side: inGame ? g.side : example ? new Chess(example.fen).turn() : s.puzzle.side,
        disabled:
          busy ||
          !!pending ||
          analysisView || !!example ||
          (inGame ? !!g.result : s.phase !== "puzzle"),
        lastMoves,
        hintKing: inGame || example ? null : s.hintKing,
        hintFrom: inGame ? g.hint?.from : example?example.line[0].slice(0,2):s.hintFrom,
        hintTo: inGame ? g.hint?.to : example?undefined:s.hintTo,
        target: example?example.target:s.puzzle?.target,
        showLegalMoves: inGame || !!example || !s.puzzle?.concealLegalMoves,
        onMove: (from, to, promotion) =>
          send(inGame ? "game-move" : "move", { from, to, promotion }),
        onMotion: (kind) => {
          react(kind);
        },
        onSelect: (text, gaze) => {
          const eyes = root.querySelector(".rook-eyes");
          if (eyes && gaze) eyes.style.transform = `translate(${(gaze.x - .5) * 6}px, ${2 + gaze.y * 3}px)`;
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
      "react-shock",
      "react-dismay",
      "react-smug",
    );
    if (!kind || kind === "idle" || kind === "land") return;
    void puppet.getBoundingClientRect();
    puppet.classList.add("react-" + kind);
    if (kind === "celebrate" && view === "lesson") void boardDispose?.celebrate?.();
  }
  function matchCaptureLanded(move,{preview}){
    const g=profile.match?.game;
    const r=captureReaction(move,g?.side);
    if(!r)return;
    captureReacted=true;reaction=r.mood;react(r.mood);
    event('chess_capture_reaction',JSON.stringify({kind:r.kind,preview,move:move.from+move.to}));
    if(profile.settings.coachChatter!=='lively')return;
    captureKinds.add(r.kind);
    const lines=MATCH_VOICE[r.kind],i=captureTurns[r.kind]??0;
    captureTurns[r.kind]=i+1;
    void playLine(lines[i%lines.length],{automatic:true,priority:r.priority});
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
    if(performanceLine)return performanceLine;
    if (view === "match") {
      const g = profile.match?.game;
      return matchReplay?.caption || g?.hint?.voice || g?.react?.line || MATCH_VOICE.howTo;
    }
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
    if (s?.feedback?.reason === "unsafe-check") return "Keep it safe";
    if (s?.feedback?.kind === "incorrect") return "Try again";
    if (s?.hint?.stage >= 3) return "Follow the arrow";
    if (s?.hint?.stage === 2) return "Tap this piece";
    return s?.puzzle?.task || (s?.ply > 0 ? "Keep going" : currentUnit().task);
  }
  function hintControls(inGame = false) {
    const h = inGame ? profile.game?.hint : profile.session?.hint;
    const stage = h?.stage ?? (inGame && h ? 3 : 0);
    return `<div class="hint-control">${stage >= 3
      ? btn('▶<span>Show me</span>', 'demonstrate', 'hint-button', 'aria-label="Watch the suggested move"')
      : btn(glyph('hint') + '<span>Hint</span>', inGame ? 'game-hint' : 'hint', 'hint-button', 'data-paced-hint aria-label="Get a hint"')}
      <span class="hint-dots" aria-label="${stage} of 3 hint stages">${[1,2,3].map(n=>`<i class="${stage >= n ? 'on' : ''}"></i>`).join('')}</span></div>`;
  }
  function updateHintClock() {
    if (!alive || !profile) return;
    const h = view === 'game' ? profile.game?.hint : profile.session?.hint;
    const left = Math.max(0, (h?.waitMs || 0) - (Date.now() - receivedAt));
    const button = root.querySelector('[data-paced-hint]');
    if (!button) return;
    button.disabled = busy || !!pending || left > 0;
    const label = left > 0 ? `${Math.ceil(left/1000)}s` : h?.stage ? 'More help' : 'Hint';
    button.querySelector('span').textContent = label;
    button.setAttribute('aria-label', left > 0 ? `Next hint in ${Math.ceil(left/1000)} seconds. You can still move or replay Rook.` : label);
  }
  const hintClock = setInterval(updateHintClock, 200);
  async function demonstrationBeat() {
    // Let the requested sentence finish, without hanging if media fails or navigation cancels it.
    const start = Date.now();
    do { await new Promise(resolve=>setTimeout(resolve,150)); }
    while (alive && (Date.now()-start < 750 || voice.isPlaying() && Date.now()-start < 8000));
  }
  function lockDemonstration() {
    boardDispose?.lock(true);
    root.querySelectorAll('[data-do]').forEach(el=>el.disabled=true);
  }
  function examplePrompt(title, words) {
    root.querySelector('.arena-prompt h1').textContent=title;
    const caption=root.querySelector('.spoken-caption, .arena-coach + .sr-only');
    if(caption)caption.textContent=words;
  }
  async function playExample(){
    if(busy||pending||!profile.session?.example)return;
    exampleView=true;render();let board=boardDispose;
    if(!board)return;
    busy=true;lockDemonstration();
    const example=profile.session.example;
    try{
      if(example.contrast){
        examplePrompt('Can they take it?',STEP_VOICE.unsafeExample);
        await say(STEP_VOICE.unsafeExample,{force:true});
        react("think");
        for(const move of example.contrast.line){
          await board.animate([move],{feedback:false});
          if(!alive)return;
          await new Promise(resolve=>setTimeout(resolve,450));
        }
        react("retry");
        await demonstrationBeat();
        if(!alive)return;
        render();board=boardDispose;lockDemonstration();
        examplePrompt('Check safely',STEP_VOICE.safeExample);
        await say(STEP_VOICE.safeExample,{force:true});
      }else await say(currentUnit().idea,{force:true});
      for(const {uci:move,board:exampleBoard,move:played,learner} of demonstrationMoves(example)){
        await board.animate([move]);
        if(!alive)return;
        root.querySelectorAll('.demo-target').forEach(el=>el.classList.remove('demo-target'));
        if(learner)drawTeachingOverlay(root,exampleBoard,played,example);
        if(learner)for(const target of exampleBoard.board().flat().filter(p=>p&&p.color!==played.color&&['k','q','r'].includes(p.type)&&exampleBoard.attackers(p.square,played.color).includes(played.to)))root.querySelector(`[data-square="${target.square}"]`)?.classList.add('demo-target');
        await demonstrationBeat();
      }
    }finally{
      busy=false;
      if(alive){await say(FOUNDATION_VOICE.yourTurn,{kind:'task'});root.querySelectorAll('[data-do]').forEach(el=>el.disabled=false);const title=root.querySelector('.arena-prompt h1');
        if(root.querySelector('.fork-diagram')){title.innerHTML=forkTitleIcon()+'Fork · two targets';}else title.textContent='Now you try';}
    }
  }
  async function explainUnsafeCheck() {
    const line=profile.session?.feedback?.refutation;
    if(busy||pending||!line)return;
    busy=true;lockDemonstration();
    try {
      await say(STEP_VOICE.unsafeCheck,{force:true});
      react("think");
      for(const move of line){
        await boardDispose.animate([move],{feedback:false});
        if(!alive)return;
        await new Promise(resolve=>setTimeout(resolve,450));
      }
      react("retry");
      await demonstrationBeat();
    }finally{busy=false;if(alive)render();}
  }
  async function demonstrate() {
    const s = profile.session, g = profile.game, inGame = view === 'game';
    const from = inGame ? g.hint?.from : s.hintFrom;
    const to = inGame ? g.hint?.to : s.hintTo;
    if (!from || !to || busy || pending || !boardDispose) return;
    const board = boardDispose;
    busy = true;
    root.querySelectorAll('[data-do]').forEach(el => el.disabled = true);
    board.lock(true);
    try {
      const position = new Chess(inGame ? g.fen : s.puzzle.fen);
      const promotion = (inGame ? g.hint?.promotion : s.hintPromotion) || position.moves({verbose:true}).find(m => m.from === from && m.to === to)?.promotion || '';
      say(inGame ? VOICE.gameHint : VOICE.hintMove, {force:true});
      await board.preview(from + to + promotion);
      await new Promise(resolve => setTimeout(resolve, 650));
      if (alive) await board.rollback();
    } finally {
      busy = false;
      if (alive) render();
    }
  }
  function arenaHead(status, mood = "idle", name = "Rook") {
    return `<div class="arena-coach"><button class="rook-replay" data-do="hear" aria-label="Hear ${esc(name)} again">${coach(mood)}<span class="speaker-badge" aria-hidden="true">${glyph("hear")}</span></button><div class="arena-prompt" aria-live="polite"><span class="feedback-symbol" aria-hidden="true">${mood === "happy" ? "✓" : mood === "thinking" ? "↶" : ""}</span><h1>${esc(status)}</h1></div><div class="caption-control">${iconButton("captions", "captions", captions ? "Hide captions" : "Show captions", `aria-pressed="${captions}"`)}</div></div>${captions ? `<div class="spoken-caption" aria-live="polite">${esc(spokenText())}</div>` : `<div class="sr-only" aria-live="polite">${esc(spokenText())}</div>`}`;
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
    const shortPractice = shortPracticeLesson(profile);
    return `<div class="academy-layout continuous-layout ${['steps','foundations'].includes(profile.settings.band)?'small-steps-path':''}"><section class="academy-path" aria-label="Chess learning path">${profile.session && profile.session.phase !== "summary" ? `<div class="resume-strip">${btn("Continue ➜", "resume", "primary")}</div>` : progress.some(l=>l.current) ? `<div class="resume-strip">${btn("Continue ➜", "lesson:"+progress.find(l=>l.current).id, "primary")}</div>` : ""}${courseUnits().map((u, ui) => `<section class="path-unit" data-unit="${ui}" aria-label="Unit ${ui + 1}: ${esc(u.name)}" style="--unit-color:${u.color}"><header class="unit-heading"><div><small>UNIT ${ui + 1}</small><h2>${esc(u.name)}</h2></div>${btn(glyph("hear"), "hear-unit:" + ui, "text", `aria-label="Hear unit ${ui + 1}"`)}</header><div class="lesson-path">${['steps','foundations'].includes(profile.settings.band)?'<svg viewBox="0 0 440 330" preserveAspectRatio="none" aria-hidden="true" class="path-track"><path d="M220 50C380 80 375 165 235 174S70 240 148 280"/></svg>':'<svg viewBox="0 0 440 660" preserveAspectRatio="none" aria-hidden="true" class="path-track"><path d="M220 50C380 80 375 165 235 174S70 240 148 280S360 340 270 405S70 460 157 516S285 575 220 620"/></svg>'}${progress.filter(l => l.unit === ui).map((l, i) => `<div class="path-stop stop-${i} ${l.current ? "current" : ""}"><button class="path-node ${l.complete ? "complete" : ""} ${l.current ? "current" : ""} ${l.locked ? "locked" : ""}" data-do="lesson:${l.id}" ${l.locked ? "disabled" : ""} ${l.current ? 'aria-current="step"' : ""} aria-label="${l.locked ? "Locked" : l.complete ? "Review" : "Start"} ${esc(l.name)}"><span>${l.locked ? glyph("lock") : l.complete ? "✓" : l.kind === "checkpoint" ? "♜" : "★"}</span></button><div class="node-label"><strong>${esc(l.name)}</strong>${l.complete ? `<span>${"●".repeat(l.complete.best)}${"○".repeat(Math.max(0,(l.complete.bestTotal||5) - l.complete.best))}</span>` : l.current ? `<span class="next-ready">${completedNotice ? "Unlocked!" : "Start here"}</span>${shortPractice ? btn("Short practice", "lesson:"+shortPractice.id, "short-practice", 'aria-label="Try an unseen short lesson"') : ""}` : ""}</div></div>`).join("")}</div></section>`).join("")}<div class="course-finish">${shortPractice&&!progress.some(l=>l.current) ? btn("Short practice", "lesson:"+shortPractice.id, "short-practice", 'aria-label="Try an unseen short lesson"') : ""}${btn("↻ Review", "review", "primary")}</div></section><aside class="academy-sidebar"><div class="path-rook">${coach()}${btn(glyph("hear"), "hear-unit", "text", 'aria-label="Hear Rook explain this unit"')}</div><details class="practice-level"><summary>Practice settings</summary><label for="chess-band">Challenge</label><select id="chess-band"><option value="foundations" ${profile.settings.band === "foundations" ? "selected" : ""}>First moves</option><option value="steps" ${profile.settings.band === "steps" ? "selected" : ""}>Small steps</option><option value="stretch" ${profile.settings.band === "stretch" ? "selected" : ""}>Stretch</option><option value="guided" ${profile.settings.band === "guided" ? "selected" : ""}>Guided</option></select></details>${btn("↻ Review", "review")}</aside></div>`;
  }
  function lessonView() {
    const s = profile.session;
    if (!s) return pathView();
    const u = currentUnit(),
      l = lessonFor(s.lesson),
      title = l?.name || "Review";
    if(showingExample())return `<section class="chess-lesson small-step-lesson example-lesson"><header class="lesson-header">${iconButton('close','path','Back to lesson path')}<span class="example-badge">Watch → Try</span></header><div class="play-table">${arenaHead('Watch Rook')}<div id="chess-board"></div><div id="board-selection" class="sr-only"></div><footer class="board-controls">${btn('▶ Watch','example','hint-button','aria-label="Watch Rook demonstrate"')}${btn('Your turn ➜','example-done','primary','aria-label="Try a different board yourself"')}</footer></div></section>`;
    if (s.phase === "intro")
      return `<section class="lesson-intro">${coach()}<h1>${title}</h1>${btn("▶", "begin", "primary large", 'aria-label="Start the puzzles"')}${btn(glyph("hear"), "hear", "text", 'aria-label="Hear the idea"')}</section>`;
    if (s.phase === "summary")
      return `<section class="lesson-summary">${coach("happy")}<h1>Lesson complete!</h1><div class="summary-stars" aria-label="${s.results.length} positions completed, ${s.results.filter((r) => r.independent).length} without help">${s.results.map((r) => r.independent ? "★" : "☆").join(" ")}</div>${btn("Continue ➜", "path", "primary large")}<details><summary>Practice notes</summary><p>${s.results.filter((r) => r.independent).length} of ${s.results.length} without hints.</p><p>${u.idea}</p></details></section>`;
    const f = s.feedback,
      solved = s.phase === "solved";
    return `<section class="chess-lesson ${['steps','foundations'].includes(s.band)?'small-step-lesson':''}"><header class="lesson-header">${iconButton("close", "path", "Back to lesson path")}<div class="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuenow="${s.index + (solved ? 1 : 0)}" aria-valuemin="0" aria-valuemax="${s.total}"><span style="width:${((s.index + (solved ? 1 : 0)) / s.total) * 100}%"></span></div>${btn(glyph(profile.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header><div class="play-table ${solved ? "solved" : ""}">${arenaHead(shortPrompt(), solved ? "happy" : f?.kind === "incorrect" ? "thinking" : "idle")}<div id="chess-board"></div><div id="board-selection" class="sr-only" aria-live="polite"></div><footer class="board-controls">${iconButton("undo", "restart", "Restart this position", solved ? "disabled" : "")}${solved ? btn("➜", "next", "primary next-puzzle", `aria-label="${s.index + 1 === s.total ? "Finish lesson" : "Next position"}"`) : hintControls()}${!solved&&f?.reason==='unsafe-check'?btn("▶ Why?","unsafe-check","text unsafe-explain",'aria-label="Watch why this check is unsafe"'):!solved&&s.example&&s.errors>=2?btn("▶ Rook","example","text",'aria-label="Watch a similar example"'):""}<details class="board-more"><summary aria-label="More options">•••</summary><div>${f?.refutation ? btn(analysisView ? "Back to puzzle" : "See the reply", "explain", "text") : ""}<p>${esc(title)}</p><p>${esc(s.puzzle.goal)}</p>${solved ? `<ol>${s.solution.map((m) => `<li>${esc(m.text)}</li>`).join("")}</ol>` : ""}<small>${s.puzzle.original?"Original practice position":`Lichess ${s.puzzle.sourceId || s.puzzle.id} · CC0`}</small></div></details></footer></div></section>`;
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
    return `<section class="practice-lobby"><div class="practice-heading"><div><h1>Practice games</h1></div>${coach()}</div><label class="opponent-select">Rook’s playing strength <select id="chess-strength"><option value="friendly" ${profile.settings.strength === "friendly" ? "selected" : ""}>Friendly</option><option value="club" ${profile.settings.strength === "club" ? "selected" : ""}>Club</option><option value="challenge" ${profile.settings.strength === "challenge" ? "selected" : ""}>Challenge</option></select></label><div class="practice-cards"><article><div class="practice-preview">${miniBoard(profile.session?.puzzle?.startFen || "4r1k1/pp3ppp/2p2n2/3p4/3P4/2PB1N2/PP3PPP/4R1K1 w - - 0 1")}</div><h2>Position game</h2>${profile.session?.puzzle ? btn("Play this position", "position:" + profile.session.puzzle.id, "primary") : btn("Explore a lesson first", "path", "primary")}</article><article><div class="practice-preview">${miniBoard()}</div><h2>Full game</h2><div>${profile.settings.strength === "friendly" ? btn(`Play ${esc(profile.match?.opponent || "Rook")} ➜`, "match", "primary") : btn("Play White", "full:w", "primary") + btn("Play Black", "full:b")}</div></article></div>${profile.game ? `<div class="resume-strip"><span>${profile.game.result || "Your practice game is saved."}</span>${btn("Return to board →", "game", "primary")}</div>` : ""}<p class="fine-print">The opponent runs locally with Stockfish. These strength settings are practice choices, not a measurement of your rating.</p></section>`;
  }
  function gameView() {
    const g = profile.game;
    if (!g) return playView();
    return `<section class="chess-lesson practice-game"><header class="lesson-header">${iconButton("close", "play", "Back to practice games")}<span class="game-title">${g.mode === "position" ? `${g.turns} / ${g.target}` : "Rook"}</span>${btn(glyph(profile.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header><div class="play-table">${arenaHead(g.result || (g.hint?.stage === 3 ? "Follow the arrow" : g.hint?.stage === 2 ? "Tap this piece" : "Your move"), g.result?.includes("you win") ? "thinking" : g.result ? "happy" : "idle")}<div id="chess-board"></div><div id="board-selection" class="sr-only" aria-live="polite"></div><footer class="board-controls">${iconButton("undo", "game-undo", "Take back a turn", g.turns < 1 ? "disabled" : "")}${g.result ? btn("➜", "play", "primary next-puzzle", 'aria-label="Choose another game"') : hintControls(true)}<details class="board-more"><summary aria-label="More options">•••</summary><div>${btn("Choose another game", "play", "text")}<p>${gameNotation(g)}</p><p>${esc(g.assessment || "")}</p></div></details></footer></div></section>`;
  }
  // ---- Full games against the coach ----
  const sideName = (c) => (c === "w" ? "White" : "Black");
  const REASON = { checkmate: "checkmate", resign: "resigned", stalemate: "stalemate", repetition: "repetition", insufficient: "not enough pieces", fifty: "50 quiet moves", limit: "long game", abandoned: "left unfinished" };
  function matchTitle(g, name) {
    const r = g.result;
    if (r.kind === "win") return r.reason === "checkmate" ? "Checkmate! You won!" : "You won!";
    if (r.kind === "loss") return r.reason === "resign" ? "Good game" : `${name} won`;
    return `Draw · ${REASON[r.reason] || "draw"}`;
  }
  function ratingLine(r) {
    const d = r.ratingAfter - r.ratingBefore;
    return `Your rating ${r.ratingBefore} → <strong>${r.ratingAfter}</strong> ${d > 0 ? `<b class="up">▲ ${d}</b>` : d < 0 ? `<b class="down">▼ ${-d}</b>` : ""}`;
  }
  function matchLobby() {
    const M = profile.match, name = esc(M.opponent);
    return `<section class="match-lobby"><div class="match-hero">${coach("happy")}<div><span class="ac-eyebrow">A REAL GAME</span><h1>Play ${name}</h1><p>A whole game, start to finish.</p></div></div><div class="match-stats"><div><small>Your rating</small><strong>${M.rating}</strong></div><div><small>Wins</small><strong>${M.record.win}</strong></div><div><small>Losses</small><strong>${M.record.loss}</strong></div><div><small>Draws</small><strong>${M.record.draw}</strong></div></div><div class="match-play">${btn("Play ➜", "match-start", "primary large")}<p>You play <strong>${sideName(M.nextSide)}</strong> this game.</p></div>${M.history.length ? `<section class="recent-lessons"><h2>Recent games</h2>${M.history.slice().reverse().map((h) => `<div><span>${h.kind === "win" ? "Won" : h.kind === "loss" ? "Lost" : "Draw"} · ${sideName(h.side)} · ${esc(REASON[h.reason] || "")}</span><strong>${h.ratingAfter}${h.ratingAfter > h.ratingBefore ? " ▲" : h.ratingAfter < h.ratingBefore ? " ▼" : ""}</strong></div>`).join("")}</section>` : ""}<p class="match-more">${btn("Position practice and stronger opponents", "practice", "text")}</p><p class="fine-print">${name} plays on this computer and adjusts after each game: a little harder after you win, a little easier after you lose.</p></section>`;
  }
  function matchView() {
    const M = profile.match, g = M?.game;
    if (!g || (g.result && g.acknowledged)) return matchLobby();
    const name = M.opponent, b = new Chess(g.fen), myTurn = !g.result && b.turn() === g.side;
    const status = matchReplay ? matchReplay.title : g.result ? matchTitle(g, name) : !myTurn ? `${name} is thinking…`
      : g.hint?.to ? "Follow the arrow" : g.hint?.from ? "Look at this piece" : g.hint ? "Here is an idea" : b.isCheck() ? "Check! Save your king" : "Your move";
    const mood = g.result ? (g.result.kind === "win" ? "thinking" : g.result.kind === "loss" ? "happy" : "idle") : g.react?.kind === "pounce" ? "thinking" : "idle";
    const stage = g.hint?.stage || 0;
    const controls = g.result
      ? `${g.recap ? btn('▶ <span>Look at this moment</span>', "match-moment", "hint-button", 'aria-label="Watch one important moment again"') : ""}${btn("Continue ➜", "match-continue", "primary")}`
      : `${btn("↶ <span>Undo</span>", "match-undo", "undo-button", `aria-label="Take back your last move (${g.undoLeft} left)" ${g.undoLeft < 1 || !g.turns ? "disabled" : ""}`)}<div class="hint-control">${btn(glyph("hint") + `<span>${stage ? "More help" : "Hint"}</span>`, "match-hint", "hint-button", `aria-label="Get a hint" ${stage >= g.maxHint ? "disabled" : ""}`)}<span class="hint-dots" aria-label="${stage} of ${g.maxHint} hint steps">${[1, 2].map((n) => `<i class="${stage >= n ? "on" : ""}"></i>`).join("")}</span></div><details class="board-more"><summary aria-label="More options">•••</summary><div>${btn("Resign", "match-resign", "text")}<p>${gameNotation(g)}</p></div></details>`;
    return `<section class="chess-lesson practice-game match-game ${g.result ? "match-over" : ""}"><header class="lesson-header">${iconButton("close", "match-leave", "Back to lessons")}<span class="game-title">${g.result ? `<span class="match-result">${ratingLine(g.result)}</span>` : `${esc(name)} · you play ${sideName(g.side)}`}</span>${btn(glyph(profile.settings.sound ? "hear" : "muted"), "sound", "sound", `aria-label="${profile.settings.sound ? "Mute coaching" : "Enable coaching"}"`)}</header><div class="play-table">${arenaHead(status, mood, name)}<div id="chess-board"></div><div id="board-selection" class="sr-only" aria-live="polite"></div><footer class="board-controls">${controls}</footer></div></section>`;
  }
  async function afterMatch(type, result) {
    const g = profile.match?.game;
    if (!g) return;
    if (type === "match-hint") { if (result.advanced !== false) void playLine(g.hint?.voice); return; }
    if (type === "match-start") {
      // How to move is said once per session; the moves themselves need no speech.
      if (onceThisSession("chess-match-howto")) await lineThenWait(MATCH_VOICE.howTo);
      if (alive && profile.match?.game?.id === g.id && !g.turns) void playLine(g.react?.line);
      return;
    }
    if (type === "match-ack") return;
    if (g.result) { void runRecap(g.id); return; }
    // A capture was performed at the actual landing, not after the opponent's
    // animations. Never repeat it here or announce a trade several seconds late.
    if(captureKinds.size&&['youCapture','youQueen','meQueen','meCapture','trade','pounce'].includes(g.react?.kind))return;
    if (g.react?.line) void playLine(g.react.line,{automatic:true});
  }
  // After the game: the result line, one short recap sentence and one replayed moment.
  async function runRecap(id) {
    if (recapRunning) return;
    recapRunning = id;
    try {
      const g = profile.match.game;
      await lineThenWait(g.react?.line);
      if (!alive || view !== "match" || profile.match.game?.id !== id || !g.recap) return;
      await lineThenWait(g.recap.line);
      if (alive && view === "match" && profile.match.game?.id === id) await playMoment();
    } finally { recapRunning = null; }
  }
  async function playMoment() {
    const g = profile.match?.game, mo = g?.recap?.moment;
    if (!mo || busy || pending) return;
    busy = true;
    const lock = () => { boardDispose?.lock(true); root.querySelectorAll("[data-do]").forEach((el) => (el.disabled = true)); };
    try {
      const first = mo.kind === "best" ? MATCH_VOICE.bestWhy : MATCH_VOICE.turnPlayed;
      matchReplay = { fen: mo.fen, title: mo.kind === "best" ? "Your best move" : "The moment it changed", caption: first };
      render(); lock();
      await sleep(500);
      if (!alive || !boardDispose) return;
      void playLine(first);
      await boardDispose.animate([mo.played]);
      matchReplay.title = `You played ${mo.san}`;
      root.querySelector(".arena-prompt h1").textContent = matchReplay.title;
      await waitVoice(1200);
      if (alive && mo.kind === "turn" && mo.better) {
        matchReplay = { fen: mo.fen, title: `Better: ${mo.betterSan || mo.better}`, caption: MATCH_VOICE.turnBetter, hintFrom: mo.better.slice(0, 2), hintTo: mo.better.slice(2, 4) };
        render(); lock();
        void playLine(MATCH_VOICE.turnBetter);
        await sleep(1100);
        if (!alive || !boardDispose) return;
        await boardDispose.animate([mo.better]);
        await waitVoice(1200);
      }
      await sleep(900);
    } finally {
      busy = false;
      matchReplay = null;
      if (alive && view === "match") render();
    }
  }
  // The shared end-of-game word break, in the coach's voice, then the lobby.
  async function matchContinue() {
    const g = profile.match?.game;
    if (!g?.result || busy || pending) return;
    utterance();
    busy = true;
    let answer = null;
    try {
      const level = await fetchWordLevel("/api/word-break?player=" + encodeURIComponent(player), DEFAULT_TRACK[player] || "mixed");
      if (!alive) return;
      answer = await wordBreak({ player, level, reason: "chess-match", effects: () => !!profile.settings.sound,
        speak: (line, essential) => void playLine(line, { force: essential }),
        log: (r) => event("word-break", JSON.stringify(r)) });
    } catch (e) { event("word-break-error", e.message); }
    finally { busy = false; }
    if (!alive) return;
    await send("match-ack", { wordBreak: answer ? { kind: answer.kind, misses: answer.misses } : null });
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
    return `<section class="academy-notebook"><span class="ac-eyebrow">YOUR CHESS NOTEBOOK</span><h1>Ideas you can come back to.</h1><p>Your best independent result stays recorded when you review a lesson.</p>${profile.checkHistory?.length ? `<p>Fresh-position checks: ${profile.checkHistory.filter(c => c.independent).length}/${profile.checkHistory.length} without help. These use a different position with a familiar idea.</p>` : ""}<div class="notebook-grid">${UNITS.map(
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
                `<div><span>${esc(lessonFor(h.lesson)?.name || "Review")} · ${h.band === "foundations" ? "First moves" : h.band === "steps" ? "Small steps" : h.band === "guided" ? "Guided" : "Stretch"}</span><strong>${h.independent}/${h.total} without help</strong></div>`,
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
          if (action === "dismiss-error") { error="";render();return; }
          if (action === "reload") {
            pending = null;
            await load();
            return;
          }
          if (action === "retry") {
            await execute();
            return;
          }
          if (action === "match-leave") {
            view = "path";
            matchReplay = null;
            utterance();
            render();
            scrollPath();
            return;
          }
          if (action === "match-start") { await send("match-start"); return; }
          if (action === "match-moment") { await playMoment(); return; }
          if (action === "match-continue") { await matchContinue(); return; }
          if (action === "match-resign") {
            if (!confirm("Resign this game? It counts as a loss.")) return;
            await send("match-resign");
            return;
          }
          if (["match-hint", "match-undo"].includes(action)) { await send(action); return; }
          if (["path", "play", "notebook", "game", "match", "practice"].includes(action)) {
            // At the easiest level, Practice games opens the adaptive full game first.
            view = action === "practice" ? "play" : action === "play" && profile.settings.strength === "friendly" ? "match" : action;
            utterance();
            render();
            if (view === "path") scrollPath();
            else window.scrollTo(0, 0);
            return;
          }
          if (action === "resume") {
            view = "lesson";
            render();
            say(profile.session?.phase==='intro'?FOUNDATION_VOICE.ready:currentUnit().cue,{kind:'task'});
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
            say((courseUnits()[arg === undefined ? unit : +arg]||courseUnits()[0]).idea, { force: true });
            return;
          }
          if(action==='example'){await playExample();return;}
          if(action==='unsafe-check'){await explainUnsafeCheck();return;}
          if(action==='example-done'){
            exampleView=false;
            if(profile.session.phase==='intro')await send('begin');else {render();say(currentUnit().cue,{kind:'task'});}
            return;
          }
          if (action === "demonstrate") { await demonstrate(); return; }
          if (action === "hear" && view === "match") { void playLine(spokenText(), { force: true }); return; }
          if (action === "hear") {
            say(
              analysisView
                ? VOICE.alternative
                : view === "game"
                  ? (profile.game?.hint?.voice || (profile.game?.hint ? VOICE.gameHint : null)) ||
                    "What is your opponent threatening? Check that before choosing your next move."
                  : profile.session?.feedback?.voice || currentUnit().cue,
              { force: true },
            );
            return;
          }
          if (action === "sound") {
            await send("settings", { sound: !profile.settings.sound });
            if(profile.settings.sound)say(currentUnit().cue,{kind:"task"});
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
            if (!pending && profile.session?.phase === "intro" && !profile.session.example)
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
    clearInterval(hintClock);
    boardDispose?.();
    root.removeEventListener('pointerdown',unlockVoice,{capture:true});
    root.removeEventListener('keydown',unlockVoice,{capture:true});
    utterance();
    voice.dispose();
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
