import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,nextChallenge,applyAttempt,expectedAnswer} from '../public/engine.mjs';
import {lessonRecap,lessonBerries,recapVoiceLines,feedLine} from '../public/recap.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
const answer=(p,c)=>applyAttempt(p,c,c.type==='trace'?{strokes:c.paths,durationMs:4000,helped:false}:{answer:expectedAnswer(c),durationMs:4000,helped:false});
test('a finished lesson gets one short spoken recap line, and Bo only ever gains berries',()=>{
 const voiced=new Set(allVoiceLines());
 for(const line of recapVoiceLines())assert.ok(voiced.has(line),line);
 const p=freshProfile('beginner');let lesson=false,before=0,spots=0;
 for(let i=0;i<40&&!lesson;i++){
  const c=nextChallenge(p);if(c.spot)spots++;
  if(i===1){applyAttempt(p,c,{answer:'?',durationMs:4000,helped:false});assert.equal(lessonBerries(p),before,'a wrong answer never takes berries');continue;}
  lesson=answer(p,c).lesson;
  if(!lesson){const now=lessonBerries(p);assert.ok(now>before);before=now;}
 }
 assert.ok(lesson);const r=lessonRecap(p);
 assert.equal(r.lines.length,2);assert.ok(voiced.has(r.lines[0]));assert.ok(voiced.has(r.lines[1]));
 assert.ok(r.lines[0].split(' ').length<=10);assert.equal(r.lines[1],feedLine(r.treats));
 assert.ok(r.treats>=5);assert.ok(r.letters.length+r.words.length>=1);
 assert.equal(p.history.filter(h=>h.spot).length>0,spots>0,'grid finds are marked so they feed three berries');
});
test('Explorer gets the recap sentence but no bear; words are listed',()=>{
 const p=freshProfile('explorer');
 p.history=['cat','hat','mat','sat','bat'].map(w=>({key:'gap:'+w,word:w,ok:true}));
 const r=lessonRecap(p);assert.deepEqual(r.lines,['You made 5 words.']);assert.deepEqual(r.words,['cat','hat','mat','sat','bat']);assert.equal(r.treats,0);
 const d=freshProfile('beginner');d.history=[{key:'find:D',ok:true,spot:true},{key:'find:B',ok:false},{key:'trace:D',ok:true},{key:'find:M',ok:true},{key:'trace:A',ok:true},{key:'name',word:'Beginner',ok:true}];
 assert.deepEqual(lessonRecap(d).lines,['You found 2 letters, traced 2 and made 1 word.','Bo ate 7 berries!']);
});
test('every browser module imported by the app is on the server allowlist',async()=>{
 const {readFileSync}=await import('node:fs');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),seen=new Set(),queue=['app.mjs'];
 while(queue.length){const file=queue.pop();if(seen.has(file))continue;seen.add(file);
  const text=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
  for(const [,dep] of text.matchAll(/from\s*'\.\/([\w-]+\.mjs)'/g))queue.push(dep);}
 for(const file of seen)assert.ok(server.includes(`'${file}'`),file+' is imported by the browser but not served');
});
