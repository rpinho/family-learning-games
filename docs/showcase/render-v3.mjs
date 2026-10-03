// Compose editorial layouts from real gameplay; the paintings and UI are never retouched.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=resolve('docs/media');await mkdir(out,{recursive:true});
const data=async path=>'data:image/png;base64,'+(await readFile(path)).toString('base64');
const hero=await data('docs/showcase/screenshots/book-story.png');
const games=[['letter-quest','Letter Quest'],['number-park','Number Park'],['chess','Rook Academy'],['maze-garden','Maze Garden']];
const images=Object.fromEntries(await Promise.all(games.map(async([id])=>[id,await data(`docs/showcase/tiles/${id}@2x.png`)])));
const tiles=(n=3)=>games.slice(0,n).map(([id,title])=>`<article class="tile ${id}"><div class="picture"><img src="${images[id]}"></div><strong>${title}</strong></article>`).join('');
const title='<h1>Family Learning Games</h1><p>— a story world and ten calm learning games</p>';
const base=`*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}main{width:1280px;height:640px;overflow:hidden}h1,p{margin:0}h1{font-family:Georgia,serif;font-size:43px;font-weight:400;letter-spacing:-1.3px;line-height:1.08}header p{font-size:22px;margin-top:9px;letter-spacing:-.3px}.painting{width:100%;height:100%;object-fit:contain;display:block}.tile{background:#fbf7ea;overflow:hidden;border-radius:9px;box-shadow:0 5px 15px #092e2020;color:#233f32}.picture{height:112px;overflow:hidden;background:#f1ebd9}.picture img{width:100%;height:100%;object-fit:cover;display:block}.tile strong{font-family:Georgia,serif;font-weight:400;display:block;padding:7px 12px;font-size:19px}.letter-quest .picture{position:relative;container-type:inline-size}.letter-quest .picture img{position:absolute;transform:none;width:150%;height:auto;left:-25%;top:-43cqw;object-fit:contain}.number-park img{transform:scale(2.25);transform-origin:50% 57%}.chess img{transform:scale(1.95);transform-origin:55% 51%}.maze-garden img{transform:scale(1.8);transform-origin:67% 48%}footer{font-size:13px;letter-spacing:.4px;display:flex;justify-content:space-between;align-items:center}footer span:last-child{font-size:11px;letter-spacing:1.1px;text-transform:uppercase}`;
const layouts={
 'social-preview-v3-cream':`${base}main{background:#f5efdf;color:#234032;padding:22px 24px}header{height:94px}.gallery{display:grid;grid-template-columns:866px 350px;gap:16px}.scene{height:487px;overflow:hidden;border-radius:12px;box-shadow:0 10px 25px #18392720}.tiles{display:grid;gap:12px;align-content:center}.picture{height:116px}footer{margin-top:13px;color:#586951}`,
 'social-preview-v3-gallery':`${base}main{background:#193b30;color:#fff4d6;padding:22px 20px}header{height:84px;display:flex;align-items:baseline;gap:26px}header h1{font-size:41px;white-space:nowrap}header p{font-size:20px;letter-spacing:-.6px}.gallery{display:grid;grid-template-columns:916px 306px;gap:18px}.scene{height:515.25px;overflow:hidden;border-radius:9px;box-shadow:0 10px 35px #0003}.tiles{display:grid;gap:14px;align-content:center}.picture{height:124px}.tile strong{font-size:18px}footer{display:none;position:absolute;top:614px;left:970px;width:288px;font-size:10px;color:#d4ddc9}footer span:last-child{display:none}`,
 'social-preview-v3-cinematic':`${base}main{background:#f4eedc;color:#263c30;padding:0}header{position:absolute;top:24px;left:27px;z-index:2;padding:18px 22px;border-radius:9px;background:#fffaecf0;box-shadow:0 10px 28px #223a2020}header h1{font-size:38px}header p{font-size:18px}.gallery{display:block}.scene{width:1280px;height:640px}.scene img{object-fit:cover;object-position:50% 48%}.tiles{position:absolute;bottom:17px;left:20px;right:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.tile{box-shadow:0 5px 20px #18392755}.picture{height:100px}.tile strong{font-size:17px;padding:6px 10px}footer{display:none}`
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
for(const [id] of [...games,['word-arcade'],['three-in-a-row'],['target-trail'],['drawing-studio'],['sling'],['dribble-duel'],['book-story'],['book-count'],['book-choice'],['world-walk'],['world-talk'],['world-map'],['world-treasure'],['calm-home']])await copyFile(resolve('docs/showcase/screenshots',id+'.png'),resolve(out,id+'.png'));
