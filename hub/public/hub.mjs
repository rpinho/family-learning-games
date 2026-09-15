import { mountSoccer } from "./soccer-mode.mjs";
import { CATALOG, FAMILIES, destination, movedRoute } from "./catalog.mjs";
import { mountChess } from "./chess/app.mjs";
const $ = (s) => document.querySelector(s),
  main = $("#main");
let config,
  player,
  frame = null,
  dispose = null,
  gate = 0,
  statusResolver;
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
async function safeLeave() {
  if (dispose?.prepareLeave) {
    try {
      await dispose.prepareLeave();
    } catch (e) {
      alert(
        e.message || "The last move has not saved. Try again before leaving.",
      );
      return false;
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
        localStorage.setItem("family-games-player", player);
        const u = new URL(location.href);
        u.searchParams.set("player", player);
        u.hash = "";
        history.replaceState(null, "", u);
        render();
      }),
  );
}
function render() {
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
    main.innerHTML = `<section class="catalog family-catalog"><a class="back-link" href="#">← All games</a><h1>${esc(item.name)}</h1><p>Choose your adventure. Each one keeps your progress.</p><div class="cards">${dest.modes.map((m) => `<a class="card activity-card" style="--tint:${item.color}" href="#${game}/${m.id}"><img class="game-preview" src="/previews/${m.preview}.jpg" alt="" width="640" height="400"><h2>${m.name}</h2><p>${m.description}</p><strong>Let’s play →</strong></a>`).join("")}</div></section>`;
    return;
  }
  if (dest.type === "frame") {
    main.innerHTML = `<div id="activity-toolbar"></div><section class="frame-wrap"><iframe title="${esc(dest.mode?.name || item.name)}" allow="autoplay; fullscreen" src="/g/${dest.game}/${player}/?player=${player}&family=1${dest.route ? "#" + dest.route : ""}"></iframe><div class="loading-note">Opening ${esc(dest.mode?.name || item.name)}…</div></section>`;
    if (dest.mode) activityToolbar(item);
    frame = main.querySelector("iframe");
    setTimeout(() => {
      const note = $(".loading-note");
      if (note) note.textContent = "Still loading? Tap Games, then try again.";
    }, 12000);
    event("open_game", game + (dest.mode ? "/" + dest.mode.id : ""));
    return;
  }
  main.innerHTML = `<section class="catalog"><h1>What shall we play?</h1><p>Your games. Your next adventure.</p><div class="cards">${games.map(([id, name, desc, tint]) => `<a class="card" href="#${id}" data-game="${id}" style="--tint:${tint}"><img class="game-preview" src="/previews/${id}.jpg" alt="" width="640" height="400"><h2>${name}</h2><p>${desc}</p></a>`).join("")}</div><footer><span>One app · Your progress stays with you.</span><button id="grown-ups">Grown-ups</button></footer></section>`;
  $("#grown-ups").onclick = () => {
    const a = 7 + Math.floor(Math.random() * 9),
      b = 4 + Math.floor(Math.random() * 7);
    gate = a + b;
    $("#gate-question").textContent = `To change player: what is ${a} + ${b}?`;
    $("#gate-answer").value = "";
    $("#gate-error").textContent = "";
    $("#parents").showModal();
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
$("#unlock").onclick = () => {
  if (Number($("#gate-answer").value) !== gate) {
    $("#gate-error").textContent = "Try that sum again.";
    return;
  }
  $("#parents").close();
  choose();
};
$("#home").onclick = async () => {
  if (!(await safeLeave())) return;
  location.hash = "";
  render();
};
$("#refresh").onclick = async () => {
  if (!(await safeLeave())) return;
  const u = new URL(location.href);
  u.searchParams.set("v", Date.now());
  location.replace(u);
};
window.addEventListener("hashchange", render);
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
  const r = await fetch("/api/config");
  if (!r.ok) throw Error("Could not reach your game server.");
  config = await r.json();
  const requested = new URL(location.href).searchParams.get("player"),
    saved = localStorage.getItem("family-games-player");
  player = config.players.some((p) => p.id === requested)
    ? requested
    : config.players.some((p) => p.id === saved)
      ? saved
      : null;
  if (player) localStorage.setItem("family-games-player", player);
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
