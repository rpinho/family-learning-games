import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,act,WORDS,voiceLines} from '../lib/engine.mjs';
import {BUILDER_STARTERS,builderQuestion} from '../lib/builder.mjs';
import {shouldAnnounce,shortPrompt} from '../lib/speech-plan.mjs';
const send=(p,input)=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id});
function solve(p,help=false){if(help)send(p,{kind:'help'});send(p,{kind:'draft',draft:[...p.session.q.word]});send(p,{kind:'answer',durationMs:1600});send(p,{kind:'next'});}
test('All 72 starter words appear before recycling; last eight never repeat across saved flights',()=>{
 let p=fresh('explorer');const words=[];
 for(let i=0;i<80;i++){
  if(!p.session||p.session.phase==='complete')send(p,{kind:'start',game:'builder'});
  const q=p.session.q;assert.ok(!words.slice(-8).includes(q.word));words.push(q.word);
  assert.equal(q.printCase,'upper');assert.ok([...q.word].every(c=>q.tiles.includes(c)));
  solve(p,true);p=JSON.parse(JSON.stringify(p));
 }
 assert.equal(new Set(words.slice(0,72)).size,72);assert.equal(p.builder.stage,1);
 assert.equal(fresh('beginner').builder,undefined);
});
test('Independent mastery advances actual words; repeated mistakes ease the following question',()=>{
 const p=fresh('admin');send(p,{kind:'start',game:'builder'});
 for(let stage=1;stage<=3;stage++){
  for(let i=0;i<8;i++){assert.equal(p.session.q.level,stage);assert.equal(p.session.q.word.length,stage+2);solve(p);}
  send(p,{kind:'start',game:'builder'});
 }
 const id=p.session.q.id;send(p,{kind:'answer',durationMs:100});send(p,{kind:'answer',durationMs:100});
 assert.equal(p.session.q.id,id);assert.equal(p.builder.stage,2);solve(p);assert.equal(p.session.q.level,2);
});
test('Switching games cannot restart Builder history; old active saves migrate without erasing progress',()=>{
 const p=fresh('explorer');p.xp=690;p.serial=17;
 p.session={game:'builder',q:{word:'hat'},results:[{q:{word:'cat'}},{q:{word:'dog'}}]};
 send(p,{kind:'start',game:'blaster'});assert.deepEqual(p.builder.recent,['cat','dog','hat']);
 send(p,{kind:'start',game:'builder'});assert.ok(!['cat','dog','hat'].includes(p.session.q.word));assert.equal(p.xp,690);
 const serial=p.builder.serial;send(p,{kind:'start',game:'builder'});assert.equal(p.builder.serial,serial+1);
});
test('Every Builder clue and success phrase exists; optional coach mute does not suppress required clues',async()=>{
 const inventory=new Set(voiceLines());
 for(let stage=1;stage<=3;stage++){
  const p={builder:{stage,serial:0,recent:[],skills:{},wins:[],misses:0}};
  for(let i=0;i<(stage===1?BUILDER_STARTERS.length:12);i++){
   const q=builderQuestion(p,WORDS);
   for(const line of [q.prompt,q.help,shortPrompt(q),`Yes! ${q.word}.`])assert.ok(inventory.has(line),line);
   assert.equal(shouldAnnounce(q,false),true);
  }
 }
 assert.equal(shouldAnnounce({game:'asteroids'},false),false);assert.equal(shouldAnnounce(null,true),false);
 const ui=await readFile(new URL('../app/Arcade.jsx',import.meta.url),'utf8');
 assert.ok(ui.includes('Yes! ${old.session.q.word}.'));assert.ok(ui.includes('Coach chat'));
});
