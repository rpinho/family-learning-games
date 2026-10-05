import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {bookService} from '../book-service.mjs';
import {bookReviewService} from '../book-review-service.mjs';
import {deployment,NOW} from '../../book/tests/fixtures.mjs';
import {bookPaths} from '../../book/paths.mjs';
import {readLedger,payoff} from '../../book/adventure/ledger.mjs';
import {routePages} from '../public/book-adventure.mjs';
const chapter=()=>({schema:'family-book-chapter-2',player:'young',name:'Ada',date:'2026-03-10',title:'A path',pages:[
 {id:'p1',node:'opening',kind:'story',scene:{bg:'castle',actors:[],props:[]},say:[],choice:{options:[{id:'a',next:'left',sets:{id:'rope',label:'rope',kind:'item'}},{id:'b',next:'right',sets:{id:'lamp',label:'lamp',kind:'item'}}]}},
 {id:'p2',node:'left',kind:'story',scene:{bg:'meadow',actors:[],props:[]},say:[]},
 {id:'p3',node:'right',kind:'story',scene:{bg:'forest',actors:[],props:[]},say:[]},
 {id:'p4',node:'ending',kind:'story',scene:{bg:'night',actors:[],props:[]},say:[]}],meta:{kit:{id:'woods',places:[],edges:[]},graph:{start:'opening',nodes:[{id:'opening',choice:{options:[{id:'a',next:'left'},{id:'b',next:'right'}]}},{id:'left',next:['ending']},{id:'right',next:['ending']},{id:'ending',next:[]}]}}});
