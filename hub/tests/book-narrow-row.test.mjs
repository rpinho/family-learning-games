import test from 'node:test';
import assert from 'node:assert/strict';
import {composeScene} from '../public/book-scene.mjs';
test('a crowded single row chooses a fitting split beside controls instead of overflowing at its scale floor',()=>{
 const actors={dad:{h:.64,poses:{idle:{ar:.53}}},mom:{h:.60,poses:{idle:{ar:.456}}},hero:{h:.62,poses:{idle:{ar:.55}}},brother:{h:.62,poses:{idle:{ar:.59}}},companion:{h:.20,poses:{idle:{ar:.93}}}};
 const scene={actors:['hero','brother','dad','mom','companion'].map(id=>({id,pose:'idle'})),props:[]};
 const L=composeScene(scene,{actors,props:{}},{width:390,height:844,ground:.93,maxHeight:.266,oneRow:true,avoid:[.208,.789]});
 assert.equal(L.actors.length,5);assert.ok(L.actors.some(a=>a.left<.208));assert.ok(L.actors.some(a=>a.left>.789));
 for(const a of L.actors){assert.ok(a.left>=.03-1e-9&&a.left+a.width<=.97+1e-9);assert.ok(a.left+a.width<=.208+1e-9||a.left>=.789-1e-9);}
});
