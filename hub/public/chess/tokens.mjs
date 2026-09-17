// Original Rook Academy playing pieces. Shared geometry keeps both sides equally legible.
// No fonts, raster textures, filters or document-global SVG IDs are required.
const shapes = {
  p: {body: 'M29 39Q30 49 24 57Q20 62 22 66Q40 74 58 66Q60 62 56 57Q50 49 51 39Z', top: '<circle cx="40" cy="28" r="13"/>', shine: 'M33 22Q36 18 41 19', seam: 'M28 58Q40 63 52 58'},
  r: {body: 'M24 31L27 57L22 63V68Q40 74 58 68V63L53 57L56 31Z', top: '<path d="M20 15Q20 12 23 12H29V22H35V12H45V22H51V12H57Q60 12 60 15V31Q40 40 20 31Z"/>', shine: 'M25 16V28M32 42V54', seam: 'M27 57Q40 62 53 57'},
  n: {body: 'M22 65Q24 55 33 47L27 40L18 43Q13 43 14 36L23 22L28 13L34 17L42 10Q45 17 45 20Q66 26 60 62L59 68Q40 76 22 68Z', top: '', shine: 'M39 24Q53 26 54 41', seam: 'M24 62Q40 68 57 62', detail: '<circle cx="29" cy="30" r="2.7" fill="var(--piece-line)" stroke="none"/><path d="M18 37L25 38M34 44Q42 44 45 39" fill="none" stroke="var(--piece-line)" stroke-width="2.5" stroke-linecap="round"/>'},
  b: {body: 'M31 41Q31 51 25 59L22 64V68Q40 75 58 68V64L55 59Q49 51 49 41Z', top: '<path d="M40 12Q20 27 25 39Q29 48 40 48Q51 48 55 39Q60 27 40 12Z"/><circle cx="40" cy="10" r="4"/>', shine: 'M34 25L31 31', seam: 'M28 58Q40 63 52 58', detail: '<path d="M46 21L37 33" fill="none" stroke="var(--piece-line)" stroke-width="4" stroke-linecap="round"/>'},
  q: {body: 'M27 38Q29 53 23 62V68Q40 75 57 68V62Q51 53 53 38Z', top: '<path d="M24 43L16 23L29 29L28 16L40 27L52 16L51 29L64 23L56 43Q40 50 24 43Z"/><circle cx="16" cy="21" r="3.5"/><circle cx="28" cy="14" r="3.5"/><circle cx="52" cy="14" r="3.5"/><circle cx="64" cy="21" r="3.5"/>', shine: 'M29 37L24 31M33 52V57', seam: 'M27 61Q40 66 53 61'},
  k: {body: 'M26 39Q28 52 23 62V68Q40 75 57 68V62Q52 52 54 39Z', top: '<path d="M25 45Q16 39 19 29Q22 21 33 26H47Q58 21 61 29Q64 39 55 45Q40 52 25 45Z"/><path d="M36 8H44V15H51V23H44V30H36V23H29V15H36Z"/>', shine: 'M25 31Q23 36 28 39M33 53V58', seam: 'M27 61Q40 66 53 61'},
};
function token(type, color) {
  const s=shapes[type], white=color==='w';
  const palette=white?'--piece-front:#f8fcfc;--piece-depth:#bed3dc;--piece-line:#658291;--piece-light:#fff':'--piece-front:#43586e;--piece-depth:#273c50;--piece-line:#253a4b;--piece-light:#8097aa';
  const silhouette=`<path d="${s.body}"/>${s.top}`;
  return `<svg class="chess-piece piece-${type} piece-${color}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 84" style="${palette}"><ellipse class="piece-shadow" cx="40" cy="75" rx="23" ry="5" fill="#1a3549" opacity=".16"/><g class="piece-sculpt" stroke="var(--piece-line)" stroke-width="2.5" stroke-linejoin="round"><g fill="var(--piece-depth)" transform="translate(0 3)">${silhouette}</g><g fill="var(--piece-front)">${silhouette}</g><path d="${s.shine}" fill="none" stroke="var(--piece-light)" stroke-width="4" stroke-linecap="round"/><path d="${s.seam}" fill="none" stroke="var(--piece-depth)" stroke-width="3" stroke-linecap="round"/>${s.detail||''}</g></svg>`;
}
export const PIECES = Object.fromEntries(['w','b'].flatMap(color=>Object.keys(shapes).map(type=>[color+type.toUpperCase(),token(type,color)])));
