// Optional documentation tool: npm install --no-save playwright, then run this file.
// It renders HTML/CSS layouts around real screenshots; it does not invent gameplay.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const htmlOnly=process.argv.includes('--html-only');
const htmlDir=process.env.SHOWCASE_HTML_DIR;
if(htmlOnly&&!htmlDir)throw Error('Set SHOWCASE_HTML_DIR for --html-only');
if(htmlOnly)await mkdir(htmlDir,{recursive:true});
const root=new URL('./',import.meta.url),out=new URL('../media/',root);
await mkdir(out,{recursive:true});
const games=[
 ['letter-quest','Letter Quest','Words open worlds.','Read words, build sentences and solve story missions.','#b9ead4','READING · STORIES · EXPLORATION'],
 ['word-arcade','Word Arcade','Spelling takes flight.','Steer your starship. Blast the missing letter.','#bfc3ff','MOVING TARGETS · WORDS · RHYMES'],
 ['number-park','Number Park','Math you can move.','Drag groups together. Count, trace and spot patterns.','#9be0e4','COUNTING · PATTERNS · DRAWING'],
 ['maze-garden','Maze Garden','Find your own way.','Trace winding paths through growing maze challenges.','#d3e9a7','2D MAZES · OPTIONAL PUZZLE STOPS'],
 ['three-in-a-row','Three in a Row','One move. New possibilities.','Play Rook, choose X or O, and explore tactical clues.','#d6c5ff','TIC-TAC-TOE · CHOICES · STRATEGY'],
 ['target-trail','Target Trail','Listen. Aim. Let it fly.','Find spoken letters and words. Choose your challenge.','#ffd19b','AIMING · LETTERS · WORDS'],
 ['chess','Rook Academy','Your next good move.','Short chess lessons, a speaking coach and room to think.','#d5cef5','CHESS · CALCULATION · STRATEGY'],
 ['dribble-duel','Soccer Club','Draw a lunge. Find the goal.','Change direction, carry the ball past, then earn a letter reward.','#b7e9ce','LIVE SOCCER · TIMING · LETTER REWARDS'],
 ['drawing-studio','Guess My Drawing','Make something your own.','A wide canvas, a fresh idea and a local picture guess.','#ffdda8','FREE DRAWING · LOCAL RECOGNITION'],
 ['sling','Sling Shot','Pull back. Let go.','Send a stone towards the matching letter or number.','#d3e9a7','LETTERS · NUMBERS · AIMING'],
 ['book-story','The Book','An adventure on every page.','An illustrated chapter, with little games inside the story.','#f5dfb8','THE BOOK · STORIES · DISCOVERY'],
 ['book-count','The Book','Count your way through.','Tap the stars. Find how many. Open the forest gate.','#f5dfb8','THE BOOK · COUNTING · LETTER KICKS'],
 ['book-choice','The Book','Help Pip choose.','Spot a silly mistake and put the story right.','#f5dfb8','THE BOOK · MAGIC WORDS · CHOICES']
];
const images=await Promise.all(games.map(async([id])=>'data:image/png;base64,'+(await readFile(new URL(`screenshots/${id}.png`,root))).toString('base64')));
const {chromium}=htmlOnly?{}:await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=htmlOnly?null:await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,headless:true}:{headless:true});
const page=htmlOnly?null:await browser.newPage({viewport:{width:1440,height:1360},deviceScaleFactor:1});
const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#122d36}h1,h2,p{margin:0}.card{width:1440px;height:1360px;background:var(--color);padding:56px 48px 38px;position:relative;overflow:hidden}.eyebrow{font-size:20px;font-weight:800;letter-spacing:3px}.card h1{font-size:66px;letter-spacing:-3px;line-height:1.07;margin-top:17px}.card p{font-size:28px;margin-top:16px}.game-label{position:absolute;top:54px;right:48px;font-size:24px;font-weight:bold;padding:13px 20px;background:#ffffff75;border:1px solid #fff;border-radius:99px}.frame{height:1010px;margin-top:34px;padding:10px;border-radius:25px;background:#102631;box-shadow:0 20px 35px #10263130;overflow:hidden}.frame img{width:100%;height:100%;object-fit:contain;border-radius:17px;background:#edf4f3;display:block}.foot{display:flex;justify-content:space-between;font-size:18px;margin-top:22px;letter-spacing:.4px}.hero{height:640px;width:1280px;background:radial-gradient(ellipse at 100% 0,#204950,transparent 70%),#102730;color:white;padding:44px;display:grid;grid-template-columns:475px 1fr;gap:38px}.hero .eyebrow{font-size:14px;color:#bcefdc;letter-spacing:2px;margin-top:10px}.hero h1{font-size:68px;letter-spacing:-3px;line-height:1.04;margin-top:25px}.hero h1 span{color:#c7f2b2}.hero p{font-size:23px;line-height:1.5;color:#d3e2e3;margin-top:24px;max-width:445px}.pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:27px}.pills span{font-size:14px;border:1px solid #547174;padding:10px 13px;border-radius:50px}.command{margin-top:29px;font:20px monospace;color:#132d35;background:#d4f59d;display:inline-block;padding:14px 20px;border-radius:12px}.repo{font-size:13px;color:#bed1d3;margin-top:15px}.tiles{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:center}.tile{height:122px;border-radius:14px;overflow:hidden;background:var(--color);color:#122d36;box-shadow:0 10px 20px #0002;border:1px solid #ffffff25}.tile img{display:block;width:100%;height:94px;object-fit:cover;object-position:center}.tile strong{display:block;text-align:center;font-size:15px;line-height:27px}`;
for(let i=0;i<games.length;i++){
 const [id,name,headline,sub,color,tag]=games[i];
 const card=`<!doctype html><meta charset="utf-8"><style>${css}</style><article class="card" style="--color:${color}"><div class="eyebrow">${tag}</div><div class="game-label">${name}</div><h1>${headline}</h1><p>${sub}</p><div class="frame"><img src="${images[i]}"></div><div class="foot"><span>FAMILY LEARNING GAMES</span><span>Actual gameplay · Generic Admin demo</span></div></article>`;
 if(htmlOnly){await writeFile(`${htmlDir}/${id}.html`,card+(id.startsWith('book-')?'<style>.card{zoom:0.888888889}</style>':''));continue;}
 const isBook=id.startsWith('book-');
 await page.setViewportSize({width:isBook?1280:1440,height:isBook?1210:1360});
 await page.setContent(card+(isBook?'<style>.card{zoom:0.888888889}</style>':''));
 await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));
 await page.screenshot({path:fileURLToPath(new URL(`${id}.png`,out))});
}
if(!htmlOnly)await page.setViewportSize({width:1280,height:640});
const heroGames=games.filter(([id])=>!['book-count','book-choice'].includes(id));
const hero=`<!doctype html><meta charset="utf-8"><style>${css}.hero{grid-template-columns:395px 1fr;gap:28px;padding:36px}.hero h1{font-size:64px}.hero p{font-size:21px}.tiles{grid-template-columns:repeat(3,1fr);gap:12px}.tile{height:128px}.tile img{height:100px}.tile.book{grid-column:span 2}.tile.book img{object-fit:contain;background:#b7dff4}.pills span{font-size:12px;padding:10px}.repo{font-size:12px}</style><article class="hero"><section><div class="eyebrow">TEN GAMES + THE BOOK.</div><h1>Family<br>Learning<br><span>Games.</span></h1><p>Read. Count. Draw. Think ahead.<br>Play inside an illustrated story.</p><div class="pills"><span>Touch-friendly</span><span>Adjustable challenges</span><span>Run locally</span></div><div class="command">npm run play</div><div class="repo">github.com/rpinho/family-learning-games</div></section><section class="tiles">${heroGames.map(([id,name,,,color])=>`<div class="tile ${id==='book-story'?'book':''}" style="--color:${color}"><img src="${images[games.findIndex(g=>g[0]===id)]}"><strong>${name}</strong></div>`).join('')}</section></article>`;
if(htmlOnly){await writeFile(`${htmlDir}/social-preview.html`,hero);}else{
await page.setContent(hero);
await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));
await page.screenshot({path:fileURLToPath(new URL('social-preview.png',out))});
await browser.close();
}
