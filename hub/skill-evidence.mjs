// Skill evidence from the games' own logs (read only), for the home nudge (skill-model.mjs).
// One log row gives zero or more small records:
//   {skill, keys, item, ok, help}      an answer: ok true/false, help = a hint/helper was used for it
//   {skill, keys, item, hint: true}     a hint asked for that item (counts against a later first answer)
//   {skill, keys, ok: null}             practice with no right/wrong (tracing, drawing, building a maze)
// `keys` name the cards the evidence belongs to: a catalog id and/or a shortcut activity (home-shortcuts.mjs).
// Only first answers count later (skill-model.mjs), so retries after a miss never inflate success. Settings,
// voice, opening a menu and grown-up "read together" answers are not evidence.

// Literacy question types -> letter names/sounds or reading (decoding words).
const LETTER_TYPES = new Set(['find', 'sequence', 'name', 'letter', 'sound', 'first-letter', 'find-letter', 'rhyme']);
const WORD_TYPES = new Set(['gap', 'spell', 'blend', 'read', 'word', 'read-word', 'sentence']);
const literacy = type => LETTER_TYPES.has(type) ? 'sounds' : WORD_TYPES.has(type) ? 'reading' : null;
// Number Park: multiplication/division games, and equal-sharing cookies past the one-for-you level.
const MULDIV = new Set(['factor', 'multiply', 'divide', 'times', 'groups-of']);
const NUMBER = new Set(['count', 'addobjects', 'pattern', 'subtract', 'sums', 'place', 'skip', 'compare', 'add', 'group']);
import { answeredQuestion, readingMeta } from './reading-evidence.mjs';
import { itemTags } from './skill-items.mjs';
import { numberAttempt } from './number-attempt.mjs';
const day = at => Math.floor(at / 86400000);
const one = r => r ? [r] : null;

function numberPark(row, at) {
  const kind = row.input?.kind, after = row.after || {}, q = after.question || {};
  if (['trace', 'shape'].includes(kind)) return one({skill: 'motor', keys: ['number-park', kind === 'trace' ? 'np:trace' : 'number-park'], ok: null});
  if (['drawing', 'art_part'].includes(kind)) return one({skill: 'motor', keys: ['drawing-studio'], ok: null});
  if (['answer', 'cookie-answer', 'cookie-check', 'place-check'].includes(kind)) {
    const attempt = numberAttempt(row);
    if (!attempt) return null;
    const game = q.kind || after.game;
    if (!q.id || !game) return null;
    let skill = null;
    if (game === 'cookies') skill = (q.level >= 3 || ['bags', 'rows', 'fix'].includes(q.mode)) ? 'muldiv' : 'number';
    else if (MULDIV.has(game)) skill = 'muldiv';
    else if (NUMBER.has(game)) skill = 'number';
    if (!skill) return null;
    const sub = {cookies: 'np:cookies', pattern: 'np:pattern', subtract: 'np:subtract'}[game];
    const keys = sub ? ['number-park', sub] : ['number-park'];
    return one({skill, keys, item: 'np:' + q.id, ok: attempt.ok, help: attempt.help});
  }
  if (kind === 'hint' && q.id) return one({skill: q.kind === 'cookies' || MULDIV.has(q.kind) ? 'muldiv' : 'number', keys: ['number-park'], item: 'np:' + q.id, hint: true});
  return null;
}

function letterQuest(row, at) {
  const kind = row.input?.kind, res = row.result || {};
  if (row.type === 'attempt') {
    const q = row.challenge || {};
    if (!q.id || typeof res.ok !== 'boolean') return null;
    const skill = q.type === 'trace' ? 'motor' : literacy(q.type);
    return skill ? one({skill, keys: ['letter-quest'], item: 'lq:' + q.id, ok: res.ok, help: !!row.input?.helped}) : null;
  }
  if (row.type === 'maze_action' && kind === 'answer') {
    const q = res.question || {}, skill = literacy(q.type);
    if (!skill || typeof res.ok !== 'boolean') return null;
    return one({skill, keys: ['maze-garden', 'lq:maze'], item: 'lq:' + q.id, ok: res.ok, help: !!res.helped});
  }
  if (row.type === 'maze_action' && kind === 'hint') return null; // which task the hint was for is not logged; `helped` covers it
  if (row.type === 'soccer_action' && kind === 'answer') {
    const shot = res.shot || {}, q = shot.question || {}, skill = literacy(q.type);
    if (!skill || typeof shot.correct !== 'boolean') return null;
    return one({skill, keys: ['dribble-duel'], item: 'lq:' + q.id, ok: shot.correct, help: !!shot.helped || !!shot.practice || res.kind === 'practice'});
  }
  if (row.type === 'reading_action' && kind === 'answer') {
    if (res.kind === 'writing') return one({skill: 'motor', keys: ['letter-quest'], ok: null});
    if (!['correct', 'incorrect'].includes(res.kind)) return null;
    return one({skill: 'reading', keys: ['letter-quest'], item: 'lq:' + row.input?.questionId, ok: res.kind === 'correct', help: res.independent === false && res.kind === 'correct'});
  }
  if (row.type === 'rescue_action' && res.kind === 'complete') {
    const mission = row.input?.mission ?? row.after?.mission;
    return mission == null ? null : one({skill: 'planning', keys: ['maze-garden'], item: 'rescue:' + mission, ok: true, help: !!row.after?.helped});
  }
  return null;
}

