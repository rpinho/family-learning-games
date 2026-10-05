// The unified learner model (family-learner-2) and the chapter following it. Synthetic players and answers only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {compileProfile,itemFirsts,classify,bookEvidence,THRESHOLDS,PROFILE_SCHEMA} from '../learner-profile.mjs';
import {focusModel,applyLearnerPlan,learnerBrief,learnerFocusIssues,vowelLookAlikes} from '../learner-plan.mjs';
import {learnerProfileFor,readEvidence,readBook,profileFile,compileLearners} from '../learner-compile.mjs';
import {planChapter} from '../plan.mjs';
import {readingIssues} from '../lint.mjs';
import {checkBeats} from '../puzzle-check.mjs';
import {buildPrompt} from '../prompt.mjs';
import {bookPaths} from '../paths.mjs';
import {young,older,NOW,deployment} from './fixtures.mjs';
import {itemTags} from '../../hub/skill-items.mjs';
import {skillEvidence} from '../../hub/skill-evidence.mjs';

const H=36e5,DAY=864e5;
let seq=0;
// One first answer: {tags, ok, help} hours ago (each a new item unless `item` is given).
const ans=(player,tags,{ok=true,help=false,h=2,item,source='letter-quest',skill='reading',chose}={})=>({player,source,skill,at:NOW-h*H,item:item||`q${++seq}`,ok,help,tags,...(chose?{chose}:{})});
const many=(player,tags,n,ind,{h=2,miss=true,...o}={})=>Array.from({length:n},(_,i)=>ans(player,tags,{ok:i<ind||!miss,help:i>=ind&&!miss,h:h+i*0.1,...o}));

