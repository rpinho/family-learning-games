import {spawn} from 'node:child_process';
import {mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const games=[['letter-quest','LETTER_QUEST_DATA'],['word-arcade','WORD_ARCADE_DATA'],['number-park','NUMBER_PARK_DATA'],['maze-garden','MAZE_DATA_DIR'],['three-in-a-row','TTT_DATA'],['target-trail','TARGET_DATA']];
const command=process.argv[2],children=[];
const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||major===22&&minor<13)throw Error('Please install Node.js 22.13 or newer, then run npm run play again.');
function run(exe,args,game,env=process.env){return new Promise((ok,fail)=>{const p=spawn(exe,args,{cwd:game==='hub'?resolve(root,'hub'):resolve(root,'games',game),stdio:'inherit',env,shell:process.platform==='win32'&&exe==='npm'});p.on('error',fail);p.on('exit',code=>code===0?ok():fail(Error(game+' exited '+code)));});}
if(command==='setup'){
 for(const game of ['word-arcade','number-park']){await run('npm',['ci'],game);await run('npm',['run','build'],game);}
 console.log('Ready. Run npm start.');
}else if(command==='test'){
 // Run app suites sequentially: several existing integration tests share fixture ports.
 for(const [game]of games){const files=(await readdir(resolve(root,'games',game,'tests'))).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);await run(process.execPath,['--test',...files],game);}
 const hubTests=(await readdir(resolve(root,'hub','tests'))).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);await run(process.execPath,['--test',...hubTests],'hub');
}else if(command==='start'){
 let stopping=false;
 function stop(code=0){if(stopping)return;stopping=true;for(const p of children)p.kill('SIGTERM');setTimeout(()=>process.exit(code),700);}
 for(const [i,[game,key]]of games.entries()){
  const port=Number(process.env.BASE_PORT||4811)+i,data=resolve(root,'.data',game);await mkdir(data,{recursive:true,mode:0o700});
  const child=spawn(process.execPath,['server.mjs'],{cwd:resolve(root,'games',game),stdio:'inherit',env:{...process.env,LETTER_QUEST_DATA:resolve(root,'.data','letter-quest'),[key]:data,HOST:'127.0.0.1',PORT:String(port)}});children.push(child);
  child.on('error',e=>{console.error(e.message);stop(1);});child.on('exit',code=>{if(!stopping){console.error(game+' stopped');stop(code||1);}});
  console.log(`${game}: http://localhost:${port}/?player=beginner (or ?player=explorer)`);
 }
 const hubPort=Number(process.env.HUB_PORT||Number(process.env.BASE_PORT||4811)-1);
 const hub=spawn(process.execPath,['server.mjs'],{cwd:resolve(root,'hub'),stdio:'inherit',env:{...process.env,FAMILY_DATA:resolve(root,'.data','hub'),PORT:String(hubPort),HOST:process.env.HOST||'127.0.0.1'}});children.push(hub);
 hub.on('error',e=>{console.error(e.message);stop(1);});hub.on('exit',code=>{if(!stopping)stop(code||1);});
 console.log(`ONE APP: http://localhost:${hubPort}/ — install Family Learning Games once.`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
}else throw Error('Use setup, start, or test.');
