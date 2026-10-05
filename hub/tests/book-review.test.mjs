import {certifyTestChapter} from '../../book/tests/episode-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {bookReviewService} from '../book-review-service.mjs';
import {bookService} from '../book-service.mjs';
import {generateOne} from '../../book/generate.mjs';
import {bookPaths,readProfiles} from '../../book/paths.mjs';
import {deployment,NOW} from '../../book/tests/fixtures.mjs';
import {readJSON,slot} from '../../book/review.mjs';
test('grown-ups gate, read-only review preview, changes and approval use isolated data; stale and oversized requests refused',async t=>{
 const {env}=await deployment(),paths=bookPaths(env),profiles=readProfiles(paths),date='2026-03-10';
 const result=await generateOne('young',{paths,profiles,date,review:true,noLLM:true,noVoice:true,now:NOW,log:()=>{}});
 await certifyTestChapter(result.chapter,{paths});await writeFile(result.file,JSON.stringify(result.chapter));
 const config={players:[{id:'young',name:'Ada'},{id:'older',name:'Robin'},{id:'admin',name:'Admin'}]},data=paths.data.hub;
 await mkdir(join(data,'book-progress'),{recursive:true});const save=join(data,'book-progress','young.json');await writeFile(save,JSON.stringify({days:{},collection:{keys:['A']}}));const before=await readFile(save);
 const review=bookReviewService({bookDir:paths.book,config,timeZone:'UTC',env,now:()=>NOW-864e5,redo:async()=>{throw Error('no writer');}}),book=bookService({data,bookDir:paths.book,config,players:config.players.map(p=>p.id),timeZone:'UTC',now:()=>NOW-864e5});
 const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(req.url.startsWith('/api/book/review'))return await review.handle(req,res,u);if(u.searchParams.get('review')==='1'&&!review.authorized(req)){res.writeHead(403);res.end('{}');return;}await book.handle(req,res,u);}catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;let cookie='';
 const call=async(path='',b)=>{const r=await fetch(base+'/api/book/'+path,{headers:{cookie,'Content-Type':'application/json'},...(b?{method:'POST',body:JSON.stringify(b)}:{})});return {status:r.status,j:await r.json(),cookie:r.headers.get('set-cookie')};};
 assert.equal((await call('review')).status,403);assert.equal((await call('preview?player=young&date='+date+'&review=1')).status,403);
 let g=(await call('review/gate')).j;const answer=g.code.split(' ').map(x=>x[0]).reverse().join('');const unlocked=await call('review/gate',{id:g.id,answer});assert.equal(unlocked.status,200);cookie=unlocked.cookie.split(';')[0];
 const view=(await call('review')).j;assert.equal(view.date,date);assert.equal(view.drafts[0].title,result.chapter.title);
 const preview=await call('preview?player=young&date='+date+'&review=1');assert.equal(preview.status,200);assert.equal(preview.j.preview,true);assert.equal(preview.j.chapter.title,result.chapter.title);assert.ok(preview.j.chapter.episode.checks.certified);assert.deepEqual(await readFile(save),before);
 const body={player:'young',date,revision:result.chapter.meta.review.revision};assert.equal((await call('review',{...body,action:'approve',revision:'stale'})).status,409);
 assert.equal((await call('review',{...body,action:'changes',note:'A calmer goodbye.'})).status,200);assert.equal((await readJSON(slot(paths.book,'young',date,true)+'.review.json')).notes[0].text,'A calmer goodbye.');
 assert.equal((await call('review',{...body,action:'redo'})).status,200);await new Promise(r=>setTimeout(r,40));assert.equal((await call('review')).j.drafts[0].job.state,'failed');assert.ok(await readJSON(result.file));
 assert.equal((await call('review',{...body,action:'approve'})).status,200);assert.equal((await readJSON(slot(paths.book,'young',date)+'.json')).meta.review.state,'approved');assert.deepEqual(await readFile(save),before);
 assert.equal((await call('review',{...body,action:'changes',note:'x'.repeat(9000)})).status,413);
});

// The regeneration worker and SMTP sender are injected: no model calls, real messages or child data.
test('a completed live redo notifies with the new draft; email failure keeps the draft ready',async t=>{
 const {env}=await deployment(),paths=bookPaths(env),date='2026-03-10';await generateOne('young',{paths,profiles:readProfiles(paths),date,review:true,noLLM:true,noVoice:true,now:NOW,log:()=>{}});
 let mails=0;const config={players:[{id:'young',name:'Ada'}]},service=bookReviewService({bookDir:paths.book,config,timeZone:'UTC',env:{...env,FAMILY_CHANNEL:'live'},now:()=>NOW-864e5,redo:async()=>{},sendNotice:async j=>{mails++;assert.equal(j.chapters[0].player,'young');throw Error('SMTP down');}});
 const server=createServer(async(req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const url='http://127.0.0.1:'+server.address().port+'/api/book/review';
 const g=await fetch(url+'/gate').then(r=>r.json()),r=await fetch(url+'/gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:g.id,answer:g.code.split(' ').map(x=>x[0]).reverse().join('')})}),cookie=r.headers.get('set-cookie').split(';')[0];
 const ch=await readJSON(slot(paths.book,'young',date,true)+'.json');await fetch(url,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'redo',player:'young',date,revision:ch.meta.review.revision})});
 for(let i=0;i<50&&!mails;i++)await new Promise(r=>setTimeout(r,10));assert.equal(mails,1);const view=await fetch(url,{headers:{cookie}}).then(r=>r.json());assert.equal(view.drafts[0].job.state,'ready');assert.match(view.drafts[0].job.noticeError,/email could not/);assert.ok(await readJSON(slot(paths.book,'young',date,true)+'.json'));
});
