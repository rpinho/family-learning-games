import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir,mkdtemp} from 'node:fs/promises';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {wordBreakItem,wordBreakLines,literacyFrom} from '../public/word-break.mjs';
import {freshProfile} from '../public/engine.mjs';
import {readingAction,readingQuestion} from '../public/reading.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
// The word-break module is shared; every game repo keeps an identical copy.
test('Shared word-break copy matches its siblings and every prompt is voiced',async()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex'),mine=hash(await readFile(new URL('../public/word-break.mjs',import.meta.url)));
 for(const path of ['../../target-trail/dist/word-break.mjs','../../three-in-a-row/dist/word-break.mjs','../../maze-garden/public/word-break.mjs','../../word-arcade/lib/word-break.mjs','../../number-park/lib/word-break.mjs']){let other;try{other=await readFile(new URL(path,import.meta.url));}catch{continue;}assert.equal(hash(other),mine,path);}
 const voiced=new Set(allVoiceLines());for(const line of wordBreakLines())assert.ok(voiced.has(line),line);
 for(const track of ['letters','words'])for(let i=0;i<200;i++){const q=wordBreakItem(literacyFrom({completed:40},track));assert.ok(voiced.has(q.spoken),q.spoken);}
});
const start=(level,run)=>{const p=freshProfile('explorer');p.reading={run,step:0,phase:'lobby',focus:'sentence',skills:{sentence:{level}},question:null,help:[],mistakes:0,results:[],history:[],draft:[],ink:[]};readingAction(p,{kind:'start',focus:'sentence',replace:true});return p;};
test('Sentence studio tiles give no position cues',()=>{
 let names=0,total=0,extras=0;
 for(let level=1;level<=3;level++)for(let run=0;run<36;run++){
  const p=start(level,run),q=p.reading.question,words=q.answer.split(' ');total++;
  assert.equal(q.type,'sentence');assert.equal(q.slots,words.length);assert.ok(q.tiles.every(t=>!/[.?!,]/.test(t)),'no punctuation tile marks the end');
  assert.ok(words.every(w=>q.tiles.includes(w)));assert.ok(q.tiles.slice(0,words.length).filter((w,i)=>w===words[i]).length<=1);
  for(let k=1;k<words.length;k++)assert.notDeepEqual(q.tiles,[...words.slice(k),...words.slice(0,k)]);
  assert.ok(!['said','asked'].includes(words.at(-2)));assert.ok(words.filter(w=>/^[A-Z]/.test(w)).length>=1);
  if(/^[A-Z]/.test(words.at(-1))&&words.at(-1)!=='I')names++;
  if(q.tiles.length>words.length){extras++;assert.ok(level>=2);}
  assert.match(q.mark,/^[.?!]$/);assert.deepEqual(readingQuestion({...p,reading:{...p.reading,question:null}}).tiles,q.tiles,'deterministic');
  // Build it: the extra tile is left over and the sentence is correct.
  const used=[],draft=words.map(w=>{const i=q.tiles.findIndex((x,j)=>x===w&&!used.includes(j));used.push(i);return i;});readingAction(p,{kind:'draft',questionId:q.id,draft});
  if(q.tiles.length>words.length)assert.throws(()=>readingAction(p,{kind:'draft',questionId:q.id,draft:[...q.tiles.keys()].slice(0,words.length+1)}));
  assert.equal(readingAction(p,{kind:'answer',questionId:q.id,durationMs:4000}).ok,true);
 }
 assert.ok(names/total<.35,'names are not usually last');assert.ok(extras>=12,'look-alike extra tile from level 2');
});
test('A sentence question saved before the change keeps its original tiles and still grades',()=>{
 const p=start(1,1),old={id:p.reading.question.id,type:'sentence',level:1,sentence:'The cat can nap.',answer:'The cat can nap.',tiles:['nap.','The','can','cat'],prompt:'Listen to the sentence. Put its words in order.',listenLine:'The cat can nap.',helpLine:'The cat can nap.'};
 p.reading.question=structuredClone(old);p.reading.draft=[];
 readingAction(p,{kind:'draft',questionId:old.id,draft:[1,3,2,0]});assert.deepEqual(p.reading.question.tiles,old.tiles);
 assert.equal(readingAction(p,{kind:'answer',questionId:old.id,durationMs:3000}).ok,true);
});
test('Breaks sit at rescue, story and shootout pauses and use this save for the level',async()=>{
 const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 for(const reason of ['rescue-finish','rescue-mid','rescue-between','story-finish','soccer-half-time','soccer-full-time'])assert.ok(app.includes(`'${reason}'`),reason);
 assert.match(app,/literacyFrom\(profile,DEFAULT_TRACK\[who\]/);assert.match(app,/isResting\(\)\|\|key&&brokeAt\.has\(key\)/,'never during the wind-down, once per pause');
 const beginner=literacyFrom({completed:17},'letters');assert.deepEqual(beginner.letters,[...'FRANCISOETL']);
});
test('Every module the browser imports is on the served allow-list',async()=>{
 const dir=new URL('../public/',import.meta.url),names=(await readdir(dir)).filter(f=>f.endsWith('.mjs')),wanted=new Set();
 for(const f of names){const src=await readFile(new URL(f,dir),'utf8');for(const m of src.matchAll(/from '\.\/([\w-]+\.mjs)'/g))wanted.add(m[1]);}
 assert.ok(wanted.has('word-break.mjs'));
 const data=await mkdtemp(join(tmpdir(),'lq-wb-')),port=14391;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',LETTER_QUEST_DATA:data},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
  for(const f of wanted)assert.equal((await fetch(`http://127.0.0.1:${port}/${f}`)).status,200,f);}
 finally{child.kill();}
});
test('Sound rule: content always speaks; instructions once per session and obey sound; praise obeys sound',async()=>{
 const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8'),fn=name=>app.match(new RegExp('function '+name+'\\([^)]*\\)\\{[^\\n]*'))[0];
 assert.doesNotMatch(fn('speak'),/settings\.sound/,'content is never muted');
 for(const name of ['instruct','narrate','praise','chime'])assert.match(fn(name),/settings\.sound/,name);
 assert.match(fn('instruct'),/firstTime\(text\)/);assert.match(fn('firstTime'),/sessionStorage/);
 assert.match(app,/if\(\['decode','act','story'\]\.includes\(q\.type\)\)instruct\(q\.prompt\);else speak/);
 assert.match(app,/instruct\(STORY_LINES\.move\)/);assert.match(app,/else instruct\(rescueMessage\)/);assert.match(app,/else instruct\(soccerMessage\)/);
 assert.match(app,/else if\(data\.result\.line\)instruct\(data\.result\.line\)/,'maze intro is an instruction');
 assert.match(app,/c\.repeated=true;coachVoice\.instruction\(c\.text\)/,'one gentle idle repeat of content');
 assert.match(app,/speak:\(line,manual\)=>\{if\(manual\|\|!WORD_BREAK_FEEDBACK\.includes\(line\)\|\|/,'word-break prompts ignore the sound setting');
});
