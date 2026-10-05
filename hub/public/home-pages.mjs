// One ordered list over two pages. Page 1 gives each family one place; page 2 keeps everything else.
import {SHORTCUTS} from './home-shortcuts.mjs';
import {CATALOG} from './catalog.mjs';

const NUDGE_AT = 2;
const DAY = 86400000;
export const NEW_GAME_DAYS = 7;

// The start day and the next six household calendar days.
function dateIndex(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const at = Date.parse(day + 'T00:00:00Z');
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === day ? at / DAY : null;
}
export function activeNewGames(newGames = {}, day = new Date().toISOString().slice(0, 10)) {
  const today = dateIndex(day);
  if (today === null || !newGames || typeof newGames !== 'object' || Array.isArray(newGames)) return [];
  return Object.entries(newGames).filter(([, start]) => {
    const first = dateIndex(start);
    return first !== null && today >= first && today < first + NEW_GAME_DAYS;
  }).map(([id]) => id);
}

// Display families follow the hub destination, including shortcuts and catalog variants.
export function parentOf(id) {
  const card = [...SHORTCUTS, ...CATALOG].find(x => x.id === id);
  if (!card) return null;
  return card.game || (card.href ? card.href.replace(/^#/, '').split('/')[0] : null);
}
export const familyOf = id => parentOf(id) || id;

export function firstPage(cards, {count, nudge = null, newGames = {}, day, familyOrder = null, lead = 0, columns = 5} = {}) {
  const list = [];
  for (const card of Array.isArray(cards) ? cards : []) if (card && !list.some(c => c.id === card.id)) list.push(card);
  const limit = Math.max(0, Math.floor(count ?? list.length));
  if (!limit) return [];
  const byId = new Map(list.map(c => [c.id, c]));
  const boosted = activeNewGames(newGames, day).filter(id => byId.has(id));
  // One card per family: a new card wins its family, otherwise his most-played (visit counts, ties: last play, from
  // the smart order). The day's nudge is extra and never takes his favourite's place (2026-10-03: the nudge Letter
  // Labyrinth won the maze family and pushed Tracing Mazes and Make a Maze, his most-played games, off page one).
  const winners = new Map();
  const candidates = [...boosted, ...(Array.isArray(familyOrder) ? familyOrder : []), ...list.map(c => c.id)].filter(id => id !== nudge);
  for (const id of candidates) if (byId.has(id) && !winners.has(familyOf(id))) winners.set(familyOf(id), id);
  const eligible = list.filter(c => c.id === nudge || winners.get(familyOf(c.id)) === c.id);
  const reserved = [nudge, ...boosted].filter((id, i, all) => all.indexOf(id) === i && eligible.some(c => c.id === id)).slice(0, limit);
  const ordinary = eligible.filter(c => !reserved.includes(c.id)).slice(0, limit - reserved.length);
  const selected = new Set([...reserved, ...ordinary.map(c => c.id)]);
  const picks = eligible.filter(c => selected.has(c.id) && !reserved.includes(c.id));
  const move = (id, at) => {
    if (!reserved.includes(id)) return;
    const card = byId.get(id);
    picks.splice(Math.min(at, picks.length), 0, card);
  };
  move(nudge, NUDGE_AT);
  // The first slot of row two; on three-column screens the nudge already occupies it.
  let at = Math.max(columns - lead, nudge && picks.some(c => c.id === nudge) ? NUDGE_AT + 1 : 0);
  for (const id of boosted) if (id !== nudge && reserved.includes(id)) move(id, at++);
  return picks;
}

// Pinned destinations never enter the smart game order or the second page.
export function homePins(player) {
  if (!player || player.id === 'admin') return [];
  const small = player.world === 'small';
  return [
    {id:'my-world', name:small ? player.name + "'s World" : 'Castle Kingdom', href:'/world?player='+encodeURIComponent(player.id), icon:'/book-art/bg/real-foreground/'+(small ? 'volcanoPortrait.webp' : 'castle-gatePortrait.webp'), painted:true, description:'Your quest, friends and discoveries.', color:'#d5dfbc'},
    {id:'my-book', name:'My Book', href:'#my-book', icon:'/my-book.svg', description:'Today’s chapter, any time.', color:'#f0a52c'},
  ];
}

// Pinned cards stay first, and page 1 keeps the larger half including those cards.
export function homePages(cards, {lead = 0, ...options} = {}) {
  const list = [];
  for (const card of Array.isArray(cards) ? cards : []) if (card && !list.some(c => c.id === card.id)) list.push(card);
  const count = Math.max(0, Math.ceil((list.length + lead) / 2) - lead);
  const first = firstPage(list, {...options, count, lead});
  return {first, second: list.filter(c => !first.includes(c))};
}

// A swipe is a quick, mostly horizontal drag of at least 60 px; anything else is a tap or a scroll.
export function swipeDirection(dx, dy, ms = 0) {
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || ms > 800) return null;
  return dx < 0 ? 'next' : 'prev';
}
export function attachHomeSwipe(el, {next, prev} = {}) {
  if (!el) return;
  let start = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start = {x: e.clientX, y: e.clientY, t: performance.now()}; }, {passive: true});
  el.addEventListener('pointerup', e => {
    if (!start) return;
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y, performance.now() - start.t);
    start = null;
    if (dir === 'next' && next) next();
    if (dir === 'prev' && prev) prev();
  }, {passive: true});
  el.addEventListener('pointercancel', () => { start = null; }, {passive: true});
}
