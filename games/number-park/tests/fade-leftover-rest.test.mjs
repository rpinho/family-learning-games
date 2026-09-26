import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,action,publicState,prepareProfile} from '../lib/math.mjs';
import {cookieProgress,challengeLevel,EXPLORER_TRACK} from '../lib/explorer.mjs';
import {cookieQuestion,cookieVoiceLines,isDragCookie,leftoverShapes,MONSTER_TOO_MANY,predictLine,PREDICT_EACH,PREDICT_BAGS,PREDICT_ROWS} from '../lib/cookie-division.mjs';
import {recapVoiceLines,LEVEL_UP,WIND_DOWN_LINE} from '../lib/recap.mjs';
import {storyVoiceLines,STORY_OPENING} from '../lib/story.mjs';
import {WIND_DOWN_MS,REST_MS,BREAK_MS} from '../lib/rest.mjs';
const act=(p,input,now)=>action(p,{...input,revision:p.revision},now);
const row=(fade,ok=true,helped=false,level=2)=>({game:'cookies',question:{track:EXPLORER_TRACK,skill:'cookies',plan:'drag3',mode:'share',fade,level},ok,helped});
// Plays the open cookie round to a win (predicting right when asked first).
function play(p,{now,helped=false,predict}={}){
 const s=p.session,q=s.question;
 if(helped)act(p,{kind:'hint'},now);
 if(p.session.cookieAsk?.predict)act(p,{kind:'cookie-answer',questionId:q.id,value:predict??q.answer},now);
 const slot=(id)=>q.mode==='bags'?Math.floor(id/q.bagSize):q.mode==='leftover'?(id<q.plates*q.answer?Math.floor(id/q.answer):q.plates):Math.floor(id/q.answer);
 for(let id=0;id<q.total;id++)if(p.session.cookieDraft[id]!==slot(id)){const d=[...p.session.cookieDraft];d[id]=slot(id);act(p,{kind:'cookie-place',questionId:q.id,draft:d},now);}
 act(p,{kind:'cookie-check',questionId:q.id},now);
 if(p.session.cookieAsk)act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer},now);
 assert.equal(p.session.result?.ok,true);
}

test('old rounds keep the level he reached; faded rounds climb show -> hide -> own -> next level',()=>{
 const p=freshProfile('explorer');
 // Explorer-shaped history: legacy drag rounds that put him at level 2.
 p.history=[...Array.from({length:5},()=>({...row(undefined),question:{...row().question,fade:undefined}})),{...row(),question:{...row().question,fade:undefined},helped:true},{...row(),question:{...row().question,fade:undefined},helped:true}];
 const legacy=challengeLevel({history:p.history.map(h=>({...h}))},'cookies');
 assert.equal(cookieProgress(p).level,legacy);assert.equal(cookieProgress(p).fade,'show');
 const base=cookieProgress(p).level;
 p.history.push(row('show'),row('show'));assert.equal(cookieProgress(p).fade,'hide');
 p.history.push(row('hide'),row('hide'));assert.equal(cookieProgress(p).fade,'own');
 p.history.push(...Array.from({length:4},()=>row('own')));assert.equal(cookieProgress(p).level,base);assert.equal(cookieProgress(p).toMastery,1);
 p.history.push(row('own'));assert.deepEqual([cookieProgress(p).level,cookieProgress(p).fade,cookieProgress(p).mastered],[base+1,'show',1]);
 // Struggle eases a stage first, then a level (landing on 'hide', not the start).
 p.history.push(row('show',true,true),row('show',true,true));assert.deepEqual([cookieProgress(p).level,cookieProgress(p).fade],[base,'hide']);
 p.history.push(row('hide',true,true),row('hide',true,true));assert.deepEqual([cookieProgress(p).level,cookieProgress(p).fade],[base,'show']);
 // A helped round breaks the run of five.
 const q=freshProfile('explorer');q.history=[row('show'),row('show'),row('hide'),row('hide'),row('own'),row('own'),row('own',true,true),row('own'),row('own'),row('own'),row('own')];
 assert.equal(cookieProgress(q).level,1);assert.equal(cookieProgress(q).toMastery,1);
});

