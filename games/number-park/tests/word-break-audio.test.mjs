import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {wordBreak,checkpointVoice,settled,mediaSettled,SETTLE_MAX_MS} from '../lib/word-break.mjs';
// The checkpoint's audio-finished contract (shared word-break module; identical test in every game repo).
// speak() returns a promise that settles when THAT line is over; a reply never cuts off the question.

const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const tick=async ms=>{mock.timers.tick(ms);await flush();};
// A fake adapter: each line "plays" until the test ends it, like a real clip.
function fakeAdapter(){
 const log=[],open=[];
 const speak=(text,essential)=>{let end;const p=new Promise(r=>end=r);const line={text,essential,end:(s='ended')=>{if(line.done)return;line.done=true;log.push(['end',text,s]);end(s);}};
  for(const o of open.splice(0))if(!o.done)log.push(['CUT',o.text]);open.push(line);log.push(['play',text]);return p;};
 return {speak,log,current:()=>open.find(o=>!o.done),cuts:()=>log.filter(e=>e[0]==='CUT')};
}
// Minimal DOM: enough for the dialog, its buttons and classes.
function fakeDoc(){
 const el=tag=>{const classes=new Set(),node={tagName:tag,children:[],dataset:{},style:{},isConnected:false,textContent:'',
  classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),contains:c=>classes.has(c)},
  set className(v){classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(c=>classes.add(c));},get className(){return [...classes].join(' ');},
  append(...k){for(const c of k){c.parent=node;c.isConnected=node.isConnected;node.children.push(c);}},
  setAttribute(){},addEventListener(){},focus(){},showModal(){node.open=true;},close(){node.open=false;},
  remove(){node.isConnected=false;if(node.parent)node.parent.children=node.parent.children.filter(c=>c!==node);},get offsetWidth(){return 1;}};return node;};
 const body=el('body');body.isConnected=true;const doc={createElement:el,body,head:el('head'),adoptedStyleSheets:[]};
 const all=n=>[n,...n.children.flatMap(all)];
 doc.buttons=()=>all(body).filter(n=>n.tagName==='button');
 doc.choice=v=>doc.buttons().find(b=>b.dataset.value===v);doc.hear=()=>doc.buttons().find(b=>b.className==='wb-hear');
 return doc;
}
const ITEM={kind:'find-letter',track:'letters',spoken:'Find the letter B.',answer:'B',options:['B','D','P']};
function open(adapter,item=ITEM){const doc=fakeDoc(),results=[];let resolved=null;
 const done=wordBreak({player:'qa-synthetic',item,doc,speak:adapter.speak,log:r=>results.push(r),effects:false});void done.then(r=>resolved=r);
 return {doc,results,resolved:()=>resolved};}

test('settled(): bounded, and anything that is not a promise counts as finished',async()=>{
 mock.timers.enable({apis:['setTimeout']});
 try{
  assert.equal(await settled(undefined),'unreported');
  let s=null;void settled(new Promise(()=>{})).then(v=>s=v);await tick(SETTLE_MAX_MS-1);assert.equal(s,null);await tick(1);assert.equal(s,'timeout');
  assert.equal(await settled(Promise.reject(Error('x'))),'failed');assert.equal(await settled(Promise.resolve(true)),'ended');assert.equal(await settled(Promise.resolve('blocked')),'blocked');
 }finally{mock.timers.reset();}
});
test('mediaSettled(): ends on ended, deliberate pause/replacement or error; a natural end is reported as ended',async()=>{
 const media=()=>{const el=new EventTarget();el.paused=false;el.ended=false;return el;};
 let el=media(),p=mediaSettled(el);el.dispatchEvent(new Event('ended'));assert.equal(await p,'ended');
 el=media();p=mediaSettled(el);el.paused=true;el.dispatchEvent(new Event('pause'));assert.equal(await p,'stopped');
 el=media();p=mediaSettled(el);el.paused=true;el.ended=true;el.dispatchEvent(new Event('pause'));assert.equal(await p,'ended');
 el=media();p=mediaSettled(el);el.dispatchEvent(new Event('emptied'));assert.equal(await p,'stopped');
 el=media();p=mediaSettled(el);el.dispatchEvent(new Event('error'));assert.equal(await p,'failed');
 el=media();el.paused=true;assert.equal(await mediaSettled(el),'stopped');
});
test('checkpointVoice(): a playing line is never replaced; one newest line waits; duplicates are dropped',async()=>{
 const a=fakeAdapter(),v=checkpointVoice(a.speak);
 assert.equal(await v.say('Q',true),true);
 const t1=v.say('Try again.');const t2=v.say('Try again.');assert.equal(await t2,false);
 const q2=v.say('Q',true);assert.equal(await q2,false,'the question is already playing');
 const praise=v.say('Yes!');assert.equal(await t1,false,'newest waiting line replaces the older one');
 assert.deepEqual(a.log,[['play','Q']]);
 a.current().end();await flush();assert.equal(await praise,true);assert.deepEqual(a.log.at(-1),['play','Yes!']);
 a.current().end();assert.equal(a.cuts().length,0);
});

