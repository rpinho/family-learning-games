// Real-browser layout/audio regression checks. QA uses temporary Admin saves only.
// PLAYWRIGHT_MODULE, CHROME, RELEASE_DIR, VOICE_DIR and FRAME_DIR are supplied by the runner.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {freshProfile,random} from '../lib/math.mjs';
import {countingQuestion,countingOptions} from '../lib/counting.mjs';
import {balanceQuestion} from '../lib/balance.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const release=resolve(process.env.RELEASE_DIR||'.'),frames=resolve(process.env.FRAME_DIR);
await mkdir(frames,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),servers=[],evidence=[];
const chromeProfile=await mkdtemp(join(tmpdir(),'layout-chrome-'));
const chrome=spawn(process.env.CHROME,['--headless=new','--remote-debugging-port=19627','--user-data-dir='+chromeProfile,'--autoplay-policy=no-user-gesture-required','--no-first-run','about:blank'],{stdio:'ignore'});
let browser;
const close=()=>{for(const s of servers)s.kill('SIGTERM');chrome.kill('SIGTERM');};
process.once('SIGINT',()=>{close();process.exit(130);});process.once('SIGTERM',()=>{close();process.exit(143);});
try{
 for(let i=0;i<200;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:19627');break;}catch{await pause(100);}}
 assert.ok(browser,'Chrome started');
 await Promise.all([['phone',390,844],['small-phone',360,740],['tablet',1180,820],['chromebook',1366,768]].map(async([name,width,height],index)=>{
  const data=await mkdtemp(join(tmpdir(),'layout-save-'));
  await symlink(resolve(process.env.VOICE_DIR),join(data,'voice'));
  const port=19631+index,base='http://127.0.0.1:'+port;
  servers.push(spawn(process.execPath,['server.mjs'],{cwd:release,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NUMBER_PARK_DATA:data,LETTER_QUEST_DATA:join(data,'no-reading')},stdio:'ignore'}));
  for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await pause(100);}
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});
  await context.addInitScript(()=>{
   window.__audio=[];const play=HTMLMediaElement.prototype.play,pause=HTMLMediaElement.prototype.pause;
   HTMLMediaElement.prototype.play=function(){if(!this.__seen){this.__seen=true;this.addEventListener('ended',()=>window.__audio.push({kind:'ended',src:this.src}));}return play.call(this);};
   HTMLMediaElement.prototype.pause=function(){if(!this.ended&&!this.paused&&this.currentTime>0)window.__audio.push({kind:'cut',src:this.src});return pause.call(this);};
  });
  const fixture=async q=>{
   const p=freshProfile('admin');p.xp=47;p.drawing=[[[1,1],[2,2]]];p.completed={mix:2};p.session={game:q.kind,round:0,correct:0,independent:0,result:null,finished:false,helped:false,started:Date.now(),question:{...q,id:'fixture-'+name}};
   await writeFile(join(data,'admin.json'),JSON.stringify(p));return p;
  };
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await fixture(balanceQuestion(3,0,random(1)));
  await page.goto(base+'/?player=admin&resume=1&quiet=1');await page.locator('.balance-stage').waitFor();
  const scene=await page.locator('.balance-stage').boundingBox(),board=await page.locator('.playboard').boundingBox();
  assert.ok(scene.x>=0&&scene.x+scene.width<=width);
  if(width>750)assert.ok(scene.width>board.width*.7,'landscape scene fills most of the card');
  else assert.ok(board.height<=height,'phone balance puzzle fits without scrolling '+JSON.stringify(board));
  await page.screenshot({path:join(frames,name+'-balance.png')});
  const cards=page.locator('.balance-animal-card');await cards.nth(0).tap();await cards.nth(1).tap();
  assert.equal(await page.locator('.balance-game').getAttribute('data-ready'),'true');
  assert.equal(await page.locator('.balance-game').getAttribute('data-angle'),'0');
  assert.equal(await page.locator('.balance-weight').count(),0);
  await page.screenshot({path:join(frames,name+'-balance-placed.png')});
  let q;for(let seed=1;seed<1000;seed++){const r=random(seed);q=countingQuestion(r,0,{stretch:true});q.options=countingOptions(q.answer,r,q.max);if(q.count===16)break;}
  assert.equal(q.count,16);const p=await fixture(q);
  await page.reload();await page.getByRole('button',{name:'Resume my round'}).click();await page.locator('.count-field').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.count-field button')?.disabled);
  const countBoard=await page.locator('.playboard').boundingBox();
  console.log(name,'count board',JSON.stringify(countBoard));
  if(width<600)assert.ok(countBoard.height<=height,'16-object phone puzzle fits '+JSON.stringify(countBoard));
  const tokens=page.locator('.count-field .token');assert.equal(await tokens.count(),16);
  const rects=await tokens.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
  for(const b of rects){assert.ok(b.width>=44&&b.height>=44,'tappable objects');assert.ok(b.x>=0&&b.x+b.width<=width);}
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'objects do not overlap');}
  await page.screenshot({path:join(frames,name+'-count16-before.png')});
  for(let i=0;i<16;i++){
   await tokens.nth(i).tap();
   assert.ok(await page.locator('.answers button').first().isDisabled(),'answer waits for complete number audio');
   if(i===13){await page.evaluate(()=>document.querySelectorAll('.count-field button')[14].click());assert.equal(await page.locator('.counted').count(),14,'rapid next tap cannot interrupt fourteen');}
   await page.waitForFunction(()=>!document.querySelector('.count-field button')?.disabled);
   assert.equal(await page.locator('.counted').count(),i+1);
  }
  await tokens.nth(0).tap();assert.equal(await page.locator('.counted').count(),16,'recount tap is idempotent');
  const audio=await page.evaluate(()=>window.__audio),manifest=await(await fetch(base+'/voice/manifest.json')).json();
  assert.equal(audio.filter(e=>e.kind==='cut').length,0,JSON.stringify(audio));
  for(const n of ['14','15','16']){assert.ok(manifest.clips[n]);assert.ok(audio.some(e=>e.kind==='ended'&&e.src===base+manifest.clips[n]),'complete number '+n);}
  await page.screenshot({path:join(frames,name+'-count16-counted.png')});
  await page.locator('.answers button').filter({hasText:/^16$/}).tap();await page.locator('.result.win').waitFor();
  const saved=JSON.parse(await readFile(join(data,'admin.json'),'utf8'));
  assert.equal(saved.xp,57);assert.equal(saved.history.at(-1).answer,16);assert.equal(saved.ceiling,13);assert.deepEqual(saved.drawing,p.drawing);assert.deepEqual(saved.completed,p.completed);
  assert.deepEqual(errors,[]);evidence.push({name,width,height,scene,board,countBoard,rects,completedAudio:audio,errors});
  await page.close();await context.close();console.log(name,'layout, touch, full 14–16 audio and save checks passed');
 }));
 await writeFile(join(frames,'layout-evidence.json'),JSON.stringify(evidence,null,2));
}finally{if(browser)await browser.close();close();}
