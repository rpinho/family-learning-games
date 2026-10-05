// 2026-10-02: the adventure drafts read like a checklist ("The chess courtyard needs equal picnic plates before its
// stairway opens", then the same line in the forest) and the second choice was "High marker / Low marker".
import test from 'node:test';
import assert from 'node:assert/strict';
import {sample as base,kit} from './adventure-integrate.test.mjs';
const sample=()=>({...base(),kit});
import {lintAdventure} from '../adventure/integrate.mjs';
import {readFile} from 'node:fs/promises';
const library=JSON.parse(await readFile(new URL('../../hub/public/book-art/library.json',import.meta.url)));
const beatPage=(story,node)=>story.nodes[node].pages.find(p=>p.beat);
const run=x=>lintAdventure(x.story,x.sk,x.kit,x.plan,{library,actors:x.plan.actorIds.all}).join('\n');
const setText=(story,node,text)=>{beatPage(story,node).say=[['narrator',text]];};

test('distinct story-moment setups and a real second choice pass the new voice checks',()=>{
 const x=sample();setText(x.story,'branchA','Bo drops the berries in the field grass. Can everyone get the same?');
 setText(x.story,'branchB','In the wood, a squirrel family argues over acorns. Help them share!');
 x.story.nodes.fork2.choice.options[0].label='Open the chest';
 const out=run(x);assert.doesNotMatch(out,/formula|place swapped|marker is not a choice|two different final moments/);
});
test('the "needs ... before it opens" formula is allowed once, flagged when repeated',()=>{
 const x=sample(),beats=Object.keys(x.story.nodes).filter(id=>beatPage(x.story,id));
 const place=id=>x.kit.places.find(p=>p.id===x.sk.nodes.find(n=>n.id===id).place).name;
 for(const id of beats)setText(x.story,id,`The ${place(id)} needs fair shares before its door opens.`);
 assert.match(run(x),/repeats the "<place> needs <task> before it opens" formula/);
});
test('mirrored branches must not be the same sentence with the place swapped',()=>{
 const x=sample(),place=id=>x.kit.places.find(p=>p.id===x.sk.nodes.find(n=>n.id===id).place).name;
 for(const id of ['branchA','branchB'])setText(x.story,id,`At the ${place(id)}, Dad spills the picnic plates everywhere; can everyone get the same?`);
 assert.match(run(x),/place swapped/);
});
test('a marker is not a second choice, and the two endings must differ',()=>{
 const x=sample();x.story.nodes.fork2.choice.options[0].label='High marker';
 const end=x.story.nodes.ending.pages.find(p=>p.consequences);end.consequences.c=[['narrator','Bo marks the high rail by the door.']];end.consequences.d=[['narrator','Bo marks the low rail by the door.']];
 const out=run(x);assert.match(out,/marker is not a choice/);assert.match(out,/two different final moments/);
});
test('the world\'s own travel words do not count as a theme or detail touch',async()=>{
 const {detailIssues}=await import('../detail-rotation.mjs');
 const plan={name:'Hero',themes:[{id:'new-trail',seed:'When the bridge on his path is closed, he discovers a new trail with a surprise.'}],details:[],blockedSeeds:[]};
 const story={pages:[{say:[['narrator','Down the trail path to the bridge.']]},{say:[['narrator','Across the bridge and up the trail path.']]}]};
 assert.match(detailIssues(story,plan).join('|'),/new-trail occurs twice/);
 assert.deepEqual(detailIssues(story,{...plan,kitWords:['down the trail path to the bridge','across the bridge and up the trail path']}),[]);
});
test('a seed made of the Book\'s own mechanics (magic words, numbers) does not block a math chapter',async()=>{
 const {detailIssues}=await import('../detail-rotation.mjs');
 const plan={name:'Hero',themes:[],details:[],blockedSeeds:[{id:'number-magic',seed:'Number magic: the numbers count out loud like magic words.'}]};
 assert.deepEqual(detailIssues({pages:[{say:[['narrator','The number lock wants the magic word. Count the numbers!']]}]},plan),[]);
 assert.match(detailIssues({pages:[{say:[['narrator','A wizard with a spellbook casts number magic.']]}]},{...plan,blockedSeeds:[{id:'wizard',seed:'a young wizard with a spellbook'}]}).join('|'),/recent wizard/);
});
test('a reaction-voice friend says only his cry (2026-10-02: "Pip! One try, then pause beside these flowers")',async()=>{
 const {softFix,onlyCry}=await import('../lint.mjs');
 const plan={cast:[{id:'pip-hat',name:'Pip with Hat',voice:'local:pip-1-reactions-v1'}]};
 const ch={pages:[{say:[['narrator','Through the tall grass.'],['pip-hat','[[pˈikə]]! One try, then pause beside these flowers.']]}]};
 const fixed=softFix(ch,plan),l=fixed.pages[0].say.find(l=>(Array.isArray(l)?l[0]:l.who)==='pip-hat');
 assert.equal(Array.isArray(l)?l[1]:l.text,'[[pˈikə]]!');assert.equal(onlyCry('Pip-pip! Go!'),'Pip-pip!');
});
test('the two carried things must make different things happen at the gate',()=>{
 const x=sample(),g=x.story.nodes.gate.pages[0];g.say=g.say.filter(l=>!l.if);
 g.say.push({who:'dad',text:'The rope holds the curling map flat.',if:'rope'},{who:'dad',text:'The lamp holds the curling map flat.',if:'lamp'});
 assert.match(run(x),/object swapped/);
 g.say=g.say.filter(l=>!l.if);g.say.push({who:'dad',text:'The rope ties the gate open.',if:'rope'},{who:'dad',text:'The lamp wakes the sleepy owl.',if:'lamp'});
 assert.doesNotMatch(run(x),/node gate: .*(object swapped|same line plays)/);
});
