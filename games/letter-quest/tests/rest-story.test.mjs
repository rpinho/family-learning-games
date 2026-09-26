import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtemp,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {freshProfile,nextChallenge,applyAttempt,expectedAnswer} from '../public/engine.mjs';
import {boStoryVoiceLines,BO_PLACES,tellsBoStory} from '../public/bo-story.mjs';
import {trackPlay,windDownDue,startRest,resting,clearRest,REST_LINE,REST_COACH,WIND_DOWN_MS,BREAK_MS,REST_MS} from '../public/rest.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
import {briefLine} from '../public/voice.mjs';
const answer=(p,c)=>applyAttempt(p,c,c.type==='trace'?{strokes:c.paths,durationMs:4000,helped:false}:{answer:expectedAnswer(c),durationMs:4000,helped:false});
const finishLesson=p=>{for(let i=0;i<60;i++){const r=answer(p,nextChallenge(p));if(r.lesson)return r;}throw Error('no lesson');};
test('each finished lesson adds one beat to Bo’s story, with the letter he practised',()=>{
 const voiced=new Set(allVoiceLines());
 for(const line of [...boStoryVoiceLines(),REST_LINE,REST_COACH]){assert.ok(voiced.has(line),line);assert.equal(briefLine(line),line,'one sentence per spoken line: '+line);}
 const p=freshProfile('beginner');const r=finishLesson(p);
 assert.ok(r.story);assert.equal(p.boStory.count,1);assert.equal(r.story.lesson,p.completed);
 assert.equal(r.story.lines[0],'Bo set off from the cozy cave.');
 if(r.story.letter)assert.equal(r.story.lines[1],`Bo found the letter ${r.story.letter}.`);
 for(const line of r.story.lines)assert.ok(voiced.has(line),line);
 const r2=finishLesson(p);assert.equal(r2.story.lines[0],'Bo walked into the berry forest.');assert.equal(p.boStory.count,2);
 for(let i=0;i<BO_PLACES.length;i++)finishLesson(p);assert.equal(p.boStory.beats.at(-1).lines[0],'Bo walked into the berry forest.','the walk loops');
 const f=freshProfile('explorer');for(let i=0;i<60&&!f.completed;i++)answer(f,nextChallenge(f));
 assert.equal(tellsBoStory('explorer'),false);assert.equal(f.boStory,undefined);
 const a=freshProfile('admin');assert.equal(finishLesson(a).story.lines[0],'Bo set off from the cozy cave.');
});
test('wind-down: 20 minutes of continuous play, breaks reset it, rest ends by itself or by a grown-up',()=>{
 const p={};let t=0;
 for(;t<=WIND_DOWN_MS;t+=60000)trackPlay(p,t);
 assert.ok(windDownDue(p,t));startRest(p,t);assert.ok(resting(p,t+1000));assert.equal(resting(p,t+REST_MS+1),false);
 trackPlay(p,t+REST_MS+5);assert.equal(p.play.since,t+REST_MS+5,'a new stretch after the rest');assert.equal(windDownDue(p,t+REST_MS+6),false);
 const q={};trackPlay(q,0);trackPlay(q,5*60000);trackPlay(q,5*60000+BREAK_MS+1);assert.equal(q.play.since,5*60000+BREAK_MS+1);
 startRest(q,1);clearRest(q,2);assert.equal(resting(q,3),false);
});
test('HTTP: summary is read-only, rest can be cleared, and a resting save stays loadable',async()=>{
 const data=await mkdtemp(join(tmpdir(),'lq-rest-'));
 const p=freshProfile('beginner');finishLesson(p);p.play={since:Date.now()-30*60000,last:Date.now(),restUntil:Date.now()+REST_MS};p.revision=7;
 await writeFile(join(data,'beginner.json'),JSON.stringify(p));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14339',HOST:'127.0.0.1',LETTER_QUEST_DATA:data},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('Server exited')));});
  const base='http://127.0.0.1:14339';
  const state=await(await fetch(base+'/api/beginner/state')).json();assert.ok(state.profile.play.restUntil>state.serverNow);
  for(const file of ['/bo-story.mjs','/rest.mjs'])assert.equal((await fetch(base+file)).status,200);
  const before=await readFile(join(data,'beginner.json'),'utf8');
  const s=await(await fetch(base+'/api/beginner/summary')).json();
  assert.equal(s.player,'beginner');assert.equal(s.app,'letter-quest');assert.ok('stuck' in s&&'lessons' in s&&'labyrinth' in s);
  assert.equal(await readFile(join(data,'beginner.json'),'utf8'),before,'summary never writes');
  assert.equal((await fetch(base+'/api/beginner/summary?date=nope')).status,400);
  assert.equal((await fetch(base+'/api/beginner/summary',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
  const r=await fetch(base+'/api/beginner/rest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);
  const d=await r.json();assert.equal(d.profile.play.restUntil,undefined);assert.equal(d.profile.boStory.count,1);
 }finally{child.kill();}
});
