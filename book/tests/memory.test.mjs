import test from 'node:test';
import assert from 'node:assert/strict';
import {storyMemory,memoryBrief,memoryUse} from '../memory.mjs';
const c=(date,title,summary,hook,extra={})=>({date,title,summary,hook,meta:{source:'codex:x',...extra}});
const prev=[c('2026-09-26','The Lost Lantern','He found the lantern in the cave.','Who lit it?'),c('2026-09-27','The River Race','He raced the boats and won fairly.','What is under the bridge?'),
 c('2026-09-28','The Tide Gate','He opened the tide gate with a clever count.','A bell rings far away.'),c('2026-09-29','The Workshop','He fixed the robot.','Who is knocking behind the tiny door?'),
 c('2026-09-30','The Whistle','He followed the whistle.','What platform hides behind the painted waterfall?')];
test('memory picks up the last hook and one older moment, never a generic template hook or a template chapter',()=>{
 const m=storyMemory(prev,{date:'2026-10-01'});
 assert.equal(m.lastHook.hook,'What platform hides behind the painted waterfall?');
 assert.ok(m.callback&&['2026-09-26','2026-09-27','2026-09-28'].includes(m.callback.date),'2+ chapters back');
 const t=storyMemory([...prev.slice(0,4),c('2026-09-30','X','Y','Another locked door is waiting for the next key.')],{date:'2026-10-01'});
 assert.equal(t.lastHook,null);
 const tpl=storyMemory([...prev.slice(0,4),{...prev[4],meta:{source:'template (model chapter failed lint)'}}],{date:'2026-10-01'});
 assert.equal(tpl.lastHook,null);
 assert.deepEqual(storyMemory([],{date:'2026-10-01'}),{lastHook:null,callback:null});
 assert.equal(memoryBrief({lastHook:null,callback:null}),'');
});
test('a callback used in the last three chapters is not reused',()=>{
 const used=prev.map((p,i)=>i>=2?{...p,meta:{...p.meta,callback:{date:['2026-09-26','2026-09-27','2026-09-28'][i-2]}}}:p);
 const m=storyMemory(used,{date:'2026-10-01'});assert.equal(m.callback,null);
});
test('memoryUse sees the hook in the first pages and the callback anywhere',()=>{
 const m=storyMemory(prev,{date:'2026-10-01'});
 const story={pages:[{say:[['narrator','Behind the painted waterfall a platform appeared.']]},{say:[]},{say:[]},{say:[['narrator',`Like the time you ${m.callback.summary.toLowerCase()}`]]}]};
 const u=memoryUse(story,m);assert.equal(u.hook,true);assert.equal(u.callback,true);
 assert.deepEqual(memoryUse({pages:[]},m),{hook:false,callback:false});
});

test('one long distinctive word is enough to count the hook as picked up (the real 10-02 opening)',()=>{
 const m={lastHook:{hook:"What platform hides behind the map's painted waterfall?"},callback:null};
 const story={pages:[{say:[['narrator','Yesterday you told Dad six times seven was too easy.'],['dad','Behind the waterfall: a pretend castle!']]}]};
 assert.equal(memoryUse(story,m).hook,true);
});

test('the brief\'s word target fits the time budget: fewer words when there are more games',async()=>{
 const {wordTarget}=await import('../prompt.mjs');
 const beat=w=>({id:'b',kind:'count',spoken:Array(w).fill('word').join(' ')});
 const six=wordTarget({level:'early',beats:Array.from({length:6},()=>beat(16))}),four=wordTarget({level:'early',beats:Array.from({length:4},()=>beat(16))});
 assert.ok(six<four&&six>=90&&six<=150,`six beats -> ${six}`);
});
