import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localDate,noteTarget,cleanNote,shouldOpen,AUTO_OPENS} from '../book-service.mjs';
import {isWrongToken,lastPlace,rememberPlace,bare} from '../public/book.mjs';
import {howItWent,itemLine} from '../public/bedtime.mjs';

const today=localDate(Date.now());
const chapter=player=>({schema:'family-book-chapter-1',player,name:'Beginner',date:today,number:1,title:'A Test Day',cover:"Beginner's Book. Chapter 1. A Test Day.",companion:{name:'Bo',emoji:'🐻'},level:'early',
 pages:[{id:'p1',kind:'story',text:'Hello.',lines:['Hello.'],scene:'🐻'},{id:'p2',kind:'challenge',text:'Find it.',lines:['Find it.'],practises:'the letter B',item:{kind:'find-letter',spoken:'Find the letter B.',answer:'B',options:['B','D','P']}},
  {id:'p3',kind:'mistake',text:'Bus starts with D.',lines:['Bus starts with D.'],mistake:{kind:'letter',claim:'Bus starts with D.',wrong:'D',right:'B',tokens:['🚌','bus','starts with','D'],hint:'Listen.',caught:'You caught me!',fix:{kind:'first-letter',spoken:'Which letter does bus start with?',answer:'B',options:['B','D','P']}}},{id:'p4',kind:'story',text:'The end.',lines:['The end.']}],
 summary:'s',hook:'h',bedtimeQuestion:'q?',voice:{clips:{'Hello.':'0123456789abcdef.wav'}}});
