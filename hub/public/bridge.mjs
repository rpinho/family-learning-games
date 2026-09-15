// Classic script injected before each app's own scripts. Preferences are scoped
// to app + player; authoritative progress stays in the original app servers.
(() => {
  const { game, player, prefix } = document.currentScript.dataset;
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
      const r = await nativeFetch(
        input instanceof Request ? new Request(u, input) : u,
        options,
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
})();
