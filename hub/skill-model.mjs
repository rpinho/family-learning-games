// Per-child skill model and the home nudge score (grown-ups' diagnostics only; nothing here is shown to
// the children). Evidence comes from skill-evidence.mjs. Learning claims need evidence: success here is
// first-try independence inside our games, not mastery, and correct-with-help is kept apart from
// independent. Child-specific priorities never live in this public file: they arrive in a private
// per-child profile ({age, context, focus, reports}), and without one every skill is neutral.
import { SHORTCUTS } from './public/home-shortcuts.mjs';

const DAY = 86400000;
export const HISTORY = 45 * DAY;
const RECENT = 14 * DAY, CARD_WINDOW = 21 * DAY, MIN_ITEMS = 6, CARD_MIN = 8;

// Skill areas, with the ages they are usually worked on (ages) and the years they are central (core).
export const SKILLS = {
  sounds: {label: 'letter names and sounds', ages: [3, 8], core: [4, 6]},
  reading: {label: 'decoding and reading words', ages: [4, 11], core: [6, 9]},
  number: {label: 'number sense and early math', ages: [3, 9], core: [4, 7]},
  muldiv: {label: 'multiplication and division', ages: [7, 12], core: [8, 11]},
  motor: {label: 'fine motor and tracing', ages: [3, 9], core: [4, 7]},
  planning: {label: 'planning and mazes', ages: [4, 14], core: [5, 12]},
  chess: {label: 'chess', ages: [5, 99], core: null},
};
// What each home card practises (0-1) and the ages it suits. Shortcut cards share their activity's evidence.
export const CARD_FIT = {
  'letter-quest': {ages: [4, 9], skills: {reading: 1, sounds: 0.8}},
  'word-arcade': {ages: [5, 10], skills: {reading: 1, sounds: 0.5}},
  'letter-slalom': {ages: [4, 9], skills: {sounds: 1, reading: 0.6}},
  hunt: {ages: [4, 8], skills: {sounds: 1, reading: 0.4}},
  'number-park': {ages: [4, 10], skills: {number: 1, muldiv: 0.6, motor: 0.3}},
  'drawing-studio': {ages: [3, 12], skills: {motor: 0.8}},
  'maze-garden': {ages: [4, 12], skills: {planning: 1, motor: 0.6, reading: 0.3}},
  chess: {ages: [5, 99], skills: {chess: 1, planning: 0.4}},
  'three-in-a-row': {ages: [4, 8], skills: {planning: 0.6}},
  'target-trail': {ages: [4, 9], skills: {sounds: 0.5, motor: 0.3}},
  sling: {ages: [4, 10], skills: {motor: 0.3}},
  'dribble-duel': {ages: [4, 12], skills: {sounds: 0.4, reading: 0.3}},
  'snack-friend': {ages: [7, 11], skills: {muldiv: 1, number: 0.5}},
  'cookie-share': {ages: [4, 7], skills: {number: 1}},
  'pattern-parade': {ages: [3, 7], skills: {number: 0.8, planning: 0.3}},
  'trace-numbers': {ages: [3, 7], skills: {motor: 1, number: 0.4}},
  'take-away': {ages: [4, 7], skills: {number: 1}},
  'maze-maker': {ages: [5, 12], skills: {planning: 0.8, motor: 0.5}},
  'maze-trace': {ages: [4, 12], skills: {motor: 0.8, planning: 0.8}},
  'letter-labyrinth': {ages: [5, 10], skills: {reading: 1, sounds: 0.6, planning: 0.4}},
};
const activityOf = Object.fromEntries(SHORTCUTS.map(s => [s.id, s.activity]));
const cardKey = id => activityOf[id] || id;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const round = (x, d = 2) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;
const pct = x => x == null ? 'n/a' : Math.round(x * 100) + '%';

// The private profile: {age, context: {skill: 0-2}, focus: {skill: 0-2}, reports: [{focus}]}. Anything
// Malformed entries are ignored; unknown skills are dropped. `focus` contains optional reported priorities.
export function normalizeProfile(raw) {
  const weights = obj => Object.fromEntries(Object.entries(obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {})
    .filter(([k, v]) => SKILLS[k] && Number.isFinite(v)).map(([k, v]) => [k, clamp(v, 0, 2)]));
  const p = raw && typeof raw === 'object' ? raw : {};
  const focus = weights(p.focus);
  for (const report of Array.isArray(p.reports) ? p.reports : []) for (const [k, v] of Object.entries(weights(report?.focus))) focus[k] = Math.max(focus[k] || 0, v);
  const age = Number.isFinite(p.age) && p.age > 1 && p.age < 19 ? p.age : null;
  return {age, context: weights(p.context), focus};
}
export function ageWeight(skill, age) {
  const s = SKILLS[skill];
  if (!s) return 0;
  if (age == null) return 0.6;
  if (age < s.ages[0] || age > s.ages[1]) return 0;
  return s.core && age >= s.core[0] && age <= s.core[1] ? 1 : 0.5;
}

