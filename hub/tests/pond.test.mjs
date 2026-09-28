import test from 'node:test';
import assert from 'node:assert/strict';
import {createPond,pondAction,pondResult} from '../public/pond/model.mjs';
test('counting is one-to-one in any order; repeated touches never count twice',()=>{
 const initial=createPond();let s=initial;
 for(const id of [4,4,-1,2,2,7,0,3,1])s=pondAction(s,{type:'count',id});
 assert.deepEqual(s.counted,[4,2,0,3,1]);assert.equal(s.phase,'done');assert.deepEqual(initial.counted,[]);assert.equal(pondResult(s).completed,true);
});
test('a prediction is recorded before observing; gate and duplicate answers cannot alter a running trial',()=>{
 let s=createPond('flow');s=pondAction(s,{type:'arrive'});assert.deepEqual(s.trials,[]);
 s=pondAction(s,{type:'predict',bank:'flowers'});s=pondAction(s,{type:'gate'});s=pondAction(s,{type:'predict',bank:'reeds'});
 assert.equal(s.gate,'reeds');assert.equal(s.prediction,'flowers');s=pondAction(s,{type:'arrive'});s=pondAction(s,{type:'arrive'});
 assert.deepEqual(s.trials,[{prediction:'flowers',bank:'reeds',matched:false}]);assert.equal(s.phase,'explain');
 s=pondAction(s,{type:'gate'});s=pondAction(s,{type:'predict',bank:'flowers'});s=pondAction(s,{type:'arrive'});
 assert.equal(s.phase,'done');assert.equal(s.trials.length,2);
});
test('help remains explicit and a wrong prediction does not prevent finishing both paths',()=>{
 let s=pondAction(createPond('flow'),{type:'help'});
 for(const bank of ['flowers','reeds']){s=pondAction(s,{type:'predict',bank});s=pondAction(s,{type:'arrive'});if(s.phase!=='done')s=pondAction(s,{type:'gate'});}
 assert.equal(pondResult(s).completed,true);assert.equal(pondResult(s).helped,true);assert.ok(s.trials.every(t=>!t.matched));
});
