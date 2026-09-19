import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../public/chess/curriculum.mjs';
import { pathProgress } from '../public/chess/path.mjs';
import { parentChallenge, parentAnswerMatches, menuStyle, gameArtwork } from '../public/menu-options.mjs';
import { CATALOG } from '../public/catalog.mjs';

test('A continuous path unlocks one new step across a unit boundary, including assisted completions', () => {
  const p={completed:{}};
  assert.equal(pathProgress(p).length,72);
  assert.equal(pathProgress(p).filter(l=>!l.locked).length,1);
  for(let i=0;i<6;i++)p.completed[LESSONS[i].id]={best:0};
  const path=pathProgress(p);
  assert.equal(path[6].unit,1);
  assert.equal(path[6].current,true);
  assert.equal(path[6].locked,false);
  assert.equal(path[7].locked,true);
  assert.equal(path.filter(l=>l.current).length,1);
});
test('Legacy out-of-order progress and an active lesson remain accessible; completed courses have no dangling next step',()=>{
  const p={completed:{[LESSONS[10].id]:{best:4}},session:{lesson:LESSONS[20].id,phase:'puzzle'}};
  const before=JSON.stringify(p),path=pathProgress(p);
  assert.equal(path[10].locked,false);assert.equal(path[11].current,true);assert.equal(path[20].locked,false);
  assert.equal(JSON.stringify(p),before);
  p.completed=Object.fromEntries(LESSONS.map(l=>[l.id,{best:5}]));
  assert.equal(pathProgress(p).some(l=>l.current||l.locked),false);
});
test('Adult gate requires reading and reversing letters rather than solving a simple sum',()=>{
  let n=0;const gate=parentChallenge(()=>((n++%17)+1)/20);
  assert.equal(parentAnswerMatches(gate,''),false);
  assert.equal(parentAnswerMatches(gate,'24'),false);
  assert.equal(parentAnswerMatches(gate,gate.code),false);
  const answer=gate.code.replace(/[^A-Z]/g,'').split('').reverse().join('');
  assert.equal(parentAnswerMatches(gate,answer.toLowerCase()),true);
  assert.equal(parentAnswerMatches(gate,answer.split('').join(' ')),true);
  assert.notEqual(parentChallenge(()=>.1).answer,parentChallenge(()=>.8).answer);
});
test('Artwork preference stays per player and device, with all nine destinations retained',()=>{
  const store=new Map([['family-games-menu-style:beginner','logos']]);
  const storage={getItem:key=>store.get(key)};
  assert.equal(menuStyle('beginner',null,storage),'logos');
  assert.equal(menuStyle('explorer',null,storage),'screenshots');
  assert.equal(menuStyle('explorer','logos',storage),'logos');
  store.set('family-games-menu-style:explorer','screenshots');
  assert.equal(menuStyle('explorer','logos',storage),'screenshots');
  assert.equal(menuStyle('beginner','logos',{getItem(){throw Error('blocked');}}),'logos');
  for(const item of CATALOG){assert.match(gameArtwork(item,'logos').src,/\.(png|svg)$/);assert.equal(gameArtwork(item,'screenshots').src,`/previews/${item.preview||item.id}.jpg`);}
});
