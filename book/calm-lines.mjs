#!/usr/bin/env node
// The calm Book's voice (idea/20260928-book-calm), in the manner of the calm theme: his name, ONE
// instruction, then the task is handed over ("say done when you finish"); praise that names the specific thing he did
// plus a small image; a warm reset after a mistake; an "easier or harder next time?" offer at the end. NEW LINES ONLY,
// in the chapter's own narrator voice; the chapter file is never changed: the lines go to <player>/<date>.calm.json
// beside it (the server adds them as chapter.calm), and --render makes their clips with book/narrate.py (the same
// pronunciation map). No line repeats within a chapter.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {slot,readJSON,atomicJSON,withSlotLock} from './review.mjs';
import {bookPaths,soundSource,localDate,addDays} from './paths.mjs';

const WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const say=n=>/^\d+$/.test(String(n))&&Number(n)<=20?WORDS[Number(n)]:String(n);
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const T=x=>typeof x==='string'?x:x?.text||'';
// the original line's own specific words, without the cheering in front and with a calm full stop
const plain=x=>T(x).replace(/\[\[[^\]]*\]\]/g,'').replace(/^(yes|yay|wow|touchdown|hooray|great|brilliant)[!,.]*\s*/i,'').replace(/!+/g,'.').replace(/\s+/g,' ').trim().replace(/\.$/,'');
// small images, each used once per chapter
const IMAGES={
 count:['like beads on a string','like stepping stones across a stream','like counting stars one at a time'],
 order:['like steps going up a staircase','like ducks walking in a row','like notes climbing up a scale'],
 letter:['as smooth as a river stone','as steady as a lighthouse','as neat as a new pencil line'],
 kick:['like a letter posted home','like a key clicking into its lock','like a bird landing in its nest'],
 read:['like following footprints in the snow','like crossing a bridge plank by plank','like reading a treasure map'],
 puzzle:['like climbing a ladder one rung at a time','like fitting the last piece of a puzzle','like finding the right path through a maze'],
 spell:['like books back on their shelf','like beads threaded in the right order','like a train with every carriage in place'],
 no:['like a good guard at the castle gate','like a captain keeping the ship on course'],
};
const RESETS=['That one was a little tricky. Let\'s look again, slowly.','Hmm, not that one. Take your time and have another look.','That one was a bit bumpy, but you are sticking with it. Try another way.','Nearly. Look carefully, and try once more.'];

export function calmLines(ch){
 const name=ch.name||cap(ch.player||'friend'),used=new Map(),pick=k=>{const a=IMAGES[k]||IMAGES.puzzle,i=used.get(k)||0;used.set(k,i+1);return a[i%a.length];};
 const nar=ch.pages.flatMap(p=>p.say||[]).find(l=>l.who==='narrator')||ch.cover?.line||{voice:'af_bella',speed:0.9};
 const L=text=>({who:'narrator',text,voice:nar.voice,speed:nar.speed});
 const pages={};
 ch.pages.forEach((p,i)=>{const b=p.beat;if(!b)return;const o={};
  switch(b.kind){
   case 'teach-letter':o.praise=L(`That's ${b.letter}, ${name}. You made its shape ${pick('letter')}.`);break;
   case 'kick-letter':o.praise=L(`The ${b.letter} ball, right into the net, ${pick('kick')}.`);break;
   case 'count':{const things=(T(b.ask).match(/How many (.+)\?/)||[,'of them'])[1];
    o.ask=L(`${name}, tap each one to count the ${things}. Say done when you finish.`);o.done=true;
    o.praise=L(`${cap(say(b.answer))} ${things}, counted one by one, ${pick('count')}.`);break;}
   case 'order':o.praise=L(`One, two, three, four, five, all in order, ${pick('order')}.`);break;
   case 'no':o.praise=L(b.right?`You said no, and you were right: ${b.right} is the one, ${pick('no')}.`:`You said no, and you were right, ${pick('no')}.`);break;
   case 'signs':if(b.target)o.praise=L(`You read ${b.target}, every letter, ${pick('read')}.`);break;
   case 'puzzle':if(plain(b.done))o.praise=L(`${cap(plain(b.done))}. You worked it out step by step, ${pick('puzzle')}.`);break;
   case 'spell':if(Array.isArray(b.answer))o.praise=L(`${b.answer.join(' ')}. Every word in its place, ${pick('spell')}.`);break;
  }
  if(Object.keys(o).length)pages[i]=o;});
 // (the narrator never speaks as "I": 2026-10-01, "Who said that? Was it me?")
 return {schema:'family-book-calm-1',player:ch.player,date:ch.date,
  greet:L(`Hello ${name}. It is good to see you.`),
  resets:RESETS.map(L),
  offer:L(`Next time, a little easier, or a little harder? You choose.`),
  easier:L(`A little easier it is. See you next time, ${name}.`),
  harder:L(`A little harder it is. You're ready, ${name}.`),
  pages};
}
const linesOf=c=>[c.greet,...c.resets,c.offer,c.easier,c.harder,...Object.values(c.pages).flatMap(o=>[o.ask,o.praise].filter(Boolean))];