test('Only first answers count; a hint before the answer is help; other accounts are ignored',()=>{
 const ev=[ans('older',['vowel:i'],{item:'x',ok:false,h:5}),ans('older',['vowel:i'],{item:'x',ok:true,h:4}),
  {player:'older',at:NOW-3*H,item:'y',hint:true,tags:['vowel:i']},ans('older',['vowel:i'],{item:'y',ok:true,h:2}),
  ans('young',['vowel:i'],{item:'z',ok:true})];
 const f=itemFirsts(ev,'older',NOW);
 assert.deepEqual(f.map(x=>[x.ok,x.help]),[[false,false],[true,true]]);
});
test('Thresholds: thin data is never secure, too easy or too hard',()=>{
 assert.equal(classify({n:3,ind:1,help:0,miss:0}),'thin');
 assert.equal(classify({n:6,ind:.9,help:.1,miss:0}),'secure');
 assert.equal(classify({n:5,ind:.6,help:.2,miss:.2}),'edge');
 assert.equal(classify({n:3,ind:.33,help:0,miss:.67}),'struggle');
 assert.equal(classify({n:2,ind:0,help:0,miss:1}),'thin','two misses alone are not a struggle');
 assert.equal(classify({n:12,ind:1,help:0,miss:0}),'too-easy');
 assert.equal(classify({n:9,ind:.11,help:.2,miss:.7}),'too-hard');
 assert.equal(classify({n:7,ind:.1,help:0,miss:.9}),'struggle','too hard needs 8 answers');
});
test('Profile: strengths, edge, struggles with evidence, review, do-not, and a book plan from today\'s misses',()=>{
 const ev=[
  ...many('older',['letter:S'],8,8,{h:30}),                              // secure
  ...many('older',['vowel:a','pattern:cvc'],10,6,{h:26}),                 // edge
  ans('older',['word:pin','pattern:cvc','vowel:i','family:in'],{ok:false,chose:'pan',h:3}),
  ans('older',['word:tin','pattern:cvc','vowel:i','family:in'],{ok:false,chose:'ten',h:2}),
  ans('older',['word:big','pattern:cvc','vowel:i','family:ig'],{ok:true,h:1}),
  ans('older',['word:sit','pattern:cvc','vowel:i','family:it'],{ok:false,h:1.5}),
  ...many('older',['div:18/3','divisor:3','cookies:share'],5,3,{source:'number-park',skill:'muldiv',h:5}),
  ...many('older',['letter:T'],6,6,{h:10*24}),                            // secure, 10 days ago: review
  ...many('older',['chess:forks'],12,12,{source:'hub',skill:'chess',h:40}), // too easy
  ...many('older',['pattern:digraph'],9,1,{h:20}),                        // too hard
 ];
 const m=compileProfile({player:'older',now:NOW,evidence:ev,bookModel:older,focus:{age:8,context:{reading:1}},collection:{keys:['Q']}});
 assert.equal(m.schema,PROFILE_SCHEMA);
 assert.equal(m.level,'reader');
 const items=k=>m[k].map(x=>x.item);
 assert.ok(items('strengths').includes('letter:S'));
 assert.ok(items('edge').includes('vowel:a'));
 const vi=m.struggles.find(x=>x.item==='vowel:i');assert.ok(vi,'short i is a struggle');assert.equal(vi.n,4);assert.equal(vi.confidence,'low');
 assert.deepEqual(vi.recentMisses.map(x=>[x.word,x.chose??null]),[['pin','pan'],['tin','ten'],['sit',null]]);
 assert.ok(m.review.some(x=>x.item==='letter:T'&&x.daysSince>=10));
 assert.ok(m.review.some(x=>x.item==='letter:Q'&&x.daysSince==null),'a letter key from the book with no answers is due for review');
 assert.ok(m.doNot.tooEasy.some(x=>x.item==='chess:forks'));
 assert.ok(m.doNot.tooHard.some(x=>x.item==='pattern:digraph'));
 assert.equal(m.bookPlan.wordPatterns[0].vowel,'i','the short vowel he missed today leads');
 assert.deepEqual(m.bookPlan.wordPatterns[0].words.slice(0,3),['sit','tin','pin'],'his own missed words first (most missed, then most recent)');
 assert.deepEqual([m.bookPlan.mathFocus.kind,m.bookPlan.mathFocus.total,m.bookPlan.mathFocus.groups],['share',18,3]);
 assert.ok(m.evidence['vowel:i']&&m.evidence['vowel:i'].n===4);
 assert.equal(m.sources.firstAnswers,ev.length);
 assert.ok(/Accounts, not people/.test(m.notes[0]));
});
test('No evidence: an empty, honest profile and no plan',()=>{
 const m=compileProfile({player:'older',now:NOW,evidence:[],bookModel:older});
 assert.deepEqual([m.strengths,m.edge,m.struggles,m.bookPlan.wordPatterns],[[],[],[],[]]);
 assert.equal(m.bookPlan.mathFocus,null);assert.equal(m.bookPlan.letterFocus,null);
});
test('Old misses (over two weeks) do not steer the chapter',()=>{
 const m=compileProfile({player:'older',now:NOW,evidence:many('older',['vowel:o','pattern:cvc'],6,1,{h:20*24}),bookModel:older});
 assert.equal(m.bookPlan.wordPatterns.length,0);
});
test('Item tags: letters, short vowels, word patterns, maths facts and sharing, chess themes',()=>{
 assert.deepEqual(itemTags('word-arcade',{type:'action',input:{kind:'answer',answer:'tan'},after:{q:{game:'slalom',kind:'read-word',answer:'tin',options:['tin','tan']}}}),{tags:['word:tin','pattern:cvc','vowel:i','family:in'],chose:'tan'});
 assert.deepEqual(itemTags('letter-quest',{type:'maze_action',input:{answer:'u'},result:{question:{type:'gap',word:'bus',blank:1,answer:'u',options:['u','a']}}}).tags,['word:bus','pattern:cvc','vowel:u','family:us']);
 assert.deepEqual(itemTags('letter-quest',{type:'maze_action',result:{question:{type:'find',char:'b',options:['b','d']}}}).tags,['letter:B','lower:b']);
 assert.equal(itemTags('letter-quest',{type:'maze_action',result:{question:{type:'blend',word:'map',options:['map']}}}),null,'a modelled one-choice question is not a try');
 assert.deepEqual(itemTags('number-park',{after:{question:{kind:'cookies',mode:'bags',total:24,bagSize:6}}}).tags,['div:24/6','divisor:6','cookies:bags']);
 assert.deepEqual(itemTags('number-park',{after:{question:{kind:'multiply',a:7,b:3}}}).tags,['fact:3x7','table:3','table:7']);
 assert.deepEqual(itemTags('hub',{type:'chess',lesson:'forks-2'}).tags,['chess:forks']);
 assert.deepEqual(itemTags('word-arcade',{after:{q:{game:'builder',word:'frog'}}}).tags,['word:frog','pattern:blend','vowel:o']);
 assert.deepEqual(itemTags('word-arcade',{after:{q:{game:'builder',word:'ship'}}}).tags,['word:ship','pattern:digraph']);
 // Evidence keeps its tags; the miss carries what he chose.
 const e=skillEvidence('word-arcade',{type:'action',input:{kind:'answer',questionId:'1:0',answer:'tan'},after:{game:'slalom',run:1,q:{id:'1:0',type:'read-word',answer:'tin',options:['tin','tan']}},result:{ok:false}},NOW);
 assert.deepEqual([e[0].ok,e[0].tags.includes('vowel:i'),e[0].chose],[false,true,'tan']);
});
test('The Book\'s own beat results are evidence (first try right = independent; a hint = help)',()=>{
 const ev=bookEvidence({player:'older',progress:{days:{'2026-03-09':{startedAt:'2026-03-09T10:00:00Z',results:[{page:1,kind:'signs',misses:1},{page:2,kind:'share',misses:0,hints:1}],hunts:[{id:'r-sound-2026-03-09',foundAt:'2026-03-09T11:00:00Z'}]}}},
  chapters:{'2026-03-09':{pages:[{},{beat:{kind:'signs',target:'pin'}},{beat:{kind:'share',total:12,groups:3}}]}}});
 assert.deepEqual(ev.filter(e=>e.item).map(e=>[e.ok,e.help,e.tags[0]]),[[false,false,'word:pin'],[true,true,'div:12/3']]);
 assert.ok(ev.some(e=>e.ok===null&&e.tags[0]==='letter:R'),'a hunt is practice for review');
});