test('the own stage asks first; a wrong prediction is corrected by counting, never blocked',()=>{
 const p=freshProfile('explorer');p.history=[row('show',true,false,1),row('show',true,false,1),row('hide',true,false,1),row('hide',true,false,1)];
 act(p,{kind:'start',game:'cookies'});const q=p.session.question;
 assert.equal(q.fade,'own');assert.equal(p.session.cookieAsk.predict,true);assert.ok(p.session.cookieAsk.options.includes(q.answer));
 assert.ok([PREDICT_EACH,PREDICT_BAGS,PREDICT_ROWS].includes(predictLine(q)));
 assert.equal(publicState(p).session.question.answer,undefined);
 const wrong=p.session.cookieAsk.options.find(v=>v!==q.answer);
 act(p,{kind:'cookie-answer',questionId:q.id,value:wrong});assert.equal(p.session.cookieAsk,undefined);assert.equal(p.session.result,null);
 const d=[...p.session.cookieDraft];
 for(let id=0;id<q.total;id++){d[id]=q.mode==='bags'?Math.floor(id/q.bagSize):Math.floor(id/q.answer);act(p,{kind:'cookie-place',questionId:q.id,draft:[...d]});}
 act(p,{kind:'cookie-check',questionId:q.id});
 assert.equal(p.session.result,null);assert.ok(p.session.cookieAsk&&!p.session.cookieAsk.predict,'counting question follows a wrong guess');
 act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});
 assert.deepEqual(p.session.result,{ok:true,answer:q.answer,xp:4,helped:true});assert.equal(p.history.at(-1).predicted,wrong);
});

test('five clean rounds on his own promote him quietly, and the round recap says so once',()=>{
 const p=freshProfile('explorer');p.history=[row('show',true,false,1),row('show',true,false,1),row('hide',true,false,1),row('hide',true,false,1)];
 act(p,{kind:'start',game:'cookies'});
 for(let round=0;round<6;round++){play(p);act(p,{kind:'next'});}
 assert.equal(cookieProgress(p).level,2);assert.equal(p.session.levelUps,1);
 assert.deepEqual(p.session.recap.lines,['You solved 6 cookie puzzles.',LEVEL_UP]);
 assert.ok(new Set(recapVoiceLines()).has(LEVEL_UP));
});

test('remainders live only at level 6: leftovers go to Cookie Buddy and the equation has r',()=>{
 const lines=new Set(cookieVoiceLines());
 for(let level=1;level<=5;level++)for(let i=0;i<200;i++)assert.notEqual(cookieQuestion(level,Math.random).mode,'leftover');
 let seen=0;
 for(let i=0;i<300;i++){const q=cookieQuestion(6,Math.random);assert.equal(q.level,6);if(q.mode!=='leftover'){assert.ok(['mixed','bags','rows'].includes(q.mode));continue;}
  seen++;assert.ok(isDragCookie(q));assert.ok(q.leftover>=1&&q.leftover<q.plates);assert.equal(q.total,q.plates*q.answer+q.leftover);assert.ok(q.total<=26);assert.ok(lines.has(q.prompt),q.prompt);}
 assert.ok(seen>150);assert.ok(leftoverShapes().length>10);
 const p=freshProfile('explorer');let q;for(let i=0;!(q?.mode==='leftover');i++)q=cookieQuestion(6,Math.random);
 q={...q,id:'r1',track:EXPLORER_TRACK};
 p.session={game:'cookies',round:0,correct:0,independent:0,helped:false,result:null,finished:false,started:0,question:q,cookieDraft:Array(q.total).fill(null)};
 assert.equal(publicState(p).session.question.leftover,undefined);
 const put=(id,slot)=>{const d=[...p.session.cookieDraft];d[id]=slot;act(p,{kind:'cookie-place',questionId:q.id,draft:d});};
 assert.throws(()=>put(0,q.plates+1));
 // Everything to Cookie Buddy: plates are "equal" at zero, but he has enough for one more each.
 for(let id=0;id<q.total;id++)put(id,q.plates);
 act(p,{kind:'cookie-check',questionId:q.id});assert.equal(p.session.cookieMessage,MONSTER_TOO_MANY);assert.equal(p.session.cookieAsk,undefined);
 for(let id=0;id<q.plates*q.answer;id++)put(id,Math.floor(id/q.answer));
 act(p,{kind:'cookie-check',questionId:q.id});assert.ok(p.session.cookieAsk);
 act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});
 assert.equal(p.session.result.ok,true);assert.equal(p.history.at(-1).monster,q.leftover);
 // A saved leftover round is not mistaken for the old button-only remainder round.
 const s=freshProfile('explorer');s.session={game:'cookies',round:1,correct:1,independent:1,helped:false,result:null,finished:false,started:0,question:{...q,id:'r2'},cookieDraft:Array(q.total).fill(null)};
 prepareProfile(s);assert.equal(s.session.question.id,'r2');
});

