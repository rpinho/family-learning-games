import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../public/engine.mjs';
import {rescueAction,rescueState,rescueBoard,rescueClue,PUZZLE_LINES} from '../public/rescue.mjs';
const act=(p,kind,more={})=>rescueAction(p,{kind,mission:rescueState(p).mission,...more});
const legacy=()=>({mission:1,phase:'plan',plan:[],position:38,direction:3,paused:false,helped:false,moves:0,helpCount:0,pauses:0,badges:0,history:[]});
test('Open legacy exit reminds about the friend, including saves already in the doorway',()=>{
 for(const position of [10,3]){
  const p=freshProfile('beginner');p.rescue={...legacy(),phase:'friend',position,direction:0,badges:8};
  const before=structuredClone(p.rescue),revision=p.revision;
  assert.equal(rescueBoard(p).grid[0][3],0,'door stays visibly open');
  assert.deepEqual(act(p,'forward'),{kind:'exit-needs-friend',line:PUZZLE_LINES.missingFriend});
  assert.deepEqual(p.rescue,before,'no wall penalty, move, badge or mission change');assert.equal(p.revision,revision+1);
  act(p,'turn',{turn:1});assert.equal(p.rescue.direction,1,'can turn back');
 }
 const p=freshProfile('beginner');p.rescue={...legacy(),phase:'exit',position:10,direction:0};
 assert.equal(act(p,'forward').kind,'complete');assert.equal(p.rescue.badges,1);
});
function walk(p){let count=0;while(['key','friend','exit'].includes(rescueState(p).phase)){
 assert.ok(count++<100,'Each mission is reachable');const s=rescueState(p),clue=rescueClue(p);assert.ok(clue);
 while(rescueState(p).direction!==clue.absolute)act(p,'turn',{turn:1});act(p,'forward');
}}
test('Existing rescue finishes unchanged, then upgrades without losing badges or other progress',()=>{
 const p=freshProfile('explorer');p.maze={level:64,position:9};const untouched=structuredClone(p);p.rescue=legacy();
 for(let mission=1;mission<=1;mission++){
  act(p,'plan',{card:'key'});act(p,'plan',{card:'friend'});walk(p);assert.equal(p.rescue.phase,'rook');
  act(p,'rook');assert.equal(p.rescue.phase,'reroute');assert.equal(rescueBoard(p).grid[3][3],1);
  act(p,'reroute');walk(p);assert.equal(p.rescue.phase,'done');assert.equal(p.rescue.badges,mission);
  assert.throws(()=>act(p,'forward'));assert.equal(p.rescue.badges,mission);
  act(p,'next');assert.equal(p.rescue.engine,2);assert.equal(p.rescue.badges,1);assert.equal(p.rescue.mission,2);
 }
 for(const key of Object.keys(untouched))if(key!=='revision')assert.deepEqual(p[key],untouched[key],key);
});
test('help, mistakes, pause and reload preserve progress and rewards',()=>{
 let p=freshProfile('beginner');p.rescue=legacy();act(p,'plan',{card:'friend'});assert.deepEqual(p.rescue.plan,[]);
 act(p,'help');act(p,'pause');const pos=p.rescue.position;assert.throws(()=>act(p,'plan',{card:'key'}));
 p=JSON.parse(JSON.stringify(p));act(p,'resume');act(p,'plan',{card:'key'});act(p,'plan',{card:'friend'});
 act(p,'turn',{turn:1});act(p,'forward');assert.equal(p.rescue.position,pos);assert.equal(p.rescue.phase,'key');
 act(p,'help');walk(p);act(p,'rook');act(p,'reroute');walk(p);assert.equal(p.rescue.badges,1);assert.equal(p.rescue.history[0].pauses,1);
 assert.throws(()=>rescueAction(p,{kind:'next',mission:0}));assert.equal(p.rescue.mission,1);
 const before=JSON.stringify(p);assert.throws(()=>act(p,'nonsense'));assert.equal(JSON.stringify(p),before);
});