// ---------- the chapter follows it ----------
const learnerFor=(player,model,ev)=>compileProfile({player,now:NOW,evidence:ev,bookModel:model});
const shortI=()=>[ans('older',['word:pin','pattern:cvc','vowel:i','family:in'],{ok:false,chose:'pan',h:3}),ans('older',['word:tin','pattern:cvc','vowel:i','family:in'],{ok:false,h:2}),ans('older',['word:sit','pattern:cvc','vowel:i','family:it'],{ok:false,h:1})];
test('Reader: the signs he reads and the spell practise the short vowel he missed today, as decodable look-alikes',()=>{
 const L=learnerFor('older',older,shortI());
 for(const date of ['2026-03-10','2026-03-11','2026-03-12']){
  const plan=planChapter(focusModel(older,L),{date,profile:{sibling:'Ada'}});
  applyLearnerPlan(plan,L);
  const signs=plan.beats.find(b=>b.kind==='signs');
  assert.equal(signs.target[1],'i',date);
  assert.ok(signs.options.filter(o=>o!==signs.target).every(o=>o[0]===signs.target[0]&&o[2]===signs.target[2]),'the look-alikes differ only in the vowel');
  assert.deepEqual(readingIssues({pages:[]},plan),[],'still decodable');
  assert.ok(plan.learnerFocus.some(f=>f.kind==='signs'&&f.item==='vowel:i'));
  const spell=plan.beats.find(b=>b.kind==='spell');
  assert.ok(spell.answer.some(w=>w[1]==='i'&&w.length===3&&!['Max','Mom','Dad'].includes(w)),'the spell has a short-i word');
  assert.ok(buildPromptOK(plan));
 }
});
const buildPromptOK=plan=>/WHAT HE PRACTISES TODAY/.test(learnerBrief(plan))&&!/hard|struggl|missed/i.test(learnerBrief(plan).replace(/never call anything hard/,''));
test('Quest book: the number game at his edge replaces a puzzle; the planned numbers pass the number-game check',()=>{
 const L=learnerFor('older',older,[...shortI(),...many('older',['div:18/3','divisor:3'],5,3,{source:'number-park',skill:'muldiv',h:3})]);
 const plan=planChapter(focusModel(older,L),{date:'2026-03-10',profile:{sibling:'Ada',bookStyle:'quest'}});
 const before=plan.beats.map(b=>b.kind);
 applyLearnerPlan(plan,L);
 const share=plan.beats.find(b=>b.kind==='share');
 assert.ok(share&&share.total===18&&share.groups===3,'18 shared by 3');
 assert.equal(plan.beats.length,before.length);assert.deepEqual(checkBeats(plan.beats),[]);
 assert.ok(plan.learnerFocus.some(f=>f.kind==='share'&&f.value==='18/3'));
});
test('Early reader: his focus letter leads the letters the planner picks from; the stones practise it',()=>{
 const L=learnerFor('young',young,many('young',['letter:F'],5,1,{h:2}));
 assert.equal(L.bookPlan.letterFocus.letter,'F');
 const m=focusModel(young,L);assert.equal(m.literacy.learning[0],'F');assert.notEqual(m,young,'a copy');
 const cast={cast:[{id:'fox',name:'Fox',letter:'F',word:'fox'},{id:'bo',name:'Bo',letter:'B',word:'bear'}],children:{young:{fixed:['fox','bo']}}};
 const plan=planChapter(m,{date:'2026-03-10',profile:{sibling:'Robin'},cast});
 applyLearnerPlan(plan,L);
 assert.equal(plan.letter,'F');assert.ok(plan.learnerFocus.some(f=>f.value==='F'&&['stones','kick-letter'].includes(f.kind)));
});
test('No learner model, or a foreign one: the chapter is planned exactly as before',()=>{
 const a=planChapter(older,{date:'2026-03-10',profile:{sibling:'Ada'}}),b=planChapter(focusModel(older,null),{date:'2026-03-10',profile:{sibling:'Ada'}});
 assert.deepEqual(applyLearnerPlan(b,{schema:'other'}),[]);assert.deepEqual(b.learnerFocus,[]);delete b.learnerFocus;
 assert.deepEqual(a,b);assert.equal(learnerBrief(b),'');
});
test('Lint: the chapter must contain the planned focus items',()=>{
 const L=learnerFor('older',older,shortI());
 const plan=planChapter(focusModel(older,L),{date:'2026-03-10',profile:{sibling:'Ada'}});applyLearnerPlan(plan,L);
 const signs=plan.beats.find(b=>b.kind==='signs');
 const pages=plan.beats.map(b=>({beat:b.id}));
 assert.deepEqual(learnerFocusIssues({pages},plan),[]);
 assert.ok(learnerFocusIssues({pages:pages.filter(p=>p.beat!==signs.id)},plan).some(i=>/must include beat/.test(i)));
 signs.target='cat';assert.ok(learnerFocusIssues({pages},plan).some(i=>/no longer practises/.test(i)));
 const prompt=buildPrompt({...plan,learnerFocus:plan.learnerFocus},{library:{backgrounds:{},actors:{},props:{}}});
 assert.match(prompt,/WHAT HE PRACTISES TODAY/);
});
test('Vowel look-alikes differ only in the vowel when the word families have them',()=>{
 assert.deepEqual(vowelLookAlikes('pin',2,()=>0).sort(),['pan','pen']);
});

