// Parent-facing daily summary for one child: what was played, how it went,
// where they got stuck and roughly how long. Built only from the child's own
// saved history (no logs, nothing leaves the Mini). Shown in Parent settings
// and collected each evening into the family recap file for the digest.
import {advanced,cookieProgress,challengeLevel} from './explorer.mjs';
import {gamesFor} from './math.mjs';
const GAP_MS=10*60*1000;
export const localDate=(at,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const clock=(ms,timeZone)=>new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit'}).format(new Date(ms));
// Stretches of play: activity separated by less than ten minutes.
export function stretches(rows,timeZone){
 const spans=rows.map(r=>{const end=Date.parse(r.at),d=Math.min(Math.max(0,r.durationMs||0),10*60*1000);return [end-d,end];}).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)).sort((x,y)=>x[0]-y[0]);
 const out=[];
 for(const [a,b] of spans){const last=out.at(-1);if(last&&a-last[1]<=GAP_MS)last[1]=Math.max(last[1],b);else out.push([a,b]);}
 return out.map(([a,b])=>({start:clock(a,timeZone),end:clock(b,timeZone),minutes:Math.max(1,Math.round((b-a)/60000))}));
}
function describe(q){
 if(!q)return 'a question';
 if(q.kind==='cookies'){const d=q.mode==='bags'?q.bagSize:q.plates,mode={share:'sharing',fix:'fix the plates',mixed:'hidden counts',bags:'bags',rows:'rows',leftover:'remainders'}[q.mode]||'sharing';return `cookies ${q.total} ÷ ${d} (${mode}, level ${q.level}${q.fade?', '+q.fade:''})`;}
 if(q.placeMode==='build')return `build ${q.total??(q.target||[]).reduce((n,v)=>n*10+v,0)} from blocks (level ${q.level})`;
 if(q.kind==='place')return `place value ${q.total} (${q.placeMode})`;
 if(q.kind==='skip')return `jumps ${q.sequence.join(', ')}, …`;
 if(['multiply','factor','sums'].includes(q.kind))return `${q.blank===0?'?':q.a} ${q.operator} ${q.blank===1?'?':q.b} = ${q.blank===2?'?':q.total}`;
 if(q.kind==='count')return `count ${q.answer}`;
 if(q.kind==='subtract')return `${q.total} − ${q.remove}`;
 if(q.kind==='pattern')return `pattern (level ${q.level||1})`;
 return `${q.blank===0?'?':q.a} ${q.operator||'+'} ${q.blank===1?'?':q.b} = ${q.blank===2?'?':q.total}`;
}
function stuckReason(h){
 const r=[];
 if(!h.ok)r.push(`answered ${h.answer}`);
 if(h.cookieChecks)r.push(`${h.cookieChecks} uneven/extra check${h.cookieChecks>1?'s':''}`);
 if(h.askTries)r.push(`${h.askTries} wrong count${h.askTries>1?'s':''}`);
 if(h.predicted!==undefined&&h.predicted!==h.answer)r.push(`guessed ${h.predicted}`);
 if(h.placeChecks)r.push(`${h.placeChecks} build check${h.placeChecks>1?'s':''}`);
 if(h.helped&&!r.length)r.push('pressed Help');
 if((h.durationMs||0)>=120000)r.push(`${Math.round(h.durationMs/1000)} s`);
 return r;
}
export function daySummary(p,date,timeZone){
 const today=r=>r?.at&&localDate(r.at,timeZone)===date;
 const rows=(p.history||[]).filter(today),reading=(p.reading?.history||[]).filter(today),planning=(p.planning?.history||[]).filter(today),art=(p.art?.history||[]).filter(today);
 const titles=Object.fromEntries(gamesFor(p).map(g=>[g.id,g.title]));
 const byGame={};
 for(const h of rows){const g=byGame[h.game]??={id:h.game,title:titles[h.game]||h.game,questions:0,correct:0,independent:0,helped:0};g.questions++;g.correct+=Number(!!h.ok);g.independent+=Number(!!h.ok&&!h.helped);g.helped+=Number(!!h.helped);}
 const stuck=rows.map(h=>({h,reasons:stuckReason(h)})).filter(x=>x.reasons.length&&(!x.h.ok||x.h.helped||(x.h.durationMs||0)>=120000)).slice(-6).map(({h,reasons})=>`${titles[h.game]||h.game}: ${describe(h.question)}: ${reasons.join(', ')}`);
 const levels={};
 if(advanced(p)){
  const c=cookieProgress(p);levels.cookies={level:c.level,stage:c.fade,...(c.toMastery!==null?{toMastery:c.toMastery}:{})};
  for(const skill of ['multiply','factor','sums','skip','place'])levels[skill]=challengeLevel(p,skill);
 }
 const time=stretches([...rows,...reading,...planning.map(r=>({...r,durationMs:r.durationMs||0})),...art.map(r=>({at:r.at,durationMs:0}))],timeZone);
 const story=(p.story?.beats||[]).filter(today).map(b=>b.line);
 const questions=rows.length,correct=rows.filter(h=>h.ok).length,independent=rows.filter(h=>h.ok&&!h.helped).length;
 return {app:'number-park',player:p.id,name:p.name,date,played:questions+reading.length+planning.length+art.length>0,minutes:time.reduce((n,s)=>n+s.minutes,0),stretches:time,questions,correct,independent,games:Object.values(byGame),other:{reading:reading.length,planning:planning.length,drawing:art.length},levels,stuck,story,stars:p.xp};
}
