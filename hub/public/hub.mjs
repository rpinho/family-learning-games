import './audio-scope.mjs';
import {smartHomeGames} from './home-shortcuts.mjs';
import {homePages, homePins, activeNewGames, attachHomeSwipe} from './home-pages.mjs';
import {createMenuCache} from './menu-cache.mjs';
import {fetchJSON} from './save-request.mjs';
import { mountSoccer } from "./soccer-mode.mjs";
import { CATALOG, FAMILIES, destination, movedRoute } from "./catalog.mjs";
import { parentChallenge, parentAnswerMatches, menuStyle, gameArtwork } from "./menu-options.mjs";
import { lastPlace, rememberPlace } from "./places.mjs";
import {createReleaseLoader} from './release-loader.mjs';
const clientRelease = document.querySelector('meta[name="family-release"]')?.content || '';
// The book and chess load only when opened (the home screen stays light on a slow connection).
const bookApp = createReleaseLoader({loadedRelease:clientRelease,readRelease:async()=> (await fetchJSON('/__deploy/version',{},5000)).hub,reload:()=>location.reload(),load:()=>import('./book.mjs')});
const loadBook = async (...a) => (await bookApp())?.loadBook(...a);
const mountBook = async (...a) => (await bookApp())?.mountBook(...a);
// Session-start auto-open asks only whether an unread chapter is waiting (no chapter download).
const peekBook = (p) => fetchJSON(`/api/book?player=${encodeURIComponent(p)}&peek=1`, {}, 6000).catch(() => null);
import { mountHunt } from "./hunt.mjs";
const $ = (s) => document.querySelector(s),
  main = $("#main");
let config,
  player,
  frame = null,
  dispose = null,
  gate = null,
  gateAttempts = 0,
  statusResolver;
