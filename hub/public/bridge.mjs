// Classic script injected before each app's own scripts. Preferences are scoped
// to app + player; authoritative progress stays in the original app servers.
(() => {
  const { game, player, prefix, hubRelease = "", gameRelease = "" } =
    document.currentScript.dataset;
  document.documentElement.dataset.familyGame = game;
  const keys = new Set([
    "letter-quest-player",
    "word-arcade-player",
    "number-park-player",
    "number-park-parent-player",
    "maze-player",
    "three-player",
    "target-player",
  ]);
  const original = {
    get: Storage.prototype.getItem,
    set: Storage.prototype.setItem,
    remove: Storage.prototype.removeItem,
  };
  const scope = `family:${game}:${player}:`;
  let pending = 0,
    dirty = false;
  Storage.prototype.getItem = function (k) {
    return this === localStorage
      ? keys.has(k)
        ? player
        : original.get.call(this, scope + k)
      : original.get.call(this, k);
  };
  Storage.prototype.setItem = function (k, v) {
    return original.set.call(
      this,
      this === localStorage ? scope + k : k,
      this === localStorage && keys.has(k) ? player : v,
    );
  };
  Storage.prototype.removeItem = function (k) {
    return original.remove.call(this, this === localStorage ? scope + k : k);
  };
  const nativeFetch = window.fetch.bind(window);
  // A game or the hub may restart for a few seconds during an update. Ride it out
  // with backoff instead of surfacing a frozen screen. Writes are retried only when
  // the request provably never reached the game (network error / x-family-retry).
  const BACKOFF = [500, 1000, 2000, 3000, 5000, 8000, 8000, 8000];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function withRetry(attempt, write, signal) {
    for (let i = 0; ; i++) {
      try {
        const r = await attempt();
        const retryable =
          r.status >= 502 &&
          r.status <= 504 &&
          (!write || r.headers.get("x-family-retry") === "1");
        if (!retryable || i >= BACKOFF.length || signal?.aborted) return r;
      } catch (e) {
        if (e?.name === "AbortError" || signal?.aborted || i >= BACKOFF.length)
          throw e;
      }
      await wait(BACKOFF[i]);
    }
  }
  window.fetch = async (input, options) => {
    let u = new URL(
      input instanceof Request ? input.url : input,
      location.href,
    );
    if (
      u.origin === location.origin &&
      !u.pathname.startsWith(prefix) &&
      !u.pathname.startsWith("/g/")
    )
      u.pathname = prefix + u.pathname.replace(/^\//, "");
    const write =
      (options?.method || input?.method || "GET").toUpperCase() !== "GET";
    if (write) pending++;
    try {
      const base = input instanceof Request ? new Request(u, input) : null;
      const r = await withRetry(
        () => nativeFetch(base ? base.clone() : u, options),
        write,
        options?.signal || base?.signal,
      );
      if (write && r.ok && !/events?$/.test(u.pathname)) dirty = false;
      return r;
    } finally {
      if (write) pending--;
    }
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.tagName === "CANVAS") dirty = true;
    },
    { capture: true },
  );
  document.addEventListener("input", (e) => {
    if (e.target.matches("input,textarea")) dirty = true;
  });
  // The hub owns player choice. Old in-game selectors must not make the top name
  // disagree with the server profile. Grown-ups remains on the hub home screen.
  document.addEventListener(
    "change",
    (e) => {
      if (
        e.target.tagName === "SELECT" &&
        [...e.target.options].some((o) => o.value === player) &&
        [...e.target.options].some((o) => o.value === "admin")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.target.value = player;
        parent.postMessage({ type: "family-player-locked" }, location.origin);
      }
    },
    { capture: true },
  );
  document.addEventListener(
    "click",
    (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      let route = action?.startsWith("tab:") ? action.slice(4) : null;
      if (game === "letter-quest") {
        if (e.target.closest("a.brand")) route = "letter-home";
        if (action === "soccer-exit") route = "soccer-menu";
        if (e.target.closest("[data-maze=exit]")) route = "maze-menu";
        if (e.target.closest("[data-maze=rescue]")) route = "rescue";
        if (e.target.closest("[data-rescue=leave]")) route = "maze";
      }
      if (
        game === "letter-quest" &&
        [
          "soccer",
          "maze",
          "rescue",
          "soccer-menu",
          "maze-menu",
          "letter-home",
        ].includes(route)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        parent.postMessage(
          { type: "family-open", game, route },
          location.origin,
        );
        return;
      }
      if (e.target.closest("[data-player]")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        parent.postMessage({ type: "family-player-locked" }, location.origin);
      }
    },
    { capture: true },
  );
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    if (e.data?.type === "family-status")
      parent.postMessage(
        { type: "family-status", pending, dirty },
        location.origin,
      );
  });
  window.addEventListener("error", (e) =>
    parent.postMessage(
      { type: "family-error", detail: String(e.message).slice(0, 200) },
      location.origin,
    ),
  );
  window.addEventListener("load", () =>
    parent.postMessage({ type: "family-ready" }, location.origin),
  );
  // Updates: poll the hub's release endpoint; when this game's (or the hub's) release
  // changed, reload only at a natural boundary (home/finish/between rounds), never mid-round.
  let lastInput = Date.now(),
    due = false,
    hubChanged = false,
    boundarySince = 0;
  for (const t of ["pointerdown", "keydown", "touchstart", "wheel"])
    addEventListener(t, () => (lastInput = Date.now()), {
      capture: true,
      passive: true,
    });
  const $ = (s) => document.querySelector(s);
  const text = (s) => ($(s)?.textContent || "").trim();
  const shown = (s) => {
    const el = $(s);
    return !!el && !el.hidden && el.getClientRects().length > 0;
  };
  const BOUNDARY = {
    "letter-quest": () => {
      if ($(".celebration, .maze-finish, [data-rescue='next'], .story-success, .reading-finish"))
        return true;
      const b = document.body.classList;
      if (b.contains("lesson-open") || b.contains("maze-open")) return false;
      if ($(".soccer-shell") && !$(".soccer-levels")) return false;
      if ($(".story-page .story-controls") || $(".reading-session")) return false;
      return true;
    },
    "word-arcade": () =>
      !!$("section.complete") ||
      (!!$("section.lobby, section.mission-brief") && !$(".arcade-shell.is-playing")),
    "number-park": () =>
      !!$(".lesson-done, .plan-success, .plan-sparkles") ||
      (!!$("section.welcome") && !$("section.playboard:not(.reading-home)")) ||
      (!!$(".reading-home") && !$(".reading-play")) ||
      (!!$(".planning-home") && !$(".planning-play")),
    "maze-garden": () => !!$("dialog#win[open], dialog#welcome[open]"),
    "target-trail": () => shown("#overlay") && text("#round-title") !== "Ready?",
    "three-in-a-row": () => shown("#next"),
  };
  function atBoundary() {
    try {
      return !!BOUNDARY[game]?.();
    } catch {
      return false;
    }
  }
  async function pollRelease() {
    try {
      const idle = Math.round((Date.now() - lastInput) / 1000);
      const r = await nativeFetch(
        `/__deploy/version?game=${encodeURIComponent(game)}&idle=${idle}`,
        { cache: "no-store" },
      );
      if (!r.ok) return;
      const v = await r.json();
      if (!v.hub) return; // not a managed deployment
      const g = v.games?.[game] || "";
      hubChanged = v.hub !== hubRelease;
      if (hubChanged || g !== gameRelease) due = true;
    } catch {}
  }
  setTimeout(pollRelease, 3000 + Math.random() * 4000);
  setInterval(pollRelease, 60000 + Math.random() * 5000);
  setInterval(() => {
    if (!due) return;
    const quiet = Date.now() - lastInput;
    const ok =
      pending === 0 &&
      !$("dialog.wb[open]") &&
      (atBoundary() || quiet > 10 * 60000);
    if (!ok) return void (boundarySince = 0);
    boundarySince ||= Date.now();
    if (Date.now() - boundarySince < 6000 || quiet < 5000) return;
    due = false;
    parent.postMessage(
      { type: "family-update-reload", hub: hubChanged },
      location.origin,
    );
    setTimeout(() => location.reload(), 1500);
  }, 1000);
})();
