#!/usr/bin/env node
import {narrate as renderNarration} from '../../book/generate.mjs';
// Render only missing World lines ahead of playback. --check never writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {CASTLE,SMALL,worldDefinition} from '../public/world-definitions.mjs';
import {smallLearnerProfile} from '../world-small-learner.mjs';
import {bookPaths} from '../../book/paths.mjs';
import {bookService} from '../book-service.mjs';
import {worldLines,worldCryClip,recordedWorldLines} from '../world-service.mjs';
const args=process.argv.slice(2),paths=bookPaths(),at=args.indexOf('--book'),bookDir=at<0?paths.book:args[at+1];
let cast={};try{cast=JSON.parse(await readFile(join(bookDir,'cast.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
let profiles={};try{profiles=JSON.parse(await readFile(join(bookDir,'profiles.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;try{profiles=JSON.parse(await readFile(paths.profiles,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
const [smallPlayer,smallProfile]=Object.entries(profiles).find(([,p])=>p.age<=5)||['young',{age:5}],profile=await smallLearnerProfile(bookDir,smallPlayer,smallProfile);
const sets=[CASTLE,SMALL,worldDefinition(profile)];
for(const [player,p]of Object.entries(profiles).filter(([,p])=>p.age>5)){
 const read=async suffix=>{try{return JSON.parse(await readFile(join(process.env.WORLD_LEARNER_DIR||process.env.FAMILY_LEARNER||paths.learner,player+suffix+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}};
 const [compiled,raw]=await Promise.all([read('-learner'),read('')]);
 sets.push(worldDefinition({...p,learner:{...compiled,literacy:compiled.literacy||raw.literacy||{},math:{...(compiled.math||{}),...(raw.math||{})}}}));
}
const check=args.includes('--check');let rendered=0;
const variants=await Promise.all(sets.map(d=>recordedWorldLines(bookDir,d,profile)));
const pending=[];for(const lines of variants)for(const [key,line] of Object.entries(lines)){
 if(!check&&key==='pip'&&!line.clip)line.clip=await worldCryClip(bookDir,line.voice);
 if(!line.clip&&!pending.some(l=>l.text===line.text&&l.voice===line.voice&&l.speed===line.speed))pending.push(line);
}
if(!check&&pending.length){rendered=pending.length;await renderNarration(pending,{paths:{...paths,book:bookDir,voice:join(bookDir,'voice'),voiceRenderers:join(bookDir,'voice-renderers.json')}});}
const resolved=await Promise.all(sets.map(d=>recordedWorldLines(bookDir,d,profile)));
const lines=Object.fromEntries(resolved.flatMap((ls,i)=>Object.entries(ls).map(([k,v])=>[sets[i].id+':'+i+':'+k,v]))),missing=Object.entries(lines).filter(([,l])=>!l.clip).map(([k])=>k);
if(missing.length)throw Error('Missing recorded World clips: '+missing.join(', '));
for(const [key,l] of Object.entries(lines)){const bytes=await readFile(join(bookDir,'voice',l.clip));if(bytes.length<=44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Invalid World recording: '+key);}
if(!check){await mkdir(bookDir,{recursive:true});await writeFile(join(bookDir,'world-voices.json'),JSON.stringify({lines},null,2)+'\n',{mode:0o600});}
console.log(JSON.stringify({lines:Object.keys(lines).length,rendered,missing:0,check}));
// Cache the deterministic quest's complete sentences (including every supported learner sound).
// The nightly fallback can reuse these recordings even when the model or a voice worker is unavailable.
const {episodeLines,normalizeEpisode}=await import('../../book/episodes/generate.mjs'),{voicesFor}=await import('../../book/assemble.mjs'),{SOUNDS}=await import('../../book/plan.mjs'),{hasSound}=await import('../public/word-families.mjs');
const fallbackLines={};
for(const level of ['reader','early']){const raw=JSON.parse(await readFile(new URL('../../book/episodes/fixtures/'+level+'.json',import.meta.url),'utf8')),ep=normalizeEpisode(raw,raw,raw.learning);const voices=voicesFor({cast:[]},{named:cast.voices||{}});const variants=level==='early'?Object.keys(SOUNDS).filter(hasSound).map(L=>{const e=structuredClone(ep),g=e.puzzles.find(g=>g.kind==='sound');if(g){g.letter=L;g.answer=L;g.options=[L,...Object.keys(SOUNDS).filter(x=>x!==L&&hasSound(x)).slice(0,1)];g.prompt='Tap the letter that makes this sound: '+SOUNDS[L]+'.';g.goal='Listen to the clue. Find the matching letter.';}return e;}):[ep];for(const [i,e]of variants.entries())for(const [key,l]of Object.entries(episodeLines(e,{voices,pronounce:cast.pronounce||{}})))fallbackLines[level+':'+i+':'+key]=l;}
const {clipName}=await import('../book-service.mjs'),{narrate}=await import('../../book/generate.mjs');
const pendingFallback=[];for(const l of Object.values(fallbackLines)){l.clip=clipName(l);try{await readFile(join(bookDir,'voice',l.clip));}catch(e){if(e.code!=='ENOENT')throw e;pendingFallback.push(l);}}
if(pendingFallback.length){if(check)throw Error('Missing fallback quest recordings: '+pendingFallback.length);await narrate(pendingFallback,{paths:{...paths,book:bookDir,voice:join(bookDir,'voice'),voiceRenderers:join(bookDir,'voice-renderers.json')}});}
for(const [key,l]of Object.entries(fallbackLines)){const b=await readFile(join(bookDir,'voice',l.clip));if(b.length<=44||b.toString('ascii',0,4)!=='RIFF')throw Error('Invalid fallback quest recording '+key);}
if(!check)await writeFile(join(bookDir,'world-voices.json'),JSON.stringify({lines:{...lines,...fallbackLines}},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({fallbackQuestLines:Object.keys(fallbackLines).length,check}));
