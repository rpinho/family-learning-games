import test from 'node:test';
import assert from 'node:assert/strict';
import {
  weightPuzzle,
  validWeightDraft,
  weightTotals,
  weightsSolved,
  weightAngle,
  emptyWeightDraft,
} from '../lib/balance-weights.mjs';
import {
  balancePrompt,
  balanceFeedback,
  balanceVoiceLines,
} from '../lib/balance.mjs';
import {
  freshProfile,
  action,
  publicState,
  makeQuestion,
  random,
  prepareProfile,
} from '../lib/math.mjs';
import { challengeLevel } from '../lib/explorer.mjs';
import { planSpeech } from '../lib/speech-rule.mjs';
const nowBase = Date.parse('2026-10-03T12:00:00Z');
const act = (p, input, now = nowBase) =>
  action(p, { ...input, revision: p.revision }, now);
function* drafts(n, prefix = []) {
  if (!n) {
    yield prefix;
    return;
  }
  for (const side of [-1, 0, 1]) yield* drafts(n - 1, [...prefix, side]);
}

void test('every generated puzzle is solvable and every valid combination is accepted, across all levels', () => {
  for (let level = 1; level <= 5; level++)
    for (let seed = 1; seed <= 200; seed++)
      for (const round of [1, 2, 4, 5]) {
        const w = weightPuzzle(level, round, random(seed * 83 + round));
        let solutions = 0;
        assert.ok(
          w.tray.every((v) => Number.isInteger(v) && v > 0 && v < w.target),
        );
        for (const draft of drafts(w.tray.length)) {
          const left =
            w.fixed.reduce((a, b) => a + b, 0) +
            w.tray.reduce((n, v, i) => n + (draft[i] === 0 ? v : 0), 0);
          const right = w.tray.reduce(
            (n, v, i) => n + (draft[i] === 1 ? v : 0),
            0,
          );
          const expected =
            (w.mode === 'free' || !draft.includes(0)) &&
            left === w.target &&
            right === w.target;
          assert.equal(weightsSolved(w, draft), expected);
          assert.deepEqual(weightTotals(w, draft), [left, right]);
          if (expected) solutions++;
        }
        assert.ok(
          solutions >= 3,
          JSON.stringify({ level, seed, round, w, solutions }),
        );
        assert.equal(weightsSolved(w, emptyWeightDraft(w)), false);
        const cap = [0, 20, 35, 50, 200, 500][level];
        assert.ok(w.target <= cap);
        if (w.mode === 'fixed' && level === 3 && round === 1)
          assert.ok(w.fixed.every((v) => v >= 6 && v <= 9));
        if (w.mode === 'fixed' && level === 4) {
          assert.match(w.label, /×.*\+/);
          assert.ok(w.fixed.slice(0, -1).every((v) => v >= 6 && v <= 9));
        }
        if (w.mode === 'fixed' && level === 5) {
          assert.match(w.label, /×/);
          assert.ok(w.fixed.length >= 6 && w.fixed.length <= 9);
        }
      }
});
void test('beam direction and angle are monotone as the difference changes, with bounded motion', () => {
  for (const left of [0, 12, 50, 200, 441]) {
    let prior = -Infinity;
    for (let right = 0; right <= 500; right++) {
      const angle = weightAngle(left, right);
      assert.ok(
        Number.isFinite(angle) && angle >= prior && Math.abs(angle) <= 12,
      );
      prior = angle;
      assert.equal(Math.sign(angle), Math.sign(right - left));
      assert.equal(weightAngle(right, left), -angle || 0);
    }
  }
  assert.equal(weightAngle(0, 0), 0);
  for (let difference = -200; difference <= 200; difference++)
    assert.equal(
      weightAngle(250, 250 + difference),
      weightAngle(500, 500 + difference),
    );
});
void test('server persists unsolved arrangements quietly, accepts every solution and preserves other progress', () => {
  for (const round of [1, 2]) {
    const base = freshProfile('explorer');
    base.xp = 47;
    base.completed = { multiply: 3 };
    base.guided = { 6: 2 };
    base.drawing = [
      [
        [1, 1],
        [2, 2],
      ],
    ];
    act(base, { kind: 'start', game: 'balance' });
    base.session.round = round;
    base.session.question = makeQuestion(base, 'balance', round);
    const q = base.session.question,
      w = q.weights;
    const partial = emptyWeightDraft(w);
    partial[0] = 1;
    // Find a non-winning placement (the single target weight can solve fixed mode).
    if (weightsSolved(w, partial)) {
      partial[0] = -1;
      partial[w.tray.findIndex((v) => v < w.target)] = 1;
    }
    act(
      base,
      { kind: 'balance-place', questionId: q.id, draft: partial },
      10100,
    );
    assert.equal(base.session.result, null);
    assert.equal(base.history.length, 0);
    assert.equal(base.xp, 47);
    assert.deepEqual(
      publicState(prepareProfile(structuredClone(base))).session.balanceDraft,
      partial,
    );
    for (const draft of drafts(w.tray.length))
      if (weightsSolved(w, draft)) {
        const p = structuredClone(base);
        act(p, { kind: 'balance-place', questionId: q.id, draft }, 12000);
        assert.equal(p.session.result.ok, true);
        assert.equal(p.session.result.xp, 10);
        assert.equal(p.history.length, 1);
        assert.deepEqual(p.session.result.totals, [w.target, w.target]);
        assert.deepEqual(p.history[0].draft, draft);
        assert.equal(p.xp, 57);
        assert.deepEqual(p.drawing, base.drawing);
        assert.deepEqual(p.completed, base.completed);
        assert.deepEqual(p.guided, base.guided);
        assert.throws(() =>
          act(p, { kind: 'balance-place', questionId: q.id, draft }, 12001),
        );
      }
  }
});
void test('invalid weights and stale questions cannot save; difficulty changes clear the old layout', () => {
  const p = freshProfile('explorer');
  act(p, { kind: 'start', game: 'balance' });
  p.session.round = 1;
  p.session.question = makeQuestion(p, 'balance', 1);
  const q = p.session.question,
    w = q.weights;
  for (const draft of [
    null,
    [],
    w.tray.map(() => 2),
    w.tray.map(() => 0),
    w.tray.map(() => 1.5),
    [...emptyWeightDraft(w), 1],
  ]) {
    assert.equal(validWeightDraft(w, draft), false);
    assert.throws(() =>
      act(p, { kind: 'balance-place', questionId: q.id, draft }),
    );
  }
  assert.throws(() =>
    act(p, {
      kind: 'balance-place',
      questionId: 'old',
      draft: emptyWeightDraft(w),
    }),
  );
  act(p, {
    kind: 'balance-place',
    questionId: q.id,
    draft: emptyWeightDraft(w),
  });
  act(p, { kind: 'challenge-level', delta: 1 });
  assert.equal(challengeLevel(p, 'balance'), 4);
  assert.equal(p.session.balanceDraft, undefined);
});
void test('a complete hands-on round earns existing XP, clears layouts, and keeps the animal rounds', () => {
  const p = freshProfile('explorer');
  p.xp = 47;
  act(p, { kind: 'start', game: 'balance' });
  let animals = 0,
    weights = 0;
  for (let round = 0; round < 6; round++) {
    const q = p.session.question;
    if (q.weights) {
      weights++;
      const solution = [...drafts(q.weights.tray.length)].find((d) =>
        weightsSolved(q.weights, d),
      );
      act(
        p,
        { kind: 'balance-place', questionId: q.id, draft: solution },
        nowBase + 20000 + round * 10000,
      );
    } else {
      animals++;
      act(
        p,
        { kind: 'answer', questionId: q.id, answer: q.answer },
        nowBase + 20000 + round * 10000,
      );
    }
    act(p, { kind: 'next' }, nowBase + 21000 + round * 10000);
    if (!p.session.finished) assert.equal(p.session.balanceDraft, undefined);
  }
  assert.equal(animals, 2);
  assert.equal(weights, 4);
  assert.equal(p.xp, 107);
  assert.equal(p.session.correct, 6);
  assert.equal(p.completed.balance, 1);
  assert.equal(challengeLevel(p, 'balance'), 4);
});
void test('all new prompt and completion speech comes from the finite voice inventory', () => {
  const clips = new Set([
    ...balanceVoiceLines(),
    ...Array.from({ length: 1001 }, (_, i) => String(i)),
  ]);
  for (let level = 1; level <= 5; level++)
    for (let round = 0; round < 6; round++) {
      const p = freshProfile('explorer');
      p.challengeManual = { balance: { level, after: 0 } };
      const q = makeQuestion(p, 'balance', round);
      assert.deepEqual(
        planSpeech(balancePrompt(q), { sound: false, firstTime: () => false })
          .say,
        balancePrompt(q),
      );
      for (const line of [
        ...balancePrompt(q),
        ...balanceFeedback(q, { ok: true, draft: q.weights ? [] : undefined }),
      ])
        assert.ok(clips.has(line), line);
    }
});

void test('personalized table lists keep every weight prompt in the finite speech inventory', () => {
  const clips = new Set(balanceVoiceLines());
  const floors = [
    {},
    { tables: [] },
    { tables: [2, 3, 4, 5, 6, 7, 8, 9] },
    ...Array.from({ length: 12 }, (_, i) => ({ tables: [i + 1] })),
  ];
  for (const floor of floors)
    for (let level = 1; level <= 5; level++)
      for (const round of [1, 2, 4, 5])
        for (const sample of [0, 0.25, 0.5, 0.75, 0.999999]) {
          const weights = weightPuzzle(level, round, () => sample, floor);
          const lines = balancePrompt({ weights });
          for (const line of lines) assert.ok(clips.has(line), line);
          assert.deepEqual(
            planSpeech(lines, { sound: false, firstTime: () => false }).say,
            lines,
            'essential content remains complete with optional sound off',
          );
        }
});
