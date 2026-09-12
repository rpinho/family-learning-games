import test from 'node:test';import assert from 'node:assert/strict';
import {familyNameQuestion,practiceWord} from '../public/maze-curriculum.mjs';
import {freshProfile} from '../public/engine.mjs';
import {mazeAction,mazeQuestion,mazeState,mazeBoard,MAZE_WORDS} from '../public/maze.mjs';
import {mazeLearning,mazeTapLine} from '../public/maze-learning.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
test('Fictional names are weighted and all positional answers are unambiguous',()=>{
 const counts={},lines=new Set(allVoiceLines());const positions=new Set();
 for(let serial=0;serial<1000;serial++){
  const q=familyNameQuestion('explorer',serial);counts[q.name]=(counts[q.name]||0)+1;
  assert.equal(q.name[Number(q.answer)].toUpperCase(),q.char);assert.equal(q.options.length,q.name.length);assert.equal(new Set(q.options).size,q.name.length);
  if(q.mode==='locate')assert.equal([...q.name.toUpperCase()].filter(c=>c===q.char).length,1);
  assert.ok(lines.has(q.prompt));assert.ok(lines.has(mazeLearning(q).line));for(const a of q.options)assert.ok(lines.has(mazeTapLine(a,q)));
  if(q.name==='Alexandra')positions.add(q.focus);
 }
 assert.deepEqual(counts,{Alexandra:600,Jamie:200,Charlie:100,Jessica:100});assert.equal(positions.size,9);
 const first=familyNameQuestion('explorer');assert.equal(first.char,'A');assert.equal(mazeLearning(first).line,'A is letter number 1 in Alexandra.');
 assert.equal(familyNameQuestion('beginner').name,'Jamie');
});
test('Word weighting preserves -at practice and variety, avoiding the last two ordinary targets',()=>{
 let recent=[],at=0;const words=new Set(),pool=MAZE_WORDS.filter(w=>w.tier===1);
 for(let i=0;i<1000;i++){const w=practiceWord(i,pool,recent);assert.ok(!recent.slice(-2).includes(w.word));at+=Number(w.word.endsWith('at'));words.add(w.word);recent=[...recent,w.word].slice(-6);}
 assert.equal(at,600);assert.ok(words.size>=15);for(const word of ['cat','hat','mat','bat','rat','dog','sun','map'])assert.ok(words.has(word));
});
test('Visible-name practice is guided, preserves reading ability and counters across levels, and respects old questions',()=>{
 const p=freshProfile('explorer');mazeAction(p,{kind:'enter'});const q=mazeQuestion(p),level=p.maze.ability;
 assert.equal(q.type,'name');const bad=q.options.find(a=>a!==q.answer);
 mazeAction(p,{kind:'answer',questionId:q.id,answer:bad});assert.equal(p.maze.ability,level);
 mazeAction(p,{kind:'retry',questionId:q.id});const result=mazeAction(p,{kind:'answer',questionId:q.id,answer:q.answer});
 assert.equal(result.helped,true);assert.equal(p.maze.ability,level);assert.equal(p.maze.nameSerial,1);assert.equal(p.maze.practiceSerial,1);
 assert.throws(()=>mazeAction(p,{kind:'answer',questionId:q.id,answer:q.answer}));
 p.maze.done=true;mazeAction(p,{kind:'next'});assert.equal(p.maze.nameSerial,1);assert.equal(p.maze.practiceSerial,1);assert.equal(mazeQuestion(p).word,'cat');
 const b=mazeBoard(p),legacy={id:'legacy',type:'find',answer:'B',options:['A','B'],prompt:'Find B.'};p.maze.tasks[b.start]=legacy;
 assert.deepEqual(mazeQuestion(JSON.parse(JSON.stringify(p))),legacy);
});
