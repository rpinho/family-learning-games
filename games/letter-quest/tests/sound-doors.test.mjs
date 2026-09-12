import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile} from '../public/engine.mjs';
import {mazeAction,mazeQuestion,mazeState,mazeBoard} from '../public/maze.mjs';
import {mazeSkillState,recordMazeSkill} from '../public/maze-skills.mjs';
import {BLEND_WORDS,PHONEMES,soundLine} from '../public/phonics.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
test('Sound doors require each stone, survive reload, count as guided and schedule later reading',()=>{
 let p=freshProfile('explorer');mazeAction(p,{kind:'enter'});p.maze.practiceSerial=4;p.maze.tasks={};const q=mazeQuestion(p);
 assert.equal(q.type,'blend');assert.equal(q.word,'cat');const answer={kind:'answer',questionId:q.id,answer:q.answer};
 assert.throws(()=>mazeAction(p,answer));assert.throws(()=>mazeAction(p,{kind:'sound',questionId:q.id,index:4}));
 for(const index of [0,0,1])mazeAction(p,{kind:'sound',questionId:q.id,index});
 p=JSON.parse(JSON.stringify(p));assert.throws(()=>mazeAction(p,answer));mazeAction(p,{kind:'sound',questionId:q.id,index:2});
 const result=mazeAction(p,answer);assert.equal(result.helped,true);assert.equal(result.xp,6);assert.equal(result.adaptation,null);assert.equal(p.maze.practiceSkills,undefined);
 assert.throws(()=>mazeAction(p,answer));assert.deepEqual(p.maze.blendReviews,[{word:'cat',due:8}]);
 p.maze.done=true;mazeAction(p,{kind:'next'});assert.equal(p.maze.blendSerial,1);assert.equal(p.maze.blendReviews[0].word,'cat');
 p.maze.practiceSerial=7;assert.notEqual(mazeQuestion(p).type,'read');p.maze.practiceSerial=8;
 const check=mazeQuestion(p);assert.equal(check.type,'read');assert.equal(check.word,'cat');assert.ok(!check.prompt.includes('cat'));assert.ok(check.options.every(x=>check.pictures[x]));
 mazeAction(p,{kind:'answer',questionId:check.id,answer:check.answer});assert.equal(p.maze.practiceSkills.reading.recent.length,1);assert.equal(p.maze.blendReviews[0].due,21);
});
test('A full recall queue does not crowd out missing letters, ordinary words or names',()=>{
 const p=freshProfile();mazeAction(p,{kind:'enter'});p.maze.tasks={};p.maze.blendReviews=BLEND_WORDS.map(word=>({word,due:0}));const counts={};
 for(let serial=0;serial<120;serial++){p.maze.practiceSerial=serial;const type=mazeQuestion(p).type;counts[type]=(counts[type]||0)+1;}
 assert.deepEqual(counts,{name:40,gap:20,word:10,blend:20,find:20,read:10});
});
test('Skills use eight first attempts, stay separate, persist through mazes and ignore guided sound/name work',()=>{
 const s={ability:2};let n=0;
 const record=(type,ok,helped=false)=>recordMazeSkill(s,{id:String(++n),type},ok,helped);
 record('gap',false);assert.equal(mazeSkillState(s,'gaps').level,2);
 for(let i=0;i<7;i++)record('gap',false);assert.equal(mazeSkillState(s,'gaps').level,1);
 assert.equal(mazeSkillState(s,'reading').level,2);assert.equal(mazeSkillState(s,'letters').level,2);
 for(let i=0;i<8;i++)record('find',true);assert.equal(mazeSkillState(s,'letters').level,3);assert.equal(mazeSkillState(s,'reading').level,2);
 const before=JSON.stringify(s);assert.equal(recordMazeSkill(s,{id:String(n),type:'find'},false,true),null);assert.equal(JSON.stringify(s),before);
 for(let i=0;i<8;i++){record('name',true,true);record('blend',true,true);}assert.equal(JSON.stringify(s),before);
 const p=freshProfile('explorer');p.maze={...mazeState(p),...s,done:true};mazeAction(p,{kind:'next'});assert.equal(p.maze.practiceSkills.letters.level,3);assert.equal(p.maze.practiceSkills.gaps.level,1);
 p.maze.practiceSerial=5;assert.equal(mazeQuestion(p).level,3);p.maze.practiceSerial=1;assert.equal(mazeQuestion(p).level,1);
});
test('All blend words have known sounds, pictures, and complete voice keys; old gates remain identical',()=>{
 const lines=new Set(allVoiceLines());for(const word of BLEND_WORDS)for(const c of word){assert.ok(PHONEMES[c]);assert.ok(lines.has(soundLine(c)));}
 const p=freshProfile();mazeAction(p,{kind:'enter'});const b=mazeBoard(p),legacy={id:'legacy',type:'gap',level:2,word:'hat',blank:0,answer:'h',options:['h','b'],prompt:'Old question'};p.maze.tasks[b.start]=legacy;
 assert.deepEqual(mazeQuestion(p),legacy);mazeAction(p,{kind:'answer',questionId:legacy.id,answer:'h'});assert.equal(p.maze.practiceSkills.gaps.recent.length,1);
});
