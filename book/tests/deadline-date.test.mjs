import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineDate} from '../deadline.mjs';
test('the deadline publishes today\'s chapter in the morning and tomorrow\'s in the evening',()=>{
 const tz='America/New_York';
 assert.equal(deadlineDate(Date.parse('2026-10-03T09:30:00Z'),tz),'2026-10-03'); // 05:30 EDT
 assert.equal(deadlineDate(Date.parse('2026-10-03T01:00:00Z'),tz),'2026-10-03'); // 21:00 EDT Oct 2
});
