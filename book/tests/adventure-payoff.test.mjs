import test from 'node:test';
import assert from 'node:assert/strict';
import {sample,kit} from './adventure-integrate.test.mjs';
import {graphIssues,paths,flatten} from '../adventure/graph.mjs';
import {assembleAdventure,pathStory,lintAdventure,adventurePlan,collapse} from '../adventure/integrate.mjs';
import {pageLines,pathOptions,routeFlags} from '../../hub/public/book-adventure.mjs';
import {speechLines,attachClips} from '../assemble.mjs';
import {payoffUse} from '../adventure/ledger.mjs';
import {readFile} from 'node:fs/promises';
const library=JSON.parse(await readFile(new URL('../../hub/public/book-art/library.json',import.meta.url)));
function conditional(){const x=sample();x.story.nodes.branchB.pages[1].say=[['narrator','A woodland clue waits.']];for(const id of ['gate','ending']){delete x.story.nodes[id].pages[0].consequences;x.story.nodes[id].pages[0].say.push({who:'dad',text:`The rope ties the ${id} open.`,if:'rope'},{who:'dad',text:`The lamp lights the ${id} path.`,if:'lamp'});}return x;}
test('all four playback routes show only their flag; both variants receive narration clips',()=>{
 const {story,plan,sk}=conditional(),ch=assembleAdventure(story,plan,sk,kit,{library,actors:plan.actorIds.all});
 const lines=speechLines(ch);assert.ok(lines.some(l=>l.text==='The rope ties the gate open.'));assert.ok(lines.some(l=>l.text==='The lamp lights the gate path.'));
 attachClips(ch,Object.fromEntries(lines.map((l,i)=>[`${l.voice}|${l.speed}|${l.text}`,`${i}.wav`])));
 for(const r of pathOptions(ch)){
  for(const id of ['gate','ending']){const p=ch.pages.find(p=>p.node===id),ls=pageLines(p,r.choices,ch),chosen=r.choices.fork1==='a'?'rope':'lamp',other=chosen==='rope'?'lamp':'rope';
   assert.equal(ls.filter(l=>l.if).length,1);assert.ok(ls.some(l=>l.text.includes(chosen)&&l.clip));assert.ok(!ls.some(l=>l.text.includes(other)));}
  assert.ok(routeFlags(ch,r.choices).has(`${plan.date}:${r.choices.fork1==='a'?'rope':'lamp'}`));
 }
 assert.equal(pageLines(ch.pages.find(p=>p.node==='gate'),{},ch).filter(l=>l.if).length,0);
 for(const p of paths(sk)){const ch=pathStory(story,p),chosen=p.picks[0]==='a'?'rope':'lamp';assert.ok(ch.pages.find(p=>p.say.some(l=>l.if)).say.some(l=>String(l?.text||l?.[1]).includes(chosen)));assert.equal(flatten(story,p).pages.flatMap(p=>p.say).filter(l=>l.if).length,2);}
});
test('graph rejects generic mentions, missing option payoffs, wrong item words and cosmetic praise',()=>{
 const {story,sk}=conditional();assert.deepEqual(graphIssues(story,sk,kit),[]);
 for(const mutation of [l=>{delete l.if;},l=>{l.text='The banana opens the gate.';},l=>{l.text='You kept the lamp.';}]){const s=structuredClone(story),l=s.nodes.gate.pages[0].say.find(l=>l.if==='lamp');mutation(l);assert.match(graphIssues(s,sk,kit).join('|'),/node gate: flag "lamp" needs an if/);}
});
test('carried-in unpaid flag needs a visible conditional action on every route; mentions do not pay it',()=>{
 const {story,plan,sk}=conditional();plan.payoff={id:'yesterday:bell',label:'a bronze bell',kind:'item'};
 assert.match(lintAdventure(story,sk,kit,plan,{library,actors:plan.actorIds.all}).join('|'),/carried flag/);
 story.nodes.gate.pages[0].say.push({who:'narrator',text:'The bronze bell calls the hill keeper.',if:plan.payoff.id});
 assert.ok(!lintAdventure(story,sk,kit,plan,{library,actors:plan.actorIds.all}).some(i=>i.startsWith('carried flag')));
 const ch=assembleAdventure(story,plan,sk,kit,{library,actors:plan.actorIds.all});assert.ok(payoffUse(ch,plan.payoff));
 ch.meta.carriedFlags=[];assert.ok(!payoffUse(ch,plan.payoff));
});
test('challenge distribution caps each node at two and rejects generic scene setups',()=>{
 const {plan,story}=conditional(),sk=adventurePlan(plan,kit);assert.ok(sk.nodes.every(n=>n.beats.length<=2));
 for(const r of paths(sk))assert.deepEqual(r.nodes.flatMap(id=>sk.nodes.find(n=>n.id===id).beats),plan.beats.map(b=>b.id));
 const issues=lintAdventure(story,sk,kit,plan,{library,actors:plan.actorIds.all});assert.ok(issues.some(i=>i.includes('setup must say why')));
});

test('a collapsed path has no graph nodes and never reaches adventure assembly',()=>{
 const {story,sk}=conditional(),ch=collapse(story,sk);assert.ok(!ch.nodes);assert.ok(!ch.pages.some(p=>p.choice));assert.ok(!ch.pages.flatMap(p=>p.say||[]).some(l=>l.if));
});
test('failed quest narration keeps the prior review file byte-identical',async()=>{
 const {deployment,NOW}=await import('./fixtures.mjs'),{bookPaths,readProfiles}=await import('../paths.mjs'),{generateOne}=await import('../generate.mjs'),{mkdir,writeFile}=await import('node:fs/promises'),{join}=await import('node:path');
 const {env}=await deployment(),p=bookPaths(env),profiles=readProfiles(p);profiles.young.adventure={kit:kit.id};await mkdir(join(p.book,'adventure','kits'),{recursive:true});await writeFile(join(p.book,'adventure','kits',kit.id+'.json'),JSON.stringify(kit));await mkdir(join(p.book,'young','review'),{recursive:true});
 const file=join(p.book,'young','review','2026-03-10.json'),prior='{"schema":"family-book-chapter-2","title":"Keep the prior review"}';await writeFile(file,prior);
 await assert.rejects(generateOne('young',{paths:p,profiles,date:'2026-03-10',review:true,force:true,paths:{...p,python:'false'},ask:async()=>null,now:NOW,log:()=>{}}),/Deterministic quest failed/);assert.equal(await readFile(file,'utf8'),prior);
});
test('an adventure gate keeps the pictured speaker and friends on an observation challenge',()=>{
 const {story,plan,sk}=conditional();plan.beats.find(b=>b.id===sk.nodes.find(n=>n.id==='gate').beats[0]).variant='observe';
 const ch=assembleAdventure(story,plan,sk,kit,{library,actors:plan.actorIds.all});const p=ch.pages.find(p=>p.node==='gate'&&p.beat);assert.ok(p.scene.actors.some(a=>a.id===plan.actorIds.dad));assert.ok(p.scene.actors.some(a=>a.id==='bo'));
});
