import { rookAvatar } from "./rook.mjs";
// Original vector artwork. No third-party character or chess-piece assets.
export function piece(type, color) {
  const fill = color === "w" ? "#fffdf1" : "#294e56",
    stroke = color === "w" ? "#394f50" : "#102e36",
    accent = color === "w" ? "#dfd3b5" : "#213640";
  const paths = {
    p: `<circle cx="30" cy="17" r="8"/><path d="M24 26H36L38 40H22Z"/><path d="M19 43H41L44 50H16Z"/>`,
    r: `<path d="M15 11H23V18H27V11H34V18H38V11H46V26H40L38 43H22L20 26H15Z"/><path d="M19 43H41L45 51H15Z"/><path d="M21 29H39" fill="none"/>`,
    n: `<path d="M19 43C19 34 31 31 32 25L22 29L12 25L21 14L24 6L33 12C47 16 47 35 39 44Z"/><path d="M18 44H42L46 51H14Z"/><path d="M32 15L39 24" fill="none"/><circle cx="26" cy="20" r="2" fill="${stroke}" stroke="none"/>`,
    b: `<path d="M30 7C18 17 16 23 22 29L25 33L22 43H38L35 33L39 28C44 23 41 16 30 7Z"/><path d="M33 13L26 24" fill="none"/><path d="M19 44H41L45 51H15Z"/><circle cx="30" cy="6" r="3"/>`,
    q: `<path d="M14 20L23 28L30 14L37 28L46 20L40 41H20Z"/><path d="M20 41H40L45 51H15Z"/><circle cx="12" cy="17" r="4"/><circle cx="30" cy="11" r="4"/><circle cx="48" cy="17" r="4"/><path d="M22 35H38" fill="none"/>`,
    k: `<path d="M27 5H33V11H39V17H33V23H27V17H21V11H27Z"/><path d="M30 26C20 16 9 27 20 37L23 42H37L40 37C51 27 40 16 30 26Z"/><path d="M20 42H40L45 51H15Z"/>`,
  };
  return `<svg viewBox="0 0 60 60" aria-hidden="true" class="chess-piece"><ellipse cx="30" cy="53" rx="20" ry="3" fill="#142b3322"/><g fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths[type]}</g><path d="M21 46H39" stroke="${color === "w" ? "#fff" : "#6e9497"}" stroke-width="2.5" stroke-linecap="round"/><path d="M18 50H42" stroke="${accent}" stroke-width="2.5" opacity=".75"/></svg>`;
}
export function coach(mood = "idle") {
  return rookAvatar(mood === "happy" ? "happy" : "idle").replace(
    "rook-puppet ",
    `rook-puppet academy-coach rook-${mood} `,
  );
}
export function landscape() {
  return `<svg viewBox="0 0 420 180" aria-hidden="true" class="academy-landscape"><circle cx="325" cy="39" r="24" fill="#eed494"/><path d="M0 138Q70 76 140 125Q215 64 296 127Q355 89 420 126V180H0Z" fill="#c4d3b9"/><path d="M0 169Q90 110 164 146Q287 106 420 151V180H0Z" fill="#94b2a8"/><path d="M212 58H261V139H205V58Z" fill="#e9e0ca"/><path d="M206 49H220V60H230V49H242V60H251V49H266V77H206Z" fill="#f9f0da"/><path d="M223 108Q234 92 246 108V140H223Z" fill="#4f6871"/><path d="M221 79H230V96H221ZM242 79H251V96H242Z" fill="#78979d"/><path d="M179 115H214V145H179Z" fill="#e4d7bf"/><path d="M177 114L196 95L217 114Z" fill="#906d94"/><path d="M231 141Q183 158 191 180H245Q217 158 242 141" fill="#eedebc"/><path d="M267 53V13L294 24L267 35" fill="#9c779f" stroke="#624e6d" stroke-width="2"/><path d="M101 149L115 114L129 149Z" fill="#558980"/><path d="M314 151L331 106L348 151Z" fill="#558980"/><path d="M361 160L374 125L388 160Z" fill="#42766f"/><g fill="#fff5d9"><path d="M80 39L83 46L91 49L83 51L80 59L77 51L70 49L77 46Z"/><circle cx="153" cy="58" r="3"/></g></svg>`;
}
