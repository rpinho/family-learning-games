// Local-only production supervisor. Neither process reads Letter Quest saves.
import {spawn} from 'node:child_process';
const root=new URL('..',import.meta.url),node=process.execPath;let closing=false;
const children=[spawn(node,['node_modules/vinext/dist/cli.js','start','-p','4320','-H','127.0.0.1'],{cwd:root,stdio:'inherit',env:process.env}),spawn(node,['server.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,PORT:'4319',ARCADE_UI_PORT:'4320'}})];
function stop(code=0){if(closing)return;closing=true;for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(code),1500);}
for(const c of children){c.on('error',e=>{console.error(e.message);stop(1);});c.on('exit',()=>stop(1));}for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>stop());
