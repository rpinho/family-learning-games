import {createMenuCache} from './menu-cache.mjs';
import {fetchJSON} from './save-request.mjs';
import { mountSoccer } from "./soccer-mode.mjs";
import { CATALOG, FAMILIES, destination, movedRoute } from "./catalog.mjs";
import { mountChess } from "./chess/app.mjs";
import { parentChallenge, parentAnswerMatches, menuStyle, gameArtwork } from "./menu-options.mjs";
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
const games = CATALOG.map((g) => [g.id, g.name, g.description, g.color]);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function event(kind, detail = "") {
  if (player)
    fetch("/api/events?player=" + player, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, detail }),
    }).catch(() => {});
}
function safeLeave(){
  return leaveCheck ||= checkLeave().finally(()=>{leaveCheck=null;});
}
async function checkLeave() {
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
  const dest = destination(location.hash),
    game = dest.item?.id,
    item = dest.item;
  if (dest.type === "chess") {
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
    main.innerHTML = `<section class="catalog family-catalog family-${game}"><a class="back-link" href="#">← All games</a><h1>${esc(item.name)}</h1><p>Choose your adventure. Each one keeps your progress.</p><div class="cards">${dest.modes.map((m) => `<a class="card activity-card" style="--tint:${item.color}" href="#${game}/${m.id}"><img class="game-preview" src="/previews/${m.preview}.jpg" alt="" width="640" height="400"><h2>${m.name}</h2><p>${m.description}</p><strong>Let’s play →</strong></a>`).join("")}</div></section>`;
    return;
  }
  if (dest.type === "frame") {
    main.innerHTML = `<div id="activity-toolbar"></div><section class="frame-wrap"><iframe title="${esc(dest.mode?.name || item.name)}" allow="autoplay; fullscreen" src="/g/${dest.game}/${player}/?player=${player}&family=1${dest.query ? "&" + dest.query : ""}${dest.route ? "#" + dest.route : ""}"></iframe><div class="loading-note">Opening ${esc(dest.mode?.name || item.name)}…</div></section>`;
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
  const orderedGames = [...CATALOG].sort((a, b) => {
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length + CATALOG.findIndex(g => g.id === id);
    return rank(a.id) - rank(b.id);
  });
  const style = menuStyle(player, p.menuStyle, storage);
  main.innerHTML = `<section class="catalog menu-${style}"><h1>What shall we play?</h1><p>Your games. Your next adventure.</p><div class="cards">${orderedGames.map(item => { const art = gameArtwork(item, style); return `<a class="card" href="#${item.id}" data-game="${item.id}" style="--tint:${item.color}"><img class="${art.className}" src="${art.src}" alt="" width="${style === "logos" ? 192 : 640}" height="${style === "logos" ? 192 : 400}"><h2>${item.name}</h2><p>${item.description}</p></a>`; }).join("")}</div><footer><span>One app · Your progress stays with you.</span><button id="grown-ups">Grown-ups</button></footer></section>`;
  $("#grown-ups").onclick = () => {
    gateAttempts = 0;
    newParentChallenge();
    $("#gate-form").hidden = false;
    $("#parent-options").hidden = true;
    $("#menu-style").value = style;
    $("#parents").showModal();
    $("#gate-answer").focus();
  };
  event("home");
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
  $("#menu-style").focus();
};
$("#gate-cancel").onclick = $("#parent-done").onclick = () => $("#parents").close();
$("#change-player").onclick = () => { $("#parents").close(); choose(); };
$("#menu-style").onchange = () => {
  const style = $("#menu-style").value;
  if (!["logos", "screenshots"].includes(style)) return;
  try { localStorage.setItem("family-games-menu-style:" + player, style); } catch {}
  render();
};
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
window.addEventListener("error", (e) => event("error", e.message));
window.addEventListener("unhandledrejection", (e) =>
  event("error", String(e.reason)),
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
