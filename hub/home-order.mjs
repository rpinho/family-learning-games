// One ordered home list per child: what he plays now on top, a forgotten favourite or two, and one nudge
// chosen from his skill evidence (skill-model.mjs): what would help now, given where he succeeds, where he
// struggles, his age and any outside report. Deterministic per child per local day, so the cards stay where he
// found them all day (history is read up to local midnight). Every card is always kept; nothing here is shown
// to the children except the order itself. The "why" goes to the hub diagnostics log for grown-ups.
import { activeNewGames, familyOf } from './public/home-pages.mjs';
import { CATALOG } from './public/catalog.mjs';
import { SHORTCUTS, MAX_SHORTCUTS } from './public/home-shortcuts.mjs';
import { visitStats, HISTORY } from './menu-order.mjs';
import { skillModel, nudgeCandidates, nudgeReason, skillSummary, MIN_NUDGE } from './skill-model.mjs';

const DAY = 86400000;
const IDS = CATALOG.map(g => g.id);
// Home slots after My Book: F = next most frequent now, N = the day's nudge, R = a forgotten favourite.
// The nudge is never above the third card: on a phone the first row (My Book + two cards) stays his favourites.
// An F slot above the nudge with no frequent card left takes the next card of the usual order, so the rule holds.
export const TEMPLATE = ['F', 'F', 'N', 'F', 'R', 'F', 'R'];
const RECENT = 7 * DAY;      // "recently" for forgotten favourites
const QUIET_DAYS = 3;        // not opened for at least this long
const USED_TO = 3;           // distinct visits before the last week that make a past favourite
const FREQUENT_SHIELD = 4;   // already this high by frequency: no need to sprinkle it

