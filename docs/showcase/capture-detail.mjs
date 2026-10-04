// Supplemental calm gameplay. Player IDs select empty preview presets only.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.CAPTURE_DIR;if(!dir)throw Error('Set a private CAPTURE_DIR.');
const labels=(process.env.SHOWCASE_PRIVATE_LABELS||'').split(',').filter(Boolean);
const ports=JSON.parse(process.env.SHOWCASE_PORTS||'{"letter-quest":5721,"number-park":5723}');
const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--mute-audio']});
const clips=[],receipts=[];
try{for(const game of process.env.SHOWCASE_LETTER_ONLY?['letter-quest']:['letter-quest','number-park']){
 const player=game==='number-park'?process.env.SHOWCASE_NUMBER_PLAYER||'explorer':'admin';
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2,recordVideo:{dir:resolve(dir,'raw-video'),size:{width:1280,height:720}}});
 try{
 await context.route('**/*',async route=>{try{if(new URL(route.request().url()).hostname!=='localhost')return route.abort();const response=await route.fetch();if(/html|javascript|json/.test(response.headers()['content-type']||'')){let body=await response.text();for(const label of labels)body=body.replaceAll(label,'Explorer').replaceAll(label.toUpperCase(),'EXPLORER');return route.fulfill({response,body});}await route.fulfill({response});}catch{await route.abort();}});
 await context.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend?.(),100);speechSynthesis.cancel=()=>{};});
 const page=await context.newPage(),origin=Date.now();page.setDefaultTimeout(9000);page.on('pageerror',e=>{throw e;});
 const wait=ms=>page.waitForTimeout(ms),url=`http://localhost:${ports[game]}/?player=${player}`;
 await page.goto(url);await wait(700);
 if(game==='letter-quest'){const mute=page.getByRole('button',{name:'Mute effects and praise',exact:true});if(await mute.isVisible()){await mute.click();await wait(300);}await page.getByRole('button',{name:/Letters Five little discoveries/}).click();await wait(800);await page.locator('.toast').waitFor({state:'hidden',timeout:8000});}
 else{await page.getByRole('button',{name:'Balance scale',exact:false}).click();await wait(700);}
 const screenshot=async id=>{const text=await page.locator('body').innerText();if(labels.some(n=>text.includes(n)))throw Error('Private label');const broken=await page.locator('img').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().width>0&&x.naturalWidth===0).length);if(broken)throw Error('Broken image');await page.screenshot({path:resolve('docs/showcase/screenshots',id+'.png'),scale:'css'});await page.screenshot({path:resolve('docs/showcase/tiles',id+'@2x.png'),scale:'device'});receipts.push({id,text,privateLabels:0,brokenImages:0});};
 let state=await page.request.get(`http://localhost:${ports[game]}/api/${player}${game==='letter-quest'?'/state':''}`).then(r=>r.json());
 let answer;
 if(game==='number-park'){
  const q=state.session.question;const masses={mouse:.025,hamster:.12,hedgehog:.8,rabbit:2,cat:4,fox:6,beagle:10,'African penguin':3.5,turkey:8,koala:9,badger:12,sheep:70,pig:150,'giant panda':100,lion:190,gorilla:160,horse:500,cow:650,giraffe:1000,'African elephant':5000};const left=masses[q.left.name],right=masses[q.right.name];answer=Number(q.direction==='lighter'?right<left:right>left);await page.locator('[data-animal="0"]').click();await wait(180);await page.locator('[data-animal="1"]').click();await wait(650);
 }else answer=state.challenge.answer||state.challenge.char;
 await screenshot(game);const start=(Date.now()-origin)/1000;
 await wait(650);
 if(game==='number-park')await page.locator(`[data-animal="${answer}"]`).click();
 else await page.getByRole('button',{name:'Letter '+String(answer),exact:true}).last().click();
 await wait(450);await screenshot(game+'-feedback');await wait(1900);
 clips.push({id:game,path:await page.video().path(),start,duration:3});
 console.log('Detailed gameplay:',game);
 }finally{await context.close();}
}}finally{await browser.close();}
const previous=JSON.parse(await readFile(resolve(dir,'clips.json')));
await writeFile(resolve(dir,'clips.json'),JSON.stringify([...previous.filter(c=>!clips.some(n=>n.id===c.id)),...clips],null,2));
await writeFile(resolve(dir,'detail-receipts.json'),JSON.stringify(receipts,null,2));
