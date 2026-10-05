import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bookService,HUNTS_PER_DAY} from '../book-service.mjs';
import {destination} from '../public/catalog.mjs';
function res(){const r={status:0,body:null,writeHead(s){r.status=s;},end(b){try{r.body=JSON.parse(b);}catch{r.body=b;}}};return r;}
function req(method,body){return {method,headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}};}
test('Letter Hunt: a friend announces the next hunt, a few a day, finds are recorded', async () => {
 const dir=await mkdtemp(join(tmpdir(),'hunt-')),bookDir=join(dir,'book');await mkdir(bookDir,{recursive:true});
 const hunt=id=>({id,letter:id,intro:{text:'Hunt for '+id},sound:{title:'things'},written:{title:'written'}});
 await writeFile(join(bookDir,'hunts.json'),JSON.stringify({players:{kid:{friend:{name:'Pal'},hunts:['M','S','B','T','R'].map(hunt)}}}));
 const logs=[];const svc=bookService({data:dir,bookDir,players:['kid','admin'],config:{players:[{id:'kid',name:'Kid'},{id:'admin',name:'Admin'}]},log:e=>logs.push(e),timeZone:'UTC',now:()=>Date.parse('2026-09-27T15:00:00Z')});
 const get=async()=>{const r=res();await svc.handle(req('GET'),r,new URL('http://x/api/book/hunt?player=kid'));return r.body;};
 const post=async b=>{const r=res();await svc.handle(req('POST',{date:'2026-09-27',page:0,...b}),r,new URL('http://x/api/book?player=kid'));return r;};
 let info=await get();assert.equal(info.hunt.id,'M');assert.equal(info.left,HUNTS_PER_DAY);
 for(const id of ['M','S','B','T','R']){info=await get();assert.equal(info.hunt.id,id);assert.equal((await post({type:'hunt',id,stage:'start'})).status,200);
  info=await get();assert.equal(info.hunt.id,id,'an unfinished hunt comes back');assert.equal((await post({type:'hunt',id,stage:'found',found:0,confirmed:true})).status,200);assert.equal((await get()).hunt.id,id,'zero found: keep looking');assert.equal((await post({type:'hunt',id,stage:'found',found:3,confirmed:true})).status,200);}
 info=await get();assert.equal(info.left,0,'five a day, then tomorrow');
 assert.equal((await post({type:'hunt',id:'Z',stage:'start'})).status,429);
 const saved=JSON.parse(await readFile(join(dir,'book-progress','kid.json'),'utf8'));
 assert.deepEqual(saved.collection.hunts,['M','S','B','T','R']);assert.equal(saved.days['2026-09-27'].hunts[0].found,3);
 assert.ok(logs.some(l=>l.action==='hunt'&&l.hunt==='S'&&l.stage==='found'&&l.found===3));
 assert.equal(destination('#hunt').type,'hunt');
});

test('The hunt a letters book ends on is the book\'s letter, even when the day\'s hunts were made for another', async () => {
 // (2026-09-30: a review chapter teaching B replaced the day's chapter after the nightly hunts (M) were written; the book
 // ended on a B card and the hunt opened on M)
 const dir=await mkdtemp(join(tmpdir(),'hunt-book-')),bookDir=join(dir,'book');await mkdir(join(bookDir,'kid'),{recursive:true});
 const m=k=>({id:`M-${k}-2026-09-27`,mode:'letter',kind:k,letter:'M',intro:{text:'This is M.'}});
 await writeFile(join(bookDir,'hunts.json'),JSON.stringify({players:{kid:{friend:{name:'Pal'},hunts:[m('sound'),m('written')]}}}));
 const quest={who:'narrator',text:'A quest for you and Dad: Sound hunt: find three things that start with B and show Dad!',clip:'q.wav',hints:[{word:'ball',emoji:'⚽',line:{text:'Maybe a ball? It starts with [[b]].',clip:'h.wav'}}]};
 await writeFile(join(bookDir,'kid','2026-09-27.json'),JSON.stringify({schema:'family-book-chapter-2',level:'early',letter:'B',date:'2026-09-27',pages:[{scene:{bg:'x',actors:[]},beat:{kind:'teach-letter',letter:'B',sound:'[[b]]'}}],quest,ui:{}}));
 const svc=bookService({data:dir,bookDir,players:['kid','admin'],config:{players:[{id:'kid',name:'Kid'},{id:'admin',name:'Admin'}]},timeZone:'UTC',now:()=>Date.parse('2026-09-27T15:00:00Z')});
 const r=res();await svc.handle(req('GET'),r,new URL('http://x/api/book/hunt?player=kid'));
 assert.equal(r.body.hunt.letter,'B');assert.equal(r.body.hunt.intro.clip,'q.wav');assert.equal(r.body.hunt.goal.text,'Find things that start with /b/');assert.equal(r.body.hunt.hints[0].word,'ball');
 // an open hunt of the other letter (started earlier that day) waits behind the book's letter
 const post=async b=>{const x=res();await svc.handle(req('POST',{date:'2026-09-27',page:0,...b}),x,new URL('http://x/api/book?player=kid'));return x;};
 assert.equal((await post({type:'hunt',id:'M-sound-2026-09-27',stage:'start'})).status,200);
 const r2=res();await svc.handle(req('GET'),r2,new URL('http://x/api/book/hunt?player=kid'));assert.equal(r2.body.hunt.letter,'B');
 // with a hunt for the book's letter in the file, that one is used (nothing synthesised)
 await writeFile(join(bookDir,'hunts.json'),JSON.stringify({players:{kid:{friend:{name:'Pal'},hunts:[m('sound'),{id:'B-sound-2026-09-27',mode:'letter',kind:'sound',letter:'B',intro:{text:'This is B.'}}]}}}));
 const r3=res();await svc.handle(req('GET'),r3,new URL('http://x/api/book/hunt?player=kid'));assert.equal(r3.body.hunt.intro.text,'This is B.');assert.equal(r3.body.hunt.fromBook,undefined);
});
