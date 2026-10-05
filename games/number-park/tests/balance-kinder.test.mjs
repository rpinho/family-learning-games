import test from 'node:test';
import assert from 'node:assert/strict';
import {
  action,
  freshProfile,
  makeQuestion,
  publicState,
  prepareProfile,
} from '../lib/math.mjs';
import {
  kinderBalancePrompt,
  kinderBalanceFeedback,
  kinderBalanceVoiceLines,
} from '../lib/balance-kinder.mjs';
import { launchActivity } from '../lib/activity-launch.mjs';
const act = (p, input) => action(p, { ...input, revision: p.revision }, 10000);
test('Younger balance uses unmistakable animal pairs then all block targets from 1–10, with stock spoken prompts', () => {
  const targets = new Set(),
    directions = new Set(),
    voice = new Set(kinderBalanceVoiceLines());
  for (let n = 0; n < 200; n++)
    for (const round of [0, 1]) {
      const p = freshProfile('beginner');
      p.revision = n;
      const q = makeQuestion(p, 'balance-k', round);
      for (const line of kinderBalancePrompt(q))
        assert.ok(voice.has(line), line);
      if (round) {
        assert.ok(q.target >= 1 && q.target <= 10);
        targets.add(q.target);
        assert.equal(q.answer, q.target);
      } else {
        assert.ok(
          Math.max(q.left.kg, q.right.kg) / Math.min(q.left.kg, q.right.kg) >
            10,
        );
        assert.equal(q.answer, Number(q.right.kg > q.left.kg));
        directions.add(q.answer);
      }
    }
  assert.equal(targets.size, 10);
  assert.equal(directions.size, 2);
  assert.equal(launchActivity('?play=balance-k', { id: 'beginner' }), 'balance-k');
  assert.equal(launchActivity('?play=balance-k', { id: 'explorer' }), null);
});
test('Block placement is validated, persists across reload, rejects numeric answers and scores once', () => {
  const p = freshProfile('beginner');
  act(p, { kind: 'start', game: 'balance-k' });
  const animal = p.session.question;
  const safe = publicState(p).session.question;
  assert.equal(safe.left.kg, undefined);
  assert.equal(safe.answer, undefined);
  act(p, { kind: 'answer', questionId: animal.id, answer: animal.answer });
  assert.equal(p.session.result.ok, true);
  assert.ok(kinderBalanceFeedback(p.session.question, p.session.result));
  act(p, { kind: 'next' });
  const q = p.session.question;
  assert.throws(
    () => act(p, { kind: 'answer', questionId: q.id, answer: q.target }),
    /counting blocks/,
  );
  for (const count of [-1, 11, 1.5, 2])
    assert.throws(
      () => act(p, { kind: 'balance-k-place', questionId: q.id, count }),
      /one block/,
    );
  act(p, { kind: 'balance-k-place', questionId: q.id, count: 1 });
  if (q.target > 1) {
    act(p, { kind: 'balance-k-place', questionId: q.id, count: 0 });
    act(p, { kind: 'balance-k-place', questionId: q.id, count: 1 });
  }
  const copy = structuredClone(p);
  prepareProfile(copy);
  assert.deepEqual(copy, p);
  for (let count = 2; count <= q.target; count++)
    act(p, { kind: 'balance-k-place', questionId: q.id, count });
  assert.equal(p.session.result.ok, true);
  assert.equal(p.history.length, 2);
  assert.equal(p.xp, 20);
  assert.throws(() =>
    act(p, { kind: 'balance-k-place', questionId: q.id, count: q.target - 1 }),
  );
  const countBefore = p.history.length;
  act(p, { kind: 'next' });
  assert.equal(p.session.balanceCount, undefined);
  assert.equal(p.history.length, countBefore);
});

test('Animal names and block tasks remain spoken when sound effects are muted', async () => {
  const { planSpeech } = await import('../lib/speech-rule.mjs');
  for (const round of [0, 1]) {
    const q = makeQuestion(freshProfile('beginner'), 'balance-k', round),
      lines = kinderBalancePrompt(q);
    assert.deepEqual(
      planSpeech(lines, { sound: false, firstTime: () => true }).say,
      lines,
    );
  }
});
