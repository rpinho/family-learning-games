#!/usr/bin/env node
// Letter Hunt lines: check and narrate the household's private hunts file (<book>/hunts.json).
// Every line goes through the one pronunciation map (names as phonemes), must say each word once, must not be a
// bare hum, and gets its clip from the local voice (letter sounds from Letter Quest's own clips, see narrate.py).
// Usage: node hub/scripts/hunt-voice.mjs --book <dir> [--check]
import {readFile,writeFile,rename,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {bareSound,repeatedWords} from '../../book/lint.mjs';
import {bookPaths} from '../../book/paths.mjs';
import {phonemize,rawNames} from '../public/pronounce.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
export async function voiceHunts(book,{check=false,f:given=null,paths=bookPaths()}={}){
 const file=join(book,'hunts.json');
let pronounce={};try{pronounce=JSON.parse(await readFile(join(book,'cast.json'),'utf8')).pronounce||{};}catch{}
const f=given||JSON.parse(await readFile(file,'utf8'));const lines=[];
const walk=(v,p)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach((x,i)=>walk(x,`${p}[${i}]`));if(typeof v.text==='string'&&v.voice)lines.push([p,v]);for(const [k,x] of Object.entries(v))if(x&&typeof x==='object')walk(x,`${p}.${k}`);};
walk(f.players,'players');
const issues=[];
for(const [p,l] of lines){const said=phonemize(l.shown||l.text,pronounce);if(said!==l.text){l.shown=l.shown||l.text;l.text=said;delete l.clip;}
 if(bareSound(l.text))issues.push(`${p}: only a hum or letters`);const r=repeatedWords(l.text);if(r.length)issues.push(`${p}: "${r[0]}" twice in a row`);
 const raw=rawNames(l.text,pronounce);if(raw.length)issues.push(`${p}: ${raw[0]} without its pronunciation`);}
if(issues.length)throw Object.assign(Error(issues.join('\n')),{issues});
if(check)return {lines:lines.length,made:0,f};
// A clip that is gone from disk (moved to the Trash after a failed check, or never copied) is rendered again.
for(const [,l] of lines)if(l.clip&&!existsSync(join(book,'voice',l.clip)))delete l.clip;
const want=lines.filter(([,l])=>!l.clip).map(([,l])=>({text:l.text,voice:l.voice,speed:l.speed}));
if(want.length){const dir=await mkdtemp(join(tmpdir(),'hunt-voice-'));const req=join(dir,'req.json');
 await writeFile(req,JSON.stringify({lines:want,out:join(book,'voice'),models:paths.voiceModels,lq_voice:paths.data['letter-quest']?join(paths.data['letter-quest'],'voice'):null}));
 const out=execFileSync('nice',['-n','19','taskpolicy','-b',paths.python,join(here,'..','..','book','narrate.py'),req],{encoding:'utf8',maxBuffer:1<<24});
 await rm(dir,{recursive:true,force:true});const r=JSON.parse(out.trim().split('\n').at(-1));
 for(const [,l] of lines)if(!l.clip)l.clip=r.clips[`${l.voice}|${l.speed}|${l.text}`];}
if(!given){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(f,null,1),{mode:0o600});await rename(tmp,file);}
return {lines:lines.length,made:want.length,f};
}
if(import.meta.url===`file://${process.argv[1]}`){try{const r=await voiceHunts(arg('--book',bookPaths().book),{check:flag('--check')});console.log(JSON.stringify({lines:r.lines,made:r.made}));}catch(e){console.error(e.message);process.exit(1);}}
