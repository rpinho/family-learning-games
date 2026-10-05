// Optional browser verification/captures using fictional children and disposable saves.
// PLAYWRIGHT_MODULE may point at a separately installed playwright module.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const chrome=process.env.CHROME;if(!chrome)throw Error('Set CHROME to Chrome for Testing.');
const root=await mkdtemp(join(tmpdir(),'family-onboarding-browser-'));
let child,browser,exited=false;const captures=process.argv.includes('--screenshots');
async function freeBlock(){for(let base=5780;base<6000;base+=7){const listeners=[];try{for(let p=base;p<base+7;p++){const s=net.createServer();await new Promise((ok,fail)=>{s.once('error',fail);s.listen(p,'127.0.0.1',ok);});listeners.push(s);}return base;}catch{}finally{await Promise.all(listeners.map(s=>new Promise(ok=>s.close(ok))));}}throw Error('No free test ports.');}
try{
 const port=await freeBlock(),base='http://127.0.0.1:'+port;
 child=spawn(process.execPath,['scripts/manage.mjs','start'],{cwd:repo,env:{...process.env,FAMILY_CONFIG:'',FAMILY_DEPLOY_DIR:'',FAMILY_CHANNEL:'',FAMILY_DEPLOY_ROOT:root,FAMILY_DATA:join(root,'hub'),FAMILY_BOOK:join(root,'book'),FAMILY_LEARNER:join(root,'learner'),FAMILY_PRIVATE_ART_SCRIPT:'',HOST:'127.0.0.1',BASE_PORT:String(port+1),HUB_PORT:String(port),...Object.fromEntries(['LETTER_QUEST_DATA','WORD_ARCADE_DATA','NUMBER_PARK_DATA','MAZE_DATA_DIR','TTT_DATA','TARGET_DATA'].map((k,i)=>[k,join(root,['letter-quest','word-arcade','number-park','maze-garden','three-in-a-row','target-trail'][i])]))},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.once('exit',()=>exited=true);
 for(let n=0;n<100;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}if(exited)throw Error('Test server stopped: '+output);await new Promise(ok=>setTimeout(ok,100));}
 browser=await chromium.launch({executablePath:chrome,headless:true});
 const page=await browser.newPage({viewport:{width:820,height:1180},deviceScaleFactor:1});
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 async function screenshot(name){if(captures){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await mkdir(resolve(repo,'docs/media'),{recursive:true});await page.screenshot({path:resolve(repo,'docs/media/onboarding-'+name+'-tablet.png'),fullPage:true});}}
 await page.goto(base+'/');await page.waitForURL('**/onboarding');await page.locator('#code').waitFor();
 assert.equal(await page.locator('#editor').isVisible(),false);
 const code=await page.locator('#code').textContent();await page.locator('#answer').fill(code.replace(/[^A-Z]/g,'').split('').reverse().join(''));await page.locator('#gate-form button').click();
 await page.locator('input[name="name"]').fill('River');await page.locator('input[name="age"]').fill('6');await page.locator('input[name="grade"]').fill('Year 1');await screenshot('child');await page.locator('#next').click();
 await page.locator('[name="letters"]').selectOption('some');await page.locator('[name="counting"]').fill('10');await page.locator('[name="maths"]').selectOption('addition');await screenshot('skills');
 await page.locator('#placement summary').click();await page.locator('[name="check0"]').selectOption('help');await page.locator('[name="check1"]').selectOption('independent');await page.locator('#next').click();
 await page.locator('[name="interests"]').fill('Space, animals');await page.locator('[name="favourites"]').fill('Trains, a plush fox');await page.locator('#next').click();await screenshot('photos');
 await page.locator('#save').click();await page.locator('#family').waitFor({state:'visible'});assert.match(await page.locator('#status').textContent(),/Saved privately/);
 await page.locator('#add').click();await page.locator('[name="name"]').fill('Robin');await page.locator('[name="age"]').fill('9');await page.locator('#next').click();await page.locator('[name="reading"]').selectOption('words');await page.locator('[name="maths"]').selectOption('tables');await page.locator('#next').click();await page.locator('#next').click();await page.locator('#save').click();await page.locator('#family').waitFor({state:'visible'});
 await page.locator('[data-edit="beginner_1"]').click();await page.locator('[name="name"]').fill('River');await page.locator('#next').click();await page.locator('#next').click();await page.locator('#next').click();await page.locator('#save').click();await page.locator('#family').waitFor({state:'visible'});await screenshot('family');
 const config=await(await fetch(base+'/api/config')).json();assert.equal(config.onboardingRequired,false);assert.deepEqual(config.players.map(p=>p.id).sort(),['admin','beginner_1','explorer_1']);
 const suffix={'letter-quest':p=>'/api/'+p+'/state','word-arcade':p=>'/api/'+p,'number-park':p=>'/api/'+p,'maze-garden':p=>'/api/state?player='+p,'three-in-a-row':p=>'/api/state?player='+p,'target-trail':p=>'/api/state?player='+p};
 for(const p of ['beginner_1','explorer_1'])for(const [game,api] of Object.entries(suffix)){const prefix='/g/'+game+'/'+p;for(let n=0;n<40;n++){try{if((await fetch(base+prefix+'/')).ok)break;}catch{}await new Promise(ok=>setTimeout(ok,100));}const response=await fetch(base+prefix+api(p));assert.equal(response.status,200,game+' '+p+' '+await response.clone().text());const value=await response.json(),profile=value.profile||value;assert.equal(profile.id||profile.player,p,game);assert.equal(profile.name,p==='beginner_1'?'River':'Robin',game);}
 // Verify the game clients accept the new child identities, not just their APIs.
 for(const game of Object.keys(suffix)){await page.goto(base+'/g/'+game+'/beginner_1/?player=beginner_1&family=1');await page.waitForTimeout(700);const text=await page.locator('body').innerText();assert.ok(!/Choose a player|Unknown player|undefined/.test(text),game+' failed to load');}
 // Optional photos use browser re-encoding, private permission and removal, with a synthetic colour square.
 await page.goto(base+'/onboarding');await page.locator('#family').waitFor({state:'visible'});await page.locator('#add').click();
 await page.locator('[name="name"]').fill('Sky');await page.locator('[name="age"]').fill('5');for(let i=0;i<3;i++)await page.locator('#next').click();
 const synthetic=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=48;const ctx=c.getContext('2d');ctx.fillStyle='#819cb5';ctx.fillRect(0,0,48,48);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#photos').setInputFiles({name:'synthetic-square.png',mimeType:'image/png',buffer:Buffer.from(synthetic,'base64')});await page.locator('#status').filter({hasText:'Photos ready.'}).waitFor();await page.locator('#private-art').check();await page.locator('#save').click();await page.locator('#family').waitFor({state:'visible'});
 const withPhoto=JSON.parse(await readFile(join(root,'book/profiles.json'),'utf8')).beginner_2;assert.equal(withPhoto.artReferences.enabled,true);const image=await readFile(join(root,'book',withPhoto.artReferences.photos[0]));assert.equal(image[0],255);assert.equal(image[1],216);assert.equal(image.includes(Buffer.from('Exif')),false);
 await page.locator('[data-edit="beginner_2"]').click();for(let i=0;i<3;i++)await page.locator('#next').click();await page.locator('#remove-photos').check();await page.locator('#save').click();await page.locator('#family').waitFor({state:'visible'});await assert.rejects(readFile(join(root,'book',withPhoto.artReferences.photos[0])),{code:'ENOENT'});
 // Phone layout also stays within the viewport.
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/onboarding');await page.locator('#family').waitFor({state:'visible'});await page.locator('#add').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const profiles=JSON.parse(await readFile(join(root,'book/profiles.json'),'utf8'));assert.equal(profiles.beginner_1.artReferences.photos.length,0);assert.equal(profiles.beginner_1.placement.source,'grown-up-observation');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);console.log('PASS: first-run gate, tablet/phone layout, two children, edit, zero photos, optional photo re-encoding/removal, all six game APIs/clients, no external requests.');
}finally{await browser?.close();if(child&&!exited){child.kill('SIGTERM');await new Promise(ok=>child.once('exit',ok));}await rm(root,{recursive:true,force:true});}
