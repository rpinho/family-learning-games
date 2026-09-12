import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestTarget,aimFromClient,releaseAim,movedPointer} from '../lib/aim.mjs';
import {shortPrompt,needsWordClue} from '../lib/speech-plan.mjs';
import {question,voiceLines,GAMES} from '../lib/engine.mjs';
test('Magnet uses actual rendered centers, including uneven spacing and narrow layouts',()=>{
 for(const centers of [[12,38,63,88],[15.7,38.6,61.4,84.3],[20,49,82]])for(let i=0;i<centers.length;i++){
  const x=centers[i]+2;assert.equal(nearestTarget(x,centers),i);assert.equal(releaseAim({moved:true},x,centers).x,centers[i]);
 }
 assert.equal(nearestTarget(0,[12,38,63,88]),0);assert.equal(nearestTarget(100,[12,38,63,88]),3);assert.equal(nearestTarget(50,[]),null);
 assert.equal(aimFromClient(150,100,200),25);assert.equal(aimFromClient(-5,100,200),0);assert.equal(aimFromClient(999,100,200),100);
});
test('Single ship tap fires once; drag, background tap, and cancellation only snap',()=>{
 const centers=[15,39,61,85];assert.equal(releaseAim({shipTap:true,moved:false},60,centers).fire,true);
 for(const [gesture,canceled] of [[{shipTap:true,moved:true},false],[{shipTap:false,moved:false},false],[{shipTap:true,moved:false},true]])assert.equal(releaseAim(gesture,60,centers,canceled).fire,false);
 assert.equal(movedPointer({x:0,y:0},3,4),false);assert.equal(movedPointer({x:0,y:0},9,0),true);
 // Magnet does not know which letter is correct; it never solves the puzzle.
 assert.equal(releaseAim({moved:true},14,centers).index,0);
});
test('Concise audio retains all dictated targets without narrating independent reading answers',()=>{
 const lines=new Set(voiceLines());for(const g of GAMES)for(let l=1;l<=3;l++)for(let n=0;n<144;n++){
  const q=question(g.id,l,n),line=shortPrompt(q);if(line)assert.ok(lines.has(line),line);
  if(needsWordClue(q))assert.ok(line.includes(g.id==='lowercase'?q.char.toUpperCase():q.word),line);
  if(g.id==='asteroids')assert.equal(line,q.prompt);
  if(g.id==='train')assert.equal(line,q.word);
 }
});
