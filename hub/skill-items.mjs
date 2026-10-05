import {answeredQuestion} from './reading-evidence.mjs';
// The specific item behind one piece of skill evidence (skill-evidence.mjs): which letter, which sound, which word
// and its spelling pattern, which maths fact or sharing, which chess theme. Read only from the games' own log rows;
// used by the Book's learner model (book/learner-profile.mjs) to name what a child missed or is ready for, and kept on
// the evidence records as `tags` (the home nudge ignores them).
// Tags are short strings "<kind>:<value>":
//   letter:M  (a letter's name or shape; uppercase value)   lower:m  (the same, shown as a little letter)
//   sound:m   (a letter's sound: first sounds, a consonant gap)   vowel:i  (the short vowel in a CVC or blend word)
//   word:pin  pattern:cvc|blend|digraph|silent-e|vowel-team|r-controlled|other   family:in  (rime of a CVC word)
//   fact:3x7  table:7   div:24/4 (total / divisor)   divisor:4   remainder:13/4   cookies:share|bags|rows|fix
//   add:regroup|add:no-regroup   place:tens   skip:9   count:1-5|6-10|11-20   takeaway:9-2   numpattern:next
//   chess:forcing  (a lesson's theme)
// `chose` (when known) is the answer he picked on a miss, so a model can name a confusion (tin read as "tan").
const VOWELS = 'aeiou';
const isV = c => VOWELS.includes(c);
const clean = w => String(w ?? '').toLowerCase().replace(/[^a-z]/g, '');
const DIGRAPH = /sh|ch|th|wh|ck|ng|ph|qu/;
const TEAM = /ee|ea|oa|ai|ay|oo|ou|ow|oi|oy|ie|ue|ew|igh/;
const RCTRL = /[aeiou]r/;
// A word's spelling pattern for decoding: what a beginning reader must do to read it.
export function wordPattern(word) {
  const w = clean(word);
  if (!w) return null;
  if (TEAM.test(w)) return 'vowel-team';
  if (w.length === 4 && !isV(w[0]) && isV(w[1]) && !isV(w[2]) && w[3] === 'e') return 'silent-e';
  if (DIGRAPH.test(w)) return 'digraph';
  if (RCTRL.test(w) && w.length > 3) return 'r-controlled';
  const vowels = [...w].filter(isV).length;
  if (w.length === 3 && !isV(w[0]) && isV(w[1]) && !isV(w[2])) return 'cvc';
  if (vowels === 1 && w.length >= 4 && w.length <= 5 && /^[^aeiou]+[aeiou][^aeiou]+$/.test(w)) return 'blend';
  return 'other';
}
// The single short vowel of a CVC or blend word (pin -> i, frog -> o), else null.
export function shortVowel(word) {
  const w = clean(word), p = wordPattern(w);
  return p === 'cvc' || p === 'blend' ? [...w].find(isV) : null;
}
export function wordTags(word) {
  const w = clean(word);
  if (!w || w.length < 2 || w.length > 10) return [];
  const p = wordPattern(w), v = shortVowel(w), out = ['word:' + w, 'pattern:' + p];
  if (v) out.push('vowel:' + v);
  if (p === 'cvc') out.push('family:' + w.slice(1));
  return out;
}
const letterTags = (c, {sound = false} = {}) => {
  const s = String(c ?? '');
  if (!/^[A-Za-z]$/.test(s)) return [];
  return sound ? ['sound:' + s.toLowerCase()] : ['letter:' + s.toUpperCase(), ...(s === s.toLowerCase() ? ['lower:' + s] : [])];
};
// A missing letter in a word (gap, blaster, spell): the vowel of a CVC/blend word is a short-vowel item; a consonant
// is a sound item. The word itself is tagged too.
function gapTags(word, answer, position) {
  const w = clean(word), a = clean(answer);
  if (!w) return [];
  const out = wordTags(w);
  const pos = Number.isInteger(position) ? position : a.length === 1 ? w.indexOf(a) : -1;
  if (a.length === 1 && pos >= 0) {
    if (isV(a)) { if (!out.some(t => t.startsWith('vowel:'))) out.push('vowel:' + a); }
    else out.push('sound:' + a);
  }
  return out;
}
const countBand = n => n <= 5 ? '1-5' : n <= 10 ? '6-10' : '11-20';
const fact = (a, b) => { const [x, y] = [Number(a), Number(b)].sort((p, q) => p - q); return Number.isInteger(x) && Number.isInteger(y) && x > 0 ? ['fact:' + x + 'x' + y, 'table:' + x, ...(x !== y ? ['table:' + y] : [])] : []; };
// Number Park questions (and the Book's number beats use the same shapes).
export function numberTags(q) {
  if (!q || typeof q !== 'object') return [];
  const k = q.kind;
  if (k === 'cookies') {
    const total = Number(q.total), d = q.mode === 'bags' ? Number(q.bagSize) : Number(q.plates);
    if (!(total > 0 && d > 0)) return [];
    return ['div:' + total + '/' + d, 'divisor:' + d, 'cookies:' + (q.mode || 'share')];
  }
  if (k === 'multiply' || k === 'factor') return fact(q.a, q.b);
  if (k === 'sums') return [Number(q.a) % 10 + Number(q.b) % 10 >= 10 ? 'add:regroup' : 'add:no-regroup'];
  if (k === 'place') return ['place:tens'];
  if (k === 'skip') return Number(q.step) > 0 ? ['skip:' + q.step] : [];
  if (k === 'count' || k === 'addobjects') return Number(q.answer) > 0 ? ['count:' + countBand(Number(q.answer))] : [];
  if (k === 'subtract') return q.total != null && q.remove != null ? ['takeaway:' + q.total + '-' + q.remove] : [];
  if (k === 'pattern') return ['numpattern:' + (q.mode || 'next')];
  return [];
}
// One literacy question (Letter Quest, its labyrinth and soccer, Word Arcade, Letter Slalom).
export function literacyTags(q) {
  if (!q || typeof q !== 'object') return [];
  // A one-choice (modelled) question is not a try, and finding a letter's place in a family name is its own task.
  if (Array.isArray(q.options) && q.options.length === 1) return [];
  const type = q.type || q.kind || q.game;
  switch (type) {
    case 'find': case 'sequence': case 'letter': case 'find-letter':
      return letterTags(q.char ?? q.answer);
    case 'name':
      return [];
    case 'sound': case 'first-letter':
      return [...letterTags(q.char ?? q.answer, {sound: true}), ...(q.word ? ['word:' + clean(q.word)] : [])];
    case 'gap': case 'blaster': case 'spell':
      return gapTags(q.word, q.answer && String(q.answer).length === 1 ? q.answer : q.char, Number.isInteger(q.position) ? q.position : Number.isInteger(q.blank) ? q.blank : undefined);
    case 'rhyme':
      return q.answer && wordPattern(q.answer) === 'cvc' ? ['family:' + clean(q.answer).slice(1), 'pattern:rhyme'] : ['pattern:rhyme'];
    case 'sort':
      return q.answer ? ['family:' + clean(q.answer)] : [];
    case 'read': case 'read-word': case 'word': case 'blend': case 'decode': case 'dictation': case 'change':
    case 'asteroids': case 'builder': case 'orbit':
      return wordTags(q.word ?? q.answer);
    default:
      return q.word ? wordTags(q.word) : [];
  }
}
const chose = (answer, target) => {
  const a = String(answer ?? ''), t = String(target ?? '');
  return a && t && a.toLowerCase() !== t.toLowerCase() && a.length <= 12 ? a : null;
};
// {tags, chose} for a log row (same rows skill-evidence.mjs reads), or null.
export function itemTags(source, row) {
  try {
    let tags = [], picked = null;
    if (source === 'letter-quest') {
      const res = row.result || {};
      const q = row.type === 'attempt' ? row.challenge : row.type === 'soccer_action' ? res.shot?.question : row.type === 'reading_action' ? (row.before?.question || null) : res.question;
      if (!q || q.type === 'trace') return null;
      tags = literacyTags(q);
      picked = chose(row.input?.answer ?? res.answer, q.answer);
    } else if (source === 'word-arcade') {
      const q = answeredQuestion(source, row);
      if (!q) return null;
      tags = literacyTags({...q, type: q.type || q.kind || q.game});
      picked = chose(row.input?.answer, q.answer);
    } else if (source === 'number-park') {
      const q = row.after?.question || row.before?.question;
      tags = numberTags(q);
      picked = row.input?.kind === 'cookie-answer' ? chose(row.input?.value, q?.answer) : chose(row.input?.answer, q?.answer);
    } else if (source === 'hub') {
      if (row.type === 'chess' && row.lesson) tags = ['chess:' + String(row.lesson).replace(/-\d+$/, '')];
      else if (row.type === 'dribble-live') { const r = row.result || {}; tags = r.tier > 0 ? wordTags(r.target) : letterTags(r.target); picked = chose(row.input?.answer, r.target); }
    }
    return tags.length ? (picked ? {tags, chose: picked} : {tags}) : null;
  } catch { return null; }
}
