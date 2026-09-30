import test from 'node:test';
import assert from 'node:assert/strict';
import {askModel} from '../generate.mjs';

test('A worker that exits before reading a large input reports failure without crashing the caller', async () => {
  const messages = [];
  const result = await askModel('Synthetic story request. '.repeat(200000), {
    env: {...process.env, BOOK_BACKEND: 'claude,none', BOOK_CLAUDE_BIN: '/usr/bin/false'},
    log: message => messages.push(message),
  });
  assert.equal(result, null);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /claude unavailable/);
});
