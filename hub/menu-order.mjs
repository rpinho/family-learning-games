import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { CATALOG } from './public/catalog.mjs';
import { SHORTCUTS } from './public/home-shortcuts.mjs';
import { skillEvidence } from './skill-evidence.mjs';

const IDS = CATALOG.map(g => g.id);
const DAY = 86400000;
const WINDOW = 14 * DAY;
// Longer history is read only to find forgotten favourites (see home-order.mjs).
export const HISTORY = 45 * DAY;

// Distinct game opens and actual play count. Speech, settings, hints, bots and rejected
// requests are not visits. Map storage owners to today's activity families.
export function activityFor(source, row) {
  if (source === 'hub') {
    if(row.type==='client'&&row.kind==='open_game'){const id=String(row.detail||'').split('/')[0];return IDS.includes(id)?id:null;}
    if (row.type === 'chess' && ['move', 'game-move'].includes(row.action)) return 'chess';
    if (row.type === 'dribble' && ['move', 'feint', 'answer'].includes(row.input?.type)) return 'dribble-duel';
    if (row.type === 'dribble-live' && ['live-checkpoint', 'live-finish'].includes(row.input?.type)) return 'dribble-duel';
    return null;
  }
  if (source === 'letter-quest') {
    const kind = row.input?.kind;
    if (['maze_action', 'rescue_action'].includes(row.type) && ['forward', 'turn', 'answer', 'plan'].includes(kind)) return 'maze-garden';
    if (row.type === 'soccer_action' && ['answer', 'aim'].includes(kind)) return 'dribble-duel';
    if (row.type === 'attempt' || row.type === 'reading_action' && ['answer', 'draft', 'ink', 'position'].includes(kind) || row.type === 'story_action' && kind === 'move') return 'letter-quest';
    if (row.type === 'profile_action' && ['duel', 'quest', 'adventure'].includes(row.action)) return 'letter-quest';
    return null;
  }
  if (source === 'maze-garden') return ['moves', 'answer', 'challenge', 'maker-draft', 'maker-build', 'maker-moves', 'maker-answer'].includes(row.event) ? source : null;
  if(source==='word-arcade'&&row.type==='client'&&row.event?.kind==='open'){return row.event.game==='slalom'?'letter-slalom':'word-arcade';}
  if (row.type !== 'action') return null;
  const action = row.input?.kind || row.input?.type;
  if(source === 'number-park'&&['art_guess','art_label','drawing'].includes(action))return 'drawing-studio';
  if(source === 'target-trail'&&action === 'sling-shot')return 'sling';
  if(source==='word-arcade'&&[row.input?.game,row.before?.game,row.after?.game].includes('slalom')&&['start','answer','next'].includes(action))return 'letter-slalom';
  const play = {
    'number-park': ['trace', 'answer', 'plan_cards', 'plan_step', 'plan_run', 'art_part', 'shape', 'reading_answer', 'cookie-place', 'cookie-check', 'cookie-answer', 'balance-k-place'],
    'word-arcade': ['answer', 'draft', 'art'],
    'three-in-a-row': ['move'],
    'target-trail': ['shot', 'reading'],
  };
  return play[source]?.includes(action) ? source : null;
}

// Same rule: opens and actual play, never hints/voice/settings. Keys are named in home-shortcuts.mjs.
const HUB_SUB = {'maze-garden/maker': 'maze:maker', 'maze-garden/trace': 'maze:trace', 'maze-garden/letters': 'lq:maze'};
export function subActivityFor(source, row) {
  if (source === 'hub') {
    if (row.type !== 'client' || row.kind !== 'open_game') return null;
    const detail = String(row.detail || '');
    return HUB_SUB[detail] || SHORTCUTS.find(s => s.id === detail)?.activity || null;
  }
  if (source === 'number-park' && row.type === 'action') {
    const kind = row.input?.kind;
    if (['cookie-place', 'cookie-check', 'cookie-answer'].includes(kind)) return 'np:cookies';
    if (kind === 'balance-k-place'&&row.before?.game==='balance-k') return 'np:balance-k';
    if (kind === 'trace') return 'np:trace';
    const game = kind === 'start' ? row.input?.game : kind === 'answer' ? row.before?.game : null;
    return ['cookies', 'pattern', 'subtract', 'balance', 'balance-k'].includes(game) ? 'np:' + game : null;
  }
  if (source === 'maze-garden') {
    if (['maker-draft', 'maker-build', 'maker-moves', 'maker-answer'].includes(row.event)) return 'maze:maker';
    return ['moves', 'answer', 'challenge'].includes(row.event) ? 'maze:trace' : null;
  }
  if (source === 'letter-quest' && row.type === 'maze_action' && ['forward', 'turn', 'answer', 'plan'].includes(row.input?.kind)) return 'lq:maze';
  return null;
}

