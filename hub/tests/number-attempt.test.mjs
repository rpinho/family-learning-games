import test from 'node:test';
import assert from 'node:assert/strict';
import {numberAttempt} from '../number-attempt.mjs';

const question = {id: 'build-1', kind: 'place', placeMode: 'build', target: [3, 2, 4], total: 324};
const row = (after, before = {}) => ({type: 'action', input: {kind: 'place-check'}, before, after: {question, ...after}});

test('a first correct block build is independent, a corrected build is supported', () => {
  assert.deepEqual(numberAttempt(row({result: {ok: true, helped: false}})), {question, ok: true, help: false});
  assert.deepEqual(numberAttempt(row({result: {ok: true, helped: true}, placeChecks: 1})), {question, ok: true, help: true});
});
test('an accepted partial block check is a miss before the supported retry', () => {
  assert.deepEqual(numberAttempt(row({placeChecks: 1, placeMessage: 'Check the tens.'})), {question, ok: false, help: false});
  assert.equal(numberAttempt(row({placeChecks: 1, placeMessage: 'Check the tens.'}, {placeChecks: 1})), null);
  assert.equal(numberAttempt(row({placeChecks: 0, placeMessage: 'Check the tens.'})), null);
  assert.equal(numberAttempt(row({placeChecks: 1})), null);
});
test('hints before a failed block check stay marked as help', () => {
  assert.equal(numberAttempt(row({placeChecks: 1, placeMessage: 'Check the ones.', helped: true})).help, true);
});
test('ordinary and cookie outcomes retain their existing evidence', () => {
  for (const kind of ['answer', 'cookie-answer', 'cookie-check']) {
    const r = row({result: {ok: false, helped: false}}); r.input.kind = kind;
    assert.deepEqual(numberAttempt(r), {question, ok: false, help: false});
  }
  const r = row({cookieMessage: 'Not equal yet.'}); r.input.kind = 'cookie-check';
  assert.deepEqual(numberAttempt(r), {question, ok: false, help: false});
  delete r.after.cookieMessage; assert.equal(numberAttempt(r), null);
});
test('settings, narration, rejected and malformed rows are not answers', () => {
  assert.equal(numberAttempt(null), null);
  assert.equal(numberAttempt({...row({result: {ok: true}}), type: 'rejected'}), null);
  assert.equal(numberAttempt({...row({result: {ok: true}}), input: {kind: 'hint'}}), null);
  assert.equal(numberAttempt(row({question: {kind: 'place'}, result: {ok: true}})), null);
  assert.equal(numberAttempt(row({question: {id: 'x', kind: 'sums'}, result: {ok: true}})), null);
});
