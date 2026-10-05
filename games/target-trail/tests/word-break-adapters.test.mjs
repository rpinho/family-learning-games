import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
// Both Target Trail modes hand the word break a speak() that settles when the line is over (audio-finished contract).
const app=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8'),sling=await readFile(new URL('../dist/sling-app.mjs',import.meta.url),'utf8');
test('Target Trail word-break speech reports when each line is over, including a retried blocked question',()=>{
 assert.match(app,/speak:\(line,essential\)=>speak\(line,false,true,essential\)/);
 assert.match(app,/const el=audio=new Audio\(url\);globalThis\.calmBed\?\.watch\(el\);await el\.play\(\);pendingLine=null;return mediaSettled\(el\);/);
 assert.match(app,/pendingLine=line;return pendingDone\?\?=new Promise\(r=>pendingRelease=r\);/);
 assert.match(app,/const done=speak\(line,false,true,true\);pendingRelease\?\.\(done\);/);
});
test('Sling word-break speech already waits for the clip; a blocked line settles once retried',()=>{
 assert.match(sling,/speak:\(line,essential\)=>speak\(line,\{essential\}\)/);
 assert.match(sling,/await new Promise\(done=>\{a\.onended=a\.onpause=a\.onerror=done;\}\);/);
 assert.match(sling,/return new Promise\(r=>q\.release=r\);/);assert.match(sling,/q\.release\?\.\(speak\(q\.lines,q\)\);/);
});
