// Grown-ups' daily summary for one child: what was played, how it went, where
// they got stuck and roughly how long. Built from the child's save plus this
// server's own local diagnostics (read here, never served raw). Shown in the
// Grown-ups' corner and collected each evening into the family recap file.
import {readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import path from 'node:path';
const GAP_MS=10*60*1000;
export const localDate=(at,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const clock=(ms,timeZone)=>new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit'}).format(new Date(ms));
const ACTIONS=new Set(['attempt','maze_action','rescue_action','story_action','soccer_action','reading_action','profile_action']);
export function stretches(times,timeZone){
 const out=[];for(const t of [...times].sort((a,b)=>a-b)){const last=out.at(-1);if(last&&t-last[1]<=GAP_MS)last[1]=t;else out.push([t,t]);}
 return out.map(([a,b])=>({start:clock(a,timeZone),end:clock(b,timeZone),minutes:Math.max(1,Math.round((b-a)/60000))}));
}
// Stream the UTC-named log files that can hold this local day; parse only this player's action rows.
async function dayActions(logs,player,date,timeZone){
 const [y,m,d]=date.split('-').map(Number),next=new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10),prev=new Date(Date.UTC(y,m-1,d-1)).toISOString().slice(0,10);
 let names=[];try{names=(await readdir(logs)).filter(n=>/^\d{4}-\d{2}-\d{2}-\d{3}\.jsonl$/.test(n)&&[prev,date,next].includes(n.slice(0,10))).sort();}catch{return [];}
 const rows=[],needle=`"player":"${player}"`;
 for(const name of names){
  const lines=createInterface({input:createReadStream(path.join(logs,name),{encoding:'utf8'}),crlfDelay:Infinity});
  for await(const line of lines){
   if(!line.includes(needle))continue;
   let r;try{r=JSON.parse(line);}catch{continue;}
   if(r.player!==player||!ACTIONS.has(r.type)||!r.at||localDate(r.at,timeZone)!==date)continue;
   if(r.type==='profile_action'&&['settings','rest','reset'].includes(r.action))continue;
   rows.push(r);
  }
 }
 return rows;
}
const kindOf=key=>/^(find|sequence):/.test(key)?'letters found':key.startsWith('trace:')?'letters traced':'words';
export async function daySummary(p,date,timeZone,logs){
 const today=at=>at&&localDate(at,timeZone)===date;
 const actions=logs?await dayActions(logs,p.id,date,timeZone):[];
 const lessons=(p.history||[]).filter(h=>today(h.at));
 const byKind={};for(const h of lessons){const k=byKind[kindOf(h.key)]??={tried:0,correct:0,helped:0};k.tried++;k.correct+=Number(!!h.ok);k.helped+=Number(!!h.helped);}
 const perKey={};for(const h of lessons){const k=perKey[h.key]??={key:h.key,misses:0,helped:0,slow:0};k.misses+=Number(!h.ok);k.helped+=Number(!!h.helped);k.slow+=Number((h.durationMs||0)>=60000);}
 const label=key=>key.replace('find:','find ').replace('trace:','write ').replace('sequence:','alphabet trail ').replace('spell:','spell ').replace('gap:','missing letter in ').replace('name:','build the name ');
 const stuck=Object.values(perKey).filter(k=>k.misses||k.slow).sort((a,b)=>b.misses-a.misses).slice(0,5).map(k=>`${label(k.key)}: ${[k.misses&&`${k.misses} miss${k.misses>1?'es':''}`,k.helped&&`${k.helped} with help`,k.slow&&'slow'].filter(Boolean).join(', ')}`);
 const mazeRows=actions.filter(r=>r.type==='maze_action'&&r.input?.kind==='answer');
 const mazeMisses={};for(const r of mazeRows)if(r.result?.kind==='incorrect'){const q=r.result.question||{};const k=q.word?`word ${q.word}`:q.char?`letter ${q.char}`:q.type||'gate';mazeMisses[k]=(mazeMisses[k]||0)+1;}
 for(const [k,n] of Object.entries(mazeMisses).sort((a,b)=>b[1]-a[1]).slice(0,3))stuck.push(`labyrinth ${k}: ${n} miss${n>1?'es':''}`);
 const mazeLevels=(p.maze?.history||[]).filter(h=>today(h.at));
 const rescue=(p.rescue?.history||[]).filter(h=>today(h.completedAt)).length;
 const storyChapters=(p.story?.history||[]).filter(h=>today(h.at)).length;
 const count=type=>actions.filter(r=>r.type===type).length;
 const time=stretches(actions.map(r=>Date.parse(r.at)).filter(Number.isFinite),timeZone);
 const bo=(p.boStory?.beats||[]).filter(b=>today(b.at)).map(b=>b.lines.join(' '));
 const lessonsDone=actions.filter(r=>r.type==='attempt'&&r.result?.lesson).length;
 return {app:'letter-quest',player:p.id,name:p.name,date,played:actions.length+lessons.length>0,minutes:time.reduce((n,s)=>n+s.minutes,0),stretches:time,
  lessons:{finished:lessonsDone,attempts:lessons.length,correct:lessons.filter(h=>h.ok).length,independent:lessons.filter(h=>h.ok&&!h.helped).length,byKind,inProgress:p.inLesson||0},
  labyrinth:{levelsFinished:mazeLevels.length,gatesAnswered:mazeRows.length,gatesCorrect:mazeRows.filter(r=>r.result?.kind==='correct').length,level:p.maze?.level??null},
  other:{rescueMissions:rescue,storyChapters,readingActions:count('reading_action'),soccerActions:count('soccer_action')},
  stuck,story:bo,xp:p.xp};
}
