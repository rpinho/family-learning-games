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
 for(const id of ['M','S','B']){info=await get();assert.equal(info.hunt.id,id);assert.equal((await post({type:'hunt',id,stage:'start'})).status,200);
  info=await get();assert.equal(info.hunt.id,id,'an unfinished hunt comes back');assert.equal((await post({type:'hunt',id,stage:'found',found:3})).status,200);}
 info=await get();assert.equal(info.left,0,'three a day, then tomorrow');
 assert.equal((await post({type:'hunt',id:'T',stage:'start'})).status,429);
 const saved=JSON.parse(await readFile(join(dir,'book-progress','kid.json'),'utf8'));
 assert.deepEqual(saved.collection.hunts,['M','S','B']);assert.equal(saved.days['2026-09-27'].hunts[0].found,3);
 assert.ok(logs.some(l=>l.action==='hunt'&&l.hunt==='S'&&l.stage==='found'&&l.found===3));
 assert.equal(destination('#hunt').type,'hunt');
});
