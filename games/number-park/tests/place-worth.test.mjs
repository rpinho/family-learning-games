import test from 'node:test';
import assert from 'node:assert/strict';
import {worthQuestion,worthVoiceLines,WORTH_HELP,formatWorth} from '../lib/place-worth.mjs';
import {freshProfile,action,makeQuestion,publicState} from '../lib/math.mjs';
import {EXPLORER_TRACK,challengeLevel} from '../lib/explorer.mjs';
import {daySummary} from '../lib/day-summary.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});
const seeded=seed=>()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};

test('digit worth questions are unambiguous at every level, and only the place decides the answer',()=>{
 const r=seeded(7),voice=new Set(worthVoiceLines()),modes={worth:0,which:0},places=[0,0,0,0];
 for(const level of [1,2,3])for(let i=0;i<400;i++){
  const q=worthQuestion(level,r),n=q.digits.length;
  assert.equal(n,level===1?2:level===2?3:n);if(level===3)assert.ok(n===3||n===4);
  assert.notEqual(q.digits[0],0);assert.notEqual(q.digit,0);assert.equal(q.digits[q.lit],q.digit);assert.equal(q.place,n-1-q.lit);
  assert.equal(q.total,Number(q.digits.join('')));assert.equal(q.skill,'worth');assert.equal(q.kind,'place');
  assert.ok(voice.has(q.prompt),q.prompt);assert.ok(voice.has(q.explain),q.explain);
  modes[q.placeMode]++;places[q.place]++;
  if(q.placeMode==='which'){assert.equal(new Set(q.digits).size,n);assert.equal(q.answer,q.lit);assert.equal(q.max,n-1);continue;}
  assert.equal(q.answer,q.digit*10**q.place);assert.ok(q.answer<=q.max);
  assert.equal(q.options.length,n===2?3:4);assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.options.includes(q.answer));
  assert.ok(q.options.includes(q.digit),'the face value is always a choice');
  assert.ok(q.options.every(v=>[1,10,100,1000].some(k=>v===q.digit*k)));
 }
 assert.ok(modes.which>250&&modes.worth>700,JSON.stringify(modes));
 assert.ok(places[1]>places[0]*2,'tens are lit far more often than ones');
 assert.ok(places[3]>0);
 assert.ok(voice.has(WORTH_HELP));assert.equal(formatWorth(7000),'7,000');assert.equal(formatWorth(700),'700');
});

test('Tens & ones mixes in digit worth on its own level; worth history never moves the block builder',()=>{
 const p=freshProfile('explorer');let worth=0;
 for(let i=0;i<300;i++){p.revision=i;const q=makeQuestion(p,'place',i%6);if(q.skill==='worth'){worth++;assert.equal(q.track,EXPLORER_TRACK);assert.equal(q.level,2);}}
 assert.ok(worth>90&&worth<150,String(worth));
 for(let i=0;i<2;i++)p.history.push({ok:false,helped:false,question:{track:EXPLORER_TRACK,skill:'worth'}});
 assert.equal(challengeLevel(p,'worth'),1);assert.equal(challengeLevel(p,'place'),2);
 for(let i=0;i<50;i++){p.revision=1000+i;const q=makeQuestion(p,'place',i%6);if(q.skill==='worth')assert.equal(q.digits.length,2);}
 const d=freshProfile('beginner');for(let i=0;i<60;i++){d.revision=i;assert.notEqual(makeQuestion(d,'mix',i%6).skill,'worth');}
});

test('a missed digit-worth answer is recorded, reveals the column, and hides nothing it should not',()=>{
 const p=freshProfile('explorer');act(p,{kind:'start',game:'place'});
 for(let i=0;i<80&&!(p.session.question.skill==='worth'&&p.session.question.placeMode==='worth');i++)act(p,{kind:'start',game:'place'});
 let q=p.session.question;assert.equal(q.placeMode,'worth');
 let shown=publicState(p).session.question;assert.ok(!('answer' in shown));assert.ok(!('explain' in shown));assert.equal(shown.lit,q.lit);
 act(p,{kind:'answer',questionId:q.id,answer:q.digit===q.answer?q.digit*10:q.digit});
 assert.equal(p.session.result.ok,false);assert.equal(p.session.result.answer,q.answer);
 shown=publicState(p).session.question;assert.equal(shown.explain,q.explain);
 assert.equal(p.history.at(-1).question.skill,'worth');assert.equal(p.history.at(-1).ok,false);
 for(let i=0;i<120&&!(p.session.question.skill==='worth'&&p.session.question.placeMode==='which');i++)act(p,{kind:'start',game:'place'});
 q=p.session.question;assert.equal(q.placeMode,'which');
 shown=publicState(p).session.question;for(const k of ['answer','lit','place','digit','explain'])assert.ok(!(k in shown),k);
 assert.throws(()=>act(p,{kind:'answer',questionId:q.id,answer:q.digits.length}),/valid answer/);
 const wrong=(q.lit+1)%q.digits.length;act(p,{kind:'answer',questionId:q.id,answer:wrong});
 assert.equal(p.session.result.ok,false);assert.equal(p.session.result.picked,wrong);
 const date=p.history.at(-1).at.slice(0,10),summary=daySummary(p,date,'UTC');
 assert.ok(summary.stuck.some(line=>line.includes(`tapped the ${q.digits[wrong]}`)&&line.includes('place of')),JSON.stringify(summary.stuck));
 assert.equal(typeof summary.levels.worth,'number');
});
