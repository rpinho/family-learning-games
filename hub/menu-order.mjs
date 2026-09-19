import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { CATALOG } from './public/catalog.mjs';

const IDS = CATALOG.map(g => g.id);
const DAY = 86400000;
const WINDOW = 14 * DAY;

// Only actual play counts. Opens, speech, settings, hints, bots and rejected
// requests are not visits. Map storage owners to today's activity families.
export function activityFor(source, row) {
  if (source === 'hub') {
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
  if (source === 'maze-garden') return ['moves', 'answer', 'challenge'].includes(row.event) ? source : null;
  if (row.type !== 'action') return null;
  const action = row.input?.kind || row.input?.type;
  if(source === 'number-park'&&['art_guess','art_label','drawing'].includes(action))return 'drawing-studio';
  const play = {
    'number-park': ['trace', 'answer', 'plan_cards', 'plan_step', 'plan_run', 'art_part', 'shape', 'reading_answer'],
    'word-arcade': ['answer', 'draft', 'art'],
    'three-in-a-row': ['move'],
    'target-trail': ['shot', 'reading'],
  };
  return play[source]?.includes(action) ? source : null;
}

export function rankPlay(events, player, now = Date.now()) {
  const rows = events.filter(e => e.player === player && IDS.includes(e.game) && Number.isFinite(e.at) && e.at <= now && e.at >= now - WINDOW)
    .sort((a, b) => a.at - b.at || a.game.localeCompare(b.game));
  const scores = Object.fromEntries(IDS.map(id => [id, 0]));
  const visits = Object.fromEntries(IDS.map(id => [id, 0]));
  const days = new Map();
  let previous;
  for (const row of rows) {
    if (!previous || row.game !== previous.game || row.at - previous.at >= 10 * 60000) {
      const key = row.game + ':' + Math.floor(row.at / DAY);
      const count = days.get(key) || 0;
      if (count < 6) {
        scores[row.game] += 2 ** (-(now - row.at) / (3 * DAY));
        visits[row.game]++;
        days.set(key, count + 1);
      }
    }
    previous = row;
  }
  // Stable catalog ties retain every game, including ones not tried yet.
  const order = [...IDS].sort((a, b) => scores[b] - scores[a] || IDS.indexOf(a) - IDS.indexOf(b));
  return { order, scores, visits };
}

export function menuOrderService({ sources, players, clock = Date.now }) {
  const files = new Map();
  let refreshAt = 0, pending, points = [];
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
        if (date + DAY < now - WINDOW || date > now) continue;
        const path = join(directory, name), info = await stat(path);
        seen.add(path);
        let cached = files.get(path);
        if (!cached || cached.size !== info.size || cached.mtime !== info.mtimeMs) {
          cached = { size: info.size, mtime: info.mtimeMs, points: [], resets: [] };
          const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
          for await (const line of lines) {
            let row;
            try { row = JSON.parse(line); } catch { continue; } // includes an unfinished final log line
            if (!players.includes(row.player)) continue;
            const at = Date.parse(row.at);
            if (!Number.isFinite(at)) continue;
            if (source === 'letter-quest' && row.type === 'profile_reset_completed') cached.resets.push({ player: row.player, source, at });
            const game = activityFor(source, row);
            if (game) cached.points.push({ player: row.player, game, source, at });
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
    points = [...files.values()].flatMap(file => file.points)
      .filter(p => p.at >= (resets.get(p.source + ':' + p.player) || 0));
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
  };
}
