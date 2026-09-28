import test from 'node:test';
import assert from 'node:assert/strict';
import {matchUtterance,rankFor,decide,skeleton} from '../listen/match.mjs';
import {listenService,cleanTarget,listenSettings} from '../listen-service.mjs';
test('Child-tolerant matching: close is good enough, a different word is not', () => {
 const w=t=>matchUtterance(t,{kind:'word',word:'mat'}).match;
 for(const ok of ['mat','Mat.','Matt!','the mat','mad','met'])assert.equal(w(ok),true,ok);
 for(const no of ['man','bat','cat','','hello'])assert.equal(w(no),false,no);
 const l=t=>matchUtterance(t,{kind:'letter',letter:'L',names:['Lulu']}).match;
 for(const ok of ['L','el','Lll','luh','Lulu','Lula','lion'])assert.equal(l(ok),true,ok);
 for(const no of ['M','sss','yes','no','um'])assert.equal(l(no),false,no);
 assert.equal(skeleton('Matt'),skeleton('mat'));
});
test('Ranking candidates: the expected reading against near misses that the matcher would reject', () => {
 const r=rankFor({kind:'word',word:'bed'});assert.deepEqual(r.target,['bed']);assert.ok(r.others.length>=4);
 for(const o of r.others)assert.equal(matchUtterance(o,{kind:'word',word:'bed'}).match,false,o);
 const L=rankFor({kind:'letter',letter:'M',names:[]});assert.ok(L.target.includes('Mmm'));assert.ok(!L.others.includes('M'));
 assert.equal(decide({text:'Alves',speech:.9,rank:{best:'target'}},{kind:'word',word:'fish'}).how,'ranked');
 assert.equal(decide({text:'',speech:.05,rank:{best:'target'}},{kind:'word',word:'fish'}).match,false,'silence never counts');
});
test('Targets are validated; settings come from env or a private file', () => {
 assert.equal(cleanTarget('{"kind":"word","word":"bed"}').word,'bed');
 assert.equal(cleanTarget('{"kind":"word","word":"<script>"}'),null);
 assert.equal(cleanTarget('{"kind":"letter","letter":"lo"}'),null);
 assert.equal(listenSettings({env:{}}),null);
 assert.equal(listenSettings({env:{FAMILY_LISTEN_PYTHON:'/x/python'}}).model,'small');
});
function fakeRes(){const r={status:0,body:null,writeHead(s){r.status=s;},end(b){r.body=JSON.parse(b);}};return r;}
function fakeReq(bytes,method='POST'){return {method,async *[Symbol.asyncIterator](){yield bytes;}};}
test('The hub listens, matches and logs only the result (never audio or what he said)', async () => {
 const logs=[];const recog={running:true,warm:async()=>true,transcribe:async()=>({text:'Bed.',speech:.95,ms:120})};
 const svc=listenService({settings:{},players:['kid'],log:e=>logs.push(e),recog});
 const pcm=Buffer.alloc(16000*2);
 let res=fakeRes();await svc.handle(fakeReq(pcm),res,new URL('http://x/api/listen?player=kid&kind=magic&target='+encodeURIComponent('{"kind":"word","word":"bed"}')));
 assert.equal(res.status,200);assert.equal(res.body.match,true);assert.equal(res.body.heard,undefined,'no transcript for children');
 assert.equal(logs.length,1);assert.equal(JSON.stringify(logs[0]).includes('Bed'),false);assert.equal(logs[0].match,true);
 res=fakeRes();await svc.handle(fakeReq(pcm),res,new URL('http://x/api/listen?player=kid&preview=1&target='+encodeURIComponent('{"kind":"word","word":"bed"}')));
 assert.equal(res.body.heard,'bed','grown-ups preview sees what it heard');assert.equal(logs.length,1,'preview is not logged');
 res=fakeRes();await svc.handle(fakeReq(Buffer.alloc(100)),res,new URL('http://x/api/listen?player=kid&target='+encodeURIComponent('{"kind":"word","word":"bed"}')));assert.equal(res.status,400);
 const off=listenService({settings:null,players:['kid']});res=fakeRes();await off.handle(fakeReq(pcm),res,new URL('http://x/api/listen?player=kid&target='+encodeURIComponent('{"kind":"word","word":"bed"}')));assert.equal(res.status,503);
 res=fakeRes();await off.handle(fakeReq(Buffer.alloc(0),'GET'),res,new URL('http://x/api/listen/status'));assert.equal(res.body.available,false);
});
test('Every module the pages import is served by the hub (a missing one blanks the page)', async () => {
 const {readFile,readdir}=await import('node:fs/promises');const dir=new URL('../public/',import.meta.url);
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.mjs'))){const src=await readFile(new URL(f,dir),'utf8');
  for(const m of src.matchAll(/from ['"]\.\/([a-z0-9/_-]+\.mjs)['"]/g))assert.ok(server.includes(`'${m[1]}'`),`${f} imports ${m[1]}, which the hub must serve`);}
});
test('A letter is heard leniently: its sound, its name, the usual mishearings, a word that starts with it',()=>{
 const B={kind:'letter',letter:'B',names:['Birdie']},ok=t=>matchUtterance(t,B).match;
 for(const t of ['B','B.','b?','Bee!','be','bi','buh','Bə','P','pee','ball','Birdie','Bye.'])assert.ok(ok(t),t);
 for(const t of ['M','sun','Dee','kay'])assert.ok(!ok(t),t);
 assert.equal(decide({text:'Me.',alts:['Be.'],speech:.9},B).match,false,'alternative readings are not used (they accepted every wrong sound)');
 assert.equal(decide({text:'',alts:['B'],speech:.05},B).match,false,'silence stays silence');
});
