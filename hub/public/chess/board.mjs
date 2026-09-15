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
    onMotion = () => {},
    onSelect = () => {},
  },
) {
  const chess = new Chess(fen);
  let selected = null,
    drag = null,
    ghost = null,
    locked = disabled,
    disposed = false,
    previewFen = null,
    previewUci = null,
    droppedAt = null;
  const animations = new Set(),
    floating = new Set();
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
    if (selected) onMotion("select");
    onSelect(
      selected
        ? `${NAMES[p.type][0].toUpperCase() + NAMES[p.type].slice(1)} selected. Choose a marked square.`
        : "Choose a piece.",
    );
  }
  function attempt(from, to) {
    if (!from || from === to) {
      droppedAt = null;
      return;
    }
    const moves = chess
      .moves({ square: from, verbose: true })
      .filter((m) => m.to === to);
    if (!moves.length) {
      droppedAt = null;
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
    if (locked || e.button > 0) return;
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
    if (chess.get(sq)?.color === chess.turn()) select(sq);
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
      if (target) {
        droppedAt = { x: e.clientX, y: e.clientY };
        attempt(d.from, target);
      }
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
    if (locked) return;
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
  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cell = (sq) => board.querySelector(`[data-square="${sq}"]`);
  async function tween(el, frames, options) {
    if (disposed || reduced()) return;
    const animation = el.animate(frames, options);
    animations.add(animation);
    try {
      await animation.finished;
    } catch {
    } finally {
      animations.delete(animation);
    }
  }
  function refreshPieces() {
    for (const sq of squares) {
      const el = cell(sq),
        p = chess.get(sq);
      el.querySelector("svg")?.remove();
      if (p) el.insertAdjacentHTML("afterbegin", piece(p.type, p.color));
      el.classList.remove(
        "selected",
        "legal",
        "hint-piece",
        "hint-target",
        "last",
        "in-check",
      );
      el.classList.toggle(
        "in-check",
        chess.isCheck() && p?.type === "k" && p.color === chess.turn(),
      );
      el.setAttribute(
        "aria-label",
        `${p ? (p.color === "w" ? "White " : "Black ") + NAMES[p.type] + " on " : ""}${sq}`,
      );
    }
    selected = null;
    root.querySelector(".hint-arrow")?.remove();
  }
  async function travel(
    from,
    to,
    markup,
    { reverse = false, capture = false, drop = null } = {},
  ) {
    const source = cell(from),
      target = cell(to);
    if (!source || !target || disposed) return;
    const a = source.getBoundingClientRect(),
      b = target.getBoundingClientRect();
    const start = drop
      ? { x: drop.x - a.width / 2, y: drop.y - a.height / 2 }
      : a;
    const moving = document.createElement("div");
    moving.className = "drag-ghost moving-piece";
    moving.innerHTML = markup;
    Object.assign(moving.style, {
      width: a.width + "px",
      height: a.height + "px",
      left: start.x + a.width / 2 + "px",
      top: start.y + a.height / 2 + "px",
    });
    document.body.append(moving);
    floating.add(moving);
    source.querySelector("svg")?.style.setProperty("visibility", "hidden");
    const dx = b.x - start.x,
      dy = b.y - start.y;
    const victim = capture ? target.querySelector("svg") : null;
    const victimMotion = victim
      ? tween(
          victim,
          [
            { opacity: 1, scale: 1 },
            { opacity: 0, scale: 0.45, translate: "0 -12px" },
          ],
          { duration: 180, easing: "ease-in", fill: "forwards" },
        )
      : Promise.resolve();
    await tween(
      moving,
      [
        { translate: "0 0", scale: 1, offset: 0 },
        {
          translate: `${dx * 0.82}px ${dy * 0.82 - 5}px`,
          scale: 1.08,
          offset: 0.7,
        },
        { translate: `${dx}px ${dy}px`, scale: 0.95, offset: 0.9 },
        { translate: `${dx}px ${dy}px`, scale: 1, offset: 1 },
      ],
      {
        duration: reverse ? 310 : drop ? 130 : 240,
        easing: "cubic-bezier(.2,.75,.3,1)",
        fill: "forwards",
      },
    );
    await victimMotion;
    moving.remove();
    floating.delete(moving);
  }
  async function animateMoves(moves, { preview = false } = {}) {
    for (const u of moves) {
      if (disposed) return;
      const from = u.slice(0, 2),
        to = u.slice(2, 4),
        p = chess.get(from);
      if (!p) return;
      let m;
      try {
        m = chess.move({ from, to, promotion: u[4] || "q" });
      } catch {
        return;
      }
      onMotion(p.color === side ? "nod" : "think");
      root.querySelector(".hint-arrow")?.remove();
      board
        .querySelectorAll(".selected,.legal,.hint-piece,.hint-target")
        .forEach((el) =>
          el.classList.remove("selected", "legal", "hint-piece", "hint-target"),
        );
      const journeys = [
        travel(from, to, piece(p.type, p.color), {
          capture: !!m.captured,
          drop: droppedAt,
        }),
      ];
      if (m.isKingsideCastle() || m.isQueensideCastle())
        journeys.push(
          travel(
            (m.isKingsideCastle() ? "h" : "a") + from[1],
            (m.isKingsideCastle() ? "f" : "d") + from[1],
            piece("r", p.color),
          ),
        );
      droppedAt = null;
      await Promise.all(journeys);
      if (disposed) return;
      refreshPieces();
      cell(from).classList.add("last");
      cell(to).classList.add("last");
      const landed = cell(to).querySelector("svg");
      if (landed)
        await tween(
          landed,
          [
            { scale: 0.9, translate: "0 2px" },
            { scale: 1.07, translate: "0 -2px" },
            { scale: 1, translate: "0 0" },
          ],
          { duration: 180, easing: "ease-out" },
        );
      if (m.captured) {
        const ring = document.createElement("span");
        ring.className = "capture-ring";
        cell(to).append(ring);
        await tween(
          ring,
          [
            { scale: 0.3, opacity: 0.8 },
            { scale: 1.35, opacity: 0 },
          ],
          { duration: 230, easing: "ease-out" },
        );
        ring.remove();
      }
      if (!preview) onMotion(m.captured ? "capture" : "land");
    }
  }
  const dispose = () => {
    disposed = true;
    drag = null;
    ghost?.remove();
    for (const a of animations) a.cancel();
    for (const f of floating) f.remove();
  };
  dispose.lock = (value) => {
    locked = value;
    board.querySelectorAll("button").forEach((el) => (el.disabled = value));
  };
  dispose.animate = animateMoves;
  dispose.preview = async (u) => {
    previewFen = chess.fen();
    previewUci = u;
    await animateMoves([u], { preview: true });
  };
  dispose.rollback = async () => {
    if (!previewFen || !previewUci || disposed) return;
    const from = previewUci.slice(0, 2),
      to = previewUci.slice(2, 4),
      original = new Chess(previewFen).get(from);
    cell(to).classList.add("wrong-square");
    onMotion("retry");
    if (original)
      await travel(to, from, piece(original.type, original.color), {
        reverse: true,
      });
    if (disposed) return;
    chess.load(previewFen);
    refreshPieces();
    cell(to).classList.remove("wrong-square");
    previewFen = null;
    previewUci = null;
  };
  return dispose;
}
