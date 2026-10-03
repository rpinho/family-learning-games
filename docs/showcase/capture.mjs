// Optional documentation tooling. Use only an isolated public installation with fresh Admin data.
// PLAYWRIGHT_MODULE points to an external Playwright install; CHROME_PATH selects test Chrome.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {demoChapter} from './demo-chapter.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.DEMO_URL||'http://localhost:4810';
const scratch=process.env.CAPTURE_DIR;if(!scratch)throw Error('Set CAPTURE_DIR for private intermediate frames.');
const root=fileURLToPath(new URL('../../',import.meta.url));
const shots=resolve(root,'docs/showcase/screenshots');await mkdir(shots,{recursive:true});await mkdir(scratch,{recursive:true});
const library=JSON.parse(await readFile(resolve(root,'hub/public/book-art/library.json'),'utf8'));
const ch=demoChapter(library);let previewChapter=ch;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||process.env.CHROME,headless:true,args:['--mute-audio']});
let n=0;const manifest=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,bypassCSP:true});
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 // Silent capture driver: skip device narration waits, without changing pictures or game mechanics.
 await page.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend?.(),150);speechSynthesis.cancel=()=>{};});
 page.on('dialog',d=>d.accept());
 const load=async id=>{await page.goto(base+'/?player=admin#'+id);await page.waitForTimeout(900);const f=page.frames().at(-1);
  // Fill the capture with the embedded app's own UI, at native scale.
  if(f.parentFrame()&&id==='three-in-a-row')return f;
  if(f.parentFrame()){await page.goto(f.url());await page.waitForTimeout(700);}
  return page.mainFrame();};
 const click=async(f,name)=>{await f.getByRole('button',{name,exact:false}).first().click();};

 const shot=async id=>{await page.screenshot({path:resolve(shots,id+'.png')});};
 const record=async(label,seconds,actions=[])=>{
  const start=n;manifest.push({label,start,frames:seconds*10});
  const tasks=actions.map(([at,fn])=>new Promise((ok,no)=>setTimeout(()=>Promise.resolve().then(fn).then(ok,no),at*1000)));
  const t=Date.now();for(let k=0;k<seconds*10;k++){const delay=t+k*100-Date.now();if(delay>0)await page.waitForTimeout(delay);await page.screenshot({path:resolve(scratch,`frame-${String(n++).padStart(5,'0')}.jpg`),type:'jpeg',quality:85});}
  await Promise.all(tasks);
 };
 // Authored fictional chapter in the existing read-only Admin preview. No save writes.
 await page.route('**/api/book/preview?*',route=>route.fulfill({json:{date:previewChapter.date,chapter:previewChapter,progress:{page:0},collection:{keys:['A','B','C'],words:[]},open:true,preview:true}}));
 let f=await load('book/beginner');await shot('book-cover');
 await page.locator('.bk-open').click({force:true});await page.waitForSelector('.bk-gate');
 await record('The Book · keys fly and painted doors open',6,[[4.5,()=>shot('book-story')]]);
 await page.waitForSelector('.bk-painted-thing');await page.waitForTimeout(1000);await shot('book-count');
 await record('The Book · count the painted stones',4,Array.from({length:12},(_,i)=>[.2+i*.17,()=>page.getByRole('button',{name:'Stepping stone '+(i+1),exact:true}).click()]).concat([[2.8,()=>page.locator('.bk-play [data-v="12"]').click()]]));
 await page.waitForSelector('.bk-btn.no');await page.waitForTimeout(1000);await shot('book-choice');
 await record('The Book · help the fox choose',3,[[.7,()=>page.locator('.bk-btn.no').click({force:true})],[1.6,()=>page.locator('.bk-play [data-v="3"]').click()]]);
 f=await load('letter-quest');const mute=f.getByRole('button',{name:'Mute sound',exact:true});if(await mute.isVisible())await mute.click();await click(f,'Word transformer');await page.waitForTimeout(6000);await shot('letter-quest');
 await record('Letter Quest · change a word',2.5,[[.7,()=>click(f,'Replace letter 1')],[1.2,()=>f.getByRole('button',{name:/Letter tile /}).first().click()],[2,()=>click(f,'Check my answer')]]);
 f=await load('word-arcade');await click(f,'▶ Play');await click(f,'Let’s play →');await page.waitForTimeout(3500);await shot('word-arcade');
 await record('Word Arcade · aim and spell',2.5,[[.5,()=>page.keyboard.press('ArrowLeft')],[1,()=>page.keyboard.press('Space')],[1.5,()=>page.keyboard.press('ArrowRight')],[2,()=>page.keyboard.press('Space')]]);
 f=await load('number-park');await click(f,'Put together');await page.waitForTimeout(350);await shot('number-park');
 await record('Number Park · move and count',2.5,[[.8,()=>click(f,'Put together →')],[2,()=>f.locator('button').filter({hasText:/^\d+$/}).last().click()]]);
 f=await load('drawing-studio');const pad=f.locator('.draw-pad');
 // Keep the actual wide canvas in view; the screenshot contains no saved drawing.
 const r=await pad.boundingBox();const point=(x,y)=>({x:r.x+r.width*x,y:r.y+r.height*y});
 await record('Guess My Drawing · a fresh doodle',2.5,[[.4,async()=>{const a=point(.3,.8);await page.mouse.move(a.x,a.y);await page.mouse.down();for(const [x,y]of [[.3,.45],[.48,.22],[.66,.45],[.66,.8],[.3,.8],[.3,.45],[.66,.45]]){const v=point(x,y);await page.mouse.move(v.x,v.y,{steps:5});}await page.mouse.up();}]]);await shot('drawing-studio');
 f=await load('maze-garden/trace');await shot('maze-garden');await f.locator('#board').focus();
 await record('Maze Garden · follow the path',2.5,[[.6,()=>page.keyboard.press('ArrowUp')],[1,()=>page.keyboard.press('ArrowRight')],[1.4,()=>page.keyboard.press('ArrowUp')],[1.8,()=>f.locator('#hint').click()]]);
 f=await load('three-in-a-row');if(await f.locator('#next').isVisible()){await f.locator('#next').click();await f.locator('#next').waitFor({state:'hidden'});}await f.getByRole('button',{name:/: empty$/}).first().click();await page.waitForTimeout(1800);await f.locator('.board').evaluate(e=>e.scrollIntoView({block:'center'}));await shot('three-in-a-row');
 await record('Three in a Row · make your move',2.5,[[.8,()=>f.getByRole('button',{name:/: empty$/}).first().click()],[2,async()=>{const hint=f.locator('#hint');if(await hint.isVisible()&&await hint.isEnabled())await hint.click();}]]);
 f=await load('target-trail');if(await f.locator('#start').isVisible()){await f.locator('#start').click();await f.locator('#overlay').waitFor({state:'hidden'});}await f.locator('.range').scrollIntoViewIfNeeded();await page.waitForTimeout(250);await shot('target-trail');
 await record('Target Trail · aim and release',2.5,[[1,()=>f.locator('#fire').click()],[2,()=>page.keyboard.press('ArrowLeft')]]);
 f=await load('sling');if(await f.locator('#start').isVisible()){await f.locator('#start').click();await f.locator('#overlay').waitFor({state:'hidden'});}await f.locator('#canvas').focus();await shot('sling');
 await record('Sling Shot · pull back and let go',2.5,[[.8,()=>page.keyboard.press('ArrowUp')],[1.2,()=>page.keyboard.press('Space')]]);
 f=await load('chess');const lesson=page.getByRole('button',{name:'Start Find the forcing move',exact:false});if(await lesson.isVisible())await lesson.click();await page.locator('#chess-board').waitFor({state:'visible'});await page.locator('.ac-content[aria-busy="true"]').waitFor({state:'hidden'});await page.waitForTimeout(500);await shot('chess');
 await record('Rook Academy · think one move ahead',2.5,[[.7,()=>page.locator('[data-square="d5"]').click()],[1.6,()=>page.locator('[data-square="c7"]').click()]]);
 f=await load('dribble-duel/live');await page.locator('.live-soccer canvas').focus();await page.locator('.live-soccer canvas').evaluate(e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-100));await page.waitForTimeout(250);await shot('dribble-duel');
 await record('Soccer Club · carry the ball',2.5,[[.4,async()=>{await page.locator('.live-soccer canvas').focus();await page.keyboard.down('ArrowUp');}],[1.2,()=>page.keyboard.down('ArrowLeft')],[1.8,()=>page.keyboard.up('ArrowLeft')],[2.3,()=>page.keyboard.up('ArrowUp')]]);
 // Refresh the supplemental stills too; they are not part of the 38-second video.
 previewChapter=demoChapter(library,{extras:true});await load('book/beginner');await page.locator('.bk-open').click({force:true});
 await page.waitForSelector('.bk-ball[data-v="B"]');await page.waitForTimeout(1500);await shot('book-kick');
 await page.locator('.bk-ball[data-v="B"]').evaluate(b=>{const r=b.getBoundingClientRect(),o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:1};b.dispatchEvent(new PointerEvent('pointerdown',o));b.dispatchEvent(new PointerEvent('pointerup',{...o,clientX:o.clientX+40,clientY:o.clientY-120}));});
 await page.waitForSelector('.bk-magic');await page.waitForTimeout(1500);await shot('book-magic');
 await writeFile(resolve(scratch,'manifest.json'),JSON.stringify({fps:10,frames:n,seconds:n/10,clips:manifest},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`Captured ${n} unique frames (${n/10}s) and fictional screenshots; zero browser exceptions.`);
}finally{await browser.close();}
