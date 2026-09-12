import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recognizeDrawing,drawingVector,inkStats} from '../lib/doodle.mjs';
import {PARTS,MISSIONS,checkPart,artVoiceLines} from '../lib/art.mjs';
import {freshProfile,action} from '../lib/math.mjs';
import {cleanMissionInk} from '../lib/shape-check.mjs';
const model=JSON.parse(await readFile(new URL('../data/doodle-model.json',import.meta.url)));
const services={recognize:ink=>recognizeDrawing(ink,model)};
test('handmade outlines tolerate slanted and rounded corners, small gaps and incidental taps',()=>{
 const door=[[[27,16],[80,14],[68,85],[13,79],[27,20]]];
 assert.equal(checkPart('rectangle',door).ok,true);
 const rounded=[[[20,15],[78,15],[83,22],[85,72],[75,85],[20,80],[18,20]]];
 assert.equal(checkPart('rectangle',rounded).ok,true);
 const dot=[[95,98],[95.3,99]];
 assert.equal(checkPart('rectangle',[...door,dot]).ok,true);
 assert.deepEqual(cleanMissionInk([...door,dot]),door);
 const triangle=[[[48,20],[83,69],[85,76],[68,82],[18,80],[12,74],[48,20]]];
 assert.equal(checkPart('triangle',triangle).ok,true);
 const rotated=PARTS.rectangle.path.map(([x,y])=>[50+(x-50)*.7-(y-50)*.5,50+(x-50)*.5+(y-50)*.7]);
 assert.equal(checkPart('rectangle',[rotated]).ok,true);
 for(const kind of ['circle','rectangle','triangle']){
  assert.equal(checkPart(kind,[[[20,20],[80,20],[80,80]]]).ok,false,'missing sides');
  assert.equal(checkPart(kind,[Array.from({length:80},(_,i)=>[i%2?80:20,20+i%60])]).ok,false,'scribble');
  for(const other of ['circle','rectangle','triangle'])assert.equal(checkPart(kind,[PARTS[other].path]).ok,kind===other,kind+' versus '+other);
 }
});
test('keep my version unlocks after two checks, logs assistance, survives reload and cannot replay',()=>{
 let p=freshProfile('admin');const send=input=>action(p,{revision:p.revision,...input},789,services);
 send({kind:'art_start'});const id=p.art.mission.id;
 const attempt={kind:'art_part',missionId:id,part:0,strokes:[PARTS.triangle.path]};
 assert.throws(()=>send({...attempt,keep:true}));
 send(attempt);assert.equal(p.art.mission.attempts,1);assert.throws(()=>send({...attempt,keep:true}));
 send(attempt);p=JSON.parse(JSON.stringify(p));assert.equal(p.art.mission.attempts,2);
 assert.throws(()=>send({...attempt,strokes:[],keep:true}));
 send({...attempt,keep:true});assert.equal(p.art.mission.part,1);assert.equal(p.art.mission.attempts,0);assert.deepEqual(p.art.mission.assistedParts,[0]);
 assert.equal(p.art.mission.feedback.ok,false);assert.equal(p.art.mission.feedback.kept,true);
 assert.throws(()=>send({...attempt,keep:true}));
 send({...attempt,part:1,strokes:[PARTS.rectangle.path]});assert.equal(p.art.mission.complete,true);
 assert.deepEqual(p.art.history.at(-1).assistedParts,[0]);assert.equal(p.xp,0);assert.equal(p.lessons,0);
});
test('real local model recognizes basic ink, abstains on empty ink and handles maximum validation bounds',()=>{
 assert.equal(recognizeDrawing([],model).label,null);
 assert.equal(recognizeDrawing([[[20,20],[20,20]]],model).label,null);
 for(const [label,kind] of [['circle','circle'],['triangle','triangle'],['square','rectangle']])assert.equal(recognizeDrawing([PARTS[kind].path],model).label,label);
 assert.equal(drawingVector([[[NaN,20]]]),null);
 assert.equal(inkStats(Array.from({length:150},()=>Array.from({length:700},()=>[50,50]))).points,105000);
 const scribble=[Array.from({length:150},(_,i)=>[i%2?90:10,10+(i%40)*2])];
 assert.equal(recognizeDrawing(scribble,model).label,null);
 assert.equal(recognizeDrawing([PARTS.circle.path],null).reason,'unavailable');
});
test('missions accept translated, smaller, wobbly and separate-side shapes without rails',()=>{
 for(const kind of Object.keys(PARTS)){
  const path=PARTS[kind].path;
  assert.equal(checkPart(kind,[path]).ok,true,kind);
  assert.equal(checkPart(kind,[path.map(([x,y])=>[x*.6+10,y*.6+12])]).ok,true,kind+' small');
  assert.equal(checkPart(kind,[path.map(([x,y],i)=>[x+(i%2?1:-1),y+(i%3?1:-1)])]).ok,true,kind+' wobbly');
 }
 const p=PARTS.triangle.path;
 assert.equal(checkPart('triangle',p.slice(1).map((x,i)=>[p[i],x])).ok,true);
 assert.equal(checkPart('triangle',[p.slice(0,2)]).ok,false);
 assert.equal(checkPart('circle',[[[15,15],[85,85]]]).ok,false);
 assert.equal(checkPart('circle',[PARTS.rectangle.path]).ok,false);
 assert.equal(checkPart('rectangle',[PARTS.circle.path]).ok,false);
 assert.equal(checkPart('rectangle',[]).ok,false);
 assert.equal(checkPart('rectangle',[[[Infinity,0]]]).ok,false);
});
test('guesses never grade or replace free drawings, and label corrections are bounded and replay safe',()=>{
 const p=freshProfile('beginner');p.drawing=[[[2,2],[3,3]]];const original=structuredClone(p.drawing);
 const send=input=>action(p,{revision:p.revision,...input},123,services);
 send({kind:'art_guess',strokes:[PARTS.triangle.path],label:'tree'});
 assert.equal(p.art.lastGuess.label,'triangle');assert.equal(p.xp,0);assert.deepEqual(p.drawing,original);
 const guessId=p.art.lastGuess.id;
 assert.throws(()=>send({kind:'art_label',guessId,label:'made up'}));
 send({kind:'art_label',guessId,label:'something else'});
 assert.equal(p.art.lastGuess.childLabel,'something else');assert.equal(p.xp,0);
 assert.throws(()=>send({kind:'art_label',guessId,label:'tree'}));
 assert.throws(()=>action(p,{revision:0,kind:'art_guess',strokes:[]},123,services));
 assert.throws(()=>send({kind:'art_guess',strokes:Array.from({length:20},()=>Array.from({length:300},()=>[0,0]))}));
});
test('mission retries keep part, successful parts advance once, six pictures cycle without touching math/reading',()=>{
 const p=freshProfile('admin');p.reading={custom:'untouched'};const send=input=>action(p,{revision:p.revision,...input},456,services);
 for(let i=0;i<MISSIONS.length+1;i++){
  send({kind:'art_start'});const m=p.art.mission,id=m.id;
  assert.equal(m.index,i%MISSIONS.length);assert.throws(()=>send({kind:'art_start'}));
  send({kind:'art_part',missionId:id,part:0,strokes:[]});assert.equal(m.part,0);
  for(const [kind] of MISSIONS[m.index].parts){const n=m.part;send({kind:'art_part',missionId:id,part:n,strokes:[PARTS[kind].path],example:true});assert.equal(m.part,n+1);assert.throws(()=>send({kind:'art_part',missionId:id,part:n,strokes:[PARTS[kind].path]}));}
  assert.equal(m.complete,true);assert.equal(p.art.completed,i+1);
 }
 assert.equal(p.xp,0);assert.equal(p.lessons,0);assert.equal(p.session,null);assert.deepEqual(p.reading,{custom:'untouched'});assert.deepEqual(p.drawing,[]);
 assert.ok(p.art.history.some(x=>x.example===true));assert.ok(artVoiceLines().includes('Is it a tree?'));
});
