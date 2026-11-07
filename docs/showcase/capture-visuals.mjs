// Capture the current player, with its native controls and independently authored demo art.
// Start demo-server.mjs and the hub with empty, isolated data. No household endpoint is used.
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const scratch=process.env.CAPTURE_DIR;
if(!scratch||!process.env.CHROME)throw Error('Set CAPTURE_DIR outside the repository and CHROME to test Chrome.');
const world=`http://localhost:${Number(process.env.SHOWCASE_WORLD_PORT||5710)}`;
const hub=`http://localhost:${Number(process.env.SHOWCASE_HUB_PORT||5727)}`;
const shots=resolve('docs/showcase/screenshots'),media=resolve('docs/media');
await mkdir(resolve(scratch,'raw-video'),{recursive:true});
const clips=process.env.SHOWCASE_PRIOR_CLIPS?JSON.parse(await readFile(process.env.SHOWCASE_PRIOR_CLIPS)).filter(c=>!c.id.startsWith('world-')&&!c.id.startsWith('book-')):[];
const receipts=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--mute-audio']});
let context,page,origin;
async function fresh({video=false}={}){
 await context?.close();
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,...(video?{recordVideo:{dir:resolve(scratch,'raw-video'),size:{width:1280,height:720}}}:{reducedMotion:'reduce'})});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
 page=await context.newPage();page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));origin=Date.now();
}
async function shot(id){
 await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode().catch(()=>{}))));
 const broken=await page.locator('img').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().width&&(!x.complete||!x.naturalWidth)).length);
 if(broken)throw Error('Broken image in '+id);
 const actors=await page.locator('.bk-actor,.actor').evaluateAll(xs=>xs.map(x=>({id:x.dataset.id,height:x.getBoundingClientRect().height/innerHeight})));
 if(id==='book-story'&&actors.some(a=>a.id==='grown-up'&&a.height<.35))throw Error('The story guide must occupy at least 35% of the frame.');
 await page.screenshot({path:resolve(shots,id+'.png'),animations:'disabled'});
 await copyFile(resolve(shots,id+'.png'),resolve(media,id+'.png'));
 receipts.push({id,actors,brokenImages:broken});console.log('Captured:',id);
}
async function record(id,seconds,actions=[]){
 const start=(Date.now()-origin)/1000,path=await page.video().path();
 await Promise.all([page.waitForTimeout(seconds*1000),...actions.map(async([at,fn])=>{await page.waitForTimeout(at*1000);await fn();})]);
 clips.push({id,path,start,duration:seconds});
}
async function bookPage(n){
 await page.goto(`${world}/book-demo?page=${n}`);
 await page.locator('.bk-open').click({force:true});
 await page.locator(`.bk-page[data-page="${n}"]`).waitFor();
}
try{
 await fresh();await page.goto(`${world}/world?player=hero&session=stills-${Date.now()}`);await page.locator('.actor.hero').waitFor();await shot('world-walk');
 await page.locator('.actor:not(.hero)').first().click({force:true});
 await page.waitForFunction(()=>document.querySelector('#goal')?.dataset.key==='next-acorns');await shot('world-talk');
 await page.locator('#map-button').click();await shot('world-map');
 await fresh();await page.goto(`${world}/world?player=hero&session=treasure-still&reveal=1`);await page.locator('.bk-gate.open').waitFor();await shot('world-treasure');
 await fresh();await bookPage(0);await page.locator('.bk-magic').waitFor();await page.locator('.bk-gate.open').waitFor();await page.waitForTimeout(500);await shot('book-story');
 await fresh();await bookPage(1);await page.locator('.bk-painted-target').first().waitFor();
 for(let i=1;i<=12;i++){await page.locator('.bk-painted-target[data-v="'+i+'"]').click({force:true});await page.waitForTimeout(1600);}
 await page.locator('.bk-play [data-v="12"]').waitFor();
 await shot('book-count');
 await fresh();await bookPage(2);await page.locator('.bk-btn.no').waitFor();await page.locator('.bk-btn.no').click({force:true});await page.locator('.bk-play [data-v="3"]').waitFor();await shot('book-choice');
 // Complete a fictional, photo-free setup in the isolated hub, then capture Admin.
 await fresh();await page.goto(hub+'/onboarding');if(!await page.locator('#family').isVisible()){await page.locator('#code').filter({hasText:/[A-Z]/}).waitFor();
 const answer=(await page.locator('#code').innerText()).replace(/[^A-Z]/g,'').split('').reverse().join('');
 await page.locator('#answer').fill(answer);await page.locator('#gate-form button').click();
 const editor=page.locator('#editor');await editor.waitFor({state:'visible'});
 await page.locator('[name="name"]').fill('Explorer');await page.locator('[name="age"]').fill('8');
 for(let i=0;i<3;i++)await page.locator('#next').click();await page.locator('#save').click();await page.locator('#family').waitFor({state:'visible'});}
 await page.goto(hub+'/?player=admin#games');await page.locator('.calm-home').waitFor();await shot('calm-home');
 // Native recordings use normal motion. Static captures above use the player's reduced-motion setting.
 await fresh({video:true});await page.goto(`${world}/world?player=hero&session=film`);await page.locator('.actor.hero').waitFor();
 await record('world-walk-talk-map',8,[[.2,()=>page.mouse.click(570,680)],[2.5,()=>page.locator('.actor:not(.hero)').first().click({force:true})],[5.3,()=>page.locator('#map-button').click()]]);
 await fresh({video:true});await page.goto(`${world}/world?player=hero&session=film-treasure&reveal=1`);await page.locator('.bk-gate').waitFor();await record('world-treasure',3);
 await fresh({video:true});await bookPage(0);await page.locator('.bk-gate').waitFor();await record('book-gate',6);
 await fresh({video:true});await bookPage(1);await page.locator('.bk-painted-target').first().waitFor();
 await record('book-count',5,Array.from({length:3},(_,i)=>[.3+i*1.7,()=>page.locator('.bk-painted-target[data-v="'+(i+1)+'"]').click({force:true})]));

 // Earn the large garden in isolated Admin practice, starting with fresh saves.
 await fresh();
 async function searchRequest(body){const r=await page.request.post(hub+'/api/word-search?player=admin',{data:body});if(!r.ok())throw Error('Admin garden: '+r.status());return r.json();}
 let ws=await searchRequest({type:'open'});
 while(ws.profile.completed<12){for(const t of ws.profile.current.targets)if(!ws.profile.current.found.includes(t.word))ws=await searchRequest({type:'select',revision:ws.profile.revision,first:t.cells[0],last:t.cells.at(-1)});ws=await searchRequest({type:'next',revision:ws.profile.revision});}
 await fresh({video:true});await page.goto(hub+'/?player=admin#word-search');await page.locator('.ws-grid[style="--size:12"]').waitFor();await shot('word-search');
 const find=async t=>{await page.locator('[data-cell="'+t.cells[0]+'"]').click();await page.locator('[data-cell="'+t.cells.at(-1)+'"]').click();await page.waitForTimeout(220);};
 await record('word-search',6,ws.profile.current.targets.slice(0,3).map((t,i)=>[.5+i*1.5,()=>find(t)]));
 for(const t of ws.profile.current.targets.slice(3))await find(t);await page.locator('.ws-finish').waitFor();await shot('word-search-finish');
 await page.locator('[data-expert]').click();await page.locator('.ws-expert').waitFor();await shot('word-search-expert');
 await fresh({video:true});await page.goto(hub+'/?player=admin#word-blocks');await page.locator('[data-activity="spelling"]').click();await page.locator('[data-turn="0"]').waitFor();await shot('word-blocks');
 await record('word-blocks',6,[[.5,()=>page.locator('[data-turn="0"]').press('ArrowUp')],[1.6,()=>page.locator('[data-turn="1"]').press('ArrowUp')],[2.8,()=>page.locator('[data-turn="2"]').press('ArrowUp')]]);
 await fresh({video:true});await page.goto(hub+'/?player=admin#free-build');await page.locator('[data-type="block"]:enabled').waitFor();
 const canvas=await page.locator('.fb-stage canvas').boundingBox();
 async function toy(type,x,y){const box=await page.locator('[data-type="'+type+'"]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*x,canvas.y+canvas.height*y,{steps:18});await page.mouse.up();await page.waitForTimeout(350);}
 for(const [type,x,y] of [['block',.4,.72],['block',.4,.61],['bounce',.65,.73],['gear',.7,.42],['gear',.82,.42]])await toy(type,x,y);
 await shot('free-build');await record('free-build',6,[[.4,()=>toy('ball',.5,.2)],[2,()=>page.mouse.click(canvas.x+canvas.width*.7,canvas.y+canvas.height*.42)]]);
 if(errors.length)throw Error(errors.join('\n'));
}finally{
 await context?.close();await browser.close();
 await writeFile(resolve(scratch,'clips.json'),JSON.stringify(clips,null,2));
 await writeFile(resolve(scratch,'capture-receipts.json'),JSON.stringify({errors,receipts},null,2));
}
