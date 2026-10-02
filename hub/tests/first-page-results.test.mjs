import test from 'node:test';
import assert from 'node:assert/strict';
import {firstPageResults} from '../first-page-results.mjs';
const at = n => new Date(Date.UTC(2026, 2, 1, 10, n)).toISOString();
test('a replay win cannot erase an earlier miss; input records stay untouched', () => {
  const saved = [{page: 2, at: at(5), misses: 0, hints: 0, correct: true}];
  const logs = [{page: 2, at: at(5), correct: true}, {page: 2, at: at(0), correct: false}];
  const first = firstPageResults(saved, logs)[0];
  assert.equal(first.correct, false); assert.equal(first.misses, 1); assert.equal(first.at, at(0));
  assert.equal(first.helpUnknown, true); assert.equal(saved[0].correct, true);
});
test('full first records preserve help and independent successes across replays', () => {
  const saved = [1, 2].map(page => ({page, at: at(5), misses: 4, hints: 1, correct: false}));
  const logs = [{page: 1, at: at(0), correct: true, misses: 0, hints: 0}, {page: 2, at: at(0), correct: true, misses: 0, hints: 1}];
  const first = firstPageResults(saved, logs);
  assert.equal(first[0].misses, 0); assert.equal(first[0].hints, 0); assert.equal(first[0].helpUnknown, false);
  assert.equal(first[1].hints, 1);
});
test('a matching saved attempt fills old summary fields; absent or invalid logs leave saves usable', () => {
  const saved = [{page: 1, at: at(0), misses: 0, hints: 1, correct: true}];
  assert.equal(firstPageResults(saved, [{page: 1, at: at(0), correct: true}])[0].hints, 1);
  assert.equal(firstPageResults(saved, [{page: 1, at: at(0), correct: true}])[0].helpUnknown, false);
  assert.deepEqual(firstPageResults(saved, [{page: 1, at: 'bad', correct: false}]), saved);
  assert.deepEqual(firstPageResults(saved), saved);
});
