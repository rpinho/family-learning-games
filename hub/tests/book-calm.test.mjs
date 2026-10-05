import test from 'node:test';
import assert from 'node:assert/strict';
import {calmLines} from '../../book/calm-lines.mjs';
import {calmSound} from '../public/calm-sound.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const L=t=>({who:'narrator',text:t,voice:'af_bella',speed:0.9});
const ch={player:'kid',name:'Kid',date:'2026-01-01',pages:[
 {say:[L('Once upon a time.')]},
 {beat:{kind:'count',n:9,ask:L('How many dinosaur eggs?'),answer:'9',spoken:L('Tap each one to count the dinosaur eggs.'),done:L('Yes! 9 dinosaur eggs!')}},
 {beat:{kind:'kick-letter',letter:'P',done:L('You kicked the P ball in!')}},
 {beat:{kind:'puzzle',answer:'18',done:L('Yes! 18! The lock clicks open.')}},
 {beat:{kind:'order'}},{beat:{kind:'teach-letter',letter:'B'}},{beat:{kind:'no',right:'B'}},{beat:{kind:'signs',target:'bug'}},{beat:{kind:'spell',answer:['Max','can','hug','Dad']}}]};
test('Calm lines: his name, one instruction then the hand-over, specific praise with a small image, warm resets, the offer',()=>{
 const c=calmLines(ch);
 assert.match(c.greet.text,/Kid/);assert.equal(c.greet.voice,'af_bella');
 assert.equal(c.pages[1].ask.text,"Kid, tap each one to count the dinosaur eggs. Say done when you finish.");assert.equal(c.pages[1].done,true);
 assert.match(c.pages[1].praise.text,/^Nine dinosaur eggs, counted one by one, like /);
 assert.match(c.pages[2].praise.text,/The P ball/);assert.match(c.pages[3].praise.text,/^18\. The lock clicks open\. You worked it out/);
 assert.match(c.pages[8].praise.text,/^Max can hug Dad\./);assert.match(c.pages[6].praise.text,/B is the one/);
 assert.equal(c.resets.length,4);assert.match(c.offer.text,/easier.*harder/);
 const texts=[c.greet,...c.resets,c.offer,c.easier,c.harder,...Object.values(c.pages).flatMap(o=>[o.ask,o.praise].filter(Boolean))].map(l=>l.text);
 assert.equal(new Set(texts).size,texts.length,'no line repeats');
 for(const t of texts)assert.doesNotMatch(t,/!/,'calm: no exclamation marks');
});
import {matchUtterance} from '../listen/match.mjs';
test('Saying done: done, I\'m done, finished, ready count; counting out loud does not',()=>{
 const t={kind:'word',word:'done',also:['finished','ready']};
 for(const s of ['done',"I'm done",'all done','finished','I am ready'])assert.equal(matchUtterance(s,t).match,true,s);
 for(const s of ['one two three','four','dog','nine eggs'])assert.equal(matchUtterance(s,t).match,false,s);
});

// Execute the real shared success handlers with sound spies, without a browser or child saves.
test('Correct choices and celebration keep their visuals and praise without pluck or ding',async()=>{
 const src=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 const calls=[],visuals=[],praise=[];
 const classes=()=>({add:x=>visuals.push(x),remove(){},contains:()=>false});
 const buttons=[],play={append:b=>buttons.push(b),querySelector:()=>buttons[1]};
 const ctx={turn:1,tele:null,IDLE_REPEAT_MS:1,IDLE_REPEATS:2,later(){},teleTap(){},teleHint(){},
  nextReset:()=>null,ch:{ui:{tryAgain:'try again'}},speak:x=>praise.push(x),
  document:{createElement:()=>({classList:classes(),dataset:{}})},CSS:{escape:String},
  snd:{pluck:()=>calls.push('pluck'),soft:()=>calls.push('soft')},
  pluck:()=>calls.push('pluck'),ding:()=>calls.push('ding'),dingClientRect:()=>calls.push('dingClientRect'),
  view:{querySelector:()=>({insertAdjacentHTML:()=>visuals.push('glint')}),querySelectorAll:()=>[{classList:classes()}]},fxHTML:()=>''};
 vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('function choices('),src.indexOf('async function runBeat('))+src.slice(src.indexOf('function burst(')).split('\n')[0],ctx);
 ctx.choices(play,['wrong','right'],{answer:'right',my:1,onRight:()=>{ctx.burst('confetti');ctx.speak('well done');}});
 await buttons[1].onclick();await buttons[1].onclick();
 assert.deepEqual(calls,[]);assert.ok(visuals.includes('right'));assert.ok(visuals.includes('glint'));assert.ok(visuals.includes('hop'));assert.deepEqual(praise,['well done']);
 buttons.length=0;ctx.choices(play,['wrong','right'],{answer:'right',my:1,onRight:()=>ctx.burst()});
 await buttons[0].onclick();await buttons[1].onclick();assert.deepEqual(calls,['soft'],'only the wrong answer plays a tone');
});
test('Every Book page, including Pond and the Hunt finds card, forbids correct-answer tones',async()=>{
 for(const file of ['book.mjs','pond/pond.mjs']){
  const src=await readFile(new URL('../public/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(src,/\b(?:pluck|ding|dingClientRect)\s*\(/,file+' must never call a correct-answer tone');
 }
 const hunt=await readFile(new URL('../public/hunt.mjs',import.meta.url),'utf8');
 const found=hunt.slice(hunt.indexOf("type:'hunt',date,page:0,id:h.id,stage:'found'"),hunt.indexOf('// what he found'));
 assert.ok(found);assert.doesNotMatch(found,/snd\.(?:pluck|strum|soft)\s*\(/,'confirmed finds keep only visuals and spoken praise');
});
test('Wrong answers keep their quiet tone; no chapter strum is exposed',async t=>{
 const fetched=[];
 class Context{state='running';currentTime=0;destination={};
  createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}
  createBufferSource(){return {connect(){},start(){}};}
  async decodeAudioData(){return {duration:10};}close(){}
 }
 t.mock.method(globalThis,'fetch',async u=>{fetched.push(u);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};});
 const oldContext=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),oldLog=Object.getOwnPropertyDescriptor(globalThis,'__calmLog');
 t.after(()=>{for(const [k,v]of [['AudioContext',oldContext],['__calmLog',oldLog]]){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}});
 globalThis.AudioContext=Context;globalThis.__calmLog=[];
 const snd=calmSound();snd.unlock();await snd.soft();assert.equal(snd.strum,undefined);
 assert.deepEqual(globalThis.__calmLog.map(x=>x.fx),['soft']);
 assert.deepEqual(fetched,['/calm/soft.m4a']);snd.stop();
});

test('Chapter closing card and its choices and hints play speech alone',async()=>{
 const src=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 const ending=src.slice(src.indexOf('async function ending(){'),src.indexOf('function stop(){'));
 assert.match(ending,/snd\.stop\(\)/,'pending effects are cancelled at chapter end');
 assert.doesNotMatch(ending,/snd\.(?!stop\b)\w+\s*\(/,'no non-speech sound anywhere on the closing card');
 assert.match(ending,/await speak\(closing\)/);assert.match(ending,/await speak\(calm\[v\]\)/);
});
