import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDER_GAMES } from '../lib/math.mjs';
import { EXPLORER_GAMES } from '../lib/explorer.mjs';
import { KINDER_COUNTERPARTS, KINDER_EXEMPTIONS } from '../lib/game-parity.mjs';
function parity(older, younger) {
  const ids = new Set(younger.map((g) => g.id));
  for (const g of older) {
    const matches =
      KINDER_COUNTERPARTS[g.id] || (ids.has(g.id) ? [g.id] : null);
    assert.ok(
      matches || KINDER_EXEMPTIONS[g.id],
      `${g.id} needs a kindergarten counterpart or a commented exemption`,
    );
    if (matches) {
      assert.ok(matches.length);
      for (const id of matches)
        assert.ok(ids.has(id), `${g.id} counterpart ${id} must exist`);
    }
  }
}
test('Every older-player game has a kindergarten counterpart or explicit curriculum exemption', () => {
  parity(EXPLORER_GAMES, KINDER_GAMES);
  for (const id of [
    ...Object.keys(KINDER_COUNTERPARTS),
    ...Object.keys(KINDER_EXEMPTIONS),
  ])
    assert.ok(
      EXPLORER_GAMES.some((g) => g.id === id),
      `stale parity entry: ${id}`,
    );
  for (const reason of Object.values(KINDER_EXEMPTIONS))
    assert.ok(reason.length > 20);
});
test('The parity guard fails for a new unpaired game and a deleted counterpart', () => {
  assert.throws(
    () => parity([...EXPLORER_GAMES, { id: 'new-game' }], KINDER_GAMES),
    /new-game needs/,
  );
  assert.throws(
    () =>
      parity(
        EXPLORER_GAMES,
        KINDER_GAMES.filter((g) => g.id !== 'balance-k'),
      ),
    /balance-k must exist/,
  );
});