function wordArcade(row, at) {
  if (row.type !== 'action') return null;
  const kind = row.input?.kind, after = row.after || {}, game = after.game || row.before?.game;
  const q = answeredQuestion('word-arcade', row);
  if (!q) return null;
  const qtype = q.type || q.kind;
  const skill = game === 'slalom' ? (literacy(qtype) || 'sounds') : game === 'rhyme' ? 'sounds' : 'reading';
  const keys = [game === 'slalom' ? 'letter-slalom' : 'word-arcade'];
  const item = row.input?.questionId != null ? `wa:${after.run ?? ''}:${row.input.questionId}` : null;
  if (kind === 'help' && item) return one({skill, keys, item, hint: true});
  if (kind === 'draft' || kind === 'art') return null;
  if (kind !== 'answer' || !item || typeof row.result?.ok !== 'boolean') return null;
  return one({skill, keys, item, ok: row.result.ok, help: !!row.input?.hinted || !!row.before?.help});
}

function mazeGarden(row, at) {
  const done = row.completed;
  if (done && done.id && typeof done.independent === 'boolean') return [
    {skill: 'planning', keys: ['maze-garden', 'maze:trace'], item: 'mg:' + done.id, ok: true, help: !done.independent},
    {skill: 'motor', keys: ['maze-garden', 'maze:trace'], ok: null},
  ];
  if (row.event === 'maker-build') return [{skill: 'planning', keys: ['maze-garden', 'maze:maker'], ok: null}, {skill: 'motor', keys: ['maze:maker'], ok: null}];
  return null;
}

function threeInARow(row, at) {
  const g = row.game;
  if (row.type !== 'action' || !g || g.phase !== 'done' || !g.id || !g.winner || g.mode !== 'play') return null;
  // A finished game is one item: not losing counts as success; a clue during the game is help.
  return one({skill: 'planning', keys: ['three-in-a-row'], item: 'ttt:' + g.id, ok: g.winner === 'draw' || g.winner === g.youMark, help: !!g.helped});
}

function hub(row, at) {
  if (row.type === 'chess') {
    const item = `chess:${row.lesson}:${row.position}:${day(at)}`;
    if (!row.lesson || !row.position) return null;
    if (row.action === 'hint') return one({skill: 'chess', keys: ['chess'], item, hint: true});
    if (row.action === 'move' && typeof row.result?.correct === 'boolean') return one({skill: 'chess', keys: ['chess'], item, ok: row.result.correct, help: false});
    return null;
  }
  if (row.type === 'dribble-live' && row.input?.type === 'live-reading-answer') {
    const r = row.result || {};
    if (r.kind !== 'reading-done' || r.skipped) return null;
    return one({skill: r.tier > 0 ? 'reading' : 'sounds', keys: ['dribble-duel'], item: `dl:${r.id}:${day(at)}`, ok: !(r.errors > 0), help: !!r.helped});
  }
  return null;
}

const BY_SOURCE = {'number-park': numberPark, 'letter-quest': letterQuest, 'word-arcade': wordArcade, 'maze-garden': mazeGarden, 'three-in-a-row': threeInARow, hub};
// Each answer or hint also names its specific item when the row says it (skill-items.mjs): `tags` (which letter,
// sound, word pattern, maths fact, chess theme) and `chose` (his answer on a miss). The home nudge ignores them.
export function skillEvidence(source, row, at) {
  try {
    const out = BY_SOURCE[source]?.(row, at) || null;
    if (out?.some(e => e.item)) {
      const t = itemTags(source, row);
      if (['word-arcade','letter-quest'].includes(source)) for (const e of out) Object.assign(e, readingMeta(source,row));
      if (t) for (const e of out) if (e.item) { e.tags = t.tags; if (t.chose && e.ok === false) e.chose = t.chose; }
    }
    return out;
  } catch { return null; }
}
