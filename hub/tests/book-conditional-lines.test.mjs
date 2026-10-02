import test from 'node:test';
import assert from 'node:assert/strict';
import {pathOptions,pageLines,routeFlags} from '../public/book-adventure.mjs';
const chapter=()=>({pages:[
 {node:'fork1',say:[],choice:{options:[{id:'a',sets:{id:'today:rope'}},{id:'b',sets:{id:'today:lamp'}}]}},
 {node:'branchA',say:[]},{node:'branchB',say:[]},
 {node:'gate',say:[{text:'The rope ties the gate open.',if:'today:rope',clip:'rope.wav'},{text:'The lamp lights the latch.',if:'today:lamp',clip:'lamp.wav'},{text:'The old bell calls a guide.',if:'yesterday:bell',clip:'bell.wav'}]},
 {node:'fork2',say:[],choice:{options:[{id:'c'},{id:'d'}]}},
 {node:'ending',say:[],consequences:{c:[{text:'Leave a marker.'}],d:[{text:'Show a friend.'}]}}
],meta:{carriedFlags:['yesterday:bell'],graph:{start:'fork1',nodes:[{id:'fork1',choice:{options:[{id:'a',next:'branchA'},{id:'b',next:'branchB'}]}},{id:'branchA',next:['gate']},{id:'branchB',next:['gate']},{id:'gate',next:['fork2']},{id:'fork2',choice:{options:[{id:'c',next:'ending'},{id:'d',next:'ending'}]}},{id:'ending',next:[]}]}}});
test('all four routes expose only the selected flag plus the carried flag, with clips and option endings',()=>{
 const ch=chapter(),routes=pathOptions(ch);assert.equal(routes.length,4);
 for(const r of routes){const ls=pageLines(ch.pages[3],r.choices,ch),chosen=r.choices.fork1==='a'?'today:rope':'today:lamp';assert.deepEqual(ls.map(l=>l.if),[chosen,'yesterday:bell']);assert.ok(ls.every(l=>l.clip));assert.deepEqual([...routeFlags(ch,r.choices)].sort(),[chosen,'yesterday:bell'].sort());assert.equal(pageLines(ch.pages[5],r.choices,ch).length,1);}
 assert.deepEqual(pageLines(ch.pages[3],{},ch).map(l=>l.if),['yesterday:bell']);assert.deepEqual(pageLines(ch.pages[3],{fork1:'fake'},ch).map(l=>l.if),['yesterday:bell']);
});