test('after a long stretch the finishing round becomes the last one for now, never mid-round',()=>{
 const p=freshProfile('explorer');let now=Date.parse('2026-09-26T14:00:00Z');
 act(p,{kind:'start',game:'multiply'},now);
 for(let round=0;round<6;round++){now+=4*60*1000;const q=p.session.question;act(p,{kind:'answer',questionId:q.id,answer:q.answer},now);
  assert.equal(p.session.windDown,undefined,'no round is cut off');act(p,{kind:'next'},now);}
 assert.equal(p.session.finished,true);assert.equal(p.session.windDown,true);assert.equal(p.session.recap.lines.at(-1),WIND_DOWN_LINE);
 assert.equal(publicState(p,now+1000).resting,true);assert.equal(publicState(p,now+REST_MS+1).resting,false);
 assert.ok(new Set(recapVoiceLines()).has(WIND_DOWN_LINE));
 // Parent settings can end the rest early; a new stretch starts from then.
 act(p,{kind:'rest-clear'},now+5000);assert.equal(publicState(p,now+6000).resting,false);assert.equal(p.play.since,now+5000);
 // Short play with breaks never winds down.
 const q=freshProfile('explorer');let t=Date.parse('2026-09-26T14:00:00Z');act(q,{kind:'start',game:'sums'},t);
 for(let round=0;round<6;round++){t+=(round===3?BREAK_MS+60000:3*60*1000);const x=q.session.question;act(q,{kind:'answer',questionId:x.id,answer:x.answer},t);act(q,{kind:'next'},t);}
 assert.ok(t-Date.parse('2026-09-26T14:00:00Z')>WIND_DOWN_MS);assert.equal(q.session.windDown,undefined);assert.equal(publicState(q,t).resting,false);
});

test('each finished round adds one spoken line to his baker story; the little track has none',()=>{
 const lines=new Set(storyVoiceLines()),p=freshProfile('explorer');
 act(p,{kind:'start',game:'cookies'});for(let round=0;round<6;round++){play(p);act(p,{kind:'next'});}
 const s=p.session.story;assert.deepEqual(s.lines[0],STORY_OPENING);assert.equal(s.lines.length,2);assert.match(s.lines[1],/^In the little bakery, the baker /);
 for(const line of s.lines)assert.ok(lines.has(line),line);
 act(p,{kind:'start',game:'place'});
 for(let round=0;round<6;round++){const q=p.session.question;if(q.placeMode==='build')act(p,{kind:'place-check',questionId:q.id,counts:q.target});else act(p,{kind:'answer',questionId:q.id,answer:q.answer});act(p,{kind:'next'});}
 assert.deepEqual(p.session.story.lines,['At the village market, the baker built a new oven from blocks.']);
 assert.equal(p.story.count,2);assert.equal(p.session.story.recent.length,2);
 for(const line of p.story.beats.map(b=>b.line))assert.ok(line.split(' ').length<=12,line);
 const d=freshProfile('beginner');act(d,{kind:'start',game:'count'});for(let round=0;round<6;round++){const q=d.session.question;act(d,{kind:'answer',questionId:q.id,answer:q.answer});act(d,{kind:'next'});}
 assert.equal(d.story,undefined);assert.equal(d.session.story,undefined);
});

test('HTTP: the parent summary is read-only and rest-clear ends a wind-down',async()=>{
 const {spawn}=await import('node:child_process'),{mkdtemp,writeFile,readFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const data=await mkdtemp(join(tmpdir(),'number-park-summary-'));
 const p=freshProfile('explorer');act(p,{kind:'start',game:'cookies'});play(p);p.play={since:Date.now()-30*60000,last:Date.now(),restUntil:Date.now()+REST_MS};
 await writeFile(join(data,'explorer.json'),JSON.stringify(p));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NUMBER_PARK_DATA:data,HOST:'127.0.0.1',PORT:'14329'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',()=>reject(Error('exited')));});
  const base='http://127.0.0.1:14329',before=await readFile(join(data,'explorer.json'),'utf8');
  const s=await(await fetch(base+'/api/explorer/summary')).json();
  assert.equal(s.player,'explorer');assert.equal(s.questions,1);assert.equal(s.games[0].id,'cookies');assert.ok(s.levels.cookies.level>=1);
  assert.equal(await readFile(join(data,'explorer.json'),'utf8'),before,'summary never writes');
  assert.equal((await fetch(base+'/api/explorer/summary?date=bad')).status,400);
  const state=await(await fetch(base+'/api/explorer')).json();assert.equal(state.resting,true);
  const r=await(await fetch(base+'/api/explorer/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'rest-clear',revision:state.revision})})).json();
  assert.equal(r.resting,false);
 }finally{child.kill();}
});
