import test from 'node:test';
import assert from 'node:assert/strict';
import {weightTeaching,weightPuzzle,weightsSolved} from '../lib/balance-weights.mjs';
const fixed={mode:'fixed',target:42,fixed:[42],tray:[21,21,13,27,41,52]};
test('worked weights are concealed until two submissions or explicit Help',()=>{
 for(const session of [{},{balanceChecks:1},{balanceChecks:1,helped:false}])assert.equal(weightTeaching(fixed,session),null);
 for(const session of [{balanceChecks:2},{helped:true}]){
  const t=weightTeaching(fixed,session);assert.ok(weightsSolved(fixed,t.draft));assert.equal(t.draft.filter(s=>s===1).length,2);assert.equal(t.equations[1],'21 + 21 = 42');
 }
 assert.equal(weightTeaching(fixed,{balanceChecks:6,result:{ok:true}}),null);
});
test('equal labels retain distinct identities and missing bases and one-weight limits are respected',()=>{
 const one={mode:'fixed',target:54,fixed:[54],baseRight:[40],tray:[14,7,7,24],selection:'one'};
 const t=weightTeaching(one,{balanceChecks:2});assert.deepEqual(t.draft,[1,-1,-1,-1]);assert.equal(t.equations[1],'40 + 14 = 54');
 assert.equal(weightTeaching({...fixed,target:43},{helped:true}),null);
 assert.equal(weightTeaching({...fixed,target:undefined},{balanceChecks:2}),null);
});
test('guidance leaves puzzle and session intact and solves fixed and free banks',()=>{
 for(let level=1;level<=5;level++)for(let seed=1;seed<=30;seed++)for(const round of [1,2,4,5]){
  let n=seed;const r=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);
  const w=weightPuzzle(level,round,r),session={balanceChecks:2,helped:false,balanceDraft:w.tray.map(()=>-1)},before=structuredClone({w,session});
  const t=weightTeaching(w,session);assert.ok(t);assert.ok(weightsSolved(w,t.draft));assert.deepEqual({w,session},before);
 }
});
