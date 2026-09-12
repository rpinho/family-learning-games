import test from 'node:test';
import assert from 'node:assert/strict';
import {GLYPHS,freshProfile as newProfile,nextChallenge,applyAttempt,assessTrace,samplePath,unlocked,leagueRows,resetProgress,questRating,taskPrompt,visibleTaskPrompt,challengeKey,expectedAnswer,WORDS,startDuel} from '../public/engine.mjs';
// These regressions exercise the original curriculum AFTER the new lowercase track.
// Fresh/unmastered Explorer profiles are covered separately in lowercase.test.mjs.
function freshProfile(id){const p=newProfile(id);if(p.id==='explorer')p.foundation={reviewComplete:true};return p;}
test('B accepts its shared middle bar in either bowl without tracing it twice',()=>{
 const [stem,upper,lower]=GLYPHS.B;
 for(const level of [0,1,2,3]){
  for(const strokes of [[stem,upper.slice(0,-1),lower],[stem,upper,lower.slice(1)]]){
   assert.equal(assessTrace(GLYPHS.B,strokes,level).ok,true);
   assert.equal(assessTrace(GLYPHS.B,strokes.map(s=>samplePath(s,.3)),level).ok,true);
  }
 }
});
test('B still requires a stem, both bowls, a middle bar, and forward strokes',()=>{
 const [stem,upper,lower]=GLYPHS.B;
 for(const strokes of [
  [upper,lower], [stem,upper], [stem,lower,lower],
  [stem,upper.slice(0,-1),lower.slice(1)],
  [[...stem].reverse(),upper,lower],
  [stem,[...upper.slice(0,-1)].reverse(),lower],
  [stem,upper,[...lower.slice(1)].reverse()],
  [stem,upper,[[25,49],[100,0],[0,100],[25,85]]]
 ])assert.equal(assessTrace(GLYPHS.B,strokes,0).ok,false,JSON.stringify(strokes));
});
test('Every uppercase, lowercase and digit has a valid, accepted model',()=>{
 assert.equal(Object.keys(GLYPHS).length,62);
 for(const [char,paths] of Object.entries(GLYPHS))assert.ok(assessTrace(paths,paths,3).ok,`Model rejected: ${char}`);
});
test('Dense Chromebook touch samples do not turn correct traces into long scribbles',()=>{
 for(const letter of ['R','A','F']){
  const dense=GLYPHS[letter].map(s=>samplePath(s,.3));
  assert.ok(assessTrace(GLYPHS[letter],dense).ok,letter);
 }
 const retraced=GLYPHS.F.map(s=>[...s,...[...s].reverse(),...s]);
 assert.equal(assessTrace(GLYPHS.F,retraced).ok,false);
});
test('Lowercase a accepts curve plus stem and legacy closed-oval plus stem',()=>{
 const closed=[[...GLYPHS.a[0],[70,43]],GLYPHS.a[1]];
 for(const model of [GLYPHS.a,closed])for(const drawing of [GLYPHS.a,closed])assert.ok(assessTrace(model,drawing).ok);
 assert.equal(assessTrace(GLYPHS.a,[GLYPHS.a[0]]).ok,false);
 assert.equal(assessTrace(GLYPHS.a,GLYPHS.a.map(s=>[...s].reverse())).ok,false);
});
test('Both boys explore the alphabet independently of old placement misses',()=>{
 for(const id of ['explorer','beginner']){
 const p=freshProfile(id);p.seq=20;p.placement={index:4,misses:2,letters:['E','T']};
 const observed=new Set();
 for(let i=0;i<20;i++){
  p.seq=18+i*6;if(p.seq%13===0)p.seq+=6;
  const c=nextChallenge(p);assert.equal(c.type,'find');assert.equal(c.level,id==='beginner'?1:2);assert.equal(c.options.length,id==='beginner'?2:4);
  assert.ok(c.id.startsWith('variety6:'));assert.deepEqual(nextChallenge(JSON.parse(JSON.stringify(p))),c);
  observed.add(c.char);applyAttempt(p,c,{answer:c.char,durationMs:2500,helped:false});
 }
 assert.ok(observed.size>=16);assert.ok([...observed].some(c=>/^[a-z]$/.test(c)));
 assert.equal(Object.keys(p.skills).some(k=>k.startsWith('trace:')),false);
 }
 const beginner=freshProfile('beginner');const c=nextChallenge(beginner);
 assert.equal(c.level,0);assert.equal(c.options.length,2);assert.equal(c.probe,false);
 const admin=freshProfile('admin');admin.seq=18;assert.equal(nextChallenge(admin).probe,false);
});
test('Harder recognition does not change retry behavior or assign writing mastery',()=>{
 const p=freshProfile();p.seq=20;
 let c=nextChallenge(p);assert.equal(c.type,'trace');const letter=c.char;
 applyAttempt(p,c,{strokes:[],durationMs:6000,helped:false});c=nextChallenge(p);
 assert.equal(c.retry,true);assert.equal(c.char,letter);
 applyAttempt(p,c,{strokes:c.paths,durationMs:6000,helped:true});
 assert.equal(p.skills[`trace:${letter}`].level,0);
});
test('Quest rating uses skill progression, not XP, and resets cleanly',()=>{
 const p=freshProfile();assert.deepEqual(questRating(p),{score:400,level:1});
 p.xp=9000;assert.equal(questRating(p).score,400);
 p.skills={'find:A':{level:2},'trace:F':{level:1}};assert.equal(questRating(p).score,440);
 assert.deepEqual(questRating(resetProgress(p)),{score:400,level:1});
});
test('Reject backwards, mirrored, incomplete and scribbled F strokes',()=>{
 const f=GLYPHS.F;
 for(const input of [f.map(s=>[...s].reverse()),f.map(s=>s.map(([x,y])=>[100-x,y])),f.slice(0,1),f.map(()=>[[0,0],[100,100],[0,100],[100,0]])])assert.equal(assessTrace(f,input).ok,false);
});
test('Allow small motor noise and reject a reversed loop',()=>{
 const noisy=GLYPHS.A.map(s=>samplePath(s).map(([x,y],i)=>[x+Math.sin(i)*2,y+Math.cos(i)*2]));
 assert.ok(assessTrace(GLYPHS.A,noisy).ok);
 assert.equal(assessTrace(GLYPHS.O,GLYPHS.O.map(s=>[...s].reverse())).ok,false);
});
test('Wrong answers do not finish a lesson; assisted answers do not advance skill',()=>{
 const p=freshProfile();let c=nextChallenge(p);
 applyAttempt(p,c,{answer:'?',durationMs:3000,helped:false});assert.equal(p.inLesson,0);
 c={id:'test',type:'find',char:'F',level:0};applyAttempt(p,c,{answer:'F',durationMs:1000,helped:true});assert.equal(p.skills['find:F'].level,0);
 applyAttempt(p,c,{answer:'F',durationMs:1000,helped:false});assert.equal(p.skills['find:F'].level,1);
 applyAttempt(p,c,{answer:'?',durationMs:1000,helped:false});assert.equal(p.skills['find:F'].level,0);
});
test('Five wins complete a lesson; three lessons earn exactly one chest',()=>{
 const p=freshProfile();for(let i=0;i<15;i++){const c=nextChallenge(p);applyAttempt(p,c,{answer:expectedAnswer(c),strokes:c.paths,durationMs:8000,helped:false});}
 assert.equal(p.completed,3);assert.equal(p.chests,1);assert.equal(p.inLesson,0);assert.equal(p.history.length,15);
});
test('Curriculum reaches every character and identities stay separate',()=>{
 const p=freshProfile();p.completed=100;assert.equal(new Set(unlocked(p)).size,62);
 const q=freshProfile('beginner');assert.equal(q.name,'Beginner');assert.equal(q.settings.leftHanded,false);assert.equal(q.xp,0);
});
test('League ranking is earned and targets are fixed',()=>{
 const p=freshProfile();assert.equal(leagueRows(p)[0].you,undefined);p.xp=251;assert.equal(leagueRows(p)[0].you,true);
});
test('Failed tracing retries the same letter with a new ID and reduced difficulty',()=>{
 const p=freshProfile();p.seq=1;
 const first=nextChallenge(p);assert.equal(first.type,'trace');
 p.skills[`trace:${first.char}`]={level:3,streak:0,seen:2,hits:2,last:0};
 const failed=applyAttempt(p,{...first,level:3},{strokes:[[[0,0],[100,100]]],durationMs:3000,helped:false});
 assert.equal(failed.ok,false);assert.equal(p.inLesson,0);
 const retry=nextChallenge(p);
 assert.equal(retry.char,first.char);assert.equal(retry.type,'trace');assert.equal(retry.retry,true);
 assert.notEqual(retry.id,first.id);assert.equal(retry.level,2);
 assert.deepEqual(nextChallenge(JSON.parse(JSON.stringify(p))),retry);
 const success=applyAttempt(p,retry,{strokes:retry.paths,durationMs:4000,helped:true});
 assert.equal(success.ok,true);assert.equal(p.inLesson,1);assert.equal(p.retryTrace,undefined);
 assert.equal(p.history.at(-1).helped,true);
});
test('Admin practice starts with Admin; reset preserves settings and invalidates stale challenges',()=>{
 const p=freshProfile('admin');assert.equal(p.name,'Admin');p.seq=13;
 assert.equal(nextChallenge(p).word,'Admin');
 p.xp=80;p.completed=1;p.revision=15;p.retryTrace='F';p.settings.sound=false;
 const prior=JSON.stringify(p),reset=resetProgress(p);
 assert.equal(reset.id,'admin');assert.equal(reset.xp,0);assert.equal(reset.seq,0);assert.equal(reset.revision,16);
 assert.equal(reset.settings.sound,false);assert.equal(reset.retryTrace,undefined);assert.deepEqual(reset.skills,{});
 assert.equal(JSON.stringify(p),prior);assert.notEqual(nextChallenge(reset).id,nextChallenge(p).id);
});
test('Family names rotate independently, retain duplicate tiles, and persist across reload',()=>{
 for(const id of ['explorer','beginner','admin','demo']){
  let p=freshProfile(id);p.placement={index:8,misses:0,letters:[]};
  const words=[];
  for(let round=0;round<8;round++){
   p.seq=(round+1)*13;
   const c=nextChallenge(p);words.push(c.word);
   assert.equal(c.type,'name');assert.ok(c.id.startsWith('family2:'));
   const tiles=[...c.options];for(const letter of c.word){const i=tiles.indexOf(letter);assert.ok(i>=0);tiles.splice(i,1);}
   assert.equal(tiles.length,id==='explorer'?2:0);
   assert.ok(tiles.every(c=>!words.at(-1).toLowerCase().includes(c)));
   assert.deepEqual(nextChallenge(JSON.parse(JSON.stringify(p))),c);
   const result=applyAttempt(p,c,{answer:c.word,durationMs:8000,helped:false});
   assert.equal(result.ok,true);assert.equal(p.history.at(-1).word,c.word);
   p=JSON.parse(JSON.stringify(p));
  }
  assert.deepEqual(new Set(words.slice(0,4)),new Set(['Explorer','Beginner','Admin','Helper']));
  assert.deepEqual(words.slice(0,4),words.slice(4));
  assert.equal(words[0],id==='beginner'?'Beginner':id==='admin'?'Admin':'Explorer');
  assert.equal(p.familyNameRound,8);assert.equal(resetProgress(p).familyNameRound,undefined);
 }
 const fresh=freshProfile('beginner');assert.equal(fresh.familyNameRound,undefined);
});
test('Explorer starts copying without tracing outlines and builds names from audio with decoys',()=>{
 const p=freshProfile();p.seq=20;let c=nextChallenge(p);
 assert.equal(c.type,'trace');assert.equal(c.level,2);assert.ok(taskPrompt(c).startsWith('Copy '));
 applyAttempt(p,c,{strokes:c.paths,durationMs:7000,helped:false});assert.equal(p.skills[`trace:${c.char}`].level,2);
 p.seq=26;c=nextChallenge(p);assert.equal(c.type,'name');assert.equal(c.memory,true);assert.equal(c.options.length,c.word.length+2);
 assert.equal(visibleTaskPrompt(c).includes(c.word),false);assert.ok(taskPrompt(c).includes(c.word));
 assert.ok(visibleTaskPrompt(c,true).includes(c.word));
 applyAttempt(p,c,{answer:c.word,durationMs:7000,helped:true});assert.equal(p.skills.name.level,0);
 const beginner=freshProfile('beginner');beginner.seq=20;c=nextChallenge(beginner);assert.equal(c.level,0);
});
test('Listening questions do not print the answer unless a hint is requested',()=>{
 const c={type:'find',char:'I',level:2};
 assert.equal(taskPrompt(c),'Find I.');assert.equal(visibleTaskPrompt(c).includes('Find I'),false);
 assert.equal(visibleTaskPrompt(c,true),'Find I.');assert.equal(visibleTaskPrompt({...c,level:0}),'Find I.');
});
test('Both children get six exercise types; words, gaps and sequences are scored distinctly',()=>{
 for(const id of ['explorer','beginner']){
  const p=freshProfile(id),types=new Set();
  for(let seq=14;seq<=30;seq++){
   p.seq=seq;delete p.retryTrace;const c=nextChallenge(p);types.add(c.type);
   assert.deepEqual(nextChallenge(JSON.parse(JSON.stringify(p))),c);
   if(c.type==='spell'){assert.equal(c.options.length===26,id!=='beginner');assert.equal(c.memory,id!=='beginner');assert.equal(c.reusable,true);assert.equal(visibleTaskPrompt(c).includes(c.word),false);}
   if(c.type==='gap'){assert.equal(c.word[c.blank],c.char);assert.equal(c.options.length,id==='beginner'?2:4);}
   if(c.type==='sequence'){assert.equal(c.letters[c.blank],c.char);assert.equal(c.letters[1].charCodeAt(0),c.letters[0].charCodeAt(0)+1);}
   const result=applyAttempt(p,c,{answer:expectedAnswer(c),strokes:c.paths,durationMs:9000,helped:false});
   assert.equal(result.ok,true);assert.ok(p.skills[challengeKey(c)]);
  }
  assert.deepEqual(types,new Set(['trace','gap','sequence','find','spell','name']));
 }
 const p=freshProfile();p.seq=19;const c=nextChallenge(p);
 assert.equal(c.type,'spell');assert.equal(applyAttempt(p,c,{answer:'wrong',durationMs:5000,helped:false}).ok,false);
 assert.equal(p.inLesson,0);
});
test('Five-round Rook duel awards only the independent player, rewards once and rematches',()=>{
 const p=freshProfile('beginner');p.retryTrace='a';const oldRevision=p.revision;
 startDuel(p);assert.equal(p.revision,oldRevision+1);const seed=p.duel.seed;
 startDuel(p);assert.equal(p.duel.seed,seed);assert.equal(p.revision,oldRevision+1);
 let misses=0;
 for(let round=0;round<5;round++){
  const c=nextChallenge(p);assert.equal(c.duel,true);assert.notEqual(c.type,'trace');
  assert.deepEqual(nextChallenge(JSON.parse(JSON.stringify(p))),c);
  const result=applyAttempt(p,c,{answer:expectedAnswer(c),durationMs:10000,helped:false});
  assert.equal(result.duel.round,round+1);assert.equal(result.duel.you,round+1);
  if(!result.duel.rookOk){misses++;assert.equal(result.duel.rook,0);assert.equal(result.duel.pointReason,'independent');}
 }
 assert.ok(misses>0);assert.equal(p.duel.finished,true);assert.equal(p.duel.outcome,'win');
 assert.equal(p.gems,5);const xp=p.xp;assert.equal(nextChallenge(p).duel,undefined);assert.equal(p.xp,xp);
 startDuel(p);assert.equal(p.duel.round,0);assert.equal(p.duel.you,0);assert.equal(p.duel.rook,0);assert.notEqual(p.duel.seed,seed);
 assert.equal(p.xp,xp);
});
