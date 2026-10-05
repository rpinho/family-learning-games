import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CASTLE,SMALL} from '../public/world-definitions.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {questGoals,goalsByRoom,worldToys,knownFact,factSupport} from '../public/world-progress.mjs';
import {checkWorld} from '../world-check.mjs';
import {worldLines,recordedWorldLines} from '../world-service.mjs';
import {clipName} from '../book-service.mjs';
import {createCoachAudio} from '../public/chess/audio.mjs';

test('missing fifth medal is pinned at its actual room, including an unvisited room',()=>{
 const model=createWorldModel(CASTLE),ids=Object.entries(CASTLE.ITEMS).filter(([,v])=>v.collection).map(([id])=>id);
 for(const missing of ids){const done=Object.entries(CASTLE.GATES).filter(([,g])=>!g.rewards.includes(missing)).map(([id])=>id),s={...model.freshWorld(),questStarted:true,treasureOpen:true,doorOpen:true,items:ids.filter(id=>id!==missing),solved:done};
  const todo=questGoals(model,s).find(g=>!g.done&&g.rewards.includes(missing));assert.ok(todo);assert.ok(goalsByRoom(model,s)[todo.room].some(g=>g.id===todo.id));assert.ok(!s.visited.includes(todo.room));
 }
});
test('scene counting cannot disclose the answer or fall back to abstract banner objects',()=>{
 for(const change of [g=>g.prompt='Tap 6 stones.',g=>g.bannerObjects=true,g=>delete g.sceneTargets]){
  const d=structuredClone(SMALL),g=d.GATES.stones;d.contentVersion=3;g.scenePuzzle={mode:'count'};g.answer='6';g.count=6;g.prompt='Count the painted stones.';g.options=['5','6','7'];g.pictures={'5':'5','6':'6','7':'7'};g.inScene=true;g.sceneTargets=Array.from({length:6},(_,id)=>({id,r:[.1,.2,.04,.04]}));change(g);
  assert.ok(checkWorld({model:createWorldModel(d),taughtLetters:['O']}).issues.some(s=>/in-scene/.test(s)));
 }
});
test('toys remain available in both finished and fresh worlds and authored placements compose with defaults',()=>{
 for(const d of [CASTLE,SMALL]){const rooms=worldToys(d),kinds=Object.values(rooms).flat().map(t=>typeof t==='string'?t:t.kind);assert.ok(kinds.includes('tetherball'));assert.ok(kinds.includes('soccer'));assert.ok(Object.values(rooms).filter(t=>t.length).length>=2);}
 const d=structuredClone(SMALL);d.toys=[{kind:'tetherball',room:'volcano',id:'custom'}];assert.equal(worldToys(d).volcano[0].id,'custom');
});
test('per-fact independent evidence excludes misses, help and fast taps; 3 × 9 gets a skip-count array',()=>{
 const rows=Array.from({length:3},()=>({firstTry:true,correct:true,ms:2400}));assert.ok(knownFact({'3x9':rows},3,9));
 for(const trial of [{firstTry:true,correct:true,ms:90},{firstTry:false,correct:false,ms:2300},{firstTry:true,correct:true,ms:2300,help:true}])assert.equal(knownFact({'3x9':[...rows,trial]},3,9),false);
 assert.equal(knownFact({},3,9),false);const support=factSupport({equation:'3 × 9 = ?',hint:'Count rows.'});assert.deepEqual(support.rows,[9,9,9]);assert.match(support.text,/9, 18, 27/);
});
test('all Dad friend and next-goal lines use the named warm voice and its voice-specific clip hash',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'world-warm-')),cast={voices:{rook:'local:warm-fixture'},cast:[{id:'dad',voice:'stale-dad'}]};await mkdir(join(dir,'voice'));await writeFile(join(dir,'cast.json'),JSON.stringify(cast));
 for(const d of [CASTLE,SMALL]){const out=worldLines(cast,d);for(const [key,l]of Object.entries(out))if(key==='start'||key.startsWith('next-')||key.startsWith('friend-')&&Object.entries(d.ROOMS).some(([id,r])=>r.friend==='dad'&&key.startsWith('friend-'+id+'-'))){assert.equal(l.voice,cast.voices.rook,key);}for(const l of Object.values(out))if(l.voice===cast.voices.rook)await writeFile(join(dir,'voice',clipName(l)),'synthetic recording');
  const recorded=await recordedWorldLines(dir,d);for(const [key,l]of Object.entries(recorded))if(out[key].voice===cast.voices.rook){assert.equal(l.clip,clipName(l));assert.equal(l.voice,cast.voices.rook);}
 }
});
test('custom priming source reuses the unlocked media element and preserves first playback',async()=>{
 const audio={pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}},p=createCoachAudio({unlockSource:'data:audio/wav;base64,fixture24k',createAudio:()=>audio});p.unlock();assert.equal(audio.src,'data:audio/wav;base64,fixture24k');p.play('/first.wav');await Promise.resolve();assert.equal(audio.src,'/first.wav');assert.equal(audio.paused,false);p.dispose();assert.equal(audio.paused,true);
});
