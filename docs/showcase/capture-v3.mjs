// Optional Playwright tooling. All URLs must point at empty, isolated loopback previews.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const scratch=process.env.CAPTURE_DIR;if(!scratch)throw Error('Set CAPTURE_DIR outside the repository.');
const shots=resolve('docs/showcase/screenshots'),tiles=resolve('docs/showcase/tiles');
await Promise.all([mkdir(shots,{recursive:true}),mkdir(tiles,{recursive:true}),mkdir(scratch,{recursive:true})]);
const ports=JSON.parse(process.env.SHOWCASE_PORTS||'{"letter-quest":5721,"word-arcade":5722,"number-park":5723,"maze-garden":5724,"three-in-a-row":5725,"target-trail":5726,"hub":5727,"world":5710}');
const labels=(process.env.SHOWCASE_PRIVATE_LABELS||'').split(',').filter(Boolean);
const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--mute-audio']});
const clips=(process.env.SHOWCASE_GAMES_ONLY||process.env.SHOWCASE_EXTRAS_ONLY||process.env.SHOWCASE_WORLD_ONLY)?JSON.parse(await readFile(resolve(scratch,'clips.json'))).filter(c=>process.env.SHOWCASE_WORLD_ONLY?!(c.id.startsWith('world-')||c.id.startsWith('book-')):process.env.SHOWCASE_EXTRAS_ONLY||c.id.startsWith('world-')||c.id.startsWith('book-')):[],errors=[],receipts=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let context,page,origin;
async function fresh(){
 if(context)await context.close();
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2,recordVideo:{dir:resolve(scratch,'raw-video'),size:{width:1280,height:720}}});
 await context.route('**/*',async route=>{
  if(new URL(route.request().url()).hostname!=='localhost')return route.abort();
  try{const response=await route.fetch(),type=response.headers()['content-type']||'';
   if(/html|javascript|json/.test(type)&&labels.length){let body=await response.text();for(const label of labels)body=body.replaceAll(label,'Explorer').replaceAll(label.toUpperCase(),'EXPLORER');return route.fulfill({response,body});}
   return route.fulfill({response});
  }catch{await route.abort();}
 });
 await context.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend?.(),150);speechSynthesis.cancel=()=>{};});
 page=await context.newPage();origin=Date.now();page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
}
async function load(game,hash=''){
 await fresh();const url=`http://localhost:${ports[game]}/?player=admin${hash?'#'+hash:''}`;await page.goto(url);await wait(750);
 if(game==='hub'&&page.frames().length>1){const frame=page.frames().at(-1);await page.goto(frame.url());await wait(650);}
}
async function click(name){await page.getByRole('button',{name,exact:false}).first().click({force:true});await wait(300);}
async function shot(id){
 const visible=await page.locator('body').innerText();for(const label of labels)if(visible.includes(label))throw Error('Private label in '+id);
 await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode().catch(()=>{}))));
 const broken=await page.locator('img').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().width>0&&!x.complete||x.getBoundingClientRect().width>0&&x.naturalWidth===0).map(x=>x.src));
 if(broken.length)throw Error('Broken artwork: '+broken.join(', '));
 await page.screenshot({path:resolve(shots,id+'.png'),scale:'css'});
 await page.screenshot({path:resolve(tiles,id+'@2x.png'),scale:'device'});
 receipts.push({id,visible,brokenImages:0,privateLabels:0});
 console.log('Still:',id);
}
async function record(id,seconds,actions=[]){
 const start=(Date.now()-origin)/1000,video=page.video();
 const tasks=actions.map(([at,fn])=>wait(at*1000).then(fn));
 await wait(seconds*1000);await Promise.all(tasks);
 const path=await video.path();clips.push({id,path,start,duration:seconds});console.log('Clip:',id,seconds);
}
try{
 if(!process.env.SHOWCASE_GAMES_ONLY&&!process.env.SHOWCASE_EXTRAS_ONLY){
 await fresh();await page.goto(`http://localhost:${ports.world}/world?player=hero&session=walk-${Date.now()}`);await page.locator('#world').waitFor({state:'visible'});await wait(750);await shot('world-walk');
 await record('world-walk-talk-map',8,[[.2,()=>page.mouse.click(640,665)],[2.5,()=>page.locator('.actor:not(.hero)').first().click({force:true})],[4.2,()=>shot('world-talk')],[5.3,()=>page.locator('#map-button').click()],[6,()=>shot('world-map')]]);
 await fresh();await page.goto(`http://localhost:${ports.world}/world?player=hero&session=treasure&reveal=1`);await page.locator('.bk-gate').waitFor();await record('world-treasure',3,[[2.3,()=>shot('world-treasure')]]);
 await fresh();await page.goto(`http://localhost:${ports.world}/book-demo?capture=1`);await page.locator('.bk-open').click({force:true});await page.locator('.bk-gate').waitFor();
 await record('book-gate',6,[[3.8,()=>shot('book-story')]]);
 await page.locator('.bk-painted-thing').first().waitFor();await wait(300);await shot('book-count');
 await record('book-count',5,Array.from({length:12},(_,i)=>[.3+i*.19,()=>page.getByRole('button',{name:'Stepping stone '+(i+1),exact:true}).click({force:true})]).concat([[3.1,()=>page.locator('.bk-play [data-v="12"]').click({force:true})]]));
 await page.locator('.bk-btn.no').waitFor();await wait(600);await shot('book-choice');
 }
 if(!process.env.SHOWCASE_EXTRAS_ONLY&&!process.env.SHOWCASE_WORLD_ONLY){
 await load('letter-quest');await page.getByRole('button',{name:'Read',exact:true}).click();await wait(600);if(await page.locator('[data-action="reading-home"]').isVisible()){await page.locator('[data-action="reading-home"]').click();await wait(600);}await click('Word transformer');await wait(900);
 const state=await page.request.get(`http://localhost:${ports['letter-quest']}/api/admin/state`).then(r=>r.json());
 const q=state.profile.reading?.question||state.profile.reading?.session?.question||state.reading?.question;
 await shot('letter-quest');
 await record('letter-quest',3,[[.3,async()=>{if(!q)return;const from=q.from||'cat',target=q.answer;const index=[...from].findIndex((c,i)=>c!==target[i]);await page.locator(`[data-action="reading-position:${index}"]`).click();const tile=q.tiles.indexOf(target[index]);await page.locator(`[data-action="reading-tile:${tile}"]`).click();}],[1.25,()=>click('Check my answer')],[2,()=>shot('letter-quest-feedback')]]);
 await load('number-park');await click('Put together');await wait(700);await shot('number-park');
 const number=await page.request.get(`http://localhost:${ports['number-park']}/api/admin`).then(r=>r.json());
 const nq=number.profile?.session?.question||number.session?.question;
 await record('number-park',3,[[.4,()=>click('Put together →')],[1.3,async()=>{if(nq)await page.getByRole('button',{name:String(nq.answer??(nq.a+nq.b)),exact:true}).click();}],[2,()=>shot('number-park-feedback')]]);
 await load('maze-garden');await page.locator('#board').focus();await shot('maze-garden');
 await record('maze-garden',3,[[.3,()=>page.keyboard.press('ArrowUp')],[.8,()=>page.keyboard.press('ArrowRight')],[1.3,()=>page.locator('#hint').click()]]);
 await load('hub','chess');const lesson=page.getByRole('button',{name:'Start Find the forcing move'});if(await lesson.isVisible())await lesson.click();await page.locator('#chess-board').waitFor();await wait(600);await shot('chess');
 await record('chess',3,[[.4,()=>page.locator('[data-square="d5"]').click()],[1.2,()=>page.locator('[data-square="c7"]').click()],[2,()=>shot('chess-feedback')]]);
 await load('target-trail');if(await page.locator('#start').isVisible())await page.locator('#start').click();await page.locator('#overlay').waitFor({state:'hidden'});await page.locator('.range').scrollIntoViewIfNeeded();await shot('target-trail');
 await record('target-trail',3,[[.7,()=>page.locator('#fire').click()],[1.8,()=>page.keyboard.press('ArrowLeft')]]);
 }
 if(!process.env.SHOWCASE_WORLD_ONLY){
 // Remaining games have full-resolution gameplay stills, without lengthening the film.
 await load('word-arcade');await wait(1600);if(await page.getByRole('button',{name:/Word Reactor/}).first().isVisible())await page.getByRole('button',{name:/Word Reactor/}).first().click();if(await page.getByRole('button',{name:'Let’s play →',exact:false}).isVisible())await click('Let’s play →');await wait(4500);await shot('word-arcade');
 await load('three-in-a-row');if(await page.locator('#next').isVisible())await page.locator('#next').click();await page.getByRole('button',{name:/: empty$/}).first().click();await wait(1200);await page.locator('.board').evaluate(e=>e.scrollIntoView({block:'center'}));await shot('three-in-a-row');
 await load('hub','drawing-studio');const pad=page.locator('.draw-pad'),r=await pad.boundingBox();await page.mouse.move(r.x+r.width*.3,r.y+r.height*.8);await page.mouse.down();for(const [x,y]of [[.3,.45],[.48,.22],[.66,.45],[.66,.8],[.3,.8],[.3,.45],[.66,.45]])await page.mouse.move(r.x+r.width*x,r.y+r.height*y,{steps:6});await page.mouse.up();await shot('drawing-studio');
 await load('hub','sling');if(await page.locator('#start').isVisible())await page.locator('#start').click();await page.locator('#overlay').waitFor({state:'hidden'});await page.locator('#canvas').focus();await page.keyboard.press('ArrowUp');await shot('sling');
 await load('hub','dribble-duel/live');await page.locator('.live-soccer canvas').focus();await page.locator('.live-soccer canvas').evaluate(e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-100));await page.keyboard.down('ArrowUp');await wait(800);await page.keyboard.up('ArrowUp');await shot('dribble-duel');
 await load('hub');await shot('calm-home');
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{
 await context?.close();await browser.close();
 await writeFile(resolve(scratch,'clips.json'),JSON.stringify(clips,null,2));
 await writeFile(resolve(scratch,'capture-receipts.json'),JSON.stringify({errors,receipts},null,2));
}