export async function renderCalm(ch,{paths,render=true}={}){
 const c=calmLines(ch),lines=linesOf(c);
 if(render){const here=dirname(fileURLToPath(import.meta.url)),dir=await mkdtemp(join(tmpdir(),'calm-')),req=join(dir,'req.json');
  try{await writeFile(req,JSON.stringify({lines,out:paths.voice,models:paths.voiceModels,...soundSource(paths)}));
   const out=execFileSync('nice',['-n','19',paths.python,join(here,'narrate.py'),req],{encoding:'utf8',maxBuffer:1<<24});
   const clips=JSON.parse(out.trim().split('\n').at(-1)).clips;for(const l of lines)l.clip=clips[`${l.voice}|${l.speed}|${l.text}`];
  }finally{await rm(dir,{recursive:true,force:true});}}
 return c;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
 const paths=bookPaths(),players=(arg('--players')||'beginner,explorer').split(',');
 // No --dates: the chapter the nightly just wrote (the same rule as generate.mjs: before noon today, after noon tomorrow).
 const now=Date.now(),hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:paths.timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date(now)));
 const dates=(arg('--dates')||(args.includes('--review')?addDays(localDate(now,paths.timeZone),1):hour<12?localDate(now,paths.timeZone):addDays(localDate(now,paths.timeZone),1))).split(',').filter(Boolean);
 if(args.includes('--review')&&!args.includes('--dry')){for(const pl of players)for(const d of dates)await withSlotLock(paths.book,pl,d,async()=>{const base=slot(paths.book,pl,d,true),ch=await readJSON(base+'.json');if(!ch)return;ch.calm=await renderCalm(ch,{paths,render:args.includes('--render')});await atomicJSON(base+'.calm.json',ch.calm);await atomicJSON(base+'.json',ch);});process.exit(0);}
 const all=[];
 for(const pl of players)for(const d of dates){const dir=join(paths.book,pl,...(args.includes('--review')?['review']:[])),f=join(dir,d+'.json');if(!existsSync(f)){console.log(`${pl} ${d}: no chapter`);continue;}
  const ch=JSON.parse(await readFile(f,'utf8')),c=calmLines(ch);all.push(...linesOf(c));
  console.log(`${pl} ${d}: ${linesOf(c).length} calm lines (${Object.keys(c.pages).length} pages)`);
  if(args.includes('--dry'))for(const l of linesOf(c))console.log('   ',l.text);
  else await writeFile(join(dir,d+'.calm.json'),JSON.stringify(c,null,1),{mode:0o600});}
 if(args.includes('--render')&&!args.includes('--dry')&&all.length){
  const here=dirname(fileURLToPath(import.meta.url)),dir=await mkdtemp(join(tmpdir(),'calm-')),req=join(dir,'req.json');
  const uniq=[...new Map(all.map(l=>[`${l.voice}|${l.speed}|${l.text}`,l])).values()];
  await writeFile(req,JSON.stringify({lines:uniq.map(l=>({text:l.text,voice:l.voice,speed:l.speed})),out:paths.voice,models:paths.voiceModels,...soundSource(paths)}));
  const out=execFileSync('nice',['-n','19',paths.python,join(here,'narrate.py'),req],{encoding:'utf8',maxBuffer:1<<24});
  await rm(dir,{recursive:true,force:true});console.log(out.trim().split('\n').at(-1));}
}
