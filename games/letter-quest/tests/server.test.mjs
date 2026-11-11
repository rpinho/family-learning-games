import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import http from 'node:http';
import tls from 'node:tls';
import {expectedAnswer,freshProfile} from '../public/engine.mjs';
import {mazeQuestion,mazeBoard} from '../public/maze.mjs';
test('Server persists progress, isolates players, rejects replay and cross-site writes',async()=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'letter-quest-test-'));
 // Exercise legacy tracing after lowercase readiness; fresh-track HTTP has its own test.
 const seeded=freshProfile();seeded.foundation={reviewComplete:true};
 await writeFile(path.join(data,'explorer.json'),JSON.stringify(seeded));
 const port=14318;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',LETTER_QUEST_DATA:data},stdio:['ignore','pipe','pipe']});
 const timeout=setTimeout(()=>child.kill(),12000);
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited early');})]);
  const base=`http://127.0.0.1:${port}`;
  const state=await (await fetch(base+'/api/explorer/state')).json();
  const payload={challengeId:state.challenge.id,answer:state.challenge.char,durationMs:3000,helped:false};
  const post=(route,body,extra={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
  const success=await post('/api/explorer/attempt',payload);assert.equal(success.status,200);
  assert.equal((await success.json()).profile.xp,12);
  assert.equal((await post('/api/explorer/attempt',payload)).status,409);
  assert.equal((await post('/api/explorer/settings',{sound:false},{Origin:'http://other.example'})).status,403);
  assert.equal((await post('/api/explorer/chest',{})).status,400);
  assert.equal((await post('/api/explorer/promote',{})).status,400);
  assert.equal((await (await fetch(base+'/api/beginner/state')).json()).profile.xp,0);
  assert.equal(JSON.parse(await readFile(path.join(data,'explorer.json'),'utf8')).xp,12);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
  const forbidden=await new Promise((resolve,reject)=>{http.get(base+'/api/explorer/state',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
  assert.equal(forbidden,403);
  const trace=(await (await fetch(base+'/api/explorer/state')).json()).challenge;
  assert.equal(trace.type,'trace');
  const failedResponse=await post('/api/explorer/attempt',{challengeId:trace.id,strokes:[[[0,0],[100,100]]],durationMs:1000,helped:false});
  assert.equal(failedResponse.status,200);
  const failed=await failedResponse.json();assert.equal(failed.result.ok,false);
  assert.equal(failed.challenge.char,trace.char);assert.notEqual(failed.challenge.id,trace.id);
  const retryPayload={challengeId:failed.challenge.id,strokes:failed.challenge.paths,durationMs:5000,helped:true};
  const corrected=await post('/api/explorer/attempt',retryPayload);
  assert.equal(corrected.status,200);
  const correctedData=await corrected.json();assert.equal(correctedData.result.ok,true);assert.equal(correctedData.profile.inLesson,2);
  assert.equal((await post('/api/explorer/attempt',retryPayload)).status,409);
  assert.equal((await fetch(base+'/voice/manifest.json')).status,404);
  await mkdir(path.join(data,'voice'));
  await writeFile(path.join(data,'voice','manifest.json'),JSON.stringify({voice:'test',clips:{}}));
  await writeFile(path.join(data,'voice','0123456789abcdef.wav'),Buffer.from('RIFF-test-audio-fixture'));
  assert.equal((await (await fetch(base+'/voice/manifest.json')).json()).voice,'test');
  const clip=await fetch(base+'/voice/0123456789abcdef.wav');
  assert.equal(clip.headers.get('content-type'),'audio/wav');
  assert.equal(await clip.text(),'RIFF-test-audio-fixture');
  assert.equal((await fetch(base+'/voice/explorer.json')).status,404);
  assert.equal((await post('/voice/0123456789abcdef.wav',{})).status,405);
  const wrongProtocol=tls.connect({host:'127.0.0.1',port});await once(wrongProtocol,'error');wrongProtocol.destroy();
  const event={kind:'trace_blocked',eventId:'e1',session:'chromebook-test',player:'beginner',reason:'feedback',password:'must-not-save'};
  assert.equal((await post('/api/diagnostics',{events:[event]})).status,200);
  assert.equal((await post('/api/diagnostics',{events:[{...event,kind:'unknown'}]})).status,400);
  assert.equal((await post('/api/diagnostics',{events:[event]},{Origin:'http://other.example'})).status,403);
  assert.equal((await fetch(base+'/api/diagnostics')).status,405);
  assert.equal((await fetch(base+'/logs')).status,404);
  assert.equal((await fetch(base+'/diagnostics.mjs')).status,404);
  assert.equal((await post('/api/explorer/attempt',null)).status,400);
  const health=await (await fetch(base+'/health')).json();assert.equal(health.diagnostics.ok,true);
  const logFiles=await readdir(path.join(data,'logs'));
  const rows=(await Promise.all(logFiles.map(f=>readFile(path.join(data,'logs',f),'utf8')))).join('').trim().split('\n').map(JSON.parse);
  const attempts=rows.filter(r=>r.type==='attempt');assert.equal(attempts.length,3);
  assert.equal(attempts[1].result.ok,false);assert.deepEqual(attempts[1].input.strokes,[[[0,0],[100,100]]]);
  assert.equal(attempts[2].input.helped,true);assert.equal(attempts[2].result.ok,true);
  assert.ok(rows.some(r=>r.type==='http'&&r.status===409));
  assert.ok(rows.some(r=>r.type==='protocol_error'&&r.reason==='https_sent_to_http_port'));
  const recorded=rows.find(r=>r.type==='client_events');assert.equal(recorded.events[0].reason,'feedback');assert.equal(recorded.events[0].password,undefined);
  const childSave=await readFile(path.join(data,'explorer.json'),'utf8');
  let admin=await (await fetch(base+'/api/admin/state')).json();assert.equal(admin.profile.name,'Admin');
  for(let i=0;i<5;i++){
   const c=admin.challenge;const response=await post('/api/admin/attempt',{challengeId:c.id,answer:c.word||c.char,strokes:c.paths,durationMs:6000,helped:false});
   assert.equal(response.status,200);admin=await response.json();
  }
  assert.equal(admin.profile.completed,1);assert.equal(admin.profile.inLesson,0);
  assert.equal((await (await fetch(base+'/api/admin/state')).json()).profile.xp,admin.profile.xp);
  assert.equal((await post('/api/explorer/reset',{confirmation:'RESET ADMIN',revision:admin.profile.revision})).status,403);
  assert.equal((await post('/api/beginner/reset',{confirmation:'RESET ADMIN',revision:admin.profile.revision})).status,403);
  assert.equal((await post('/api/admin/reset',{revision:admin.profile.revision})).status,400);
  assert.equal((await post('/api/admin/reset',{confirmation:'RESET ADMIN',revision:0})).status,409);
  const resetResponse=await post('/api/admin/reset',{confirmation:'RESET ADMIN',revision:admin.profile.revision,player:'explorer'});
  assert.equal(resetResponse.status,200);const reset=await resetResponse.json();
  assert.equal(reset.profile.id,'admin');assert.equal(reset.profile.xp,0);assert.equal(reset.profile.completed,0);
  assert.equal(reset.profile.revision,admin.profile.revision+1);
  assert.deepEqual(JSON.parse(await readFile(path.join(data,'backups',reset.result.backup),'utf8')),admin.profile);
  assert.equal(await readFile(path.join(data,'explorer.json'),'utf8'),childSave);
  assert.equal((await (await fetch(base+'/api/beginner/state')).json()).profile.xp,0);
  const stale=admin.challenge;
  assert.equal((await post('/api/admin/attempt',{challengeId:stale.id,answer:stale.char,strokes:stale.paths,durationMs:5000,helped:false})).status,409);
  assert.equal((await fetch(base+'/backups/'+reset.result.backup)).status,404);
  const current=await(await fetch(base+'/api/beginner/state')).json();
  const skip=await post('/api/beginner/skip',{challengeId:current.challenge.id});assert.equal(skip.status,200);
  const skipped=await skip.json();assert.equal(skipped.result.skipped,true);
  assert.equal(skipped.profile.xp,current.profile.xp);assert.equal(skipped.profile.completed,current.profile.completed);
  assert.deepEqual(skipped.profile.skills,current.profile.skills);assert.deepEqual(skipped.profile.history,current.profile.history);
  assert.notEqual(skipped.challenge.id,current.challenge.id);
  assert.equal((await post('/api/beginner/skip',{challengeId:current.challenge.id})).status,409);
  const start=await post('/api/beginner/duel',{revision:skipped.profile.revision});assert.equal(start.status,200);
  let duelState=await start.json();assert.equal(duelState.challenge.duel,true);
  assert.equal((await post('/api/beginner/duel',{revision:duelState.profile.revision,difficulty:99})).status,400);
  assert.equal((await fetch(base+'/hub.mjs')).status,200);assert.equal((await fetch(base+'/hub.css')).status,200);
  for(let round=0;round<5;round++){
   const c=duelState.challenge;
   const response=await post('/api/beginner/attempt',{challengeId:c.id,answer:expectedAnswer(c),durationMs:8000,helped:false});
   assert.equal(response.status,200);duelState=await response.json();assert.equal(duelState.result.duel.round,round+1);
   if(round===0){
    const pausedResponse=await post('/api/beginner/adventure',{revision:duelState.profile.revision});assert.equal(pausedResponse.status,200);
    const paused=await pausedResponse.json();assert.equal(paused.profile.duel.paused,true);assert.notEqual(paused.challenge.duel,true);
    assert.equal((await post('/api/beginner/attempt',{challengeId:duelState.challenge.id,answer:'a',durationMs:8000,helped:false})).status,409);
    const resume=await post('/api/beginner/duel',{revision:paused.profile.revision,difficulty:3});assert.equal(resume.status,200);duelState=await resume.json();assert.equal(duelState.profile.duel.round,1);assert.equal(duelState.profile.duel.difficulty,1);
   }
  }
  assert.equal(duelState.profile.duel.finished,true);assert.equal(duelState.profile.duel.you,5);
  assert.deepEqual((await(await fetch(base+'/api/beginner/state')).json()).profile.duel,duelState.profile.duel);
  assert.equal(duelState.profile.duelStats.played,1);assert.equal(duelState.profile.duelHistory.length,1);
  const revision=duelState.profile.revision;
  const claims=await Promise.all([post('/api/beginner/quest',{revision,questId:'0:moves'}),post('/api/beginner/quest',{revision,questId:'0:moves'})]);
  assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
  const afterClaim=await(await fetch(base+'/api/beginner/state')).json();assert.equal(afterClaim.profile.gems,duelState.profile.gems+10);
  assert.equal((await post('/api/beginner/quest',{revision:afterClaim.profile.revision,questId:'0:moves'})).status,400);
  assert.equal((await post('/api/beginner/quest',{revision:afterClaim.profile.revision,questId:'8:matches'})).status,400);
  assert.match((await fetch(base+'/')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(await readFile(path.join(data,'explorer.json'),'utf8'),childSave);
  // The hint endpoint awards immediately, survives reload, and cannot double-score.
  let testState=await(await post('/api/beginner/duel',{revision:afterClaim.profile.revision,difficulty:1})).json();
  const hintPayload={challengeId:testState.challenge.id};
  const hints=await Promise.all([post('/api/beginner/hint',hintPayload),post('/api/beginner/hint',hintPayload)]);
  assert.deepEqual(hints.map(r=>r.status).sort(),[200,409]);
  testState=await(await fetch(base+'/api/beginner/state')).json();
  assert.equal(testState.profile.duel.rook,1);assert.equal(testState.profile.duel.you,0);
  const hinted=await(await post('/api/beginner/attempt',{challengeId:testState.challenge.id,answer:expectedAnswer(testState.challenge),helped:false,durationMs:3000})).json();
  assert.equal(hinted.profile.duel.rook,1);assert.equal(hinted.profile.duel.you,0);assert.equal(hinted.profile.history.at(-1).helped,true);
  const storyPayload={revision:hinted.profile.revision,kind:'move',position:10,password:'must-not-log'};
  const storyMoves=await Promise.all([post('/api/beginner/story',storyPayload),post('/api/beginner/story',storyPayload)]);
  assert.deepEqual(storyMoves.map(r=>r.status).sort(),[200,409]);
  const storySaved=await(await fetch(base+'/api/beginner/state')).json();
  assert.equal(storySaved.profile.story.position,10);assert.equal(storySaved.profile.story.collected,1);
  assert.equal((await post('/api/beginner/story',{revision:storySaved.profile.revision,kind:'next'})).status,400);
  assert.equal(storySaved.profile.duel.round,1);assert.equal(storySaved.profile.duel.rook,1);
  assert.equal(await readFile(path.join(data,'explorer.json'),'utf8'),childSave);
  const storyLogs=(await Promise.all((await readdir(path.join(data,'logs'))).map(f=>readFile(path.join(data,'logs',f),'utf8')))).join('');
  assert.match(storyLogs,/story_action/);assert.doesNotMatch(storyLogs,/must-not-log/);
  let mazeData=await(await post('/api/beginner/maze',{revision:storySaved.profile.revision,kind:'enter'})).json();
  const q=mazeQuestion(mazeData.profile),mazeInput={revision:mazeData.profile.revision,kind:'answer',questionId:q.id,answer:q.answer,durationMs:8000,password:'maze-secret-must-not-log'};
  const mazeAnswers=await Promise.all([post('/api/beginner/maze',mazeInput),post('/api/beginner/maze',mazeInput)]);
  assert.deepEqual(mazeAnswers.map(r=>r.status).sort(),[200,409]);
  mazeData=await(await fetch(base+'/api/beginner/state')).json();assert.equal(mazeData.profile.maze.solved.length,1);assert.equal(mazeData.profile.maze.position,mazeBoard(mazeData.profile).start);
  assert.equal((await post('/api/beginner/maze',{revision:mazeData.profile.revision,kind:'next'})).status,400);
  // Isolated Admin earns a crown, stays #1, then explicitly advances with history.
  let adminLeague=await(await fetch(base+'/api/admin/state')).json();
  const testAdmin={...adminLeague.profile,xp:500,league:0,leagueBase:0};await writeFile(path.join(data,'admin.json'),JSON.stringify(testAdmin));
  const crowns=await Promise.all([post('/api/admin/promote',{revision:testAdmin.revision}),post('/api/admin/promote',{revision:testAdmin.revision})]);
  assert.deepEqual(crowns.map(r=>r.status).sort(),[200,409]);
  adminLeague=await(await fetch(base+'/api/admin/state')).json();assert.equal(adminLeague.profile.league,0);assert.equal(adminLeague.profile.leagueHistory[0].rows[0].xp,500);
  const advance=await post('/api/admin/advance',{revision:adminLeague.profile.revision});assert.equal(advance.status,200);const advanced=await advance.json();assert.equal(advanced.profile.league,1);assert.equal(advanced.profile.leagueHistory[0].rows[0].you,true);
  assert.equal((await post('/api/admin/advance',{revision:adminLeague.profile.revision})).status,409);
  assert.equal(await readFile(path.join(data,'explorer.json'),'utf8'),childSave);
  const mazeLogs=(await Promise.all((await readdir(path.join(data,'logs'))).map(f=>readFile(path.join(data,'logs',f),'utf8')))).join('');assert.match(mazeLogs,/maze_action/);assert.doesNotMatch(mazeLogs,/maze-secret-must-not-log/);
  let soccerData=await(await post('/api/admin/soccer',{kind:'start',revision:advanced.profile.revision,level:1})).json();
  const soccerPost=(input)=>post('/api/admin/soccer',{...input,revision:soccerData.profile.revision});
  assert.equal((await fetch(base+'/soccer.css')).status,200);assert.equal((await fetch(base+'/soccer-audio.mjs')).status,200);
  for(let i=0;i<5;i++){
   soccerData=await(await soccerPost({kind:'ready'})).json();const q=soccerData.profile.soccer.question;
   if(i===0){soccerData=await(await soccerPost({kind:'hint',questionId:q.id})).json();soccerData=await(await fetch(base+'/api/admin/state')).json();assert.equal(soccerData.profile.soccer.helped,true);}
   const payload={kind:'answer',questionId:q.id,answer:i===1?q.options.find(a=>a!==q.answer):q.answer,durationMs:7000,password:'soccer-must-not-log'};
   assert.equal((await soccerPost({...payload,durationMs:-1})).status,400);
   const responses=await Promise.all([soccerPost(payload),soccerPost(payload)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
   soccerData=await responses.find(r=>r.status===200).json();assert.equal(soccerData.result.kind,i===0?'practice':i===1?'save':'goal');
   if(i===0)assert.equal(soccerData.result.helped,true);
   soccerData=await(await soccerPost({kind:'next'})).json();
  }
  assert.equal(soccerData.profile.soccer.phase,'complete');assert.equal(soccerData.profile.soccer.stats.goals,3);assert.equal(soccerData.profile.soccer.stats.played,1);
  assert.equal(await readFile(path.join(data,'explorer.json'),'utf8'),childSave);
  const soccerLogs=(await Promise.all((await readdir(path.join(data,'logs'))).map(f=>readFile(path.join(data,'logs',f),'utf8')))).join('');assert.match(soccerLogs,/soccer_action/);assert.doesNotMatch(soccerLogs,/soccer-must-not-log/);
  let rd=await(await post('/api/admin/reading',{kind:'start',revision:soccerData.profile.revision,focus:'mix'})).json();
  for(let i=0;i<7;i++){
   const q=rd.profile.reading.question;
   const readingPost=input=>post('/api/admin/reading',{revision:rd.profile.revision,questionId:q.id,...input});
   if(i===0){rd=await(await readingPost({kind:'help',help:'read'})).json();rd=await(await fetch(base+'/api/admin/state')).json();assert.deepEqual(rd.profile.reading.help,['read']);}
   if(['dictation','change','sentence'].includes(q.type)){const used=[];const draft=(q.type==='sentence'?q.answer.split(' '):[...q.answer]).map(t=>{const n=q.tiles.findIndex((v,n)=>v===t&&(q.type!=='sentence'||!used.includes(n)));used.push(n);return n;});rd=await(await readingPost({kind:'draft',draft})).json();}
   if(q.type==='act')rd=await(await readingPost({kind:'draft',draft:q.answer.split('|').map(id=>q.options.findIndex(o=>o.id===id))})).json();
   if(q.type==='write'){rd=await(await readingPost({kind:'ink',ink:[[[10,20],[30,50]]]})).json();assert.deepEqual((await(await fetch(base+'/api/admin/state')).json()).profile.reading.ink,[[[10,20],[30,50]]]);}
   const replies=await Promise.all([readingPost({kind:'answer',answer:q.answer,durationMs:6000,password:'reading-must-not-log'}),readingPost({kind:'answer',answer:q.answer,durationMs:6000})]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
   rd=await replies.find(r=>r.status===200).json();assert.equal(rd.result.kind,i===6?'writing':'correct');if(i===0||i===6)assert.equal(rd.result.independent,false);
   rd=await(await readingPost({kind:'next'})).json();
  }
  assert.equal(rd.profile.reading.phase,'complete');assert.equal(rd.profile.reading.history.length,1);assert.equal(await readFile(path.join(data,'explorer.json'),'utf8'),childSave);
  const readingLogs=(await Promise.all((await readdir(path.join(data,'logs'))).map(f=>readFile(path.join(data,'logs',f),'utf8')))).join('');assert.match(readingLogs,/reading_action/);assert.doesNotMatch(readingLogs,/reading-must-not-log/);
 }finally{clearTimeout(timeout);child.kill();await once(child,'exit');}
});