test('server trusts chapter flags, saves branch B mid-route and resumes it; only completion writes ledger',async t=>{
 const {env}=await deployment(),paths=bookPaths(env),config={players:[{id:'young',name:'Ada'},{id:'admin',name:'Admin'}]},ch=chapter();await mkdir(join(paths.book,'young'),{recursive:true});await writeFile(join(paths.book,'young',ch.date+'.json'),JSON.stringify(ch));
 const service=bookService({data:paths.data.hub,bookDir:paths.book,config,players:['young','admin'],timeZone:'UTC',now:()=>NOW});const server=createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const url='http://127.0.0.1:'+server.address().port+'/api/book?player=young';
 const post=async body=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:ch.date,...body})});return {status:r.status,j:await r.json()};};
 assert.equal((await post({type:'finish',page:4})).status,409);assert.equal((await post({type:'choice',node:'opening',option:'fake',page:0})).status,409);
 assert.equal((await post({type:'choice',node:'opening',option:'b',page:0,sets:{id:'fake',label:'fake'}})).status,200);assert.equal(payoff(await readLedger(paths.book,'young')),null);
 assert.equal((await post({type:'page',page:1})).status,409);assert.equal((await post({type:'page',page:2})).status,200);
 const loaded=await fetch(url).then(r=>r.json());assert.equal(loaded.progress.page,2);assert.equal(loaded.progress.choices.opening,'b');assert.deepEqual(routePages(loaded.chapter,loaded.progress.choices),[0,2,3]);
 assert.equal((await post({type:'choice',node:'opening',option:'a',page:0})).status,409);assert.equal((await post({type:'finish',page:4})).status,200);assert.equal(payoff(await readLedger(paths.book,'young')).id,'lamp');
 await post({type:'finish',page:4});assert.equal((await readLedger(paths.book,'young')).flags.length,1);
});
test('review can open October-4-style future drafts, map and path pages while an earlier draft stays byte-identical',async t=>{
 const {env}=await deployment(),paths=bookPaths(env),config={players:[{id:'young',name:'Ada'}]},ch=chapter();ch.date='2026-03-11';ch.meta.review={state:'pending',revision:'r1'};await mkdir(join(paths.book,'young','review'),{recursive:true});const earlier=join(paths.book,'young','review','2026-03-10.json');await writeFile(earlier,'{"keep":true}');await writeFile(join(paths.book,'young','review',ch.date+'.json'),JSON.stringify(ch));const before=await readFile(earlier);
 const service=bookReviewService({bookDir:paths.book,config,timeZone:'UTC',env,now:()=>NOW-864e5});const server=createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port+'/api/book/review';const g=await fetch(base+'/gate').then(r=>r.json());const r=await fetch(base+'/gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:g.id,answer:g.code.split(' ').map(x=>x[0]).reverse().join('')})});const cookie=r.headers.get('set-cookie').split(';')[0];const view=await fetch(base+'?date=2026-03-11',{headers:{cookie}}).then(r=>r.json());assert.equal(view.drafts[0].adventure.paths.length,2);assert.equal(view.drafts[0].adventure.paths[1].pages[1].node,'right');assert.deepEqual(await readFile(earlier),before);
 assert.equal((await fetch(base+'?date=2030-01-01',{headers:{cookie}})).status,400);
});

test('spell words blend after every try and offer separate letter-sound controls',async()=>{
 const vm=await import('node:vm'),src=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8'),start=src.indexOf("case 'spell':{",src.indexOf('function runBeat')),end=src.indexOf("case 'share':{",start),body=src.slice(start+"case 'spell':{".length,end).replace(/return;\s*}\s*$/,'');
 const spoken=[],buttons=[],slots={children:[{textContent:''},{textContent:''}],classList:{remove(){},add(){}}};
 const element=()=>({dataset:{},classList:{remove(){},add(){},contains(){return false;}},set textContent(v){this.text=v;},get textContent(){return this.text;}});
 const play={children:buttons,append(e){buttons.push(e);}},b={spoken:'Put the words in order.',answer:['cat','sat'],tiles:['cat','sat','dog'],mark:'.',sounds:{cat:'cat-help',sat:'sat-help',dog:'dog-help'},done:'The cat sat.'};
 const ctx={support(){},esc:String,b,play,my:1,turn:1,tele:null,page:0,el:{append(){}},document:{createElement:t=>t==='div'?slots:element()},speak:async l=>spoken.push(l),teleTap(){},burst(){},cheer(){},done(){},ch:{ui:{tryAgain:'Try again.'}}};vm.runInNewContext('globalThis.playSpell=async()=>{'+body+'}',ctx);await ctx.playSpell();
 await buttons[0].onclick();assert.ok(spoken.includes('cat-help'));await buttons[2].onclick();assert.ok(spoken.includes('dog-help'));await buttons[1].onclick();assert.ok(spoken.includes('sat-help'));assert.equal(spoken.at(-1),'The cat sat.');
});

test('adventure count evidence stays large, grouped, tappable and above the portrait family',async()=>{
 const {countLayout}=await import('../public/book-adventure.mjs');for(const [width,height] of [[320,640],[390,844],[768,1024],[1366,768]])for(const n of [8,10,13,15]){const boxes=countLayout(n,{width,height});assert.equal(boxes.length,n);for(const b of boxes){assert.ok(b.width>=44&&b.height>=44);assert.ok(b.left>=0&&b.left+b.width<=width);assert.ok(b.top+b.height<height*.80);}}
});

test('letter tiles (spelling a name) say their sound on every tap, right or wrong, and repeat it',async()=>{
 const vm=await import('node:vm'),src=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8'),start=src.indexOf("case 'spell':{",src.indexOf('function runBeat')),end=src.indexOf("case 'share':{",start),body=src.slice(start+"case 'spell':{".length,end).replace(/return;\s*}\s*$/,'');
 const spoken=[],buttons=[],slots={children:[{textContent:''},{textContent:''},{textContent:''}],classList:{remove(){},add(){}}};
 const element=()=>({dataset:{},classList:{_s:new Set(),remove(c){this._s.delete(c);},add(c){this._s.add(c);},contains(c){return this._s.has(c);}},set textContent(v){this.text=v;},get textContent(){return this.text;}});
 const play={children:buttons,append(e){buttons.push(e);}},b={spoken:'Spell Mom.',answer:['M','O','M'],tiles:['O','M','M'],mark:'',sounds:{m:'mmm',o:'ooo'},done:'M, O, M. Mom!'};
 const opts=[];const ctx={support(){},esc:String,b,play,my:1,turn:1,tele:null,page:0,el:{append(){}},document:{createElement:t=>t==='div'?slots:element()},speak:async(l,o)=>{spoken.push(l);opts.push(o);},teleTap(){},burst(){},cheer(){},done(){},ch:{ui:{tryAgain:'Try again.'}}};vm.runInNewContext('globalThis.playSpell=async()=>{'+body+'}',ctx);await ctx.playSpell();
 await buttons[1].onclick();assert.equal(spoken.at(-1),'mmm');            // right tile: its sound
 await buttons[2].onclick();assert.deepEqual(spoken.slice(-2),['mmm','Try again.']); // wrong tile: its sound again, gently
 await buttons[0].onclick();assert.equal(spoken.at(-1),'ooo');
 await buttons[2].onclick();assert.equal(spoken.at(-2),'mmm');assert.equal(spoken.at(-1),'M, O, M. Mom!');
 assert.ok(opts.filter(o=>o?.again).length>=3,'letter sounds repeat (again: true)');
});

test('letter tiles for a name sit in the top band, seven in one row that fits a tablet and a laptop',async()=>{
 const css=await readFile(new URL('../public/book.css',import.meta.url),'utf8');
 const rule=sel=>{const i=css.indexOf(sel+'{');assert.ok(i>=0,'missing '+sel);return css.slice(i,css.indexOf('}',i));};
 const play=rule('.bk-page[data-beat="letters"] .bk-play');assert.match(play,/bottom:auto/);assert.match(play,/top:calc\(7%/);assert.match(play,/flex-wrap:nowrap/);
 assert.match(rule('.bk-page[data-beat="letters"] .bk-slots'),/top:7%/);
 // seven tiles at their largest size plus gaps fit the narrowest screen they are sized for (768 px tablet, 1366x768 laptop)
 for(const [W,H] of [[768,1024],[1366,768]]){const vmin=Math.min(W,H),tile=Math.max(44,Math.min(W*0.115,H*0.11,88)),gap=Math.max(6,Math.min(vmin*0.014,12));
  assert.ok(7*tile+6*gap+20<=W,`seven tiles fit ${W}x${H}`);
  const top=H*0.07+Math.max(40,Math.min(vmin*0.075,62)),bottom=top+tile;assert.ok(bottom<H*0.42,`tiles end above the family at ${W}x${H}`);}
});
