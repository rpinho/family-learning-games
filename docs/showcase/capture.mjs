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
const ch=demoChapter(JSON.parse(await readFile(resolve(root,'hub/public/book-art/library.json'),'utf8')));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||process.env.CHROME,headless:true,args:['--mute-audio']});
let n=0;const manifest=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,bypassCSP:true});
 page.setDefaultTimeout(10000);
 // Silent capture driver: skip device narration waits, without changing pictures or game mechanics.
 await page.addInitScript(()=>{speechSynthesis.speak=u=>setTimeout(()=>u.onend?.(),150);speechSynthesis.cancel=()=>{};});
 page.on('dialog',d=>d.accept());
 const load=async id=>{await page.goto(base+'/?player=admin#'+id);await page.waitForTimeout(900);return page.frames().at(-1);};
 const click=async(f,name)=>{await f.getByRole('button',{name,exact:false}).first().click();};
 const zoom=async f=>{if(f!==page.mainFrame())await f.addStyleTag({content:'body{zoom:.82}'});else await page.addStyleTag({content:'body{zoom:.82}'});};
 const shot=async id=>{await page.screenshot({path:resolve(shots,id+'.png')});};
 const record=async(label,seconds,actions=[])=>{
  const start=n;manifest.push({label,start,frames:seconds*10});
  const tasks=actions.map(([at,fn])=>new Promise((ok,no)=>setTimeout(()=>Promise.resolve().then(fn).then(ok,no),at*1000)));
  const t=Date.now();for(let k=0;k<seconds*10;k++){const delay=t+k*100-Date.now();if(delay>0)await page.waitForTimeout(delay);await page.screenshot({path:resolve(scratch,`frame-${String(n++).padStart(5,'0')}.jpg`),type:'jpeg',quality:85});}
  await Promise.all(tasks);
 };
 let f=await load('letter-quest');await click(f,'Word transformer');await zoom(f);await page.waitForTimeout(500);await shot('letter-quest');
 await record('Letter Quest · change a word',3,[[.7,()=>click(f,'Replace letter 1')],[1.2,()=>f.getByRole('button',{name:/Letter tile /}).first().click()],[2,()=>click(f,'Check my answer')]]);
 f=await load('word-arcade');await click(f,'▶ Play');await click(f,'Let’s play →');await zoom(f);await page.waitForTimeout(3500);await shot('word-arcade');
 await record('Word Arcade · aim and spell',3,[[.5,()=>page.keyboard.press('ArrowLeft')],[1,()=>page.keyboard.press('Space')],[1.5,()=>page.keyboard.press('ArrowRight')],[2,()=>page.keyboard.press('Space')]]);
 f=await load('number-park');await click(f,'Put together');await zoom(f);await page.waitForTimeout(350);await shot('number-park');
 await record('Number Park · move and count',3,[[.8,()=>click(f,'Put together →')],[2,()=>click(f,'9')]]);
 f=await load('drawing-studio');const pad=f.locator('.draw-pad');
 // Keep the actual wide canvas in view; the screenshot contains no saved drawing.
 const r=await pad.boundingBox();const point=(x,y)=>({x:r.x+r.width*x,y:r.y+r.height*y});
 await record('Guess My Drawing · a fresh doodle',3,[[.4,async()=>{const a=point(.3,.8);await page.mouse.move(a.x,a.y);await page.mouse.down();for(const [x,y]of [[.3,.45],[.48,.22],[.66,.45],[.66,.8],[.3,.8],[.3,.45],[.66,.45]]){const v=point(x,y);await page.mouse.move(v.x,v.y,{steps:5});}await page.mouse.up();}]]);await shot('drawing-studio');
 f=await load('maze-garden/trace');await zoom(f);await shot('maze-garden');await f.locator('#board').focus();
 await record('Maze Garden · follow the path',3,[[.6,()=>page.keyboard.press('ArrowUp')],[1,()=>page.keyboard.press('ArrowRight')],[1.4,()=>page.keyboard.press('ArrowUp')],[1.8,()=>f.locator('#hint').click()]]);
 f=await load('three-in-a-row');if(await f.locator('#next').isVisible())await f.locator('#next').click();await zoom(f);await shot('three-in-a-row');
 await record('Three in a Row · make your move',3,[[.8,()=>f.getByRole('button',{name:/: empty$/}).first().click()],[2,()=>f.locator('#hint').click()]]);
 f=await load('target-trail');if(await f.locator('#start').isVisible())await f.locator('#start').click();await zoom(f);await shot('target-trail');
 await record('Target Trail · aim and release',3,[[1,()=>f.locator('#fire').click()],[2,()=>page.keyboard.press('ArrowLeft')]]);
 f=await load('sling');if(await f.locator('#start').isVisible())await f.locator('#start').click();await zoom(f);await f.locator('#canvas').focus();await shot('sling');
 await record('Sling Shot · pull back and let go',3,[[.8,()=>page.keyboard.press('ArrowUp')],[1.2,()=>page.keyboard.press('Space')]]);
 f=await load('chess');const lesson=page.getByRole('button',{name:'Find the forcing move',exact:false});if(await lesson.isVisible())await lesson.click();await zoom(f);await shot('chess');
 await record('Rook Academy · think one move ahead',3,[[.7,()=>page.locator('[data-square="d5"]').click()],[1.6,()=>page.locator('[data-square="c7"]').click()]]);
 f=await load('dribble-duel/live');await zoom(f);await page.waitForTimeout(250);await shot('dribble-duel');
 await record('Soccer Club · carry the ball',3,[[.4,async()=>{await page.locator('.live-soccer canvas').focus();await page.keyboard.down('ArrowUp');}],[1.2,()=>page.keyboard.down('ArrowLeft')],[1.8,()=>page.keyboard.up('ArrowLeft')],[2.6,()=>page.keyboard.up('ArrowUp')]]);
 // Supply an invented chapter to the existing read-only Admin preview. No child save writes.
 await page.route('**/api/book/preview?*',route=>route.fulfill({json:{date:ch.date,chapter:ch,progress:{page:0},collection:{keys:[],words:[]},open:true,preview:true}}));
 f=await load('book/beginner');await shot('book-cover');
 await record('The Book · turn a page',2,[[.4,()=>page.locator('.bk-open').click({force:true})]]);await shot('book-story');
 await page.waitForSelector('.bk-thing');await shot('book-count');
 await record('The Book · count inside the story',3,[[.3,()=>page.locator('.bk-thing').nth(0).click()],[.8,()=>page.locator('.bk-thing').nth(1).click()],[1.3,()=>page.locator('.bk-thing').nth(2).click()],[1.8,()=>page.locator('.bk-thing').nth(3).click()],[2.5,()=>page.locator('.bk-play [data-v="4"]').click()]]);
 await page.waitForSelector('.bk-ball[data-v="B"]');await shot('book-kick');
 await record('The Book · kick the letter',2,[[.5,()=>page.locator('.bk-ball[data-v="B"]').evaluate(b=>{const r=b.getBoundingClientRect(),o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:1};b.dispatchEvent(new PointerEvent('pointerdown',o));b.dispatchEvent(new PointerEvent('pointerup',{...o,clientX:o.clientX+40,clientY:o.clientY-120}));})]]);
 await page.waitForSelector('.bk-magic');await shot('book-magic');await page.locator('.bk-magic').click({force:true});await page.waitForSelector('.bk-btn.no');await shot('book-choice');
 await record('The Book · help Pip choose',3,[[.7,()=>page.locator('.bk-btn.no').click({force:true})],[1.6,()=>page.locator('.bk-play [data-v="5"]').click({force:true})]]);
 await writeFile(resolve(scratch,'manifest.json'),JSON.stringify({fps:10,frames:n,seconds:n/10,clips:manifest},null,2));
 console.log(`Captured ${n} unique frames (${n/10}s) and generic screenshots.`);
}finally{await browser.close();}
