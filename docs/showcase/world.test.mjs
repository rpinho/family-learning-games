import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldModel} from './world-model.mjs';
test('a fictional explorer restores the map through real challenge rules and opens the castle',()=>{
 const m=createWorldModel();let s=m.freshWorld();
 const act=b=>{s=m.worldAction(s,b).state;};
 assert.equal(m.mapPieces(s),0);assert.equal(s.doorOpen,false);
 act({action:'quest'});
 act({action:'walk',room:'chess-courtyard',x:.4,y:.9});
 assert.equal(m.worldAction(s,{action:'solve',gate:'chess',answer:'You by 9'}).correct,false);
 act({action:'solve',gate:'chess',answer:'You by 5'});assert.equal(m.mapPieces(s),1);
 act({action:'walk',room:'castle-gate',x:.4,y:.9});
 act({action:'walk',room:'castle-forest',x:.4,y:.9});
 act({action:'solve',gate:'reading',answer:'red-shell'});assert.equal(m.mapPieces(s),2);
 act({action:'walk',room:'castle-gate',x:.4,y:.9});
 act({action:'walk',room:'chess-courtyard',x:.4,y:.9});
 act({action:'walk',room:'soccer-pitch',x:.4,y:.9});
 act({action:'solve',gate:'score',answer:'50'});assert.equal(m.mapPieces(s),3);assert.equal(s.doorOpen,true);
 assert.ok(s.visited.includes('castle-forest'));assert.ok(!s.visited.includes('pirate-ship'),'unvisited rooms retain fog');
 assert.deepEqual(m.freshWorld().solved,[],'a new demo is independent');
});
test('the public definition references only original fictional cast IDs',()=>{
 const {definition}=createWorldModel();const cast=new Set(['hero','bo','grown-up','pip']);
 for(const room of Object.values(definition.ROOMS))assert.ok(cast.has(room.friend));
});
