import test from 'node:test';
import assert from 'node:assert/strict';
import {
  action,
  freshProfile,
  makeQuestion,
  prepareProfile,
} from '../lib/math.mjs';
import { patternLevel } from '../lib/play-practice.mjs';
const act = (p, input) => action(p, { ...input, revision: p.revision }, 1000);
test('All seven pattern levels are solvable, including growing groups and two independent attributes', () => {
  const families = new Set(),
    modes = new Set();
  let growing = false,
    two = false;
  for (let level = 1; level <= 7; level++)
    for (let n = 0; n < 120; n++) {
      const p = freshProfile('beginner');
      p.patternManual = { level, after: 0 };
      p.revision = n;
      const q = makeQuestion(p, 'pattern', n % 6);
      assert.equal(q.level, level);
      assert.ok(q.options.includes(q.answer));
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.sequence.length <= 10);
      modes.add(q.mode);
      if (q.growing) {
        growing = true;
        const symbol = Array.from(q.sequence.find(Boolean))[0];
        if (q.mode === 'next')
          assert.equal(q.answer, q.sequence.at(-1) + symbol);
        const full = q.sequence.map((v, i) => v ?? q.answer);
        for (let i = 1; i < full.length; i++)
          assert.ok(
            Array.from(full[i]).length > Array.from(full[i - 1]).length,
          );
      } else {
        families.add(
          q.unit.map((v) => [...new Set(q.unit)].indexOf(v)).join(''),
        );
        if (q.twoAttributes) {
          two = true;
          assert.equal(new Set(q.options.map((t) => t.split(':')[0])).size, 2);
          assert.equal(new Set(q.options.map((t) => t.split(':')[1])).size, 2);
        }
      }
    }
  for (const f of ['011', '001', '012', '0011', '0122'])
    assert.ok(families.has(f), f);
  assert.ok(growing && two);
  assert.ok(modes.has('repair') && modes.has('missing'));
});
test('Easier and Harder replace an unanswered prompt immediately and persist independently of old progress', () => {
  const p = freshProfile('beginner');
  p.history = [{ ok: true, question: { patternVersion: 2 } }];
  const saved = structuredClone(p.history);
  act(p, { kind: 'start', game: 'pattern' });
  assert.equal(p.session.question.level, 4);
  const original = p.session.question.id;
  act(p, { kind: 'pattern-level', delta: 1 });
  assert.equal(p.session.question.level, 5);
  assert.notEqual(p.session.question.id, original);
  assert.deepEqual(p.history, saved);
  const copy = structuredClone(p);
  prepareProfile(copy);
  assert.deepEqual(copy, p);
  assert.equal(patternLevel(copy), 5);
  act(p, { kind: 'pattern-level', delta: -1 });
  assert.equal(p.session.question.level, 4);
  assert.throws(() => act(p, { kind: 'pattern-level', delta: 0 }));
  const q = p.session.question;
  act(p, { kind: 'answer', answer: q.answer, questionId: q.id });
  assert.throws(() => act(p, { kind: 'pattern-level', delta: 1 }));
});
test('Unfinished legacy pattern upgrades only its active prompt; earned history and finished questions stay intact', () => {
  const p = freshProfile('beginner');
  act(p, { kind: 'start', game: 'pattern' });
  p.session.question.patternVersion = 2;
  const history = structuredClone(p.history);
  prepareProfile(p);
  assert.equal(p.session.question.level, 4);
  assert.equal(p.session.question.patternVersion, 3);
  assert.deepEqual(p.history, history);
  p.session.result = { ok: true };
  p.session.question.patternVersion = 2;
  const before = structuredClone(p);
  prepareProfile(p);
  assert.deepEqual(p, before);
});