// ---------- compile: real files, read only, fail-soft ----------
test('Book replay keeps its latest view while the read-only compiler restores the first recorded attempt',async()=>{
 const {root,env}=await deployment(),paths=bookPaths(env),date='2026-03-09';
 const saved={days:{[date]:{results:[{page:1,at:'2026-03-09T11:00:00Z',correct:true,misses:0,hints:0}]}}};
 await mkdir(join(paths.data.hub,'book-progress'),{recursive:true});await mkdir(join(paths.book,'older'),{recursive:true});
 const file=join(paths.data.hub,'book-progress','older.json');await writeFile(file,JSON.stringify(saved));
 await writeFile(join(paths.book,'older',date+'.json'),JSON.stringify({pages:[{},{beat:{kind:'signs',target:'pin'}}]}));
 const rows=[{type:'book',action:'result',player:'older',date,page:1,at:'2026-03-09T10:00:00Z',correct:false,attempts:3},
  {type:'book',action:'result',player:'young',date,page:1,at:'2026-03-09T09:00:00Z',correct:true},
  {type:'book',action:'result',player:'older',date,page:1,at:'2026-03-09T11:00:00Z',correct:true,attempts:1}];
 await writeFile(join(paths.data.hub,'logs',date+'.jsonl'),rows.map(JSON.stringify).join('\n')+'\n');
 const read=await readBook(paths,'older');assert.equal(read.evidence[0].ok,false);
 assert.equal(read.evidence[0].at,Date.parse(rows[0].at));assert.equal(read.evidence[0].help,true,'old logs cannot establish independence');
 assert.equal(read.evidence[0].helpUnknown,true);
 assert.ok(compileProfile({player:'older',now:NOW,evidence:read.evidence,bookModel:older}).notes.some(n=>n.includes('unknown assistance')));
 assert.deepEqual(JSON.parse(await readFile(file,'utf8')),saved,'no save backfill or replay rewrite');
});
test('Compiler reads the games\' logs (with item tags) read-only and writes a private model; on failure keeps the last good one',async()=>{
 const {root,env}=await deployment();const paths=bookPaths(env);
 const lq=join(root,'data','letter-quest','logs','2026-03-10-000.jsonl');
 const rows=[['tin','tan'],['pin','pan'],['sit','sat']].map(([w,c],i)=>({at:new Date(NOW-(3-i)*H).toISOString(),player:'older',type:'maze_action',input:{kind:'answer',questionId:'m'+i,answer:c},result:{ok:false,question:{id:'m'+i,type:'read',word:w,answer:w,options:[w,c]}}}));
 rows.push({at:new Date(NOW-H).toISOString(),player:'young',type:'maze_action',input:{kind:'answer',questionId:'y1',answer:'b'},result:{ok:true,question:{id:'y1',type:'find',char:'B',options:['B','D']}}});
 await writeFile(lq,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 const before=await readFile(lq,'utf8');
 const ev=await readEvidence(paths,['older','young'],{now:NOW});
 assert.equal(ev.filter(e=>e.player==='older'&&e.tags?.includes('vowel:i')).length,3);
 const dir=join(root,'learner');
 const m=await learnerProfileFor('older',{paths,now:NOW,players:['older','young'],dir});
 assert.equal(m.schema,PROFILE_SCHEMA);assert.ok(m.struggles.some(s=>s.item==='vowel:i'));
 assert.equal((await stat(profileFile(dir,'older'))).mode&0o777,0o600);
 assert.equal(await readFile(lq,'utf8'),before,'logs are never changed');
 const logs=[];
 const kept=await learnerProfileFor('older',{paths,now:NOW,dir,compile:async()=>{throw Error('boom');},log:l=>logs.push(l)});
 assert.equal(kept.stale,true);assert.equal(kept.builtAt,m.builtAt);assert.match(logs[0],/keeping the last good one/);
 const none=await learnerProfileFor('nobody',{paths,now:NOW,dir,compile:async()=>{throw Error('boom');},log:()=>{}});
 assert.equal(none,null);
 const all=await compileLearners(['older','young'],{paths,now:NOW});
 assert.ok(all.young.edge.length+all.young.strengths.length+all.young.struggles.length===0,'one answer is not a judgement');
});

test('a stale remainder focus cannot reintroduce remainder questions without parent opt-in',()=>{
 const L=learnerFor('older',older,shortI());L.bookPlan.mathFocus={kind:'remainder',item:'remainder:17/4',total:17,groups:4,why:'old focus'};
 for(const bookStyle of ['quest','classic']){const plan=planChapter(older,{date:'2026-10-03',profile:{bookStyle}});const before=structuredClone(plan.beats);applyLearnerPlan(plan,L);assert.equal(plan.allowRemainders,false);assert.ok(!plan.beats.some(b=>b.kind==='remainder'));assert.equal(plan.beats.length,before.length);}
});
