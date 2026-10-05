import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bookService} from '../book-service.mjs';
import {LOUDNESS,loudness} from '../voice-level.mjs';
// Speech-like test clips (a warbling tone that starts and stops like words), one very quiet and one hot.
const speechy=(file,volumeDb)=>execFileSync('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i',
 'aevalsrc=sin(2*PI*(180+40*sin(2*PI*3*t))*t)*(0.5+0.5*sin(2*PI*2.2*t))*gt(sin(2*PI*0.7*t)\\,-0.6):s=24000:d=3',
 '-af',`volume=${volumeDb}dB`,'-ac','1','-ar','24000','-c:a','pcm_s16le',file]);
const duration=file=>execFileSync('ffmpeg',['-loglevel','error','-i',file,'-f','s16le','-ac','1','-ar','24000','-'],{maxBuffer:1<<24}).length/2/24000;
function get(svc,path){return new Promise(async ok=>{const res={writeHead(s,h){this.s=s;this.h=h;},end(b){ok({status:this.s,headers:this.h,body:Buffer.from(b||'')});}};
 await svc.handle({method:'GET',headers:{}},res,new URL('http://x'+path));});}
test('Every served clip (webm and wav) is levelled to one loudness, whoever speaks; timing and the stored clip unchanged',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-level-')),book=join(dir,'book');await mkdir(join(book,'voice'),{recursive:true});
 const quiet=join(book,'voice','0000000000000001.wav'),hot=join(book,'voice','0000000000000002.wav');speechy(quiet,-30);speechy(hot,-4);
 const qIn=(await loudness(quiet)).lufs,hIn=(await loudness(hot)).lufs;
 assert.ok(hIn-qIn>20,'the two test voices start far apart');
 const svc=bookService({data:dir,bookDir:book,players:['kid'],config:{players:[{id:'kid'}]},timeZone:'UTC'});
 for(const ext of ['webm','wav'])for(const id of ['0000000000000001','0000000000000002']){
  const r=await get(svc,`/book-voice/${id}.${ext}`);assert.equal(r.status,200);assert.equal(r.headers['Content-Type'],ext==='webm'?'audio/webm':'audio/wav');
  const f=join(dir,`served-${id}.${ext}`);await writeFile(f,r.body);const m=await loudness(f);
  assert.ok(Math.abs(m.lufs-LOUDNESS.target)<=LOUDNESS.tolerance,`${id}.${ext}: ${m.lufs} LUFS, target ${LOUDNESS.target}`);
  assert.ok(m.peak<=0,`${id}.${ext}: peak ${m.peak} dBTP`);
  assert.ok(Math.abs(duration(f)-3)<0.03,`${id}.${ext}: duration ${duration(f)}`);}
 assert.equal((await loudness(quiet)).lufs,qIn,'the stored clip is never rewritten');
 assert.equal((await get(svc,'/book-voice/0000000000000009.webm')).status,404);
});
