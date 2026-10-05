import {massAngle} from './balance-physics.mjs';
// Number weights have identities: equal labels are still separate physical pieces.
const sum = (a) => a.reduce((n, v) => n + v, 0);
const shuffle = (a, r) =>
  a
    .map((v) => [r(), v])
    .sort((a, b) => a[0] - b[0])
    .map((v) => v[1]);
export const WEIGHT_PROMPT = 'Make both sides equal.';
export const FREE_PROMPT = 'Make each pan match the target.';
export const WEIGHT_HELP =
  'Tap a weight, then a pan. Tap a placed weight to take it off. You can also drag.';
export function weightPuzzle(
  level,
  round,
  r,
  mathFloor = { tables: [6, 7, 8, 9] },
) {
  const roll = (n) => Math.floor(r() * n),
    tables = (mathFloor.tables || [6, 7, 8, 9]).filter(
      (n) => Number.isInteger(n) && n >= 6 && n <= 9,
    );
  const table = tables[roll(tables.length)] || 6;
  let fixed, label;
  if (level >= 5) {
    const a = 21 + roll(29),
      b = table;
    fixed = Array(b).fill(a);
    label = `${a} × ${b}`;
  } else if (level === 4) {
    const b = 6 + roll(4),
      extra = 11 + roll(200 - table * b - 10);
    fixed = [...Array(b).fill(table), extra];
    label = `${table} × ${b} + ${extra}`;
  } else if (level === 3 && round % 6 === 1) {
    const b = 2 + roll(4);
    fixed = Array(b).fill(table);
    label = `${table} × ${b}`;
  } else {
    const cap = [0, 20, 35, 50][level],
      target = 12 + roll(cap - 11),
      a = 3 + roll(target - 5);
    fixed = [a, target - a].sort((a,b)=>a-b);
    label = fixed.join(' + ');
  }
  const target = sum(fixed),
    a = 2 + roll(target - 3);
  let b = 2 + roll(target - 3);
  while (b === a || b === target - a) b = b === target - 2 ? 2 : b + 1;
  let c = 2 + roll(target - 3);
  while ([a, target - a, b, target - b].includes(c))
    c = c === target - 2 ? 2 : c + 1;
  const mode = round % 3 === 2 ? 'free' : 'fixed';
  // Three distinct partitions give several solutions, each requiring a combination.
  const tray = shuffle([a, target - a, b, target - b, c, target - c], r);
  return {
    mode,
    target,
    fixed: mode === 'fixed' ? fixed : [],
    label: mode === 'fixed' ? label : '',
    tray,
  };
}
export const emptyWeightDraft = (w) => w.tray.map(() => -1);
export function validWeightDraft(w, draft) {
  return (
    Array.isArray(draft) &&
    draft.length === w.tray.length &&
    draft.every(
      (side) =>
        Number.isInteger(side) &&
        [-1, 0, 1].includes(side) &&
        (w.mode === 'free' || side !== 0),
    )
  );
}
export function weightTotals(w, draft) {
  const totals = [sum(w.fixed), 0];
  w.tray.forEach((value, i) => {
    if (draft[i] === 0 || draft[i] === 1) totals[draft[i]] += value;
  });
  return totals;
}
export function weightsSolved(w, draft) {
  if (!validWeightDraft(w, draft)) return false;
  const [left, right] = weightTotals(w, draft);
  return left === w.target && right === w.target;
}
// Positive angle lowers the right pan. Monotone in right minus left.
export function weightAngle(left, right, reference=50) {
  return massAngle(left, right, reference);
}
export const weightVoiceLines = () => [
  WEIGHT_PROMPT,
  FREE_PROMPT,
  WEIGHT_HELP,
  'Target.',
];