function rate(list) {
  const n = list.length;
  if (!n) return {n: 0, ind: null, assisted: null, miss: null};
  let ind = 0, assisted = 0, miss = 0;
  for (const i of list) { if (!i.ok) miss++; else if (i.help) assisted++; else ind++; }
  return {n, ind: ind / n, assisted: assisted / n, miss: miss / n};
}
function status(r, practised) {
  if (r.n < MIN_ITEMS) return practised ? 'practice-only' : 'unknown';
  if (r.ind >= 0.95 && r.n >= 10) return 'too-easy';
  if (r.ind < 0.3 && r.miss >= 0.5 && r.n >= 8) return 'too-hard';
  if (r.ind >= 0.5 && r.ind <= 0.8) return 'edge';
  return r.ind > 0.8 ? 'secure' : 'stretch';
}
// Value of practising now, by where he is: at the edge (50-80% independent) most, a stretch (where he struggles
// but still succeeds with help) nearly as much; never what is too easy or keeps failing.
const EDGE = {edge: 1, stretch: 0.85, unknown: 0.5, 'practice-only': 0.5, 'too-easy': 0, 'too-hard': 0};

// First answers per item (later retries ignored; an earlier hint on the item marks it helped), plus every
// practice time per skill, for one player up to `cutoff` (local midnight: the model is fixed all day).
export function firstAnswers(evidence, player, cutoff) {
  const rows = (Array.isArray(evidence) ? evidence : []).filter(e => e && e.player === player && SKILLS[e.skill] && Number.isFinite(e.at) && e.at < cutoff && e.at >= cutoff - HISTORY)
    .sort((a, b) => a.at - b.at || String(a.item).localeCompare(String(b.item)) || (b.hint ? 1 : 0) - (a.hint ? 1 : 0));
  const hinted = new Set(), seen = new Set(), firsts = [], practice = {};
  for (const e of rows) {
    (practice[e.skill] ||= []).push(e.at);
    if (e.hint) { if (e.item) hinted.add(e.item); continue; }
    if (typeof e.ok !== 'boolean' || !e.item || seen.has(e.item)) continue;
    seen.add(e.item);
    firsts.push({skill: e.skill, keys: Array.isArray(e.keys) ? e.keys : [], at: e.at, ok: e.ok, help: !!e.help || hinted.has(e.item)});
  }
  return {firsts, practice};
}

export function skillModel({evidence = [], player, cutoff, profile = null}) {
  const p = normalizeProfile(profile), {firsts, practice} = firstAnswers(evidence, player, cutoff);
  const skills = {};
  for (const skill of Object.keys(SKILLS)) {
    const items = firsts.filter(i => i.skill === skill), times = practice[skill] || [];
    const recent = items.filter(i => i.at >= cutoff - RECENT);
    const older = recent.length < MIN_ITEMS && items.length > recent.length;
    const basis = rate(older ? items.slice(-20) : recent);
    const last7 = rate(items.filter(i => i.at >= cutoff - 7 * DAY)), prior = rate(items.filter(i => i.at < cutoff - 7 * DAY && i.at >= cutoff - 28 * DAY));
    const daysIn = span => new Set(times.filter(t => t >= cutoff - span).map(t => Math.floor((cutoff - 1 - t) / DAY))).size;
    const last = times.length ? Math.max(...times) : null;
    const st = status(basis, times.length > 0);
    const core = ageWeight(skill, p.age) === 1;
    const importance = ageWeight(skill, p.age) * (1 + (p.context[skill] || 0) + (p.focus[skill] || 0));
    // daysSince: whole days before today (1 = yesterday; the model stops at local midnight).
    const days14 = daysIn(RECENT), daysSince = last == null ? null : Math.floor((cutoff - last) / DAY) + 1;
    const gap = clamp(1 - days14 / (core ? 4 : 2)), stale = daysSince == null ? 1 : clamp((daysSince - 3) / 8);
    const practiceNeed = Math.max(gap, stale);
    let edge = EDGE[st];
    if (st === 'secure') edge = 0.6 - 0.5 * clamp((basis.ind - 0.8) / 0.15);
    const trend = last7.n >= 5 && prior.n >= 5 ? last7.ind - prior.ind : null;
    // Falling independence this week adds a little need (at most a quarter).
    const need = (st === 'too-easy' || st === 'too-hard') ? 0 : importance * (0.6 * edge + 0.4 * practiceNeed) * (1 + clamp(-(trend || 0), 0, 0.25));
    skills[skill] = {n: basis.n, window: older ? 'older' : '14d', ind: round(basis.ind), assisted: round(basis.assisted), miss: round(basis.miss),
      trend: round(trend), days7: daysIn(7 * DAY), days14, daysSince, status: st,
      importance: round(importance), practiceNeed: round(practiceNeed), need: round(need, 3)};
  }
  return {profile: p, skills, firsts};
}

