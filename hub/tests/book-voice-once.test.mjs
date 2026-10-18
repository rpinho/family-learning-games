import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bookService,clipName} from '../book-service.mjs';
function call(svc,method,path,body){return new Promise(async ok=>{const u=new URL('http://x'+path);const chunks=body?[Buffer.from(JSON.stringify(body))]:[];
 const req={method,headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){for(const c of chunks)yield c;}};
 const res={writeHead(s){this.s=s;},end(b){ok({status:this.s,body:JSON.parse(String(b||'null'))});}};await svc.handle(req,res,u);});}
// A tablet that asks again while a line renders joins the first render instead of queueing another one.
test('Requests for the same missing line while it renders share one render',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'book-voice-once-'));const book=join(dir,'book');await mkdir(join(book,'living'),{recursive:true});await mkdir(join(book,'voice'),{recursive:true});
 await writeFile(join(book,'living','stories.json'),JSON.stringify({stories:{s1:{voices:{narrator:{voice:'bm_fable',speed:.9}},lines:{a:['narrator','Hop aboard!']}}},clips:{}}));
 const rendered=[];const svc=bookService({data:dir,bookDir:book,players:['kid'],config:{players:[{id:'kid'}]},timeZone:'UTC',
  voiceEngine:async lines=>{rendered.push(...lines);const clips={};for(const l of lines){const f=clipName(l);await writeFile(join(book,'voice',f),'RIFF');clips[`${l.voice}|${l.speed}|${l.text}`]=f;}return {made:lines.length,clips};}});
 const all=await Promise.all(Array.from({length:10},()=>call(svc,'POST','/api/book/voice',{story:'s1',key:'a'})));
 assert.deepEqual(new Set(all.map(r=>r.status)),new Set([200]));assert.equal(new Set(all.map(r=>r.body.clip)).size,1);assert.equal(rendered.length,1);
});
