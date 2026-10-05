// Compose editorial layouts from real gameplay; the paintings and UI are never retouched.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=resolve('docs/media');await mkdir(out,{recursive:true});
const data=async path=>'data:image/png;base64,'+(await readFile(path)).toString('base64');
const hero=await data('docs/showcase/screenshots/book-story.png');
const games=[['letter-quest','Letter Quest'],['number-park','Number Park'],['maze-garden','Maze Garden']];
const images=Object.fromEntries(await Promise.all(games.map(async([id])=>[id,await data(`docs/showcase/tiles/${id}@2x.png`)])));
const tiles=(n=3)=>games.slice(0,n).map(([id,title])=>`<article class="tile ${id}"><div class="picture"><img src="${images[id]}"></div><strong>${title}</strong></article>`).join('');
const title='<h1>Family Learning Games</h1><p>— a story world and ten calm learning games</p>';
const base=`*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}main{width:1280px;height:640px;overflow:hidden}h1,p{margin:0}h1{font-family:Georgia,serif;font-size:43px;font-weight:400;letter-spacing:-1.3px;line-height:1.08}header p{font-size:22px;margin-top:9px;letter-spacing:-.3px}.painting{width:100%;height:100%;object-fit:contain;display:block}.tile{background:#fbf7ea;overflow:hidden;border-radius:9px;box-shadow:0 5px 15px #092e2020;color:#233f32}.picture{height:112px;overflow:hidden;background:#f1ebd9}.picture img{width:100%;height:100%;object-fit:cover;display:block}.tile strong{font-family:Georgia,serif;font-weight:400;display:block;padding:7px 12px;font-size:19px}.letter-quest .picture{position:relative;container-type:inline-size}.letter-quest .picture img{position:absolute;transform:none;width:150%;height:auto;left:-25%;top:-43cqw;object-fit:contain}.number-park img{transform:scale(2.25);transform-origin:50% 57%}.chess .picture img{transform:none;object-fit:contain}.maze-garden img{transform:scale(1.8);transform-origin:67% 48%}footer{font-size:13px;letter-spacing:.4px;display:flex;justify-content:space-between;align-items:center}footer span:last-child{font-size:11px;letter-spacing:1.1px;text-transform:uppercase}`;
const layouts={
 'social-preview':`${base}main{background:#193b30;color:#fff4d6;padding:12px 20px}header{height:60px;display:flex;align-items:baseline;gap:26px}header h1{font-size:41px;white-space:nowrap}header p{font-size:20px;letter-spacing:-.6px}.gallery{display:grid;grid-template-columns:988px 240px;gap:12px}.scene{height:555.75px;overflow:hidden;border-radius:9px;box-shadow:0 10px 35px #0003}.tiles{display:grid;gap:14px;align-content:center}.picture{height:130px}.tile strong{font-size:18px}footer{display:none}`
};
const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:640},deviceScaleFactor:1});
 for(const [id,css]of Object.entries(layouts)){
  const html=`<!doctype html><meta charset="utf-8"><style>${css}</style><main><header>${title}</header><section class="gallery"><div class="scene"><img class="painting" src="${hero}"></div><aside class="tiles">${tiles(id.includes('cinematic')?4:3)}</aside></section><footer><span>Painted worlds. Little discoveries.</span><span>Run locally · Play together</span></footer></main>`;
  await page.setContent(html);await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));await page.screenshot({path:resolve(out,id+'.png')});
  if(process.env.SHOWCASE_HTML_DIR){await mkdir(process.env.SHOWCASE_HTML_DIR,{recursive:true});await writeFile(resolve(process.env.SHOWCASE_HTML_DIR,id+'.html'),html);}
 }
}finally{await browser.close();}
// Native gameplay remains native in the README; labels are in the surrounding Markdown.
for(const [id] of [...games,['chess'],['word-arcade'],['three-in-a-row'],['target-trail'],['drawing-studio'],['sling'],['dribble-duel'],['book-story'],['book-count'],['book-choice'],['world-walk'],['world-talk'],['world-map'],['world-treasure'],['calm-home']])await copyFile(resolve('docs/showcase/screenshots',id+'.png'),resolve(out,id+'.png'));