// How well a card suits practising `skill` for this child right now: what it practises, whether it suits his
// age, and whether he succeeds there (never a card he has found too easy or too hard lately).
export function cardFit(card, skill, {age = null, firsts = [], cutoff}) {
  const spec = CARD_FIT[card], w = spec?.skills?.[skill] || 0;
  if (!w) return {fit: 0};
  if (age != null && (age < spec.ages[0] || age > spec.ages[1])) return {fit: 0, note: 'not for his age'};
  const key = cardKey(card), mine = firsts.filter(i => i.keys.includes(key));
  const recent = mine.filter(i => i.at >= cutoff - CARD_WINDOW);
  const r = rate(recent.length >= CARD_MIN ? recent : mine.slice(-20));
  let factor = 0.85, note = 'little card evidence';
  if (r.n >= CARD_MIN) {
    if (r.ind >= 0.95) { factor = 0; note = 'too easy here'; }
    else if (r.ind < 0.3 && r.miss >= 0.5) { factor = 0; note = 'too hard here'; }
    else if (r.ind >= 0.5 && r.ind <= 0.9) { factor = 1; note = 'succeeds here'; }
    else { factor = 0.75; note = r.ind > 0.9 ? 'mostly easy here' : 'leans on help here'; }
  }
  return {fit: w * factor, weight: w, card: {n: r.n, ind: round(r.ind), assisted: round(r.assisted), miss: round(r.miss)}, note};
}

// The skill a card practises most (for "same skill as yesterday").
export function primarySkill(card) {
  const skills = CARD_FIT[card]?.skills;
  return skills ? Object.entries(skills).sort((a, b) => b[1] - a[1])[0][0] : null;
}
// Score every card: need (skill) x fit (card) x freshness (not nudged the last two days). A card's score is its
// best skill plus a quarter of what else it practises. `exclude` = cards that need no nudge (already played most).
export function nudgeCandidates({model, cards, cutoff, exclude = [], previous = [], seed = 0, hash = () => 0}) {
  const out = [];
  for (const card of cards) {
    if (exclude.includes(card) || !CARD_FIT[card]) continue;
    const parts = Object.keys(SKILLS).map(skill => {
      const fit = cardFit(card, skill, {age: model.profile.age, firsts: model.firsts, cutoff});
      return {skill, value: (model.skills[skill]?.need || 0) * fit.fit, fit};
    }).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    if (!parts.length) continue;
    const total = parts.reduce((s, x) => s + x.value, 0), base = parts[0].value + 0.25 * (total - parts[0].value);
    // Freshness: the same card yesterday x0.3 (two days ago x0.7); the same skill both days x0.75, yesterday x0.9.
    const same = previous.slice(0, 2).map(c => primarySkill(c) === parts[0].skill);
    const fresh = (previous[0] === card ? 0.3 : previous[1] === card ? 0.7 : 1) * (same[0] && same[1] ? 0.75 : same[0] ? 0.9 : 1);
    const jitter = 1 + 0.03 * ((hash(seed + ':' + card) % 1000) / 1000);
    out.push({card, skill: parts[0].skill, score: base * fresh * jitter, fresh: +fresh.toFixed(3), need: model.skills[parts[0].skill].need, fit: parts[0].fit, also: parts.slice(1, 3).map(x => x.skill)});
  }
  return out.sort((a, b) => b.score - a.score || a.card.localeCompare(b.card));
}
export const MIN_NUDGE = 0.15;

// One line for the diagnostics log: the skill evidence behind today's nudge.
export function nudgeReason(pick, model) {
  const s = model.skills[pick.skill], label = SKILLS[pick.skill].label, c = pick.fit.card || {};
  const p = model.profile, priority = [(p.context[pick.skill] ? 'child-context priority ' + p.context[pick.skill] : ''), (p.focus[pick.skill] ? 'outside-report focus ' + p.focus[pick.skill] : '')].filter(Boolean).join(', ');
  const evidence = s.n ? `${pct(s.ind)} independent first try, ${pct(s.assisted)} with help, ${pct(s.miss)} missed (n=${s.n}, ${s.window})` : 'no scored answers yet';
  return `nudge (analytics): ${label} [${s.status}] ${evidence}; trend ${s.trend == null ? 'n/a' : (s.trend >= 0 ? '+' : '') + Math.round(s.trend * 100) + ' pts'}; ` +
    `${s.days14} active days/14d, last ${s.daysSince == null ? 'never' : s.daysSince + 'd ago'}; age weight ${ageWeight(pick.skill, p.age)}${priority ? '; ' + priority : ''}; ` +
    `card: ${pick.fit.note}${c.n ? ` (${pct(c.ind)} independent, n=${c.n})` : ''}; score ${pick.score.toFixed(2)} = need ${s.need.toFixed(2)} x fit ${pick.fit.fit.toFixed(2)} x fresh ${pick.fresh}`;
}
// The numbers per skill, compact, for the diagnostics row and /api/menu?why=1.
export function skillSummary(model) {
  return Object.fromEntries(Object.entries(model.skills).map(([k, s]) => [k, {n: s.n, ind: s.ind, assisted: s.assisted, miss: s.miss, trend: s.trend, days7: s.days7, days14: s.days14, daysSince: s.daysSince, status: s.status, need: round(s.need)}]));
}
