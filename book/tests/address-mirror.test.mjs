import test from 'node:test';
import assert from 'node:assert/strict';
import {lintChapter} from '../lint.mjs';
import {skeleton,graphIssues} from '../adventure/graph.mjs';
const plan={level:'reader',beats:[],cast:[]};
const pd=t=>lintChapter({title:'T',pages:[{scene:'garden',say:[['narrator',t]]}]},plan).filter(i=>/personal data/.test(i));
test('2026-10-02: a story "forest road" is not personal data; address-shaped text still is',()=>{
 assert.deepEqual(pd('Along the mossy forest road they go.'),[]);
 assert.deepEqual(pd('A narrow lane leads home.'),[]);
 assert.ok(pd('They live at '+[123,'Fictional','Road'].join(' ')+' near the park.').length);
 assert.ok(pd('Turn onto Elm Street.').length);
});
test('the two branches may not say the same line word for word',()=>{
 const kit={id:'k',places:[{id:'a',bg:'x'},{id:'b',bg:'y'},{id:'c',bg:'z'},{id:'d',bg:'w'}],edges:[['a','b','p'],['a','c','q'],['b','d','r'],['c','d','s']]};
 const sk=skeleton(kit,[{id:'b1',kind:'signs'},{id:'b2',kind:'count'}],{rand:()=>0.5});const nodes={};
 for(const n of sk.nodes)nodes[n.id]={pages:[{scene:n.place,say:[['narrator',`At ${n.id}.`]]}]};
 nodes.branchA.pages.push({scene:'b',say:[['narrator','Baby dinosaurs want a tall stack of pancakes.']]});
 nodes.branchB.pages.push({scene:'c',say:[['narrator','Baby dinosaurs want a tall stack of pancakes.']]});
 nodes.fork1.choice={options:[{id:'a',sets:{id:'x',label:'a key'}},{id:'b'}]};
 assert.match(graphIssues({nodes},sk,kit).join('|'),/both say "baby dinosaurs/);
});