for(const at of [100,400,900]){
 test(`a correct answer at ${at} ms never cuts the question; progress is logged at once`,async()=>{
  mock.timers.enable({apis:['setTimeout','Date']});
  try{
   const a=fakeAdapter(),w=open(a);
   await tick(at);w.doc.choice('B').onclick();await flush();
   assert.equal(w.results.length,1,'the answer is recorded immediately');assert.equal(w.results[0].misses,0);
   if(at<350){await tick(400);assert.deepEqual(a.log.map(e=>e[1]),['Yes!'],'answered before the question began: no question, praise only');}
   else{assert.deepEqual(a.log,[['play','Find the letter B.']],'praise waits for the question');
    await tick(5000);assert.equal(w.resolved(),null,'the break stays open while the question finishes');
    a.current().end();await flush();assert.deepEqual(a.log.at(-1),['play','Yes!']);}
   a.current()?.end();await tick(1000);assert.ok(w.resolved(),'the break closes after the usual pause');
   assert.equal(a.cuts().length,0);
  }finally{mock.timers.reset();}
 });
}
test('wrong then right mid-question: one short reply after the question, the question is not restarted over itself',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});
 try{
  const a=fakeAdapter(),w=open(a);await tick(400);
  w.doc.choice('D').onclick();w.doc.choice('P').onclick();w.doc.choice('D').onclick();await flush();
  assert.ok(w.doc.choice('B').classList.contains('glow'),'help glow still appears at once');
  w.doc.hear().onclick();await flush();
  assert.deepEqual(a.log,[['play','Find the letter B.']]);
  w.doc.choice('B').onclick();await flush();assert.equal(w.results[0].misses,3);
  a.current().end();await flush();assert.deepEqual(a.log.at(-1),['play','Yes!'],'only the praise follows; the waiting repeat was dropped');
  a.current().end();await tick(1000);assert.ok(w.resolved());assert.equal(a.cuts().length,0);
 }finally{mock.timers.reset();}
});
test('after the question ends: replay and replies play normally, and a reply in progress is not cut either',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});
 try{
  const a=fakeAdapter(),w=open(a);await tick(400);a.current().end();await flush();
  w.doc.choice('D').onclick();await flush();assert.deepEqual(a.log.at(-1),['play','Try again.']);
  w.doc.hear().onclick();await flush();assert.deepEqual(a.log.at(-1),['play','Try again.'],'replay waits for the short reply');
  a.current().end();await flush();assert.deepEqual(a.log.at(-1),['play','Find the letter B.'],'then the requested replay plays');
  a.current().end();await flush();w.doc.hear().onclick();await flush();assert.deepEqual(a.log.at(-1),['play','Find the letter B.']);
  assert.equal(a.cuts().length,0);
 }finally{mock.timers.reset();}
});
test('a stuck or silent adapter cannot hold the break open: bounded wait, and muted lines count as finished',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});
 try{
  const stuck={speak:()=>new Promise(()=>{})},w=open(stuck);await tick(400);w.doc.choice('B').onclick();await flush();
  assert.equal(w.results.length,1);await tick(SETTLE_MAX_MS-400);assert.equal(w.resolved(),null);await tick(400);await tick(1000);assert.ok(w.resolved(),'closed after the bound');
  const muted={speak:()=>undefined},m=open(muted);await tick(400);m.doc.choice('B').onclick();await flush();await tick(1000);assert.ok(m.resolved());
 }finally{mock.timers.reset();}
});
test('autoplay blocked: the question settles as blocked and the speaker replays it at once',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});
 try{
  const said=[];const blocked={speak:t=>{said.push(t);return Promise.resolve(said.length===1?'blocked':'ended');}};
  const w=open(blocked);await tick(400);w.doc.hear().onclick();await flush();
  assert.deepEqual(said,['Find the letter B.','Find the letter B.']);
 }finally{mock.timers.reset();}
});
