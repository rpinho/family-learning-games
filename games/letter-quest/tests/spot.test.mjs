import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,nextChallenge,applyAttempt,spotGrid,SPOT_TARGETS,taskPrompt,visibleTaskPrompt} from '../public/engine.mjs';
test('Beginner gets "tap every one" letter grids with look-alikes; Explorer never does',()=>{
 const seen={beginner:0,explorer:0};
 for(const id of ['beginner','explorer']){
  const p=freshProfile(id);
  for(let i=0;i<60;i++){
   p.seq=i*3;if(p.seq%13===0&&p.seq>0)continue;
   const c=nextChallenge(p);if(!c.spot)continue;seen[id]++;
   assert.equal(c.type,'find');assert.equal(c.grid.length,9);
   assert.equal(c.grid.filter(x=>x===c.char).length,SPOT_TARGETS);
   assert.ok(c.id.includes(':spot1'));assert.deepEqual(nextChallenge(structuredClone(p)),c);
   assert.equal(taskPrompt(c),`Find ${/^[a-z]$/.test(c.char)?'little ':''}${c.char.toUpperCase()}.`,'spoken prompt reuses existing clips');
   const text=visibleTaskPrompt(c);assert.ok(c.level===0?text.includes(c.char):!text.includes(` ${c.char} `));
  }
 }
 assert.ok(seen.beginner>=10);assert.equal(seen.explorer,0);
});
test('look-alike grids: b/d/p stay together, digits stay digits, case is preserved',()=>{
 for(let k=0;k<50;k++){
  const d=spotGrid('d');assert.ok(d.filter(x=>x!=='d').every(x=>'bpq'.includes(x)));
  const M=spotGrid('M');assert.ok(M.filter(x=>x!=='M').every(x=>/^[A-Z]$/.test(x)));
  const seven=spotGrid('7');assert.ok(seven.every(x=>/^[0-9]$/.test(x)));
 }
});
test('a finished grid is scored like any find: helped when a look-alike was tapped',()=>{
 const p=freshProfile('beginner');let c;for(let s=0;s<30;s+=3){p.seq=s;c=nextChallenge(p);if(c.spot)break;}
 assert.ok(c?.spot);
 const clean=applyAttempt(structuredClone(p),c,{answer:c.char,durationMs:4000,helped:false});assert.equal(clean.ok,true);assert.equal(clean.xp>=12,true);
 const supported=applyAttempt(structuredClone(p),c,{answer:c.char,durationMs:4000,helped:true});assert.equal(supported.ok,true);assert.ok(supported.xp<clean.xp);
});
