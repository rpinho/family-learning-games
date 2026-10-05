import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addNote,listNotes,removeNote,markUsed,eligible,rankNotes,sensitivity,normalizeNote,unknownNames,dayNotesFor,dayNotesSection,dayNoteIssues,woven,checkSeed,EXPIRE_DAYS} from '../daynotes.mjs';
import {main as cli} from '../daynote.mjs';
import {buildPrompt} from '../prompt.mjs';
import {lintChapter} from '../lint.mjs';
import {templateChapter} from '../template.mjs';
import {generateOne,actorIdsFor} from '../generate.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {drawnBeats} from '../quest-beats.mjs';
import {COUNT_THINGS} from '../plan.mjs';
import {deployment,NOW,plans} from './fixtures.mjs';
// Synthetic children and notes only (Ada, Robin; a private name "Smithers").
const library=JSON.parse(await readFile(new URL('../../hub/public/book-art/library.json',import.meta.url),'utf8'));
const tmp=()=>mkdtemp(join(tmpdir(),'daynotes-'));
const T=Date.parse('2026-03-09T18:00:00Z'),KIDS=['young','older'];
const CART='we visited the pretend park, Robin built a paper castle, Ada drew a purple dragon';
const SLEEP='went to the doctor for a sleep study';

test('The store keeps notes private, per day, and validates them',async()=>{
 const dir=join(await tmp(),'daynotes');
 const a=await addNote(dir,{child:'older',text:'  Robin lost a tooth <b>  ',from:'mom',now:T,timeZone:'UTC',children:KIDS});
 assert.equal(a.text,'Robin lost a tooth b');assert.equal(a.child,'older');assert.equal(a.from,'mom');assert.equal(a.date,'2026-03-09');assert.match(a.id,/^20260309-/);
 const b=await addNote(dir,{child:'both',text:'a quiet day',now:T,timeZone:'UTC',children:KIDS,memory:true});assert.equal(b.from,'dad');assert.equal(b.memory,true);
 await assert.rejects(addNote(dir,{child:'nobody',text:'x',now:T,children:KIDS}),/Choose/);
 await assert.rejects(addNote(dir,{child:'both',text:'   ',now:T,children:KIDS}),/few words/);
 await assert.rejects(addNote(dir,{child:'both',text:'x',from:'stranger',now:T,children:KIDS}),/from/);
 assert.equal(((await stat(dir)).mode&0o777),0o700);assert.equal(((await stat(join(dir,'2026-03-09.json'))).mode&0o777),0o600);
 assert.deepEqual(await readdir(dir),['2026-03-09.json'],'no lock or temp files left behind');
 const stored=JSON.parse(await readFile(join(dir,'2026-03-09.json'),'utf8'));assert.equal(stored.schema,'family-book-daynotes-1');
 assert.deepEqual(Object.keys(stored.notes[0]).sort(),['at','child','from','id','text']);
 assert.equal((await listNotes(dir)).length,2);
 assert.equal(await removeNote(dir,a.id),true);assert.equal(await removeNote(dir,a.id),false);assert.equal(await removeNote(dir,'../../etc'),false);
 assert.deepEqual((await listNotes(dir)).map(n=>n.text),['a quiet day']);
 // concurrent writers (hub, CLI, nightly) do not lose notes
 await Promise.all(Array.from({length:12},(_,i)=>addNote(dir,{child:'young',text:'note '+i,now:T,timeZone:'UTC',children:KIDS})));
 assert.equal((await listNotes(dir)).length,13);
});

test('Eligible: about him or both, told, unused by him, and only for a few days',()=>{
 const n=(id,date,extra={})=>({id,date,at:date+'T10:00:00Z',child:'older',text:'t '+id,from:'dad',...extra});
 const notes=[n('a','2026-03-09'),n('b','2026-03-09',{child:'young'}),n('c','2026-03-09',{child:'both'}),n('d','2026-03-09',{memory:true}),
  n('e','2026-03-08',{used:{older:{chapter:'older/2026-03-09'}}}),n('f','2026-03-08',{used:{older:{chapter:'older/2026-03-10'}}}),
  n('g',`2026-03-0${10-EXPIRE_DAYS-1}`),n('h',`2026-03-0${10-EXPIRE_DAYS}`),n('i','2026-03-11'),n('j','2026-03-08',{child:'both',used:{young:{chapter:'young/2026-03-09'}}})];
 assert.deepEqual(eligible(notes,{player:'older',date:'2026-03-10'}).map(x=>x.id),['a','c','f','h','j'],'a rerun of the same chapter may reuse its note; a brother using a shared note does not use it up');
});