async function hub(){
 const data=await mkdtemp(join(tmpdir(),'family-hub-book-')),book=join(data,'..',data.split('/').pop()+'-book');
 await mkdir(join(book,'beginner'),{recursive:true});await mkdir(join(book,'voice'),{recursive:true});
 await writeFile(join(book,'beginner',today+'.json'),JSON.stringify(chapter('beginner')));
 await writeFile(join(book,'voice','0123456789abcdef.wav'),'RIFFfake');
 await mkdir(join(book,'cast'),{recursive:true});await writeFile(join(book,'cast','owl.jpg'),'JFIFfake');
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,FAMILY_CONFIG:'',FAMILY_DATA:data,FAMILY_BOOK:book,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 const out=await new Promise((resolve,reject)=>{child.stdout.once('data',x=>resolve(String(x)));child.once('exit',c=>reject(Error('exit '+c)));});
 return {data,book,child,base:'http://127.0.0.1:'+out.match(/localhost:(\d+)/)[1]};
}
const post=(base,path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('The hub carries an identical copy of the shared word-break module',async()=>{
 assert.equal(await readFile(new URL('../public/word-break.mjs',import.meta.url),'utf8'),await readFile(new URL('../../games/letter-quest/public/word-break.mjs',import.meta.url),'utf8'));
});
test('Today’s chapter opens by itself until finished, and never more than a few times a day',async()=>{
 const {base,child,data}=await hub();
 try{
  assert.deepEqual((await readdir(data)).sort(),['logs'],'reading the book writes nothing');
  let b=await(await fetch(base+'/api/book?player=beginner')).json();
  assert.equal(b.open,true);assert.equal(b.chapter.title,'A Test Day');assert.equal(b.date,today);
  assert.equal((await(await fetch(base+'/api/book?player=explorer')).json()).chapter,null,'no chapter, no book');
  assert.equal((await(await fetch(base+'/api/book?player=admin')).json()).open,false);
  assert.equal((await fetch(base+'/api/book?player=nobody')).status,400);
  assert.equal((await post(base,'/api/book?player=beginner',{type:'page',date:'2000-01-01',page:1})).status,409,'stale pages cannot write');
  assert.equal((await post(base,'/api/book?player=beginner',{type:'hack',date:today})).status,400);
  for(let i=0;i<AUTO_OPENS;i++)assert.equal((await post(base,'/api/book?player=beginner',{type:'open',date:today,page:0})).status,200);
  b=await(await fetch(base+'/api/book?player=beginner')).json();
  assert.equal(b.open,false,'after 3 unfinished opens the book waits for tomorrow');assert.equal(b.progress.opens,AUTO_OPENS);
  await post(base,'/api/book?player=beginner',{type:'page',date:today,page:2});
  await post(base,'/api/book?player=beginner',{type:'result',date:today,page:2,result:{kind:'mistake',misses:1,hints:0,ms:5000}});
  const done=await(await post(base,'/api/book?player=beginner',{type:'finish',date:today,page:4})).json();
  assert.equal(done.progress.finished,true);assert.equal(done.progress.results[0].misses,1);
  const saved=JSON.parse(await readFile(join(data,'book-progress','beginner.json'),'utf8'));assert.equal(saved.days[today].finished,true);
  const wav=await fetch(base+'/book-voice/0123456789abcdef.wav');assert.equal(wav.status,200);assert.equal(wav.headers.get('content-type'),'audio/wav');
  assert.equal((await fetch(base+'/book-voice/..%2Fbeginner.wav')).status,404);
  assert.equal((await fetch(base+'/book-voice/ffffffffffffffff.wav')).status,404);
  const face=await fetch(base+'/book-cast/owl.jpg');assert.equal(face.status,200);assert.equal(face.headers.get('content-type'),'image/jpeg');
  assert.equal((await fetch(base+'/book-cast/..%2Fprofiles.json')).status,404);assert.equal((await fetch(base+'/book-cast/nobody.jpg')).status,404);
  for(const f of ['/book.mjs','/word-break.mjs','/bedtime.html','/bedtime.mjs'])assert.equal((await fetch(base+f)).status,200,f);
  const html=await(await fetch(base+'/')).text();assert.match(html,/id="book-note"/);assert.match(html,/bedtime\.html/);
 }finally{child.kill();}
});
test('Grown-ups’ "Today" notes: saved, attributed by first name, removable, and on the bedtime page',async()=>{
 const {base,child,data}=await hub();
 try{
  assert.equal((await post(base,'/api/book/notes',{text:'   '})).status,400);
  let r=await(await post(base,'/api/book/notes',{text:'Beginner scored a goal <b>'})).json();
  assert.equal(r.notes.length,1);assert.equal(r.notes[0].player,'beginner');assert.equal(r.notes[0].text,'Beginner scored a goal b');
  r=await(await post(base,'/api/book/notes',{text:'we built the robot track'})).json();assert.equal(r.notes[1].player,null);
  const stored=JSON.parse(await readFile(join(data,'book-notes.json'),'utf8'));assert.equal(stored.notes.length,2);
  const bed=await(await fetch(base+'/api/book/bedtime')).json();
  const kid=bed.kids.find(k=>k.player==='beginner');assert.equal(kid.chapter.title,'A Test Day');assert.deepEqual(kid.notes,['Beginner scored a goal b','we built the robot track']);
  assert.deepEqual(bed.kids.find(k=>k.player==='explorer').notes,['we built the robot track']);
  assert.ok(!bed.kids.some(k=>k.player==='admin'));
  r=await(await post(base,'/api/book/notes',{remove:r.notes[0].id})).json();assert.equal(r.notes.length,1);
 }finally{child.kill();}
});
test('Pure helpers: note target, clean notes, auto-open rule, mistake taps, remembered place, bedtime lines',()=>{
 const kids=[{id:'a',name:'Ana'},{id:'b',name:'Ben'}];
 assert.equal(noteTarget('Ana won',kids),'a');assert.equal(noteTarget('Ana and Ben swam',kids),null);assert.equal(noteTarget('Banana bread',kids),null);
 assert.equal(cleanNote('x'.repeat(300)).length,160);
 assert.equal(shouldOpen(null,null),false);assert.equal(shouldOpen({},{finished:true}),false);assert.equal(shouldOpen({},{opens:2}),true);assert.equal(shouldOpen({},{opens:3}),false);
 const m={wrong:'25'};assert.equal(isWrongToken('25!',m),true);assert.equal(isWrongToken('"25,"',m),true);assert.equal(isWrongToken('5',m),false);assert.equal(isWrongToken('D',{wrong:'D'}),true);assert.equal(bare('(hi)'),'hi');
 const store=new Map(),s={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert.equal(lastPlace('a',s),'');rememberPlace('a','#maze-garden/maker',s);assert.equal(lastPlace('a',s),'#maze-garden/maker');rememberPlace('a','#',s);assert.equal(lastPlace('a',s),'#maze-garden/maker');
 const ch=chapter('beginner');
 assert.deepEqual(howItWent(ch,{opens:0,page:0,finished:false,results:[]}),['Has not opened today’s chapter yet']);
 assert.deepEqual(howItWent(ch,{opens:1,page:3,finished:true,results:[{page:2,kind:'mistake',misses:0}]}),['Read the whole chapter ✓','Caught the mistake “Bus starts with D.” first try']);
 assert.equal(itemLine({kind:'math',display:'6 × 7 = ?',answer:'42'}),'6 × 7 = ? (42)');
});
test('No new kid-facing menu: the book is checked before any destination renders, and only for children',async()=>{
 const src=await readFile(new URL('../public/hub.mjs',import.meta.url),'utf8');
 const render=src.slice(src.indexOf('async function render()'),src.indexOf('function afterBook'));
 assert.ok(render.indexOf('loadBook(player)')>0&&render.indexOf('loadBook(player)')<render.indexOf('destination(location.hash)'),'book first, then the game he asked for');
 assert.match(render,/player !== "admin"/);
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(book,/<select|type="radio"|data-choose/,'no choices inside the book');
});