// Distinct visits per key: a new visit when the key changes or after ten quiet minutes, at most six a
// day per key. Rows must be one stream (sorted by time). Weight halves every three days when decaying.
export function visitStats(rows, keyOf, now, { window = WINDOW, decay = true } = {}) {
  const stats = new Map();
  const days = new Map();
  let previous;
  for (const row of rows) {
    if (!(row.at <= now && row.at >= now - window)) continue;
    const key = keyOf(row);
    if (!key) continue;
    if (!previous || key !== previous.key || row.at - previous.at >= 10 * 60000) {
      const day = key + ':' + Math.floor(row.at / DAY);
      const count = days.get(day) || 0;
      if (count < 6) {
        const s = stats.get(key) || { score: 0, visits: 0, first: row.at, last: row.at, times: [] };
        s.score += decay ? 2 ** (-(now - row.at) / (3 * DAY)) : 1;
        s.visits++; s.last = row.at; s.times.push(row.at);
        stats.set(key, s);
        days.set(day, count + 1);
      }
    }
    previous = { key, at: row.at };
  }
  return stats;
}

export function rankPlay(events, player, now = Date.now()) {
  const rows = events.filter(e => e.player === player && IDS.includes(e.game) && Number.isFinite(e.at) && e.at <= now && e.at >= now - WINDOW)
    .sort((a, b) => a.at - b.at || a.game.localeCompare(b.game));
  const stats = visitStats(rows, row => row.game, now);
  const scores = Object.fromEntries(IDS.map(id => [id, stats.get(id)?.score || 0]));
  const visits = Object.fromEntries(IDS.map(id => [id, stats.get(id)?.visits || 0]));
  // Stable catalog ties retain every game, including ones not tried yet.
  const order = [...IDS].sort((a, b) => scores[b] - scores[a] || IDS.indexOf(a) - IDS.indexOf(b));
  return { order, scores, visits };
}

export function menuOrderService({ sources, players, clock = Date.now }) {
  const files = new Map();
  let refreshAt = 0, pending, points = [], evidence = [], shown = [];
  async function refresh() {
    const now = clock(), seen = new Set();
    const resets = new Map();
    for (const [source, directory] of Object.entries(sources)) {
      let names;
      try { names = await readdir(directory); }
      catch (e) { if (e.code === 'ENOENT') continue; throw e; }
      for (const name of names.sort()) {
        if (!/^\d{4}-\d{2}-\d{2}(?:-\d+)?\.jsonl$/.test(name)) continue;
        const date = Date.parse(name.slice(0, 10));
        if (date + DAY < now - HISTORY || date > now) continue;
        const path = join(directory, name), info = await stat(path);
        seen.add(path);
        let cached = files.get(path);
        if (!cached || cached.size !== info.size || cached.mtime !== info.mtimeMs) {
          cached = { size: info.size, mtime: info.mtimeMs, points: [], evidence: [], shown: [], resets: [] };
          const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
          for await (const line of lines) {
            let row;
            try { row = JSON.parse(line); } catch { continue; } // includes an unfinished final log line
            if (!players.includes(row.player)) continue;
            const at = Date.parse(row.at);
            if (!Number.isFinite(at)) continue;
            if (source === 'letter-quest' && row.type === 'profile_reset_completed') cached.resets.push({ player: row.player, source, at });
            const game = activityFor(source, row), sub = subActivityFor(source, row);
            if (game || sub) cached.points.push({ player: row.player, game, sub, source, at });
            for (const e of skillEvidence(source, row, at) || []) cached.evidence.push({ ...e, player: row.player, source, at });
            // The hub's own record of each day's home list: which card was the nudge (for "not nudged yesterday").
            if (source === 'hub' && row.type === 'menu_home' && typeof row.day === 'string') cached.shown.push({ player: row.player, day: row.day, nudge: typeof row.nudge === 'string' ? row.nudge : null, at });
          }
          files.set(path, cached);
        }
        for (const reset of cached.resets) {
          const key = reset.source + ':' + reset.player;
          resets.set(key, Math.max(resets.get(key) || 0, reset.at));
        }
      }
    }
    for (const key of files.keys()) if (!seen.has(key)) files.delete(key);
    const kept = p => p.at >= (resets.get(p.source + ':' + p.player) || 0);
    points = [...files.values()].flatMap(file => file.points).filter(kept);
    evidence = [...files.values()].flatMap(file => file.evidence || []).filter(kept);
    shown = [...files.values()].flatMap(file => file.shown || []);
    refreshAt = now;
  }
  return {
    async ranking(player) {
      if (!players.includes(player)) throw Error('Unknown player');
      if (!refreshAt || clock() - refreshAt >= 60000) {
        pending ||= refresh().finally(() => { pending = null; });
        await pending;
      }
      return rankPlay(points, player, clock());
    },
    // The parsed play rows of the last refresh (read only), for the smart home order.
    events() { return points; },
    // Skill evidence of the last refresh (skill-evidence.mjs), for the home nudge.
    evidence() { return evidence; },
    // Past home lists as logged by the hub ({player, day, nudge, at}).
    shown() { return shown; },
  };
}
