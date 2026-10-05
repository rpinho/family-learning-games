import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localDate,noteTarget,cleanNote,shouldOpen,AUTO_OPENS,mergeArtLibrary} from '../book-service.mjs';
import {lastPlace,rememberPlace,swipeBack,PLAY_TARGETS,saysGoal,standInDepth,standInSize,STORY_GROUND} from '../public/book.mjs';
import {repeatOf,cries,REPEAT_MS} from '../public/repeats.mjs';
import {readLibrary} from '../../book/generate.mjs';
import {bookPaths} from '../../book/paths.mjs';

const today=localDate(Date.now());
test('Private release art patches preserve every other library entry and leave the source untouched',()=>{
 const base={backgrounds:{room:{file:'old.webp'},yard:{file:'yard.webp'}},actors:{friend:{poses:{idle:{}}}},props:{ball:{}}};
 const patch={backgrounds:{room:{file:'fixed.webp'}}};const out=mergeArtLibrary(base,patch);
 assert.equal(out.backgrounds.room.file,'fixed.webp');assert.equal(base.backgrounds.room.file,'old.webp');
 assert.deepEqual(out.backgrounds.yard,base.backgrounds.yard);assert.deepEqual(out.actors,base.actors);assert.deepEqual(out.props,base.props);
});
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

test('release layout metadata reaches both the library API and existing chapters without a file write',async()=>{
 const {base,child,book}=await hub();
 try{
  const file=join(book,'beginner',today+'.json');
  for(const bg of ['meadow','castle']){
   const saved=chapter('beginner');saved.pages[0].scene={...scene,bg};
   await writeFile(file,JSON.stringify(saved));const before=await readFile(file);
   const expected=readLibrary(bookPaths({FAMILY_DEPLOY_ROOT:'/nonexistent'})).backgrounds[bg];
   const library=await(await fetch(base+'/api/book/library')).json();
   const served=(await(await fetch(base+'/api/book?player=beginner')).json()).chapter;
   assert.equal(library.backgrounds[bg].groundStart,expected.groundStart);
   assert.equal(served.art.backgrounds[bg].groundStart,expected.groundStart);
   assert.equal(served.art.backgrounds[bg].url,'/book-art/'+expected.file);
   assert.deepEqual(library.backgrounds[bg].standBand,expected.standBand);
   assert.deepEqual(served.art.backgrounds[bg].keepOut||[],expected.keepOut||[]);
   assert.deepEqual(await readFile(file),before);
  }
 }finally{child.kill();}
});

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
  const logName=(await readdir(join(data,'logs'))).find(n=>n.endsWith('.jsonl'));
  const firstLog=(await readFile(join(data,'logs',logName),'utf8')).trim().split('\n').map(JSON.parse).find(r=>r.type==='book'&&r.action==='result');
  assert.equal(firstLog.misses,1);assert.equal(firstLog.hints,0,'first-answer support is retained in the append-only log');
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
  const html=await(await fetch(base+'/')).text();assert.match(html,/id="daynotes-link"/);assert.match(html,/book\.css/);assert.match(html,/id="book-watch"/);assert.doesNotMatch(html,/bedtime/);
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
 const kids=[{id:'a',name:'Ada'},{id:'b',name:'Robin'}];
 assert.equal(noteTarget('Ada won',kids),'a');assert.equal(noteTarget('Ada and Robin swam',kids),null);assert.equal(noteTarget('Banana bread',kids),null);
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

