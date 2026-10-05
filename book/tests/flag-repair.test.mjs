import test from 'node:test';
import assert from 'node:assert/strict';
import {repairFlagPayoffs} from '../generate.mjs';
import {conditionalPayoffs} from '../adventure/graph.mjs';

const story={nodes:{gate:{pages:[{say:[['narrator','The hill gate is shut tight.']]}]},
 ending:{pages:[{say:[['narrator','The tree house waits.'],['dad','Look up there!']],consequences:{c:[['narrator','x']],d:[['narrator','y']]}}]}}};
const issues=['node ending: flag "Meadow ribbon" needs an if:"treetop:ribbon" line using its own words to change what happens','path ac: something soft'];
const flag={id:'treetop:ribbon',label:'Meadow ribbon'};

test('writes only the missing flag line and it passes the payoff rule', async()=>{
 const ask=async()=>({text:JSON.stringify({'ending:treetop:ribbon':'Your ribbon ties the rope ladder down.'})});
 const fixed=await repairFlagPayoffs(story,issues,{ask});
 assert.equal(conditionalPayoffs(fixed,'ending',flag).length,1);
 const line=fixed.nodes.ending.pages[0].say.at(-1);
 assert.equal(line.who,'narrator','no two Dad lines in a row');
 assert.equal(conditionalPayoffs(story,'ending',flag).length,0,'original untouched');
});

test('rejects praise that does nothing, then gives up after three tries', async()=>{
 let n=0;const ask=async()=>{n++;return {text:JSON.stringify({'ending:treetop:ribbon':'What a lovely ribbon you picked!'})};};
 assert.equal(await repairFlagPayoffs(story,issues,{ask}),null);assert.equal(n,3);
});

test('does nothing when no flag line is missing', async()=>{
 assert.equal(await repairFlagPayoffs(story,['path ac: too long'],{ask:async()=>{throw Error('no call');}}),null);
});
