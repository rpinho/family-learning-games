import test from 'node:test';import assert from 'node:assert/strict';
import {launchActivity,openActivity} from '../lib/activity-launch.mjs';
test('A home link opens only a game listed for the selected profile and leaves drawing and other tabs alone',()=>{
 assert.equal(launchActivity('?play=cookies',{id:'explorer'}),'cookies');
 for(const q of ['?play=unknown','?play=cookies&studio=1','?play=cookies&tab=draw'])assert.equal(launchActivity(q,{id:'explorer'}),null);
 for(const game of ['cookies','pattern','subtract'])assert.equal(launchActivity('?play='+game,{id:'beginner'}),game);
 assert.equal(launchActivity('?play=multiply',{id:'beginner'}),null);assert.equal(launchActivity('?play=pattern',{id:'explorer'}),null);
 assert.equal(launchActivity('?play=cookies',null),null);assert.equal(launchActivity('',{id:'beginner'}),null);
});
test('An unfinished round resumes; a different or finished round starts once through the save client',async()=>{
 const calls=[];const start=async g=>{calls.push(g);return {session:{game:g}};};
 assert.equal(await openActivity('cookies',{session:{game:'cookies',finished:false}},start),true);assert.deepEqual(calls,[]);
 for(const session of [{game:'cookies',finished:true},{game:'pattern'},null])assert.equal(await openActivity('cookies',{session},start),true);
 assert.deepEqual(calls,['cookies','cookies','cookies']);assert.equal(await openActivity('cookies',{},async()=>null),false);
 assert.equal(await openActivity('pattern',{session:{game:'pattern',finished:false}},start),true);assert.equal(calls.length,3);
});
