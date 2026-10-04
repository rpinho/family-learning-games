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
 ['book-count','The Book','Count your way through.','Tap the painted stones. Count a path across the crater.','#f5dfb8','THE BOOK · PAINTED SCENES · COUNTING'],
 ['book-choice','The Book','Help the fox choose.','Spot a silly mistake and put the story right.','#f5dfb8','THE BOOK · FICTIONAL CAST · CHOICES']
];
const images=await Promise.all(games.map(async([id])=>'data:image/png;base64,'+(await readFile(new URL(`screenshots/${id}.png`,root))).toString('base64')));
const {chromium}=htmlOnly?{}:await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=htmlOnly?null:await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,headless:true}:{headless:true});
const page=htmlOnly?null:await browser.newPage({viewport:{width:1440,height:1360},deviceScaleFactor:1});
const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#15342e}h1,p{margin:0}.card{width:1280px;height:860px;background:#f6f1e5;padding:24px 32px}.eyebrow{font-size:13px;font-weight:700;letter-spacing:2px;color:#527466}.card h1{font-size:34px;line-height:1.1;margin-top:10px}.card p{font-size:19px;margin-top:9px;color:#475e55}.game-label{float:right;font-size:17px;font-weight:bold;padding:10px 14px;border:1px solid #a7b8a2;border-radius:12px}.frame{width:1216px;height:684px;margin-top:18px;overflow:hidden;border-radius:12px;background:#17352e}.frame img{width:100%;height:100%;object-fit:contain;display:block}.foot{display:flex;justify-content:space-between;font-size:12px;margin-top:14px;letter-spacing:.5px}`;
try {
for(let i=0;i<games.length;i++){
 const [id,name,headline,sub,color,tag]=games[i];
 const card=`<!doctype html><meta charset="utf-8"><style>${css}</style><article class="card" style="--color:${color}"><div class="eyebrow">${tag}</div><div class="game-label">${name}</div><h1>${headline}</h1><p>${sub}</p><div class="frame"><img src="${images[i]}"></div><div class="foot"><span>FAMILY LEARNING GAMES</span><span>Actual gameplay · Generic Admin demo</span></div></article>`;
 if(htmlOnly){await writeFile(`${htmlDir}/${id}.html`,card);continue;}
 await page.setViewportSize({width:1280,height:860});
 await page.setContent(card);
 await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));
 await page.screenshot({path:fileURLToPath(new URL(`${id}.png`,out))});
}
if(!htmlOnly)await page.setViewportSize({width:1280,height:640});
const heroGames=games.filter(([id])=>['letter-quest','number-park','chess','word-arcade'].includes(id));
const hero=`<!doctype html><meta charset="utf-8"><style>${css}
.hero{width:1280px;height:640px;background:#f6f1e5;padding:24px 24px 20px}.hero h1{font-size:43px;letter-spacing:-1.5px;line-height:1.06}.hero p{font-size:28px;line-height:1.2;margin-top:8px;color:#475e55}.gallery{display:grid;grid-template-columns:744px 472px;gap:16px;margin-top:23px;align-items:center}.book{overflow:hidden;border-radius:14px;background:#183c32;box-shadow:0 8px 18px #17352e18}.book img{width:744px;height:418.5px;display:block}.book strong{display:block;padding:11px 16px;color:#fff;font-size:20px}.tiles{display:grid;grid-template-columns:1fr 1fr;gap:18px 16px}.tile{overflow:hidden;border-radius:12px;background:#fff;border:1px solid #d6decf}.tile-shot{width:228px;height:128.25px;overflow:hidden}.tile img{display:block;width:228px;height:128.25px;object-fit:contain;transform:scale(1.65);transform-origin:50% 45%}.tile.letter-quest img{transform:scale(1.4);transform-origin:50% 43%}.tile.word-arcade img{transform:scale(1.3);transform-origin:50% 70%}.tile.chess img{transform:scale(1.3);transform-origin:50% 48%}.tile.number-park img{transform:scale(1.5);transform-origin:50% 50%}.tile strong{display:block;padding:10px 6px;font-size:16px;text-align:center}.repo{font-size:13px;color:#587164;margin-top:13px}
</style><article class="hero"><h1>Family Learning Games</h1><p>— ten games and a story Book that plays</p><section class="gallery"><div class="book"><img src="${images[games.findIndex(g=>g[0]==='book-story')]}"><strong>The Book · painted worlds you can play inside</strong></div><div class="tiles">${heroGames.map(([id,name])=>`<div class="tile ${id}"><div class="tile-shot"><img src="${images[games.findIndex(g=>g[0]===id)]}"></div><strong>${name}</strong></div>`).join('')}</div></section><div class="repo">github.com/rpinho/family-learning-games · Run locally with npm run play</div></article>`;
if(htmlOnly){await writeFile(`${htmlDir}/social-preview.html`,hero);}else{
await page.setContent(hero);
await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));
await page.screenshot({path:fileURLToPath(new URL('social-preview.png',out))});
}
} finally {await browser?.close();}
