import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localDate,noteTarget,cleanNote,shouldOpen,AUTO_OPENS} from '../book-service.mjs';
import {lastPlace,rememberPlace} from '../public/book.mjs';

const today=localDate(Date.now());
const line=(text,clip)=>({who:'narrator',text,voice:'af_heart',speed:0.95,...(clip?{clip}:{})});
const scene={bg:'meadow',actors:[{id:'hero',pose:'idle'}],props:[],fx:'none'};
const chapter=(player,date=today)=>({schema:'family-book-chapter-2',player,name:'Beginner',date,number:1,title:'A Test Day',level:'early',cover:{title:'A Test Day',line:line("Beginner's Book. Chapter 1. A Test Day."),scene},
 art:{backgrounds:{meadow:{url:'/book-art/bg/meadow.svg'}},actors:{hero:{name:'the hero',h:.42,poses:{idle:{url:'/book-art/actors/hero.svg',ar:.6}}}},props:{}},
 pages:[{id:'p1',kind:'story',scene,caption:'',say:[line('Hello.','0123456789abcdef.wav')]},{id:'p2',kind:'beat',scene,caption:'',say:[line('A river!')],beat:{id:'b2',kind:'stones',letter:'B',stones:['B','D','B','P','B','D'],need:3}},{id:'p3',kind:'story',scene,caption:'',say:[line('The end.')]}],
 ui:{yes:line('Yes!')},quest:line('A quest for you and Dad: find three things that start with B.'),summary:'s',hook:'h',meta:{}});