test('Tracing never turns the page back: a swipe back only starts on the picture, never on the trace layer or a play thing',async()=>{
 assert.equal(swipeBack({dx:180,dy:4}),true,'a finger drawn across the picture still turns back');
 assert.equal(swipeBack({dx:180,dy:4,onPlay:true}),false,'a stroke that began on the trace layer never does');
 assert.equal(swipeBack({dx:70,dy:200}),false,'a mostly-down stroke is not a swipe');assert.equal(swipeBack({dx:-200,dy:0}),false);assert.equal(swipeBack({dx:40,dy:0}),false);
 for(const sel of ['canvas','.bk-trace','.bk-ball','button'])assert.ok(PLAY_TARGETS.split(',').includes(sel),sel);
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 const nav=book.slice(book.indexOf('// ---- navigation'),book.indexOf("root.querySelector('.bk-exit')"));
 assert.match(nav,/closest\?\.\(PLAY_TARGETS\)/,'where the finger went DOWN decides (an accepted trace removes its layer before the lift)');
 assert.match(nav,/swipeBack\(/);assert.doesNotMatch(nav,/dx>60&&page>0/,'no raw sideways check left');
 assert.match(book,/cv\.className='bk-trace'/,'the trace layer keeps the class the guard knows');
});

test('"Goal!" is said once: the Book stays quiet when the kick page\'s own next line says it',async()=>{
 assert.equal(saysGoal([{text:'Goal! Off we go!'}]),true);assert.equal(saysGoal([{text:'You scored! Off we go!'}]),false);assert.equal(saysGoal([{text:'The goalkeeper waves.'}]),false);assert.equal(saysGoal(undefined),false);
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 const shoot=book.slice(book.indexOf('async function shoot('),book.indexOf('// where the ball waits to be thrown'));
 assert.match(shoot,/if\(!quiet\)await speak\(ch\.ui\.goal\)/);
 assert.match(book,/shoot\(el,p,my,ball,aim,\{quiet:saysGoal\(a\.after\)\}\)/,'a kick page: its after lines');
 assert.match(book,/shoot\(el,p,my,bl,aim,\{quiet:saysGoal\(\[b\.done\]\)\}\)/,'a kick-letter page: its done line');
});
test('Repeats: never the same line twice in a row, never a crying friend twice in a row; a replay always speaks',async()=>{
 const pip=t=>({who:'pip-hat',text:t,voice:'local:pip-1-reactions-v1-x',clip:t+'.wav'}),now=1e6,at=now-1000;
 assert.equal(cries(pip('Pip!')),true);assert.equal(cries({voice:'af_bella@relaxed'}),false);assert.equal(cries({voice:'local:birdie-book-v1-x'}),false);assert.equal(cries({voice:'x',cry:true}),true);
 assert.equal(repeatOf(pip('Can I? Please?'),{...pip('Bird starts with P!'),at},now),'same-friend','the begging after the claim');
 assert.equal(repeatOf({who:'narrator',text:'Goal!',clip:'g.wav'},{who:'narrator',text:'Goal!',clip:'g.wav',at},now),'same-line');
 assert.equal(repeatOf({who:'narrator',text:'Yes!',clip:'y.wav'},{who:'narrator',text:'Yes!',clip:'y.wav',at:now-REPEAT_MS-1},now),null,'long after, a line may come back');
 assert.equal(repeatOf({who:'dad',text:'Kick it!',voice:'local:rook-dad'},{who:'dad',text:'Your turn!',voice:'local:rook-dad',at},now),null,'Dad may say two different lines');
 assert.equal(repeatOf(pip('Oops!'),{who:'narrator',text:'What do you say?',at},now),null);
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8'),hunt=await readFile(new URL('../public/hunt.mjs',import.meta.url),'utf8');
 assert.match(book,/const rep=!again&&repeatOf\(line,prevLine\)/,'the Book checks every line except an explicit replay');
 assert.match(hunt,/if\(repeatOf\(line,prev\)\)return res\(\)/,'the hunts check every line');
});
test('Every module the Book and the hunts import is served (a new file must join the server\'s list)',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');const list=JSON.parse(server.match(/const files=(\[[^\]]*\])/)[1].replace(/'/g,'"'));
 for(const f of ['book.mjs','hunt.mjs','book-scene.mjs']){const src=await readFile(new URL('../public/'+f,import.meta.url),'utf8');
  for(const [,m] of src.matchAll(/from '\.\/([^']+)'/g))assert.ok(list.includes(m),`${f} imports ${m}, which the server does not serve`);}
});
test('A story page\'s stand-in goal stands up the field: higher and smaller in perspective, keeper scaled the same',()=>{
 const {foot,scale}=standInDepth();assert.ok(foot<STORY_GROUND-0.2,'well above the friends\' ground line');assert.ok(foot>0.5,'still on the floor, below the back wall');
 assert.ok(scale>0.4&&scale<0.7,'smaller with depth');
 const old=Math.max(201*0.85,240*0.68)/0.9,{h,w}=standInSize(201,1280,800);assert.ok(h<old*0.75,`smaller than the old near goal (${Math.round(h)} vs ${Math.round(old)})`);assert.ok(w<0.34*1280,'narrower than the old least width');
 assert.ok(Math.abs(h*0.9-201*scale)<1,'the keeper fills it at his own height times the same depth');
 assert.ok(standInSize(10,1280,800).h>=800*0.11,'never an unreadable goal');
});
test('The stand-in goal uses that perspective, and its keeper stands in front of the net at the same depth',async()=>{
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');const gr=book.slice(book.indexOf('function goalRect('),book.indexOf("// ---- a game's things in the picture"));
 assert.match(gr,/standInSize\(keeperHeight\(el,p\),W,H,\{scale:far\.scale\}\)/);assert.match(gr,/foot=Math\.min\(far\.foot,/,'up the field, never nearer than behind the ball');
 assert.match(book,/own\*keeperDepth\(p,!g\.drawn\)/,'the keeper shrinks by the same depth');
 assert.match(book.slice(book.indexOf('function goalFrame('),book.indexOf('function diveBox(')),/insertAdjacentHTML\('afterbegin'/,'the net stays behind the friends (a39fd89)');
});