let storage;try{storage=localStorage;}catch{}
const menuOrders = createMenuCache({storage});
let leaveCheck=null;
// The home page he last saw in this page load ("" = page 1, "more" = page 2), for a game family's back link.
// Nothing is stored: a new visit always opens on Today.
let lastMenu="";
// The Book opens by itself once per page load (and at most a few times a day, server-side), before any game.
const bookChecked=new Set();let renderSeq=0;
const games = CATALOG.map((g) => [g.id, g.name, g.description, g.color]);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function event(kind, detail = "", stack = "") {
  if (player)
    fetch("/api/events?player=" + player, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, detail, clientRelease, ...(kind === 'error' ? {stack: String(stack).slice(0,1500)} : {}) }),
    }).catch(() => {});
}
function safeLeave(){
  return leaveCheck ||= checkLeave().finally(()=>{leaveCheck=null;});
}
function silence(){
  try{frame?.contentWindow?.familyAudio?.stop();}catch{}
  frame?.contentWindow?.postMessage({type:"family-audio-stop"},location.origin);
  globalThis.familyAudio?.stop();
}
async function checkLeave() {
  silence();
  if (dispose?.prepareLeave) {
    try {
      let timer;
      try{await Promise.race([dispose.prepareLeave(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The game is taking too long to confirm its save.')),6000);})]);}
      finally{clearTimeout(timer);}
    } catch (e) {
      return confirm((e.message || 'The last move could not be confirmed saved.')+'\nLeave or refresh anyway? The last unsaved action may be lost.');
    }
  }
  if (dispose?.busy?.())
    return confirm(
      "A move is still saving. Leave or refresh anyway? The last move may not be saved.",
    );
  if (!frame) return true;
  const status = await new Promise((resolve) => {
    statusResolver = resolve;
    frame.contentWindow.postMessage({ type: "family-status" }, location.origin);
    setTimeout(() => {
      if (statusResolver === resolve) {
        statusResolver = null;
        resolve({ dirty: true });
      }
    }, 700);
  });
  if (status.pending)
    return confirm(
      "This game is still saving. Leave or refresh anyway? The last action may not be saved.",
    );
  return (
    !status.dirty ||
    confirm(
      "Leave this game? A drawing or answer you have not saved may be lost.",
    )
  );
}
function stop() {
  silence();
  dispose?.();
  dispose = null;
  frame = null;
  speechSynthesis.cancel();
}
function choose() {
  stop();
  main.innerHTML = `<section class="choose"><h1>Who is playing?</h1><p>Choose once for this device.</p>${config.players.map((p) => `<button data-choose="${p.id}">${esc(p.name)}</button>`).join("")}</section>`;
  main.querySelectorAll("[data-choose]").forEach(
    (b) =>
      (b.onclick = () => {
        player = b.dataset.choose;
        try{storage?.setItem("family-games-player", player);}catch{}
        const u = new URL(location.href);
        u.searchParams.set("player", player);
        u.hash = "";
        history.replaceState(null, "", u);
        render();
      }),
  );
}
async function render() {
  stop();
  window.scrollTo(0, 0);
  const p = config.players.find((x) => x.id === player);
  $("#player-name").textContent = p?.name || "Family Games";
  if (!p) {
    choose();
    return;
  }
  const seq = ++renderSeq;
  // Grown-ups' preview of a child's book: the same player, same narration, nothing saved.
  // (#book/<child>/p<page>/<YYYY-MM-DD>: a given day's chapter, for grown-ups and the layout checks)
  const watch = location.hash.match(/^#book\/([\w-]+)(?:\/p(\d{1,2}))?(?:\/(\d{4}-\d{2}-\d{2}))?$/);
  if (watch && config.players.some((k) => k.id === watch[1] && k.id !== "admin")) {
    const book = await loadBook(watch[1], { preview: true, date: watch[3] || "" });
    if (seq !== renderSeq) return;
    if (book?.chapter) {
      dispose = await mountBook(main, { player: watch[1], book, preview: true, startPage: watch[2] ? Number(watch[2]) - 1 : 0, onDone: () => { dispose = null; location.hash = ""; } });
      return;
    }
    main.innerHTML = `<section class="error"><h1>No chapter yet.</h1><p>The next chapter is written overnight.</p><a class="back-link" href="#">← Back</a></section>`;
    return;
  }
  // Returning from a World stays on home for this visit, including when turning to page two.
  if (location.hash === "#games") bookChecked.add(player);
  if (player !== "admin" && !bookChecked.has(player)) {
    bookChecked.add(player);
    const peek = await peekBook(player);
    if (seq !== renderSeq) return;
    const book = peek?.open ? await loadBook(player) : null;
    if (seq !== renderSeq) return;
    if (book?.open && book.chapter) {
      dispose = await mountBook(main, { player, book, event, onDone: () => { dispose = null; afterBook(); } });
      return;
    }
  }
  // His own book, any time: the "My Book" card opens today's chapter (a finished one can be read again).
  if (location.hash === "#my-book" && player !== "admin") {
    const book = await loadBook(player);
    if (seq !== renderSeq) return;
    if (book?.chapter) {
      const again = book.progress?.finished ? { ...book, progress: { ...book.progress, page: 0 } } : book;
      dispose = await mountBook(main, { player, book: again, event, onDone: () => { dispose = null; location.hash = ""; } });
      return;
    }
    main.innerHTML = `<section class="error"><h1>Your next chapter is being written.</h1><p>It will be ready in the morning.</p><a class="back-link" href="#">← Back</a></section>`;
    return;
  }
  const dest = destination(location.hash),
    game = dest.item?.id,
    item = dest.item;
  if (["chess", "soccer", "frame"].includes(dest.type)) rememberPlace(player, location.hash);
  if (dest.type === "hunt") {
    // Letter Hunt: a real-world hunt at home, announced by a friend from the book.
    dispose = mountHunt(main, { player, event, onClose: () => { location.hash = ""; } });
    return;
  }
  if (dest.type === "chess") {
    const { mountChess } = await import("./chess/app.mjs");
    if (seq !== renderSeq) return;
    dispose = mountChess(main, { player, name: p.name, event });
    return;
  }
  if (dest.type === "soccer") {
    main.innerHTML =
      '<div id="activity-toolbar"></div><div id="activity-stage"></div>';
    activityToolbar(item);
    dispose = mountSoccer(main.querySelector("#activity-stage"), {
      player,
      name: p.name,
      event,
      initialMode: dest.mode.native,
    });
    return;
  }
  if (dest.type === "family") {
    main.innerHTML = `<section class="catalog family-catalog family-${game}"><a class="back-link" href="#${lastMenu}">← Games</a><h1>${esc(item.name)}</h1><p>Choose your adventure. Each one keeps your progress.</p><div class="cards">${dest.modes.map((m) => `<a class="card activity-card" style="--tint:${item.color}" href="#${game}/${m.id}"><img class="game-preview" src="/previews/${m.preview}.jpg" alt="" width="640" height="400"><h2>${m.name}</h2><p>${m.description}</p><strong>Let’s play →</strong></a>`).join("")}</div></section>`;
    return;
  }
  if (dest.type === "frame") {
    main.innerHTML = `<div id="activity-toolbar"></div><section class="frame-wrap"><iframe title="${esc(dest.mode?.name || item.name)}" allow="autoplay; fullscreen; microphone" src="/g/${dest.game}/${player}/?player=${player}&family=1${dest.query ? "&" + dest.query : ""}${dest.route ? "#" + dest.route : ""}"></iframe><div class="loading-note">Opening ${esc(dest.mode?.name || item.name)}…</div></section>`;
    if (dest.mode) activityToolbar(item);
    frame = main.querySelector("iframe");
    setTimeout(() => {
      const note = $(".loading-note");
      if (note) note.textContent = "Still loading? Tap Games, then try again.";
    }, 12000);
    event("open_game", game + (dest.mode ? "/" + dest.mode.id : ""));
    return;
  }
  // Paint immediately. Updated preferences apply only on the NEXT menu visit.
  const order = menuOrders.current(player);
  void menuOrders.refresh(player);
  const catalog = [...CATALOG].sort((a, b) => {
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length + CATALOG.findIndex(g => g.id === id);
    return rank(a.id) - rank(b.id);
  });
  // The main menu always shows the illustrated logos (the children pick by them); a game's own menu keeps its
  // screenshots. There is no per-device choice any more, so there is nothing to reset.
  const style = "logos";
  const homeDay = new Intl.DateTimeFormat('en-CA', {timeZone: config.menuTimeZone || 'UTC', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  const newCards = new Set(activeNewGames(p.homeNewGames, homeDay));
  const card = item => { const art = gameArtwork(item, style); return `<a class="card" href="${item.href || '#'+item.id}" data-game="${item.id}" style="--tint:${item.color}"><img class="${art.className}${item.painted ? ' world-painting' : ''}" src="${art.src}" alt="" width="192" height="192"><h2>${esc(item.name)}</h2>${newCards.has(item.id) ? '<span class="new-game">New</span>' : ""}<p>${esc(item.description || "")}</p></a>`; };
  // One list: frequent now, a forgotten favourite or two and one nudge (computed in the background; the last list
  // fetched is used, so cards never move while he is choosing), shown over two pages so neither is too busy.
  const ordered = smartHomeGames(catalog, p.homeShortcuts, menuOrders.home(player));
  const book = homePins(p);
  const pages = homePages(ordered, { lead: book.length, nudge: menuOrders.nudge(player), newGames: p.homeNewGames, day: homeDay, familyOrder: menuOrders.familyOrder(player), columns: matchMedia('(max-width:1000px)').matches ? 3 : 5 });
  const second = location.hash === "#more";
  lastMenu = second ? "more" : "";
  const shown = second ? pages.second : [...book, ...pages.first];
  const kids = config.players.filter((k) => k.id !== "admin");
  const watchCards = player === "admin" && !second ? `<div class="book-watch-home"><h2>📖 The Book</h2>${kids.map((k) => `<a class="book-watch-btn" href="#book/${esc(k.id)}">Watch ${esc(k.name)}'s book →</a>`).join("")}</div>` : "";
  const pager = second
    ? `<nav class="home-pager"><a class="pager-btn back" href="#">← Back</a></nav>`
    : `<nav class="home-pager"><a class="pager-btn more" href="#more">More games →</a></nav>`;
  main.innerHTML = `<section class="catalog calm-home home-page-${second ? 2 : 1} menu-${style}"><h1>${second ? "More games" : "A place to explore."}</h1><p>${second ? "Take your time." : "Choose a little adventure. Take your time."}</p>${watchCards}<div class="cards">${shown.map(card).join("")}</div>${pager}<footer><span>Your place is kept.</span><button id="grown-ups">Grown-ups</button></footer></section>`;
  attachHomeSwipe(main.querySelector(".calm-home"), second ? {prev: () => { location.hash = ""; }} : {next: () => { location.hash = "#more"; }});
  $("#grown-ups").onclick = () => {
    gateAttempts = 0;
    newParentChallenge();
    $("#gate-form").hidden = false;
    $("#parent-options").hidden = true;
    $("#parents").showModal();
    $("#gate-answer").focus();
  };
  event("home", second ? "page2" : "page1");
}
// After today's chapter: back to where he was (the page he opened, or the game he last played).
function afterBook() {
  const target = location.hash ? "" : lastPlace(player);
  if (target && target !== location.hash) location.hash = target.replace(/^#/, "");
  else render();
}
function activityToolbar(item) {
  $("#activity-toolbar").innerHTML =
    `<nav class="activity-toolbar" aria-label="${esc(item.name)} activities"><a href="#${item.id}">← ${esc(item.name)}</a>${FAMILIES[item.id].map((m) => `<a href="#${item.id}/${m.id}" ${location.hash === `#${item.id}/${m.id}` ? 'aria-current="page"' : ""}><img src="/previews/${m.preview}.jpg" alt=""><span>${m.name}</span></a>`).join("")}</nav>`;
}
document.addEventListener("click", async (e) => {
  if (e.defaultPrevented) return;
  const link = e.target.closest('a[href^="#"]');
  if (!link || !main.contains(link)) return;
  e.preventDefault();
  if (await safeLeave()) location.hash = link.getAttribute("href").slice(1);
});
function newParentChallenge() {
  gate = parentChallenge();
  $("#gate-question").textContent = gate.question;
  $("#gate-code").textContent = gate.code;
  $("#gate-answer").value = "";
  $("#gate-error").textContent = "";
}
$("#gate-form").onsubmit = (e) => {
  e.preventDefault();
  if (!parentAnswerMatches(gate, $("#gate-answer").value)) {
    gateAttempts++;
    if (gateAttempts % 3 === 0) newParentChallenge();
    $("#gate-error").textContent = "Read the instruction and try again.";
    return;
  }
  $("#gate-form").hidden = true;
  $("#parent-options").hidden = false;
  $("#gate-cancel").focus();
  $("#world-previews").innerHTML = config.players.filter(k=>k.id!=="admin"&&k.id===player).map(k=>`<a class="book-watch-btn" href="/world?player=${encodeURIComponent(k.id)}&amp;preview=${k.worldQuest?0:1}">🌍 ${esc(k.name)}'s ${k.world==='small'?'World':'Castle Kingdom'}${k.worldQuest?'':' · Preview'}</a>`).join("");
  $("#book-watch").innerHTML = config.players.filter((k) => k.id !== "admin").map((k) => `<button type="button" class="book-watch-btn" data-watch="${esc(k.id)}">Watch ${esc(k.name)}'s book</button><a class="book-watch-btn book-cards-link" href="/api/book/cards?player=${encodeURIComponent(k.id)}" target="_blank" rel="noopener">🖨️ ${esc(k.name)}'s word cards</a>`).join("");
  $("#book-watch").querySelectorAll("[data-watch]").forEach((b) => (b.onclick = () => { $("#parents").close(); location.hash = "book/" + b.dataset.watch; }));
};
// Grown-ups: day notes about each child's day live on their own phone-friendly page (linked from the options).
$("#gate-cancel").onclick = $("#parent-done").onclick = () => $("#parents").close();
$("#change-player").onclick = () => { $("#parents").close(); choose(); };
$("#home").onclick = async () => {
  if (!(await safeLeave())) return;
  if(!config?.players?.length)return location.reload();
  if(location.hash)location.hash = "";
  else render();
};
$("#refresh").onclick = async () => {
  if (!(await safeLeave())) return;
  const u = new URL(location.href);
  u.searchParams.set("v", Date.now());
  location.replace(u);
};
window.addEventListener("hashchange", render);
// Updates: when the hub's release changes, reload this page at a natural boundary
// (home/catalog screens, or when an embedded game reports it reached one).
let hubDue = false,
  lastInput = Date.now(),
  quietSince = 0;
for (const t of ["pointerdown", "keydown", "touchstart", "wheel"])
  addEventListener(t, () => (lastInput = Date.now()), { capture: true, passive: true });
async function pollRelease() {
  try {
    const idle = Math.round((Date.now() - lastInput) / 1000);
    const r = await fetch(`/__deploy/version?game=hub&idle=${idle}`, { cache: "no-store" });
    if (!r.ok) return;
    const v = await r.json();
    if (v.hub && config && v.hub !== (config.release || "")) hubDue = true;
  } catch {}
}
setTimeout(pollRelease, 4000 + Math.random() * 4000);
setInterval(pollRelease, 60000 + Math.random() * 5000);
setInterval(() => {
  if (!hubDue) return;
  const quiet = Date.now() - lastInput;
  const home = !frame && !dispose && !document.querySelector("dialog[open]");
  if (!((home && quiet > 5000) || (dispose && !frame && quiet > 10 * 60000))) return void (quietSince = 0);
  quietSince ||= Date.now();
  if (Date.now() - quietSince > 3000) location.reload();
}, 1000);
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
  if (e.data?.type === "family-open") {
    const target = movedRoute(e.data.game, e.data.route);
    if (target)
      void safeLeave().then((ok) => {
        if (ok) {
          if (location.hash.slice(1) === target) render();
          else location.hash = target;
        }
      });
    return;
  }
  if (e.data?.type === "family-ready") $(".loading-note")?.remove();
  if (e.data?.type === "family-update-reload" && (hubDue || e.data.hub)) location.reload();
  if (e.data?.type === "family-status") {
    statusResolver?.(e.data);
    statusResolver = null;
  }
  if (e.data?.type === "family-error") event("game_error", e.data.detail);
  if (e.data?.type === "family-player-locked")
    alert("Change player using Grown-ups on the Games home screen.");
});
window.addEventListener("error", (e) => event("error", e.message, e.error?.stack || `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`));
window.addEventListener("unhandledrejection", (e) =>
  event("error", String(e.reason), e.reason?.stack || ''),
);
try {
  config = await fetchJSON('/api/config',{},8000);
  if(!Array.isArray(config.players)||!config.players.length)throw Error('Could not read your game settings.');
  const requested = new URL(location.href).searchParams.get("player");
  let saved;try{saved=storage?.getItem("family-games-player");}catch{}
  player = config.players.some((p) => p.id === requested)
    ? requested
    : config.players.some((p) => p.id === saved)
      ? saved
      : null;
  if (player){try{storage?.setItem("family-games-player", player);}catch{}void menuOrders.refresh(player);}
  // A new visit always opens on page 1, even from a saved or shared page-2 address.
  if (location.hash === "#more") history.replaceState(null, "", location.pathname + location.search);
  render();
} catch (e) {
  main.innerHTML = `<section class="error"><h1>Let’s reconnect.</h1><p>${esc(e.message)}</p><p>Make sure your game server is on, then tap Refresh.</p></section>`;
}
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "family_games_state",
        description:
          "Read the selected player and game. Does not play or modify scores.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          player,
          game: location.hash.slice(1) || "home",
          games: games.map((x) => x[0]),
        }),
      }),
    ).catch(() => {});
  } catch {}
}

// had been loaded the day before): coming back to the app on a later day reloads it, so today's chapter is the one.
{const day=()=>new Date().toLocaleDateString('en-CA');let loaded=day();
 const check=()=>{if(document.visibilityState==='visible'&&day()!==loaded){loaded=day();location.reload();}};
 document.addEventListener('visibilitychange',check);addEventListener('focus',check);addEventListener('pageshow',check);setInterval(check,10*60*1000);}
