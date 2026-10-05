import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {deployment,NOW,young} from './fixtures.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {planChapter} from '../plan.mjs';
import {adventurePlan,assembleAdventure,collapse,rotateChallenges} from '../adventure/integrate.mjs';
import {paths} from '../adventure/graph.mjs';
import {generateOne,writeAdventure} from '../generate.mjs';
import {speechLines,attachClips} from '../assemble.mjs';
import {routePages,pathOptions,pageLines} from '../../hub/public/book-adventure.mjs';
import {completeAdventure,readLedger,payPublished,payoff,payoffUse} from '../adventure/ledger.mjs';
const lib=JSON.parse(await readFile(new URL('../../hub/public/book-art/library.json',import.meta.url)));
export const kit={id:'woodland',title:'The Woodland',places:[{id:'gate',bg:'castle',name:'gate'},{id:'field',bg:'meadow',name:'field'},{id:'wood',bg:'forest',name:'wood'},{id:'hill',bg:'night',name:'hill'}],edges:[['gate','field','through the doors'],['gate','wood','along the path'],['field','hill','up the steps'],['wood','hill','along the ridge']]};
export function sample(){const plan=planChapter(young,{date:'2026-03-10',profile:{sibling:'Robin'}});plan.actorIds={hero:'hero',dad:'grown-up',all:['hero','grown-up','bo']};const sk=adventurePlan(plan,kit),nodes={};
 for(const n of sk.nodes)nodes[n.id]={pages:[{scene:kit.places.find(p=>p.id===n.place).bg,actors:plan.actorIds.all,say:[['narrator',`At the ${n.place}.`]]},...n.beats.map(id=>({scene:kit.places.find(p=>p.id===n.place).bg,actors:plan.actorIds.all,beat:id,say:[['narrator','A clue waits.']]}))]};
 nodes.fork1.choice={prompt:'Which path?',options:[{id:'a',label:'Field',reply:'Take the rope.',sets:{id:'rope',kind:'item',label:'rope'}},{id:'b',label:'Wood',reply:'Take the lamp.',sets:{id:'lamp',kind:'item',label:'lamp'}}]};
 nodes.fork2.choice={prompt:'What next?',options:[{id:'c',label:'Mark the map',reply:'Mark it.'},{id:'d',label:'Teach Bo',reply:'Teach Bo.'}]};
 nodes.gate.pages[0].consequences={a:[['dad','The rope holds the gate.']],b:[['dad','The lamp lights the gate.']]};nodes.ending.pages[0].consequences={a:[['dad','Keep the rope.']],b:[['dad','Keep the lamp.']],c:[['dad','You mark the map.']],d:[['dad','Bo learns the way.']]};
 const story={title:'The New Path',summary:'A map opens.',hook:'A new place waits.',nodes},ch=assembleAdventure(story,plan,sk,kit,{library:lib,actors:plan.actorIds.all});return {plan,sk,story,ch};}
