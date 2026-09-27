import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bookService,clipName} from '../book-service.mjs';
import {missingClips} from '../scripts/check-clips.mjs';
function call(svc,method,path,body){return new Promise(async ok=>{const u=new URL('http://x'+path);const chunks=body?[Buffer.from(JSON.stringify(body))]:[];
 const req={method,headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){for(const c of chunks)yield c;}};
 const res={writeHead(s){this.s=s;},end(b){ok({status:this.s,body:JSON.parse(String(b||'null'))});}};await svc.handle(req,res,u);});}
async function setup(){const dir=await mkdtemp(join(tmpdir(),'book-voice-'));const book=join(dir,'book');await mkdir(join(book,'living'),{recursive:true});await mkdir(join(book,'voice'),{recursive:true});
 await writeFile(join(book,'living','stories.json'),JSON.stringify({stories:{s1:{voices:{narrator:{voice:'bm_fable',speed:.9}},lines:{a:['narrator','Hop aboard!']}}},clips:{}}));
 const rendered=[];const svc=bookService({data:dir,bookDir:book,players:['kid'],config:{players:[{id:'kid'}]},timeZone:'UTC',
  voiceEngine:async lines=>{rendered.push(...lines);const clips={};for(const l of lines){const f=clipName(l);await writeFile(join(book,'voice',f),'RIFF');clips[`${l.voice}|${l.speed}|${l.text}`]=f;}return {made:lines.length,clips};}});
 return {book,svc,rendered};}
test('A living line without a clip is rendered by the voice engine once, then served from the store',async()=>{
 const {svc,rendered}=await setup();
 const a=await call(svc,'POST','/api/book/voice',{story:'s1',key:'a'});assert.equal(a.status,200);assert.match(a.body.clip,/^[a-f0-9]{16}\.wav$/);
 const b=await call(svc,'POST','/api/book/voice',{story:'s1',key:'a'});assert.equal(b.body.clip,a.body.clip);assert.equal(rendered.length,1);
});
test('Only lines that exist can be rendered (no free text to the voice engine)',async()=>{
 const {svc,rendered}=await setup();
 assert.equal((await call(svc,'POST','/api/book/voice',{story:'s1',key:'nope'})).status,404);
 assert.equal((await call(svc,'POST','/api/book/voice',{player:'kid',date:'2026-01-01',text:'Say anything',voice:'bm_fable',speed:.9})).status,404);
 assert.equal(rendered.length,0);
});
test('The narration gate names every line without a clip',async()=>{
 const {book}=await setup();
 const m=await missingClips(book,{today:'2026-01-01'});assert.equal(m.length,1);assert.equal(m[0].key,'a');
 const f=JSON.parse(await readFile(join(book,'living','stories.json'),'utf8'));const name=clipName({voice:'bm_fable',speed:.9,text:'Hop aboard!'});f.clips['bm_fable|0.9|Hop aboard!']=name;
 await writeFile(join(book,'living','stories.json'),JSON.stringify(f));assert.equal((await missingClips(book,{today:'2026-01-01'})).length,1,'the clip file itself must exist');
 await writeFile(join(book,'voice',name),'RIFF');assert.equal((await missingClips(book,{today:'2026-01-01'})).length,0);
});