async function hub(){
 const data=await mkdtemp(join(tmpdir(),'family-hub-book-')),book=join(data,'..',data.split('/').pop()+'-book');
 await mkdir(join(book,'beginner'),{recursive:true});await mkdir(join(book,'explorer'),{recursive:true});await mkdir(join(book,'voice'),{recursive:true});
 await writeFile(join(book,'beginner',today+'.json'),JSON.stringify(chapter('beginner')));
 await writeFile(join(book,'explorer',today+'.json'),JSON.stringify({schema:'family-book-chapter-1',player:'explorer',pages:[]}));
 await writeFile(join(book,'voice','0123456789abcdef.wav'),'RIFFfake');
 await mkdir(join(book,'art','lib','bg'),{recursive:true});await writeFile(join(book,'art','lib','bg','castle-forest.webp'),'RIFFwebp');
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,FAMILY_CONFIG:'',FAMILY_DATA:data,FAMILY_BOOK:book,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 const out=await new Promise((resolve,reject)=>{child.stdout.once('data',x=>resolve(String(x)));child.once('exit',c=>reject(Error('exit '+c)));});
 return {data,book,child,base:'http://127.0.0.1:'+out.match(/localhost:(\d+)/)[1]};
}
const post=(base,path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('The hub carries an identical copy of the shared word-break module',async()=>{
 assert.equal(await readFile(new URL('../public/word-break.mjs',import.meta.url),'utf8'),await readFile(new URL('../../games/letter-quest/public/word-break.mjs',import.meta.url),'utf8'));
});
test('Today’s chapter opens by itself until finished; keys and words he earns are kept; older formats are ignored',async()=>{
 const {base,child,data}=await hub();
 try{
  assert.deepEqual((await readdir(data)).sort(),['logs'],'reading the book writes nothing');
  let b=await(await fetch(base+'/api/book?player=beginner')).json();
  assert.equal(b.open,true);assert.equal(b.chapter.title,'A Test Day');assert.equal(b.date,today);assert.deepEqual(b.collection,{keys:[],words:[]});
  assert.equal((await(await fetch(base+'/api/book?player=explorer')).json()).chapter,null,'an older-format chapter is not served');
  assert.equal((await(await fetch(base+'/api/book?player=admin')).json()).open,false);
  assert.equal((await fetch(base+'/api/book?player=nobody')).status,400);
  assert.equal((await post(base,'/api/book?player=beginner',{type:'page',date:'2000-01-01',page:1})).status,409,'stale pages cannot write');
  assert.equal((await post(base,'/api/book?player=beginner',{type:'hack',date:today})).status,400);
  for(let i=0;i<AUTO_OPENS;i++)assert.equal((await post(base,'/api/book?player=beginner',{type:'open',date:today,page:0})).status,200);
  b=await(await fetch(base+'/api/book?player=beginner')).json();
  assert.equal(b.open,false,'after 3 unfinished opens the book waits for tomorrow');assert.equal(b.progress.opens,AUTO_OPENS);
  await post(base,'/api/book?player=beginner',{type:'result',date:today,page:1,result:{kind:'stones',misses:1,ms:5000,earned:{key:'B'}}});
  await post(base,'/api/book?player=beginner',{type:'result',date:today,page:2,result:{kind:'magic',misses:0,ms:900,earned:{word:'Jump'}}});
  await post(base,'/api/book?player=beginner',{type:'result',date:today,page:2,result:{kind:'magic',earned:{key:'bad key',word:'<script>'}}});
  const done=await(await post(base,'/api/book?player=beginner',{type:'finish',date:today,page:3})).json();
  assert.equal(done.progress.finished,true);
  b=await(await fetch(base+'/api/book?player=beginner')).json();assert.deepEqual(b.collection,{keys:['B'],words:['jump']});
  const saved=JSON.parse(await readFile(join(data,'book-progress','beginner.json'),'utf8'));assert.equal(saved.days[today].finished,true);assert.deepEqual(saved.collection.keys,['B']);
  const wav=await fetch(base+'/book-voice/0123456789abcdef.wav');assert.equal(wav.status,200);assert.equal(wav.headers.get('content-type'),'audio/wav');
  assert.equal((await fetch(base+'/book-voice/..%2Fbeginner.wav')).status,404);
  assert.equal((await fetch(base+'/book-voice/ffffffffffffffff.wav')).status,404);
  const own=await fetch(base+'/book-art/bg/castle-forest.webp');assert.equal(own.status,200);assert.equal(own.headers.get('content-type'),'image/webp');
  const generic=await fetch(base+'/book-art/actors/hero.svg');assert.equal(generic.status,200,'the generic library fills in');assert.equal(generic.headers.get('content-type'),'image/svg+xml');
  for(const path of ['bg/real-foreground/castle-gateLandscape.webp','bg/real-foreground/volcanoPortrait.webp','actors/hero-cheer.webp','props/treasure-chest.webp']){
   const picture=await fetch(base+'/book-art/'+path);assert.equal(picture.status,200,path);assert.equal(picture.headers.get('content-type'),'image/webp');
  }
  for(const path of ['actors/real-foreground/hero.webp','bg/real-foreground/%2e%2e%2fsecret.webp','bg/other/private.webp'])assert.equal((await fetch(base+'/book-art/'+path)).status,404,path);
  for(const bad of ['/book-art/..%2Fbeginner%2Ftoday.json','/book-art/bg/../../x.webp','/book-art/secret/x.webp','/book-art/bg/nothing.webp'])assert.equal((await fetch(base+bad)).status,404,bad);
  for(const f of ['/book.mjs','/book.css','/book-scene.mjs','/word-break.mjs'])assert.equal((await fetch(base+f)).status,200,f);
  for(const f of ['/bedtime.html','/bedtime.mjs','/api/book/bedtime'])assert.notEqual((await fetch(base+f)).status,200,`${f} is gone`);
  const html=await(await fetch(base+'/')).text();assert.match(html,/id="book-note"/);assert.match(html,/book\.css/);assert.match(html,/id="book-watch"/);assert.doesNotMatch(html,/bedtime/);
 }finally{child.kill();}
});
test('Grown-ups can watch a child’s newest chapter (tonight: tomorrow’s), read-only',async()=>{
 const {base,child,data,book}=await hub();
 try{
  const tomorrow=localDate(Date.now()+864e5);await writeFile(join(book,'beginner',tomorrow+'.json'),JSON.stringify(chapter('beginner',tomorrow)));
  let r=await(await fetch(base+'/api/book/preview?player=beginner')).json();
  assert.equal(r.preview,true);assert.equal(r.date,tomorrow);assert.equal(r.chapter.date,tomorrow);
  r=await(await fetch(base+`/api/book/preview?player=beginner&date=${today}`)).json();assert.equal(r.chapter.date,today);
  assert.equal((await(await fetch(base+'/api/book/preview?player=explorer')).json()).chapter,null);
  assert.equal((await fetch(base+'/api/book/preview?player=admin')).status,400);
  assert.deepEqual((await readdir(data)).sort(),['logs'],'watching writes nothing');
 }finally{child.kill();}
});
test('Grown-ups’ "Today" notes: saved, attributed by first name, removable',async()=>{
 const {base,child,data}=await hub();
 try{
  assert.equal((await post(base,'/api/book/notes',{text:'   '})).status,400);
  let r=await(await post(base,'/api/book/notes',{text:'Beginner scored a goal <b>'})).json();
  assert.equal(r.notes.length,1);assert.equal(r.notes[0].player,'beginner');assert.equal(r.notes[0].text,'Beginner scored a goal b');
  r=await(await post(base,'/api/book/notes',{text:'we built the robot track'})).json();assert.equal(r.notes[1].player,null);
  const stored=JSON.parse(await readFile(join(data,'book-notes.json'),'utf8'));assert.equal(stored.notes.length,2);
  r=await(await post(base,'/api/book/notes',{remove:r.notes[0].id})).json();assert.equal(r.notes.length,1);
 }finally{child.kill();}
});
test('Pure helpers: note target, clean notes, auto-open rule, remembered place',()=>{
 const kids=[{id:'a',name:'Ana'},{id:'b',name:'Ben'}];
 assert.equal(noteTarget('Ana won',kids),'a');assert.equal(noteTarget('Ana and Ben swam',kids),null);assert.equal(noteTarget('Banana bread',kids),null);
 assert.equal(cleanNote('x'.repeat(300)).length,160);
 assert.equal(shouldOpen(null,null),false);assert.equal(shouldOpen({},{finished:true}),false);assert.equal(shouldOpen({},{opens:2}),true);assert.equal(shouldOpen({},{opens:3}),false);
 const store=new Map(),s={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert.equal(lastPlace('a',s),'');rememberPlace('a','#maze-garden/maker',s);assert.equal(lastPlace('a',s),'#maze-garden/maker');rememberPlace('a','#',s);assert.equal(lastPlace('a',s),'#maze-garden/maker');
});
test('The book comes first for children; grown-ups get a preview; every page turn speaks at once',async()=>{
 const src=await readFile(new URL('../public/hub.mjs',import.meta.url),'utf8');
 const render=src.slice(src.indexOf('async function render()'),src.indexOf('function afterBook'));
 assert.ok(render.indexOf('loadBook(player)')>0&&render.indexOf('loadBook(player)')<render.indexOf('destination(location.hash)'),'book first, then the game he asked for');
 assert.match(render,/player !== "admin"/);assert.match(render,/preview: true/);assert.match(src,/Watch \$\{esc\(k\.name\)\}'s book/);
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(book,/<select|type="radio"|data-choose/,'no menus inside the book');
 assert.equal((book.match(/new Audio\(/g)||[]).length,1,'one audio element, unlocked once and reused for every line');
 const go=book.slice(book.indexOf('function go('),book.indexOf('// A magic word'));
 assert.match(go,/speakAll\(p\.say,my\)/,'a story page speaks its narration as soon as it is shown');assert.match(go,/runBeat\(p,my\)/);
 assert.match(book.slice(book.indexOf('async function runBeat'),book.indexOf('switch(b.kind)')),/speakAll\(p\.say,my\)/,'a beat page speaks too');
 assert.match(book,/AUTO_ADVANCE_MS/);assert.match(book,/prefers|TAP_GUARD_MS/);
});