export function localDay(now, timeZone) {
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(now)).map(p => [p.type, p.value]));
  } catch { return localDay(now, 'UTC'); }
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  const start = now - (((+parts.hour * 60) + +parts.minute) * 60 + +parts.second) * 1000 - (((now % 1000) + 1000) % 1000);
  return { key, start, index: Math.round(Date.parse(key + 'T00:00:00Z') / DAY) };
}
export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffled(items, seed) {
  const out = [...items];
  let s = seed || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// The cards one child's home can show (catalog plus his reviewed shortcuts, at most six). My Book is
// added in front by the page itself.
export function homeCards(shortcuts = []) {
  const chosen = Array.isArray(shortcuts) ? [...new Set(shortcuts)].filter(id => SHORTCUTS.some(s => s.id === id)).slice(0, MAX_SHORTCUTS) : [];
  return [...IDS, ...chosen];
}
// Today's rotating pick: k consecutive items of a per-child fixed shuffle, moving k places a day.
function rotate(pool, k, player, dayIndex, salt) {
  if (!pool.length || k <= 0) return [];
  const perm = shuffled(pool, hash(player + ':' + salt));
  const n = perm.length, take = Math.min(k, n), at = ((dayIndex * take) % n + n) % n;
  return Array.from({ length: take }, (_, i) => perm[(at + i) % n]);
}

// `nudges` = the grown-ups' optional override list (forces the nudge; empty by default). Without it the nudge
// comes from `evidence` (skill-evidence.mjs records) and the private `profile` (age, context, outside reports).
// `shown` = the hub's log of past home lists ({player, day, nudge}): the last two days' nudges are read from it,
// or recomputed when a day was not logged.
export function smartHome(options) { return homeFor(options, 2); }
function homeFor(options, depth) {
  const { events = [], evidence = [], profile = null, shown = [], player, now = Date.now(), timeZone = 'UTC', shortcuts = [], nudges = [], newGames = {} } = options;
  const day = localDay(now, timeZone), cutoff = day.start;
  const cards = homeCards(shortcuts), favourites = cards.filter(id => !IDS.includes(id));
  const activity = Object.fromEntries(SHORTCUTS.map(s => [s.id, s.activity]));
  const rows = events.filter(e => e && e.player === player && Number.isFinite(e.at) && e.at < cutoff && e.at >= cutoff - HISTORY)
    .sort((a, b) => a.at - b.at || String(a.game).localeCompare(String(b.game)));
  const familyKey = r => IDS.includes(r.game) ? r.game : null, subKey = r => r.sub || null;
  const recentFam = visitStats(rows, familyKey, cutoff), recentSub = visitStats(rows, subKey, cutoff);
  const longFam = visitStats(rows, familyKey, cutoff, { window: HISTORY, decay: false }), longSub = visitStats(rows, subKey, cutoff, { window: HISTORY, decay: false });
  const stat = (id, fam, sub) => (IDS.includes(id) ? fam.get(id) : sub.get(activity[id])) || null;
  const score = id => stat(id, recentFam, recentSub)?.score || 0;
  const index = id => cards.indexOf(id);
  const last = id => stat(id, recentFam, recentSub)?.last || 0;
  // Family totals include every variant; compare a catalog card's direct visits with shortcut visits.
  const directFam=visitStats(rows.filter(r=>!r.sub),familyKey,cutoff);
  const familyStat=id=>stat(id,directFam,recentSub);
  const familyOrder = cards.slice().sort((a, b) => (familyStat(b)?.visits || 0) - (familyStat(a)?.visits || 0) || (familyStat(b)?.last||0)-(familyStat(a)?.last||0) || index(a) - index(b));
  const fresh = activeNewGames(newGames, day.key).filter(id => cards.includes(id));
  const frequent = cards.filter(id => score(id) > 0).sort((a, b) => score(b) - score(a) || last(b) - last(a) || index(a) - index(b));
  const shield = new Set(frequent.slice(0, FREQUENT_SHIELD));
  const why = {};
  const history = id => {
    const s = stat(id, longFam, longSub);
    const times = s?.times || [];
    return { before: times.filter(t => t < cutoff - RECENT).length, lastWeek: times.filter(t => t >= cutoff - RECENT).length, daysSince: s ? Math.floor((cutoff - s.last) / DAY) : null };
  };
  // One nudge a day, never a card already near the top. A grown-ups' override list wins (rotating daily);
  // otherwise the best-scoring card for his skills today, not the same as the last two days.
  const nudgeList = (Array.isArray(nudges) ? [...new Set(nudges)] : []).filter(id => cards.includes(id));
  const discoveryFamilies = new Set(fresh.map(familyOf));
  const discoveryCards = cards.filter(id => discoveryFamilies.has(familyOf(id)));
  const nudgePool = nudgeList.filter(id => !frequent.slice(0, 3).includes(id) && !discoveryCards.includes(id));
  let nudge = null, model = null, analytics = null;
  if (nudgeList.length) {
    nudge = nudgePool.length ? nudgePool[((day.index + hash(player)) % nudgePool.length + nudgePool.length) % nudgePool.length] : null;
    if (nudge) why[nudge] = 'nudge (grown-ups override list, rotates daily)';
  } else {
    model = skillModel({ evidence, player, cutoff, profile });
    // No evidence and no profile: nothing to base a nudge on.
    if (model.firsts.length || model.profile.age != null) {
      const previous = [];
      const logged = new Map();
      for (const x of (Array.isArray(shown) ? shown : []).filter(x => x && x.player === player && typeof x.day === 'string').sort((a, b) => (a.at || 0) - (b.at || 0))) logged.set(x.day, x.nudge || null);
      for (let k = 0, t = cutoff - 1; k < 2; k++) {
        const key = localDay(t, timeZone).key;
        previous.push(logged.has(key) ? logged.get(key) : depth > 0 ? homeFor({ ...options, now: t }, depth - 1).nudge : null);
        t = localDay(t, timeZone).start - 1;
      }
      const candidates = nudgeCandidates({ model, cards, cutoff, exclude: [...frequent.slice(0, 3), ...discoveryCards], previous, seed: player + ':' + day.key, hash });
      const pick = candidates[0]?.score >= MIN_NUDGE ? candidates[0] : null;
      if (pick) { nudge = pick.card; why[nudge] = nudgeReason(pick, model); }
      analytics = { pick: pick ? { card: pick.card, skill: pick.skill, score: +pick.score.toFixed(3), fit: pick.fit } : null, previous,
        candidates: candidates.slice(0, 5).map(c => ({ card: c.card, skill: c.skill, score: +c.score.toFixed(3), fresh: c.fresh })) };
    }
  }
  // Forgotten favourites: played a lot before last week but quiet now, plus reviewed shortcuts not opened lately.
  const forgottenPool = cards.filter(id => {
    if (id === nudge || fresh.includes(id) || shield.has(id)) return false;
    const h = history(id), quiet = h.daysSince === null || h.daysSince >= QUIET_DAYS;
    if (h.before >= USED_TO && h.lastWeek <= 1 && quiet) return true;
    return favourites.includes(id) && quiet;
  });
  const forgotten = rotate(forgottenPool, 2, player, day.index, 'forgotten');
  for (const id of forgotten) {
    const h = history(id);
    why[id] = h.before >= USED_TO ? `forgotten favourite (${h.before} visits before last week, last ${h.daysSince} days ago)` : `reviewed favourite, quiet ${h.daysSince === null ? 'so far' : h.daysSince + ' days'}`;
  }
  const order = [], used = new Set();
  const take = id => { if (id && !used.has(id)) { used.add(id); order.push(id); return true; } return false; };
  // Everything else: recent frequency, then reviewed favourites, then the usual catalog order.
  const usual = cards.slice().sort((a, b) => score(b) - score(a) || last(b) - last(a) || favourites.includes(b) - favourites.includes(a) || index(a) - index(b));
  const usualWhy = id => score(id) > 0 ? `by recent play (score ${score(id).toFixed(2)})` : favourites.includes(id) ? 'reviewed favourite, no recent play' : 'not played recently';
  let f = 0, r = 0;
  for (const slot of TEMPLATE) {
    if (slot === 'N') take(nudge);
    else if (slot === 'R') { while (r < forgotten.length && !take(forgotten[r++])); }
    else {
      while (f < frequent.length && used.has(frequent[f])) f++;
      if (f < frequent.length) { const id = frequent[f++]; take(id); why[id] = `frequent now #${frequent.indexOf(id) + 1} (score ${score(id).toFixed(2)}, ${stat(id, recentFam, recentSub)?.visits || 0} visits/14d)`; }
      else if (order.length < TEMPLATE.indexOf('N')) { const id = usual.find(id => !used.has(id) && id !== nudge && !forgotten.includes(id)); if (take(id)) why[id] ||= usualWhy(id); }
    }
  }
  for (const id of usual) if (take(id)) why[id] ||= usualWhy(id);
  // New discoveries keep a second-row slot for seven days, independent of play count.
  for (const id of fresh) if (id !== nudge) order.splice(order.indexOf(id), 1);
  if (fresh.length && nudge) { order.splice(order.indexOf(nudge), 1); order.splice(Math.min(2, order.length), 0, nudge); }
  let freshAt = 4;
  for (const id of fresh) {
    why[id] = `new game (from ${newGames[id]}, 7 days)` + (id === nudge ? '; ' + why[id] : '');
    if (id === nudge) continue;
    order.splice(Math.min(freshAt++, order.length), 0, id);
  }
  return { day: day.key, order, why, nudge, familyOrder, newGames: fresh, forgotten, frequent: frequent.slice(0, 4), ...(model ? { skills: skillSummary(model), analytics } : {}) };
}
