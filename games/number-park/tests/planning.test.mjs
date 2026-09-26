import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {action,freshProfile} from '../lib/math.mjs';
import {PLAN_GOALS,PLAN_LINES,PLAN_CARDS,planSteps,planChoices,planningVoiceLines} from '../lib/planning.mjs';
const send=(p,kind,more={})=>action(p,{kind,revision:p.revision,planId:p.planning?.session?.id,...more});
const start=(goal,level=1)=>{const p=freshProfile('beginner');if(level===2)p.planning={serial:0,badges:3,history:Array.from({length:3},()=>({firstTry:true,helped:false})),session:null};send(p,'plan_start',{goal});return p;};
function run(p,cards){send(p,'plan_cards',{cards});send(p,'plan_run');while(p.planning.session.phase==='running')send(p,'plan_step',{step:p.planning.session.cursor});}
test('Three goals execute actual dependencies, award once, and leave math/drawing/reading alone',()=>{
 for(const goal of PLAN_GOALS)for(const level of [1,2]){
  const p=start(goal.id,level),before=structuredClone(p);const s=p.planning.session;
  assert.equal(planSteps(s).length,level+1);assert.equal(new Set(planChoices(s)).size,level+2);
  run(p,planSteps(s));assert.equal(p.planning.session.phase,'success');assert.equal(p.planning.badges,before.planning.badges+1);
  assert.throws(()=>send(p,'plan_step',{step:0}));assert.throws(()=>send(p,'plan_run'));
  for(const k of Object.keys(before))if(!['revision','planning','play'].includes(k))assert.deepEqual(p[k],before[k]);
 }
});
test('Wrong order produces visible consequences, can be revised, and loses no badge',()=>{
 for(const g of PLAN_GOALS){const p=start(g.id);const correct=planSteps(p.planning.session);run(p,correct.toReversed());
  assert.equal(p.planning.session.phase,'review');assert.equal(p.planning.badges,0);assert.ok(p.planning.session.events.some(e=>!e.ok));assert.notEqual(p.planning.session.line,PLAN_LINES.success);
  run(p,correct);assert.equal(p.planning.badges,1);assert.equal(p.planning.history[0].tries,2);assert.equal(p.planning.history[0].firstTry,false);
 }
});
test('Pause/reload/resume, stale-step rejection and leaving are safe during execution',()=>{
 let p=start('bridge');send(p,'plan_cards',{cards:planSteps(p.planning.session)});send(p,'plan_run');send(p,'plan_step',{step:0});
 const before=JSON.stringify(p);assert.throws(()=>send(p,'plan_step',{step:0}));assert.equal(JSON.stringify(p),before);
 send(p,'plan_pause');assert.throws(()=>send(p,'plan_step',{step:1}));p=JSON.parse(JSON.stringify(p));send(p,'plan_resume');send(p,'plan_step',{step:1});assert.equal(p.planning.badges,1);
 send(p,'plan_leave');assert.equal(p.planning.session,null);assert.equal(p.planning.badges,1);
 send(p,'plan_start',{goal:'garden'});assert.throws(()=>send(p,'plan_start',{goal:'bridge'}));
});
test('No mastery from hints, repeats, speed or badges; 3 independent first tries unlock third step',()=>{
 const p=start('garden');send(p,'plan_help');run(p,planSteps(p.planning.session));assert.equal(p.planning.history[0].helped,true);
 for(let i=0;i<3;i++){send(p,'plan_start',{goal:PLAN_GOALS[i].id});assert.equal(p.planning.session.level,1);run(p,planSteps(p.planning.session));}
 send(p,'plan_start',{goal:'bridge'});assert.equal(p.planning.session.level,2);
});
test('Invalid cards and requests do not mutate progress, finite narration covers all actions',()=>{
 const p=start('garden');for(const cards of [['plant','plant'],['plant','water','wave'],['build'],null]){const before=JSON.stringify(p);assert.throws(()=>send(p,'plan_cards',{cards}));assert.equal(JSON.stringify(p),before);}
 assert.throws(()=>send(p,'plan_run'));assert.throws(()=>send(p,'plan_cards',{planId:'stale',cards:[]}));
 const lines=planningVoiceLines();for(const c of Object.values(PLAN_CARDS))assert.ok(lines.includes(c.line));for(const g of PLAN_GOALS){assert.ok(lines.includes(g.prompt));assert.ok(lines.includes(g.hint));}
});
test('Prominent identity precedes app header; planning is addressable and refresh preserves its tab',()=>{
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.ok(page.indexOf('className="player-identity"')<page.indexOf('<header className="top"'));
 assert.match(page,/value="planning"/);assert.match(page,/\[[^\]]*'planning'[^\]]*\]\.includes\(tab\)/);
 const view=readFileSync(new URL('../app/planning.tsx',import.meta.url),'utf8');assert.match(view,/document.visibilityState/);assert.match(view,/s\.paused/);assert.match(view,/\|\|speaking/);assert.match(view,/sent.current===token/);
});
