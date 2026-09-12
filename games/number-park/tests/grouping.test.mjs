import test from 'node:test';
import assert from 'node:assert/strict';
import {moveGroup,groupsNear} from '../lib/grouping.mjs';
import {freshProfile,makeQuestion} from '../lib/math.mjs';
test('bigger grouping varies totals 8–13, keeps manageable piles and offers four close answers',()=>{
 const p=freshProfile('admin'),totals=new Set(),pairs=new Set();
 for(let i=0;i<500;i++){
  p.revision=i;const q=makeQuestion(p,'addobjects',i%6);
  assert.ok(q.a>=3&&q.a<=7);assert.ok(q.b>=3&&q.b<=7);
  assert.equal(q.a+q.b,q.total);assert.equal(q.answer,q.total);
  assert.ok(q.total>=8&&q.total<=13);assert.equal(q.max,13);
  assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);
  assert.ok(q.options.includes(q.answer));assert.ok(q.options.every(n=>n>=0&&n<=13&&Math.abs(n-q.answer)<=3));
  totals.add(q.total);pairs.add(q.a+','+q.b);p.recent=[...p.recent,q.fingerprint].slice(-12);
 }
 assert.equal(totals.size,6);assert.ok(pairs.size>=10);
});
test('magnetic grouping accepts overlap and near misses in either direction, but not far drops',()=>{
 const left={left:10,right:100,top:20,bottom:150},near={left:120,right:210,top:20,bottom:150};
 assert.ok(groupsNear(left,near));assert.ok(groupsNear(near,left));
 assert.ok(!groupsNear(left,{...near,left:130,right:220}));
 assert.ok(!groupsNear(left,{left:10,right:100,top:180,bottom:260}));
});
test('pointer movement remains within the board at phone and desktop widths',()=>{
 for(const width of [280,360,650]){
  const board={left:10,right:10+width,top:20,bottom:220},origin={left:30,right:130,top:50,bottom:190};
  for(const [dx,dy] of [[1000,1000],[-1000,-1000],[0,0],[40,-20]]){const p=moveGroup(origin,board,dx,dy);assert.ok(p.rect.left>=board.left);assert.ok(p.rect.right<=board.right);assert.ok(p.rect.top>=board.top);assert.ok(p.rect.bottom<=board.bottom);assert.equal(p.rect.right-p.rect.left,100);assert.equal(p.rect.bottom-p.rect.top,140);}
 }
});
