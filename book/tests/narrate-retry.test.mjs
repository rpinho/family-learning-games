import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {narrate} from '../generate.mjs';
async function worker(failures,code=134){
 const root=await mkdtemp(join(tmpdir(),'narration-abort-')),audit=join(root,'audit.jsonl'),python=join(root,'worker');
 await writeFile(python,`#!${process.execPath}
const fs=require('node:fs'),r=JSON.parse(fs.readFileSync(process.argv.at(-1))),audit=process.env.NARRATE_AUDIT;let rows=[];try{rows=fs.readFileSync(audit,'utf8').trim().split('\\n');}catch{}fs.appendFileSync(audit,JSON.stringify({threads:process.env.BOOK_VOICE_THREADS,lines:r.lines})+'\\n');if(rows.length<${failures}){console.error('synthetic worker failure');process.exit(${code});}console.log(JSON.stringify({made:r.lines.length,clips:Object.fromEntries(r.lines.map(l=>[l.voice+'|'+l.speed+'|'+l.text,'synthetic.wav']))}));`,{mode:0o700});
 return {audit,paths:{python,voice:join(root,'voice')},env:{...process.env,NARRATE_AUDIT:audit}};
}
const lines=[{voice:'synthetic',speed:1,text:'A short sentence.'}];
test('transient aborts retry the same bounded request with one worker thread and return all clips',async()=>{
 const f=await worker(2),result=await narrate(lines,f);assert.equal(result.made,1);assert.equal(result.clips['synthetic|1|A short sentence.'],'synthetic.wav');
 const rows=(await readFile(f.audit,'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(rows.map(r=>r.threads),['2','1','1']);for(const r of rows)assert.deepEqual(r.lines,lines);
});
test('persistent aborts stop after three attempts; other failures never retry',async()=>{
 for(const code of [134,7]){const f=await worker(10,code);await assert.rejects(narrate(lines,f),/synthetic worker failure/);const rows=(await readFile(f.audit,'utf8')).trim().split('\n');assert.equal(rows.length,code===134?3:1);}
});
