import { Chess } from "./rules.mjs";
import { piece } from "./art.mjs";
import { NAMES } from "./curriculum.mjs";
export function mountBoard(
  root,
  {
    fen,
    side = "w",
    disabled = false,
    lastMoves = [],
    hintFrom,
    hintTo,
    onMove,
    onSelect = () => {},
  },
) {
  const chess = new Chess(fen);
  let selected = null,
    drag = null,
    ghost = null;
  const squares = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++)
      squares.push(
        String.fromCharCode(97 + (side === "w" ? col : 7 - col)) +
          (side === "w" ? 8 - row : row + 1),
      );
  const marked = new Set(
    lastMoves.flatMap((m) => [m.slice(0, 2), m.slice(2, 4)]),
  );
  root.innerHTML = `<div class="board-coordinates"><div class="chess-board" role="group" aria-label="Chess board. ${side === "w" ? "White" : "Black"} at the bottom.">${squares
    .map((sq, i) => {
      const p = chess.get(sq),
        light = (+sq[1] + sq.charCodeAt(0)) % 2 !== 0;
      return `<button type="button" class="sq ${light ? "light" : "dark"} ${marked.has(sq) ? "last" : ""} ${hintFrom === sq ? "hint-piece" : ""} ${hintTo === sq ? "hint-target" : ""} ${chess.isCheck() && p?.type === "k" && p.color === chess.turn() ? "in-check" : ""}" data-square="${sq}" aria-label="${p ? (p.color === "w" ? "White " : "Black ") + NAMES[p.type] + " on " : ""}${sq}" ${disabled ? "disabled" : ""}>${p ? piece(p.type, p.color) : ""}${i % 8 === 0 ? `<span class="rank">${sq[1]}</span>` : ""}${i >= 56 ? `<span class="file">${sq[0]}</span>` : ""}<span class="move-dot"></span></button>`;
    })
    .join("")}</div></div>`;
  const board = root.querySelector(".chess-board");
  if (
    hintFrom &&
    hintTo &&
    squares.includes(hintFrom) &&
    squares.includes(hintTo)
  ) {
    const a = squares.indexOf(hintFrom),
      b = squares.indexOf(hintTo);
    const x1 = (a % 8) * 100 + 50,
      y1 = Math.floor(a / 8) * 100 + 50,
      x2 = (b % 8) * 100 + 50,
      y2 = Math.floor(b / 8) * 100 + 50;
    const angle = Math.atan2(y2 - y1, x2 - x1),
      length = Math.hypot(x2 - x1, y2 - y1);
    // One connected arrow also works for a knight: endpoints identify the move.
    root
      .querySelector(".board-coordinates")
      .insertAdjacentHTML(
        "beforeend",
        `<svg class="hint-arrow" viewBox="0 0 800 800" aria-hidden="true"><g transform="translate(${x1} ${y1}) rotate(${(angle * 180) / Math.PI})"><path d="M0 -10H${length - 40}V-28L${length} 0L${length - 40} 28V10H0Z" fill="#ffbc35" stroke="#915516" stroke-width="3" stroke-linejoin="round"/></g></svg>`,
      );
  }

  function select(sq) {
    const p = chess.get(sq);
    selected = p?.color === chess.turn() ? sq : null;
    const legal = selected
      ? chess.moves({ square: selected, verbose: true })
      : [];
    board.querySelectorAll(".sq").forEach((el) => {
      el.classList.toggle("selected", el.dataset.square === selected);
      el.classList.toggle(
        "legal",
        legal.some((m) => m.to === el.dataset.square),
      );
      el.classList.toggle("capture", !!chess.get(el.dataset.square));
      el.setAttribute("aria-pressed", String(el.dataset.square === selected));
    });
    onSelect(
      selected
        ? `${NAMES[p.type][0].toUpperCase() + NAMES[p.type].slice(1)} selected. Choose a marked square.`
        : "Choose a piece.",
    );
  }
  function attempt(from, to) {
    if (!from || from === to) return;
    const moves = chess
      .moves({ square: from, verbose: true })
      .filter((m) => m.to === to);
    if (!moves.length) {
      select(to);
      return;
    }
    if (moves.some((m) => m.promotion)) {
      const chooser = document.createElement("div");
      chooser.className = "promotion-chooser";
      chooser.setAttribute("role", "dialog");
      chooser.setAttribute("aria-label", "Choose a promotion piece");
      chooser.innerHTML =
        "<strong>Promote to…</strong>" +
        ["q", "r", "b", "n"]
          .map(
            (t) =>
              `<button data-promote="${t}" aria-label="Promote to ${NAMES[t]}">${piece(t, chess.turn())}</button>`,
          )
          .join("") +
        "<button data-cancel>Cancel</button>";
      root.append(chooser);
      chooser.querySelectorAll("[data-promote]").forEach(
        (el) =>
          (el.onclick = () => {
            chooser.remove();
            onMove(from, to, el.dataset.promote);
          }),
      );
      chooser.querySelector("[data-cancel]").onclick = () => chooser.remove();
      chooser.querySelector("button").focus();
      return;
    }
    onMove(from, to);
  }
  board.addEventListener("pointerdown", (e) => {
    if (disabled || e.button > 0) return;
    const cell = e.target.closest("[data-square]");
    if (!cell) return;
    const sq = cell.dataset.square;
    drag = {
      from: sq,
      x: e.clientX,
      y: e.clientY,
      prior: selected,
      moved: false,
    };
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      drag.moved = true;
      const cell = board.querySelector(`[data-square="${drag.from}"]`);
      if (chess.get(drag.from)?.color !== chess.turn()) return;
      cell?.classList.add("dragging");
      if (!ghost) {
        select(drag.from);
        ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.innerHTML = cell.querySelector("svg")?.outerHTML || "";
        ghost.style.width = board.getBoundingClientRect().width / 8 + "px";
        ghost.style.height = ghost.style.width;
        document.body.append(ghost);
      }
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
    }
  });
  board.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    ghost?.remove();
    ghost = null;
    board.releasePointerCapture(e.pointerId);
    board
      .querySelectorAll(".dragging")
      .forEach((el) => el.classList.remove("dragging"));
    const rect = board.getBoundingClientRect(),
      col = Math.floor(((e.clientX - rect.left) / rect.width) * 8),
      row = Math.floor(((e.clientY - rect.top) / rect.height) * 8),
      target =
        col >= 0 && col < 8 && row >= 0 && row < 8
          ? squares[row * 8 + col]
          : null;
    if (d.moved) {
      if (target) attempt(d.from, target);
    } else if (d.prior && d.prior !== target) attempt(d.prior, target);
    else select(target);
  });
  board.addEventListener("pointercancel", () => {
    drag = null;
    ghost?.remove();
    ghost = null;
    board
      .querySelectorAll(".dragging")
      .forEach((el) => el.classList.remove("dragging"));
  });
  board.addEventListener("keydown", (e) => {
    const sq = e.target.closest("[data-square]")?.dataset.square;
    if (!sq) return;
    const i = squares.indexOf(sq);
    let next = i;
    if (e.key === "ArrowRight") next = i + 1;
    else if (e.key === "ArrowLeft") next = i - 1;
    else if (e.key === "ArrowDown") next = i + 8;
    else if (e.key === "ArrowUp") next = i - 8;
    else if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (selected && selected !== sq) attempt(selected, sq);
      else select(sq);
      return;
    } else return;
    e.preventDefault();
    if (next >= 0 && next < 64)
      board.querySelector(`[data-square="${squares[next]}"]`).focus();
  });
  const dispose = () => {
    drag = null;
    ghost?.remove();
  };
  dispose.animate = async (moves) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const u of moves) {
      const from = u.slice(0, 2),
        to = u.slice(2, 4),
        source = board.querySelector(`[data-square="${from}"]`),
        target = board.querySelector(`[data-square="${to}"]`),
        p = chess.get(from);
      if (!source || !target || !p || !root.isConnected) return;
      const a = source.getBoundingClientRect(),
        b = target.getBoundingClientRect(),
        moving = document.createElement("div");
      moving.className = "drag-ghost";
      moving.innerHTML = piece(p.type, p.color);
      Object.assign(moving.style, {
        width: a.width + "px",
        height: a.height + "px",
        left: a.x + a.width / 2 + "px",
        top: a.y + a.height / 2 + "px",
      });
      document.body.append(moving);
      source.querySelector("svg")?.remove();
      try {
        await moving.animate(
          [
            { translate: "0 0" },
            { translate: `${b.x - a.x}px ${b.y - a.y}px` },
          ],
          {
            duration: 260,
            easing: "cubic-bezier(.2,.7,.2,1)",
            fill: "forwards",
          },
        ).finished;
      } finally {
        moving.remove();
      }
      target.querySelector("svg")?.remove();
      target.insertAdjacentHTML("afterbegin", piece(u[4] || p.type, p.color));
      try {
        const m = chess.move({ from, to, promotion: u[4] });
        if (m.isEnPassant())
          board
            .querySelector(`[data-square="${to[0] + from[1]}"] svg`)
            ?.remove();
        if (m.isKingsideCastle() || m.isQueensideCastle()) {
          const rf = (m.isKingsideCastle() ? "h" : "a") + from[1],
            rt = (m.isKingsideCastle() ? "f" : "d") + from[1];
          board.querySelector(`[data-square="${rf}"] svg`)?.remove();
          board
            .querySelector(`[data-square="${rt}"]`)
            ?.insertAdjacentHTML("afterbegin", piece("r", p.color));
        }
      } catch {
        return;
      }
    }
  };
  dispose.rejectMove = async (u) => {
    const source = board.querySelector(`[data-square="${u.slice(0, 2)}"]`),
      target = board.querySelector(`[data-square="${u.slice(2, 4)}"]`),
      original = source?.querySelector("svg");
    if (!source || !target || !original) return;
    target.classList.add("wrong-square");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.classList.remove("wrong-square");
      return;
    }
    const a = source.getBoundingClientRect(),
      b = target.getBoundingClientRect(),
      moving = document.createElement("div");
    moving.className = "drag-ghost rejected-piece";
    moving.innerHTML = original.outerHTML;
    Object.assign(moving.style, {
      width: a.width + "px",
      height: a.height + "px",
      left: a.x + a.width / 2 + "px",
      top: a.y + a.height / 2 + "px",
    });
    document.body.append(moving);
    original.style.opacity = "0";
    const dx = b.x - a.x,
      dy = b.y - a.y;
    try {
      await moving.animate(
        [
          { translate: "0 0", offset: 0 },
          { translate: `${dx}px ${dy}px`, offset: 0.34 },
          { translate: `${dx + 5}px ${dy}px`, offset: 0.43 },
          { translate: `${dx - 5}px ${dy}px`, offset: 0.5 },
          { translate: `${dx}px ${dy}px`, offset: 0.58 },
          { translate: "0 0", offset: 1 },
        ],
        { duration: 730, easing: "ease-in-out" },
      ).finished;
    } finally {
      moving.remove();
      original.style.opacity = "";
      target.classList.remove("wrong-square");
    }
  };
  return dispose;
}
