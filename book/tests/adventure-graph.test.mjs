import test from 'node:test';
import assert from 'node:assert/strict';
import {kitIssues,legalMove,travel,skeleton,paths,flatten,graphIssues,lintStory,applyChoice,payoff,markPaid} from '../adventure/graph.mjs';
const kit={id:'volcano-world',title:'The Volcano',places:[{id:'rim',bg:'volcano-rim'},{id:'river',bg:'lava-river'},{id:'cave',bg:'lava-cave'},{id:'spring',bg:'hot-spring'}],
 edges:[['rim','river','down the zigzag path'],['rim','cave','through the cool dark tunnel'],['river','spring','across the stepping stones'],['cave','spring','up the glowing steps']]};
const beats=[{id:'b1',kind:'teach-letter'},{id:'b2',kind:'count',n:10},{id:'b3',kind:'signs'},{id:'b4',kind:'no'}];
const pg=(text,scene)=>({scene,say:[['narrator',text]]});
function story(sk,{sets=true,payoffWord='lantern'}={}){const nodes={};for(const n of sk.nodes)nodes[n.id]={pages:[pg(`At the ${n.place}.`,n.place)]};
 nodes.fork1.choice={prompt:'Which way?',options:[{id:'a',label:'the zigzag path',...(sets?{sets:{id:'rope',kind:'item',label:'a rope'}}:{})},{id:'b',label:'the dark tunnel',...(sets?{sets:{id:'lantern',kind:'item',label:'a glowing lantern'}}:{})}]};
 nodes.gate.pages.push(pg(`The ${payoffWord} helps them, and so does the rope.`,sk.nodes.find(n=>n.id==='gate').place));return {title:'T',nodes};}
test('a kit needs 3+ places, known backgrounds and a way to travel each edge',()=>{
 assert.deepEqual(kitIssues(kit),[]);
 assert.match(kitIssues(kit,{backgrounds:new Set(['volcano-rim'])}).join('|'),/unknown background lava-river/);
 assert.match(kitIssues({...kit,edges:[['rim','river','']]}).join('|'),/needs a way to travel/);
 assert.ok(legalMove(kit,'rim','cave')&&!legalMove(kit,'rim','spring'));assert.equal(travel(kit,'spring','cave'),'up the glowing steps');
});
test('the skeleton: two forks make 4 paths, both branches carry the same kind of challenge, branches meet at a shared place',()=>{
 const sk=skeleton(kit,beats,{rand:()=>0.5});const ps=paths(sk);
 assert.equal(ps.length,4);assert.deepEqual(ps.map(p=>p.picks.join('')).sort(),['ac','ad','bc','bd']);
 const A=sk.nodes.find(n=>n.id==='branchA'),B=sk.nodes.find(n=>n.id==='branchB');
 assert.notEqual(A.place,B.place);assert.equal(A.beat.kind,B.beat.kind);assert.equal(A.beat.mirror,'b2');
 assert.equal(sk.nodes.find(n=>n.id==='gate').place,'spring');
 const s=story(sk);assert.deepEqual(graphIssues(s,sk,kit),[]);
 assert.equal(flatten(s,ps[0]).pages.length,7,'6 nodes on a path, the gate has 2 pages');
});
test('graph checks: unwritten nodes, moves off the map, a choice that changes nothing, a flag that never comes back',()=>{
 const sk=skeleton(kit,beats,{rand:()=>0.5});
 const s=story(sk);delete s.nodes.ending;assert.match(graphIssues(s,sk,kit).join('|'),/node ending has no pages/);
 assert.match(graphIssues(story(sk),{...sk,nodes:sk.nodes.map(n=>n.id==='gate'?{...n,place:'rim'}:n)},kit).join('|'),/not on the map/);
 assert.match(graphIssues(story(sk,{sets:false}),sk,kit).join('|'),/first choice must change something/);
 assert.match(graphIssues(story(sk,{payoffWord:'banana'}),sk,kit).join('|'),/"a glowing lantern" is set but never comes back/);
});
test('the linear lint runs on every path, labelled by the choices',()=>{
 const sk=skeleton(kit,beats,{rand:()=>0.5});const s=story(sk);s.nodes.branchB.pages[0].say.push(['narrator','A scary ghost!']);
 const issues=lintStory(s,sk,kit,ch=>ch.pages.some(p=>p.say.some(l=>/scary/.test(l[1])))?['scary: "scary"']:[]);
 assert.deepEqual(issues.sort(),['path bc: scary: "scary"','path bd: scary: "scary"']);
});
test('the ledger: a choice sets a flag once, tomorrow pays off the oldest unpaid one',()=>{
 let l=applyChoice(null,{id:'lantern',kind:'item',label:'a glowing lantern'},'2026-10-03');
 l=applyChoice(l,{id:'lantern',label:'again'},'2026-10-04');assert.equal(l.flags.length,1);
 l=applyChoice(l,{id:'owl',kind:'ally',label:'Owl'},'2026-10-04');assert.equal(payoff(l).id,'lantern');
 l=markPaid(l,'lantern','2026-10-05');assert.equal(payoff(l).id,'owl');
});
test('the brief names every node, its place and scene, how they travel, the mirrored challenge, the choices and the payoff',async()=>{
 const {adventureBrief}=await import('../adventure/brief.mjs');
 const sk=skeleton(kit,beats,{rand:()=>0.5});
 const t=adventureBrief({sk,kit,plan:{beats},payoff:{label:'a glowing lantern',kind:'item'},chooser:'Alex'});
 for(const n of sk.nodes)assert.match(t,new RegExp(`"${n.id}"`));
 assert.match(t,/they arrive (down the zigzag path|through the cool dark tunnel)/);assert.match(t,/same kind of challenge in a different skin/);
 assert.match(t,/ends with a CHOICE/);assert.match(t,/a glowing lantern/);assert.match(t,/never a right and a wrong one/);
});

test('when two routes meet, each branch tells its own road and the shared page names none',async()=>{
 const {adventureBrief}=await import('../adventure/brief.mjs');const sk=skeleton(kit,beats,{rand:()=>0.5});
 const t=adventureBrief({sk,kit,plan:{beats}});
 assert.match(t,/"branchA"[^\n]*end this node by telling how they go on to spring: across the stepping stones/);
 assert.match(t,/"branchB"[^\n]*end this node by telling how they go on to spring: up the glowing steps/);
 assert.match(t,/"gate"[^\n]*do not describe the road here/);
});
