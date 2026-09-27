#!/usr/bin/env node
// Living-book stories: check and narrate the household's private story file (<book>/living/stories.json).
// - Lint: no line is a bare hum or a string of letters ("Mmm."), and in a decodable story every word he must read
//   (the board, the signs, the magic word, the maze sign) is a CVC word-family word, with look-alikes that share
//   its first letter and differ in the vowel or the end.
// - Narrate: every line without a clip is spoken by the local Kokoro model (book/narrate.py) into <book>/voice
//   (clips are only ever added), and the clip map in the story file is updated.
// Usage: node hub/scripts/living-voice.mjs --book <dir> [--check] [--python <py>] [--models <dir>]
import {readFile,writeFile,rename,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {bareSound,spelledSound} from '../../book/lint.mjs';
import {bookPaths,resolveVoices} from '../../book/paths.mjs';
import {isFamilyWord,isLookAlike} from '../public/word-families.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const paths=bookPaths();const book=arg('--book',paths.book),file=join(book,'living','stories.json');
export function lintStory(id,s){const out=[];
 for(const [k,[who,text]] of Object.entries(s.lines||{})){if(!text)continue;if(bareSound(text))out.push(`${id}.${k}: "${text}" is only a hum or letters`);const sp=spelledSound(text);if(sp)out.push(`${id}.${k}: "${sp}" would be read as letter names`);
  if(!(s.voices?.[who]||s.voices?.narrator))out.push(`${id}.${k}: no voice for "${who}"`);}
 if(s.reading==='decodable'){
  const beat=(name,b)=>{if(!b)return;if(!isFamilyWord(b.word))out.push(`${id}.${name}: "${b.word}" is not a decodable family word`);for(const o of b.options||[])if(o!==b.word&&!(isFamilyWord(o)&&isLookAlike(b.word,o)))out.push(`${id}.${name}: look-alike "${o}" must share the first letter of "${b.word}" and differ in the vowel or the end`);
   for(const o of b.options||[b.word])if(!s.lines?.['so:'+String(o).toLowerCase()])out.push(`${id}.${name}: no sound-out line "so:${o}"`);};
  beat('board',s.board);beat('signs',s.signs);if(s.magic){if(!isFamilyWord(s.magic.word))out.push(`${id}.magic: "${s.magic.word}" is not a decodable family word`);if(!s.lines?.['so:'+s.magic.word])out.push(`${id}.magic: no sound-out line`);}
  if(s.maze?.sign&&!isFamilyWord(s.maze.sign))out.push(`${id}.maze: sign "${s.maze.sign}" is not a decodable family word`);}
 return out;}
const f=JSON.parse(await readFile(file,'utf8'));
const issues=Object.entries(f.stories||{}).flatMap(([id,s])=>lintStory(id,s));
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
if(flag('--check')){console.log('ok');process.exit(0);}
const want=new Map();
let named={};try{named=JSON.parse(await readFile(join(book,'cast.json'),'utf8')).voices||{};}catch{}
for(const s0 of Object.values(f.stories||{})){const s={...s0,voices:resolveVoices(s0.voices,named)};for(const [who,text] of Object.values(s.lines||{})){if(!text)continue;const v=s.voices[who]||s.voices.narrator;const k=`${v.voice}|${v.speed}|${text}`;if(!f.clips?.[k])want.set(k,{text,voice:v.voice,speed:v.speed});}}
if(!want.size){console.log(JSON.stringify({made:0}));process.exit(0);}
const dir=await mkdtemp(join(tmpdir(),'living-voice-'));const req=join(dir,'req.json');
await writeFile(req,JSON.stringify({lines:[...want.values()],out:join(book,'voice'),models:arg('--models',paths.voiceModels)}));
const out=execFileSync('nice',['-n','19','taskpolicy','-b',arg('--python',paths.python),join(here,'..','..','book','narrate.py'),req],{encoding:'utf8',maxBuffer:1<<24,env:{...process.env,BOOK_VOICE_THREADS:process.env.BOOK_VOICE_THREADS||'2'}});
await rm(dir,{recursive:true,force:true});
const r=JSON.parse(out.trim().split('\n').at(-1));f.clips={...(f.clips||{}),...r.clips};
const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(f,null,1),{mode:0o600});await rename(tmp,file);
console.log(JSON.stringify({made:r.made,lines:want.size}));
