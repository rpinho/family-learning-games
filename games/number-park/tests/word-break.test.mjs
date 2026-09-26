import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';import {once} from 'node:events';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {wordBreakItem,wordBreakLines,literacyFrom} from '../lib/word-break.mjs';
import {roundSnapshot,roundBreak,freeBreakDue,BREAK_COOLDOWN_MS} from '../lib/word-breaks.mjs';
// The word-break module is shared; every game repo keeps an identical copy.
test('Shared word-break copy matches its siblings',async()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex'),mine=hash(await readFile(new URL('../lib/word-break.mjs',import.meta.url)));
 for(const path of ['../../target-trail/dist/word-break.mjs','../../three-in-a-row/dist/word-break.mjs','../../maze-garden/public/word-break.mjs','../../word-arcade/lib/word-break.mjs','../../letter-quest/public/word-break.mjs']){let other;try{other=await readFile(new URL(path,import.meta.url));}catch{continue;}assert.equal(hash(other),mine,path);}
 const lines=new Set(wordBreakLines());for(const track of ['letters','words'])for(let i=0;i<200;i++){const q=wordBreakItem(literacyFrom({completed:40},track));assert.ok(lines.has(q.spoken),q.spoken);}
});
test('Round breaks: after question 3 and before the finish screen, never on a wind-down or a reload',()=>{
 const s=(round,finished=false,windDown=false,began=1)=>roundSnapshot('beginner',{game:'mix',began,round,finished,windDown});
 assert.equal(roundBreak(s(2),s(3)),'round-mid');
 for(const [a,b] of [[1,2],[3,4],[4,5]])assert.equal(roundBreak(s(a),s(b)),null);
 assert.equal(roundBreak(s(5),s(5,true)),'round-end');
 assert.equal(roundBreak(s(5),s(5,true,true)),null,'the calm wind-down is never blocked');
 assert.equal(roundBreak(null,s(3)),null,'opening a saved round mid-way is not a break');
 assert.equal(roundBreak(null,s(5,true)),null);assert.equal(roundBreak(s(5,true),s(5,true)),null,'the recap is not doubled');
 assert.equal(roundBreak(s(2,false,false,1),s(3,false,false,2)),null,'a new round is not a transition');
 assert.equal(roundBreak(roundSnapshot('beginner',{game:'mix',began:1,round:2}),roundSnapshot('explorer',{game:'mix',began:1,round:3})),null);
 assert.ok(freeBreakDue(BREAK_COOLDOWN_MS,0));assert.ok(!freeBreakDue(1000,0));
});
test('Every break site is wired: rounds, trace/shape, Plan & Play, Guess My Drawing',async()=>{
 const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8'),page=await read('app/page.tsx');
 assert.match(page,/checkpoint\('trace',true\)/);assert.match(page,/checkpoint\('shape',true\)/);assert.match(page,/roundBreak\(prev,snap\)/);assert.match(page,/!parentOpen&&!breaking/,'auto-advance waits for a break');
 assert.ok(page.indexOf('roundBreak(prev,snap)')<page.indexOf('End of round: speak the short recap'),'round break is set before the recap speaks');
 assert.match(await read('app/planning.tsx'),/requestWordBreak\('plan'\)/);assert.match(await read('app/art.tsx'),/requestWordBreak\('guess'\)/);
});
test('Word-break level route is read-only and derived from Letter Quest',async()=>{
 const data=await mkdtemp(join(tmpdir(),'np-wb-')),letters=await mkdtemp(join(tmpdir(),'np-lq-'));await writeFile(join(letters,'beginner.json'),JSON.stringify({completed:17,secret:'must-not-leak'}));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NUMBER_PARK_DATA:data,LETTER_QUEST_DATA:letters,HOST:'127.0.0.1',PORT:'14331'},stdio:['ignore','pipe','pipe']});
 const timeout=setTimeout(()=>child.kill(),10000);
 try{await once(child.stdout,'data');const base='http://127.0.0.1:14331';
  const res=await fetch(base+'/api/beginner/word-break'),text=await res.text(),d=JSON.parse(text);assert.equal(d.track,'letters');assert.deepEqual(d.letters,[...'FRANCISOETL']);assert.doesNotMatch(text,/must-not-leak/);
  assert.equal((await(await fetch(base+'/api/explorer/word-break')).json()).track,'words');
  assert.equal((await fetch(base+'/api/beginner/word-break',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
  assert.equal((await fetch(base+'/api/nobody/word-break')).status,404);
  assert.equal((await fetch(base+'/api/beginner/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'word-break',name:'round-mid',detail:'{}'})})).status,200);
 }finally{clearTimeout(timeout);child.kill();}
});
