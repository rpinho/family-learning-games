import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {waitFor,STEP_MS,ROOM_LOAD_MS,CDP_COMMAND_MS} from '../episodes/audit-wait.mjs';
// A fake clock: each poll costs its 75 ms gap plus a slow 50 ms browser evaluation.
const clock=()=>{let t=0;return {now:()=>t,sleep:async ms=>{t+=ms;},check:readyAt=>async()=>{t+=50;return t>=readyAt;}};};
test('a room that takes 23 s to load passes the clock-based room wait (the old 180-poll wait gave up)',async()=>{
 const old=clock();assert.equal(await waitFor(old.check(23e3),{sleep:old.sleep,now:old.now}),false);
 const c=clock();assert.equal(await waitFor(c.check(23e3),{ms:ROOM_LOAD_MS,sleep:c.sleep,now:c.now}),true);
});
test('the room wait still gives up on a room that never loads',async()=>{
 const c=clock();assert.equal(await waitFor(c.check(Infinity),{ms:ROOM_LOAD_MS,sleep:c.sleep,now:c.now}),false);assert.ok(c.now()>=ROOM_LOAD_MS&&c.now()<ROOM_LOAD_MS+1e3);
});
test('other checks keep 180 polls',async()=>{let n=0;assert.equal(await waitFor(async()=>{n++;return false;},{sleep:async()=>{}}),false);assert.equal(n,180);});
test('the quest audit loads every room with the clock-based wait',async()=>{
 const src=await readFile(new URL('../episodes/audit.mjs',import.meta.url),'utf8');
 assert.match(src,/const load=async s=>{[^\n]*naturalWidth\)`,ROOM_LOAD_MS\);\};/);
 assert.match(src,/const until=async\(expression,ms=STEP_MS\)=>\{if\(await waitFor\(\(\)=>js\(expression\),\{ms,sleep:pause\}\)\)return;/);
});
test('one slow DevTools command gets 60 s, not 20 s',async()=>{
 assert.equal(CDP_COMMAND_MS,60e3);
 const src=await readFile(new URL('../episodes/audit.mjs',import.meta.url),'utf8');
 assert.match(src,/no\(Error\('CDP timeout '\+method\)\),CDP_COMMAND_MS\)/);assert.doesNotMatch(src,/CDP timeout '\+method\)\),20000/);
});
test('every other audit wait is by the clock too: a 20-s support step passes, a missing one fails after 45 s',async()=>{
 assert.equal(STEP_MS,45e3);
 const slow=clock();assert.equal(await waitFor(slow.check(20e3),{ms:STEP_MS,sleep:slow.sleep,now:slow.now}),true);
 const never=clock();assert.equal(await waitFor(never.check(Infinity),{ms:STEP_MS,sleep:never.sleep,now:never.now}),false);assert.ok(never.now()<STEP_MS+1e3);
});
