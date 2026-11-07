import test from 'node:test';
import assert from 'node:assert/strict';
import {boardRule,makeBoard,boardErrors,searchAct,freshSearch} from '../word-search-model.mjs';
import {SEARCH_WORDS,LONG_WORDS} from '../word-search-vocabulary.mjs';
import {hasPicture} from '../public/word-blocks/art.mjs';
import {explorationEpisode} from '../public/world-exploration.mjs';
import {roomArtFallback} from '../art-fallback.mjs';
import {readingChangeSupport,readingAction} from '../../games/letter-quest/public/reading.mjs';
test('all long-word clues have original pictures; an unpictured deal never leaves the generator',()=>{
 assert.equal(LONG_WORDS.length,24);for(const w of LONG_WORDS)assert.ok(hasPicture(w.toLowerCase()),w);
 assert.throws(()=>makeBoard({size:6,count:1,words:['XYZ'],seed:'missing-picture',targetHasPicture:()=>false}),e=>e.code==='WORD_SEARCH_PICTURE');
 const b=makeBoard({size:6,count:1,words:['XYZ'],seed:'synthetic-face',names:['XYZ'],targetHasPicture:()=>true});assert.equal(b.targets[0].word,'XYZ');
});
test('Expert uses a large board, picture-only clues and exactly two checked near misses',()=>{
 for(let n=0;n<12;n++){
  const b=makeBoard({...boardRule(26),words:[...LONG_WORDS,...SEARCH_WORDS],mode:'expert',targetHasAudio:()=>true,seed:'expert-'+n});
  assert.equal(b.size,12);assert.equal(b.mode,'expert');assert.equal(b.decoys.length,2);assert.deepEqual(boardErrors(b),[]);
  const p={...freshSearch(),completed:26,current:b};const result=searchAct(p,{type:'hint'});assert.ok(result.hint.cells.length);assert.equal(result.hint.word,undefined);
 }
});
test('legacy itinerary links open while actual item locks and reading instructions remain',()=>{
 const ep={forwardRoute:['a','b'],forwardSteps:['sum'],rooms:[{id:'a',exits:{right:'b',top:'c'},exitRequires:{right:'sum',top:'key-lock'}}],puzzles:[{id:'sum',room:'a',forwardPrevious:'earlier',requires:['earlier','key-lock']}],locks:[{id:'key-lock',item:'key',requires:[]}]};
 const original=structuredClone(ep),open=explorationEpisode(ep);assert.deepEqual(ep,original);assert.deepEqual(open.rooms[0].exitRequires,{top:'key-lock'});assert.deepEqual(open.puzzles[0].requires,['key-lock']);assert.equal(open.locks[0].item,'key');
});
test('a missing room painting falls back independently and retains available custom art',async()=>{
 const stock={backgrounds:{meadow:{file:'meadow.svg'},castle:{file:'castle.svg'},forest:{file:'forest.svg'}}};
 const lib={backgrounds:{castle:{file:'missing.svg'},forest:{file:'custom.svg'},newRoom:{file:'absent.svg'}},actors:{}};
 const out=await roomArtFallback(lib,stock,async f=>f!=='missing.svg'&&f!=='absent.svg');
 assert.equal(out.backgrounds.castle.file,'castle.svg');assert.equal(out.backgrounds.forest.file,'custom.svg');assert.equal(out.backgrounds.newRoom.file,'meadow.svg');
});
test('shown replacement model restores unchanged letters and focuses the replacement',()=>{
 const question={id:'guided',type:'change',from:'cat',answer:'cot',tiles:['c','a','t','o'],level:1};
 const state={question,help:['show'],draft:[1,1,1],cursor:0};const before=structuredClone(state),s=readingChangeSupport(state);
 assert.deepEqual(state,before);assert.equal(s.position,1);assert.equal(s.target,3);assert.deepEqual(s.draft,[0,1,2]);
 const p={revision:0,reading:{...state,phase:'question'}};readingAction(p,{kind:'draft',questionId:'guided',draft:[1,3,1]});assert.deepEqual(p.reading.draft,[0,3,2]);assert.equal(p.reading.cursor,1);
});
