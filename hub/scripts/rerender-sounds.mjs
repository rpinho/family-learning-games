#!/usr/bin/env node
// Re-render every line that contains a letter sound (a [[b]]-style phoneme) in a book's chapters (from a date on) and
// its Letter Hunts, with the letter sounds of that channel (FAMILY_CHANNEL=staging uses staging's candidate set, see
// book/paths.mjs). The same clip names are made again in voice-new-<stamp>/, then swapped in; the old clips are MOVED
// to <book>/voice-replaced-<stamp>/ (never deleted). Usage: FAMILY_CHANNEL=staging node hub/scripts/rerender-sounds.mjs --book <dir> [--from YYYY-MM-DD]
//   [--letters b,f,u] [--dry]
import {readFile,readdir,mkdir,rename,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {bookPaths,soundSource} from '../../book/paths.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},dry=args.includes('--dry');
const paths=bookPaths(),book=arg('--book',paths.book),from=arg('--from','0000'),only=arg('--letters')?.split(',');
const PH2LETTER={'æ':'a','b':'b','k':'c','d':'d','ɛ':'e','f':'f','ɡ':'g','h':'h','ɪ':'i','m':'m','n':'n','ɑ':'o','p':'p','ɹ':'r','s':'s','t':'t','ʌ':'u'};
const soundsIn=text=>[...String(text).matchAll(/\[\[([^\]]*)\]\]/g)].map(m=>m[1].replace(/[ˈˌ]/g,'')).filter(p=>p.length>0&&p.length<=2).map(p=>PH2LETTER[p]).filter(Boolean);
const lines=[];const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);
 if(typeof v.text==='string'&&v.voice&&v.clip){const s=soundsIn(v.text);if(s.length&&(!only||s.some(l=>only.includes(l))))lines.push(v);}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
for(const d of await readdir(book,{withFileTypes:true})){if(!d.isDirectory()||['voice','art','cast','living','refs','rejected'].includes(d.name)||d.name.startsWith('voice-'))continue;
 for(const f of await readdir(join(book,d.name)).catch(()=>[]))if(/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f>=from)walk(JSON.parse(await readFile(join(book,d.name,f),'utf8')));}
if(existsSync(join(book,'hunts.json')))walk(JSON.parse(await readFile(join(book,'hunts.json'),'utf8')));
const byClip=new Map(lines.map(l=>[l.clip,l]));
console.log(`${byClip.size} clips with letter sounds${only?` (${only.join(', ')})`:''}; sounds from ${soundSource(paths).letter_sounds}`);
if(dry||!byClip.size)process.exit(0);
// The new clips are made in a folder next to voice/ first; only when all are made is each old clip moved aside and
// the new one moved in (a rename each), so a child reading right now never finds a clip missing.
const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15),aside=join(book,`voice-replaced-${stamp}`),fresh=join(book,`voice-new-${stamp}`);
const dir=await mkdtemp(join(tmpdir(),'rerender-'));const req=join(dir,'req.json');
await writeFile(req,JSON.stringify({lines:[...byClip.values()].map(l=>({text:l.text,voice:l.voice,speed:l.speed})),out:fresh,models:paths.voiceModels,...soundSource(paths)}));
const out=execFileSync('nice',['-n','19','taskpolicy','-b',paths.python,join(here,'..','..','book','narrate.py'),req],{encoding:'utf8',maxBuffer:1<<24});
await rm(dir,{recursive:true,force:true});
const notMade=[...byClip.keys()].filter(c=>!existsSync(join(fresh,c)));
if(notMade.length){console.log(JSON.stringify({error:'not all clips were made; nothing replaced',notMade:notMade.slice(0,5),newClipsIn:fresh}));process.exit(1);}
await mkdir(aside,{recursive:true});
for(const c of byClip.keys()){if(existsSync(join(book,'voice',c)))await rename(join(book,'voice',c),join(aside,c));await rename(join(fresh,c),join(book,'voice',c));}
if(!(await readdir(fresh)).length)await rm(fresh,{recursive:true});
const r=JSON.parse(out.trim().split('\n').at(-1));const missing=[...byClip.keys()].filter(c=>!existsSync(join(book,'voice',c)));
console.log(JSON.stringify({made:r.made,sameNames:!missing.length,missing:missing.slice(0,5),oldClipsIn:aside}));
process.exit(missing.length?1:0);