test('Sensitive notes are recognised; family and outings are not',()=>{
 const s=sensitivity(SLEEP);assert.equal(s.sensitive,true);assert.ok(s.kinds.includes('medical')&&s.kinds.includes('sleep'));assert.ok(s.words.includes('doctor')&&s.words.includes('sleep study'));
 assert.equal(sensitivity('Ada went to Smithers and loved it',{extra:['Smithers']}).sensitive,true,'a private name (a therapist, a teacher) is never told');
 for(const t of ['his OT session went well','the teacher said he was upset at circle','evaluation results came back','he had a fever','he couldn\'t sleep again','Grandma visited'])assert.equal(sensitivity(t).sensitive,true,t);
 for(const t of [CART,'Robin lost a tooth','Ada went to the shop and loved it','Robin took shots at the goal with Dad'])assert.equal(sensitivity(t).sensitive,false,t);
 const brand=sensitivity('we saw a Tesla on the way home');assert.equal(brand.sensitive,false);assert.deepEqual(brand.brands,['Tesla']);
 assert.equal(normalizeNote('River biked along with Alex',[{id:'mom',name:'Mom',realNames:['River']},{id:'dad',name:'Dad',realNames:['Alex']}]),'Mom biked along with Dad');
 assert.deepEqual(unknownNames('Robin and Rook went to Pinewood. Then Mom came.',['Robin']),['Rook','Pinewood']);
});

test('The most chapter-worthy note leads; a sensitive one never does',()=>{
 const d='2026-03-09',n=(id,child,text,at='10')=>({id,date:d,at:`${d}T${at}:00:00Z`,child,text,from:'dad'});
 const r=rankNotes([n('1','both','a quiet morning'),n('2','older','Robin lost a tooth at lunch and was so proud','11'),n('3','older',SLEEP,'12'),n('4','both',CART,'09')],{player:'older',date:'2026-03-10'});
 assert.deepEqual(r.map(x=>x.note.id),['2','4','1','3']);assert.equal(r.at(-1).sensitive,true);
});

test('dayNotesFor: a real thread, a softened moment, and forbidden words',async()=>{
 const dir=join(await tmp(),'daynotes');
 await addNote(dir,{child:'both',text:CART,now:T,timeZone:'UTC',children:KIDS});
 await addNote(dir,{child:'older',text:SLEEP+' with Smithers',now:T,timeZone:'UTC',children:KIDS});
 const asked=[];const ask=async(prompt,{system})=>{asked.push({prompt,system});return {text:'{"seed":"a brave night adventure: Robin camps in a new tent with Dad close by and wakes up proud"}',source:'fake'};};
 const d=await dayNotesFor('older',{dir,date:'2026-03-10',name:'Robin',extra:['Smithers'],known:['Ada'],ask});
 assert.equal(d.thread.text,CART);assert.equal(d.thread.when,'yesterday');assert.equal(d.thread.kind,'real');
 // the second literal slot is empty, so the softened note is the moment
 assert.equal(d.moment.kind,'allegory');assert.match(d.moment.seed,/tent/);assert.ok(!('text' in d.moment),'a sensitive note is never carried as written');
 assert.equal(asked.length,1);assert.match(asked[0].system,/never copy facts/i);
 for(const w of ['doctor','sleep study','Smithers'])assert.ok(d.forbid.includes(w),w);
 // cached: the next night does not ask again
 const again=await dayNotesFor('older',{dir,date:'2026-03-10',name:'Robin',extra:['Smithers'],known:['Ada'],ask:async()=>assert.fail('asked twice')});assert.equal(again.moment.seed,d.moment.seed);
 // an unsafe seed is refused and remembered as skipped
 const dir2=join(await tmp(),'daynotes');await addNote(dir2,{child:'older',text:SLEEP,now:T,timeZone:'UTC',children:KIDS});
 const none=await dayNotesFor('older',{dir:dir2,date:'2026-03-10',name:'Robin',ask:async()=>({text:'{"seed":"Robin visits the kind doctor for his sleep study"}'})});
 assert.equal(none.thread,null);assert.equal(none.moment,null);assert.ok(none.forbid.includes('doctor'));
 assert.ok((await listNotes(dir2))[0].soft.older.skip);
 assert.equal(checkSeed('a gentle sleepover in a cozy tent'),'a gentle sleepover in a cozy tent');
 assert.equal(await dayNotesFor('older',{dir:join(await tmp(),'none'),date:'2026-03-10',name:'Robin'}),null);
});

