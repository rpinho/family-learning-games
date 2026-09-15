import { rookAvatar } from "./rook.mjs";
import { PIECES } from "./pieces.mjs";
export function piece(type, color) {
  return PIECES[color + type.toUpperCase()] || "";
}
export function coach(mood = "idle") {
  return rookAvatar(mood).replace(
    "rook-puppet ",
    `rook-puppet academy-coach rook-${mood} `,
  );
}
export function landscape() {
  return `<svg viewBox="0 0 420 180" aria-hidden="true" class="academy-landscape"><circle cx="325" cy="39" r="24" fill="#eed494"/><path d="M0 138Q70 76 140 125Q215 64 296 127Q355 89 420 126V180H0Z" fill="#c4d3b9"/><path d="M0 169Q90 110 164 146Q287 106 420 151V180H0Z" fill="#94b2a8"/><path d="M212 58H261V139H205V58Z" fill="#e9e0ca"/><path d="M206 49H220V60H230V49H242V60H251V49H266V77H206Z" fill="#f9f0da"/><path d="M223 108Q234 92 246 108V140H223Z" fill="#4f6871"/><path d="M221 79H230V96H221ZM242 79H251V96H242Z" fill="#78979d"/><path d="M179 115H214V145H179Z" fill="#e4d7bf"/><path d="M177 114L196 95L217 114Z" fill="#906d94"/><path d="M231 141Q183 158 191 180H245Q217 158 242 141" fill="#eedebc"/><path d="M267 53V13L294 24L267 35" fill="#9c779f" stroke="#624e6d" stroke-width="2"/><path d="M101 149L115 114L129 149Z" fill="#558980"/><path d="M314 151L331 106L348 151Z" fill="#558980"/><path d="M361 160L374 125L388 160Z" fill="#42766f"/><g fill="#fff5d9"><path d="M80 39L83 46L91 49L83 51L80 59L77 51L70 49L77 46Z"/><circle cx="153" cy="58" r="3"/></g></svg>`;
}