test('assembly includes all branches, voiced choices, consequences and shown travel; each route keeps all skills',()=>{
 const {ch,plan}=sample();assert.equal(pathOptions(ch).length,4);
 for(const path of pathOptions(ch)){const pages=path.pages.map(i=>ch.pages[i]);assert.deepEqual(pages.filter(p=>p.beat).map(p=>p.beat.id),plan.beats.map(b=>b.id));assert.ok(pages.some(p=>p.travel));assert.equal(pages.filter(p=>p.node.startsWith('branch')).length,2);}
 assert.equal(ch.pages.find(p=>p.node==='fork2'&&p.choice).choice.options[1].pictureActor,'bo');assert.equal(ch.pages.find(p=>p.choice).choice.prompt.text,'Which path would you like to take?');const lines=speechLines(ch);assert.ok(lines.some(l=>l.text==='Take the lamp.'));assert.ok(lines.some(l=>l.text==='The rope holds the gate.'));attachClips(ch,Object.fromEntries(lines.map((l,i)=>[`${l.voice}|${l.speed}|${l.text}`,`${i}.wav`])));assert.ok(ch.pages.find(p=>p.choice).choice.options.every(o=>o.reply.clip));
});
test('branch B resume uses the stored route, hides branch A and reads only its own consequences',()=>{
 const {ch}=sample(),picks={fork1:'b',fork2:'d'},route=routePages(ch,picks),mid=route.find(i=>ch.pages[i].node==='branchB');assert.ok(route.includes(mid));assert.ok(!route.some(i=>ch.pages[i].node==='branchA'));assert.ok(pageLines(ch.pages.find(p=>p.node==='gate'),picks).some(l=>l.text.includes('lamp')));assert.ok(!pageLines(ch.pages.find(p=>p.node==='gate'),picks).some(l=>l.text.includes('rope')));
 assert.equal(routePages(ch,{}).at(-1),ch.pages.findIndex(p=>p.choice));assert.equal(routePages({...ch,meta:{}},{}).length,ch.pages.length);
});
test('completion atomically stores trusted flags per child; replay idempotent; payoff marked only when used and published',async()=>{
 const {env}=await deployment(),p=bookPaths(env),{ch}=sample();await assert.rejects(completeAdventure(p.book,'young',ch,{}),/Choose/);
 await Promise.all([completeAdventure(p.book,'young',ch,{fork1:'b',fork2:'d'}),completeAdventure(p.book,'older',ch,{fork1:'a',fork2:'c'})]);
 let ledger=await readLedger(p.book,'young');assert.equal(ledger.flags.length,1);assert.equal(payoff(ledger).label,'lamp');assert.equal((await readLedger(p.book,'older')).flags[0].label,'rope');await completeAdventure(p.book,'young',ch,{fork1:'b',fork2:'d'});assert.equal((await readLedger(p.book,'young')).flags.length,1);
 assert.equal(payoffUse(ch,{id:'old-lamp',label:'lamp'}),false,'a branch-only mention cannot pay an earlier flag on all routes');ch.meta.carriedFlags=['old-lamp'];ch.pages[0].say.push({who:'narrator',text:'The lamp from yesterday lights the map.',if:'old-lamp'});assert.equal(payoffUse(ch,{id:'old-lamp',label:'lamp'}),true);assert.equal(payoffUse(ch,{label:'apple'}),false);ch.pages[0].say.push({who:'narrator',text:'A forest path opens.'});assert.equal(payoffUse(ch,{label:'forest tune'}),false,'the world name alone cannot pay off its knowledge flag');ch.meta.payoff={id:ledger.flags[0].id,used:false};await payPublished(p.book,'young',ch);assert.ok(payoff(await readLedger(p.book,'young')));ch.meta.payoff.used=true;await payPublished(p.book,'young',ch);assert.equal(payoff(await readLedger(p.book,'young')),null);
});
test('nightly replaces the old kit pipeline with a deterministic quest fallback',async()=>{
 const {env}=await deployment(),p=bookPaths(env),profiles=readProfiles(p);profiles.young.adventure={kit:kit.id};await mkdir(join(p.book,'adventure','kits'),{recursive:true});await writeFile(join(p.book,'adventure','kits',kit.id+'.json'),JSON.stringify(kit));
 const r=await generateOne('young',{paths:p,profiles,date:'2026-03-10',review:true,noLLM:true,noVoice:true,now:NOW,log:()=>{}});assert.match(r.source,/deterministic quest fallback/);assert.ok(!r.chapter.meta.graph);assert.equal(r.chapter.pages.length,1);assert.ok(r.chapter.episode.rooms.length>=3);assert.ok(r.chapter.episode.puzzles.length>=3);
});
test('NO challenge never occurs on consecutive chapters and other challenges keep its answer and skill',()=>{
 let last=[];for(let d=10;d<25;d++){const p=planChapter(young,{date:`2026-03-${d}`,profile:{}}),old=p.beats.find(b=>b.kind==='no');rotateChallenges(p,last);assert.notEqual(p.turnType,last.at(-1)?.meta.turnType);const b=p.beats.find(b=>b.id===old.id);assert.equal(String(b.answer||b.right),String(old.right));last.push({meta:{turnType:p.turnType}});}
});

test('deterministic collapse passes the complete linear lint and repair retains the best issue list',async()=>{
 const {plan,sk,story}=sample(),{lintChapter}=await import('../lint.mjs');
 const r=await writeAdventure(plan,{sk,kit,ask:async()=>null,library:lib,actors:plan.actorIds.all});assert.deepEqual(lintChapter(r.story,plan,{library:lib,actors:plan.actorIds.all}),[]);
 const prompts=[];const out=await writeAdventure(plan,{sk,kit,ask:async p=>{prompts.push(p);return {text:JSON.stringify(story),source:'fixture'};},library:lib,actors:plan.actorIds.all});assert.equal(prompts.filter(p=>!/^A children.s adventure needs a few short alternate Dad lines/.test(p)).length,4);assert.match(prompts[1],/REPAIR ONLY THESE ISSUES/);assert.match(prompts[1],/Preserve every planned beat and node/);assert.ok(!out.story.nodes);
});

test('curated kit travel phrases pass the address filter while an actual address is still refused',async()=>{
 const {safetyIssues}=await import('../lint.mjs'),opts={travel:['along the mossy forest road']};assert.deepEqual(safetyIssues('They walk along the mossy forest road.',opts),[]);assert.ok(safetyIssues('At 123 Maple road.',opts).length);assert.ok(safetyIssues('Their phone number is 1234567.',opts).length);
});

test('graph style fixes remove stressful reading invitations while preserving every node, choice and consequence',async()=>{
 const {softFixAdventure}=await import('../adventure/integrate.mjs'),{story,plan}=sample();story.nodes.fork2.pages[0].say=[['narrator','A card glows. Read it!']];const fixed=softFixAdventure(story,plan);assert.equal(fixed.nodes.fork2.pages[0].say[0][1],'A card glows.');assert.deepEqual(Object.keys(fixed.nodes),Object.keys(story.nodes));assert.deepEqual(fixed.nodes.fork1.choice,story.nodes.fork1.choice);assert.deepEqual(fixed.nodes.ending.pages[0].consequences,story.nodes.ending.pages[0].consequences);
});
