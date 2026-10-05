// Portable nightly entry point for an ordinary public installation, without voice setup.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bookPaths,localDate,addDays} from '../book/paths.mjs';
import {writeArtReferences,artReferences} from '../book/private-art.mjs';
const repo=fileURLToPath(new URL('..',import.meta.url));
const root=resolve(process.env.FAMILY_DEPLOY_ROOT||resolve(repo,'.data'));
const env={...process.env,FAMILY_DEPLOY_ROOT:root,FAMILY_DATA:process.env.FAMILY_DATA||resolve(root,'hub')};
const paths=bookPaths(env);
async function run(script,args){const child=spawn(process.execPath,[script,...args],{cwd:repo,env,stdio:'inherit'});const timer=setTimeout(()=>child.kill('SIGTERM'),2700e3);timer.unref();try{await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',code=>code===0?ok():fail(Error('Nightly step failed: '+code)));});}finally{clearTimeout(timer);}}
// Only a family-installed local worker receives likeness photos. Text model calls never receive them.
if(env.FAMILY_PRIVATE_ART_SCRIPT&&(await artReferences(paths)).references.length){const manifest=await writeArtReferences(paths);await run(resolve(env.FAMILY_PRIVATE_ART_SCRIPT),['--references',manifest,'--book',paths.book]);}
const args=process.argv.slice(2),date=args.includes('--date')?[]:['--date',addDays(localDate(Date.now(),paths.timeZone),1)];
await run(resolve(repo,'book/generate.mjs'),['--no-voice',...date,...args]);