const ready=p=>{drawnBeats(p,library,{countThings:COUNT_THINGS});const ids=actorIdsFor(p,library);p.actorIds=ids;return {library,actors:ids.all};};
test('The brief tells the real day warmly, and a sensitive note only as allegory',()=>{
 const p=plans(['2026-03-10'])[1];ready(p);
 p.daynotes={thread:{id:'x',text:CART,from:'dad',child:'both',when:'yesterday',kind:'real'},moment:{id:'y',seed:'a brave night adventure in a new tent',kind:'allegory',when:'yesterday'},forbid:['doctor','sleep study']};
 const b=buildPrompt(p,{library,actors:p.actorIds.all});
 assert.match(b,/FROM HIS REAL DAY \(Dad told the Book this happened yesterday/);assert.ok(b.includes(`"${CART}"`));
 assert.match(b,/real event/);assert.match(b,/never says "I"/);assert.match(b,/Never compare or rank the brothers/);assert.match(b,/His brother Ada/);
 assert.match(b,/GENTLE MOMENT FROM HIS WEEK \(allegory only/);assert.ok(b.includes('a brave night adventure in a new tent'));
 assert.doesNotMatch(b,/sleep study|doctor for/);
 assert.ok(b.indexOf('FROM HIS REAL DAY')<b.indexOf('WHAT HAPPENED YESTERDAY'));
 p.daynotes={thread:{id:'x',text:'Robin lost a tooth',from:'mom',child:'older',when:'today',kind:'real'},moment:null,forbid:[]};
 const c=buildPrompt(p,{library,actors:p.actorIds.all});assert.match(c,/Mom told the Book/);assert.doesNotMatch(c,/brothers/);
 delete p.daynotes;assert.doesNotMatch(buildPrompt(p,{library,actors:p.actorIds.all}),/FROM HIS REAL DAY/);
});

test('Lint: no comparing the brothers in their shared day; forbidden words are private words',()=>{
 const p=plans(['2026-03-10'])[1];const o=ready(p);const good=templateChapter(p,library);
 p.daynotes={thread:{id:'x',text:CART,from:'dad',child:'both',when:'yesterday',kind:'real'},forbid:[]};
 assert.deepEqual(dayNoteIssues(good,p),[]);
 const cmp={...good,pages:good.pages.map((x,i)=>i===0?{...x,say:[...x.say,['narrator','You biked faster than your brother Ada!']]}:x)};
 assert.ok(dayNoteIssues(cmp,p).some(i=>/never compare the brothers/.test(i)));
 assert.ok(lintChapter(cmp,p,{...o,speakers:null}).some(i=>/never compare the brothers/.test(i)));
 const leak={...good,pages:good.pages.map((x,i)=>i===0?{...x,say:[...x.say,['narrator','Off to the sleep study!']]}:x)};
 assert.ok(lintChapter(leak,p,{...o,extra:['sleep study'],speakers:null}).some(i=>/private word: "sleep study"/.test(i)));
});

test('Only notes the chapter really wove in are used up',async()=>{
 const p={name:'Robin',sibling:'Ada',daynotes:{thread:{id:'20260309-aaaaaa',text:CART,kind:'real'},moment:{id:'20260309-bbbbbb',text:'Robin found a frog by the pond',kind:'real'}}};
 assert.deepEqual(woven({pages:[{say:[['narrator','You built a paper castle at the pretend park!']]}]},p),['20260309-aaaaaa']);
 assert.deepEqual(woven({pages:[{say:[['narrator','A lighthouse above the clouds.']]}]},p),[]);
 const dir=join(await tmp(),'daynotes');const a=await addNote(dir,{child:'both',text:CART,now:T,timeZone:'UTC',children:KIDS});
 await markUsed(dir,[a.id],'older','older/2026-03-10',T);
 const [n]=await listNotes(dir);assert.equal(n.used.older.chapter,'older/2026-03-10');
 assert.equal(eligible([n],{player:'older',date:'2026-03-11'}).length,0);assert.equal(eligible([n],{player:'young',date:'2026-03-10'}).length,1);
});

test('Nightly: the note reaches the brief (sensitive words never do), and a template chapter uses nothing up',async()=>{
 const {root,env}=await deployment();const paths=bookPaths(env),profiles=readProfiles(paths),dir=join(root,'book','daynotes');
 await addNote(dir,{child:'both',text:CART,now:T,timeZone:'UTC',children:KIDS});
 await addNote(dir,{child:'older',text:SLEEP,now:T+60000,timeZone:'UTC',children:KIDS});
 await addNote(dir,{child:'older',text:'Robin said Smithers is his best friend',now:T+120000,timeZone:'UTC',children:KIDS,memory:true});
 const prompts=[],logs=[];
 const ask=async(prompt)=>{prompts.push(prompt);return prompt.includes('ONE gentle story seed')?{text:'{"seed":"Robin camps in a cozy tent with Dad close by and wakes up proud"}',source:'fake'}:null;};
 const r=await generateOne('older',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:m=>logs.push(m),ask});
 const brief=prompts.find(p=>p.includes('Nightly Book inputs'));assert.ok(brief,'the chapter brief was asked for');
 assert.ok(brief.includes(CART));assert.ok(brief.includes('cozy tent'));
 for(const w of ['sleep study','doctor','Smithers'])assert.ok(!brief.includes(w),w);
 assert.match(r.source,/deterministic quest fallback/);assert.equal(r.chapter.meta.daynotes,undefined);
 assert.ok(logs.some(l=>/day notes woven in: none/.test(l)));
 assert.ok((await listNotes(dir)).every(n=>!n.used),'nothing was used up by a template chapter');
});

test('CLI: add and list from a Claude session land in the same store',async()=>{
 const {root,env}=await deployment();const out=[];const print=s=>out.push(s);
 assert.equal(await cli(['add','--child','older','Robin','built','a','raft'],{env,now:T,print}),0);
 assert.equal(await cli(['add','--child','young','--from','mom','--memory','a private memory'],{env,now:T,print}),0);
 assert.equal(await cli(['add','--child','nobody','x'],{env,now:T,print:()=>{}}).catch(e=>e.message).then(x=>typeof x==='string'),true);
 out.length=0;assert.equal(await cli(['list'],{env,now:T,print}),0);
 assert.equal(out.length,2);assert.match(out[0],/older\s+claude\s+\[waiting\]\s+Robin built a raft/);assert.match(out[1],/memory only/);
 const notes=await listNotes(join(root,'book','daynotes'));assert.equal(notes[0].from,'claude');
 out.length=0;await cli(['list','--json'],{env,now:T,print});assert.equal(JSON.parse(out[0]).length,2);
 assert.equal(await cli(['remove',notes[0].id],{env,now:T,print}),0);assert.equal((await listNotes(join(root,'book','daynotes'))).length,1);
});

test('A day note never makes the chapter worse: a failed chapter is written once more without it',async()=>{
 const {withDayNotes}=await import('../daynotes.mjs');
 const plan={player:'older',date:'2026-03-10',daynotes:{thread:{id:'x',text:'t',kind:'real'},forbid:['Rook']}};const seen=[];
 const write=async(p,o)=>{seen.push({notes:!!p.daynotes,extra:o.extra});return p.daynotes?{story:'T',source:'template (model chapter failed lint)',lint:['x']}:{story:'M',source:'fake'};};
 const r=await withDayNotes(write)(plan,{extra:['Smithers','Rook']});
 assert.equal(r.story,'M');assert.match(r.source,/without the day note/);assert.equal(plan.daynotes,undefined,'nothing is marked used');
 assert.deepEqual(seen,[{notes:true,extra:['Smithers','Rook']},{notes:false,extra:['Smithers']}]);
 const ok=await withDayNotes(async()=>({story:'A',source:'fake'}))({...plan,daynotes:{forbid:[]}},{extra:[]});assert.equal(ok.source,'fake');
 const p2={player:'older',date:'2026-03-10',daynotes:{forbid:[]}};const both=await withDayNotes(async()=>({story:'T',source:'template (model chapter failed lint)'}))(p2,{extra:[]});
 assert.match(both.source,/^template/);assert.ok(p2.daynotes,'both failed: the plan keeps its notes (nothing woven, still eligible)');
});
