import {EPISODE_SCHEMA,episodeDefinition} from '../../hub/public/world-episode.mjs';
import {createWorldModel} from '../../hub/public/world-model.mjs';
import {exploreWorld,allActions} from '../../hub/world-check.mjs';
import {canSoundOut,isFamilyWord,hasSound} from '../../hub/public/word-families.mjs';
export {EPISODE_SCHEMA,episodeDefinition};
const ID=/^[a-z][a-z0-9_-]{0,63}$/;
export function episodeIssues(e,{library,taughtLetters=[],level=e?.level}={}){
 const out=[],add=m=>out.push(m),arr=x=>Array.isArray(x)?x:[];
 if(!e||e.schema!==EPISODE_SCHEMA)return ['Wrong episode schema'];if(!['rooms','puzzles','locks','sideQuests'].every(k=>Array.isArray(e[k])&&e[k].every(x=>x&&typeof x==='object'&&!Array.isArray(x)))||!e.items||typeof e.items!=='object'||Array.isArray(e.items))return ['Rooms, puzzles, locks, side quests and items must have the declared JSON shape'];
 for(const k of ['id','player','start','finish'])if(!ID.test(e[k]||''))add(`Invalid ${k}`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date||''))add('Invalid date');
 if(!['reader','early'].includes(e.level)||e.level!==level)add('Wrong learner level');
 for(const k of ['title','goal','intro','recap','reveal','hook'])if(typeof e[k]!=='string'||!e[k].trim()||e[k].length>500)add(`Missing or oversized ${k}`);
 const rooms=arr(e.rooms),puzzles=arr(e.puzzles),locks=arr(e.locks),sides=arr(e.sideQuests),items=e.items||{};
 if(rooms.length<3||rooms.length>6)add('Episode needs 3–6 rooms');if(puzzles.length<2||puzzles.length>8)add('Episode needs 2–8 puzzles');if(locks.length<1||locks.length>3)add('Episode needs 1–3 tool locks');if(sides.length<1||sides.length>3)add('Episode needs 1–3 optional side quests');
 for(const [label,list]of [['room',rooms],['puzzle',puzzles],['lock',locks]]){const ids=list.map(x=>x?.id);if(new Set(ids).size!==ids.length)add(`Duplicate ${label} id`);for(const x of list)if(!ID.test(x?.id||''))add(`Invalid ${label} id`);}
 const rids=new Set(rooms.map(r=>r.id)),gids=new Set(puzzles.map(g=>g.id)),lids=new Set(locks.map(l=>l.id)),iids=new Set(Object.keys(items));const refs=new Set([...gids,...lids,...iids]);
 if(refs.has('quest'))add('quest is a reserved id');
 if(new Set([...gids,...lids,...iids]).size!==gids.size+lids.size+iids.size)add('Puzzle, item and lock ids must differ');
 if(!rids.has(e.start)||!gids.has(e.finish))add('Start or finish is missing');
 for(const r of rooms){if(!r.name||!r.bg||!r.friend||!Array.isArray(r.lines)||r.lines.length!==2||r.lines.some(t=>typeof t!=='string'||!t.trim()))add(`room ${r.id}: needs name, painting, friend and two lines`);
  if(library&&(!library.backgrounds?.[r.bg]||!library.actors?.[r.friend]))add(`room ${r.id}: unavailable painting or friend`);
  for(const [side,to]of Object.entries(r.exits||{})){if(!['left','right','top','bottom'].includes(side)||!rids.has(to))add(`room ${r.id}: invalid exit ${side}`);else if(rooms.find(r=>r.id===to)?.exits?.[({left:'right',right:'left',top:'bottom',bottom:'top'})[side]]!==r.id)add(`room ${r.id}: missing return sign from ${to}`);}
  if(r.door){if(!rids.has(r.door.to)||rooms.find(x=>x.id===r.door.to)?.door?.to!==r.id)add(`room ${r.id}: interior must have a return opening`);if(!r.door.return)for(const key of ['wide','tall'])if(!Array.isArray(r.door[key])||r.door[key].length!==4||r.door[key].some(n=>!Number.isFinite(n)||n<0||n>1))add(`room ${r.id}: opening needs ${key} coordinates`);}
  for(const [side,k]of Object.entries(r.exitRequires||{}))if(!r.exits?.[side]||!refs.has(k))add(`room ${r.id}: invalid exit requirement`);
 }
 if(!rooms.some(r=>r.door&&!r.door.return))add('Episode needs a walkable interior');
 for(const [k,v]of Object.entries(items))if(!ID.test(k)||!v?.name||!v?.icon)add(`item ${k}: invalid tool or reward`);
 for(const g of puzzles){if(!rids.has(g.room)||!g.title||!g.prompt||!g.hint||!g.goal||!g.icon)add(`puzzle ${g.id}: missing room, prompt, goal or hint`);
  if(!Array.isArray(g.options)||g.options.length<2||g.options.length>4||g.options.some(x=>typeof x!=='string')||!g.options.includes(g.answer)||new Set(g.options).size!==g.options.length)add(`puzzle ${g.id}: answer and distinct options required`);
  if(!Array.isArray(g.requires)||!Array.isArray(g.rewards))add(`puzzle ${g.id}: requires and rewards arrays required`);
  for(const k of arr(g.requires))if(!refs.has(k))add(`puzzle ${g.id}: unknown prerequisite ${k}`);for(const k of arr(g.rewards))if(!iids.has(k))add(`puzzle ${g.id}: unknown reward ${k}`);
  if(e.level==='reader'){
   if(g.kind==='tiles'){
    const allowed=w=>canSoundOut(w)&&(g.practice==='name-spelling'?(e.learning?.nameSpelling||[]).includes(w)&&!['mom','grown-up'].includes(w):g.practice==='hear-and-build'?(e.learning?.hearAndBuildWords||e.learning?.wordsAboveLevel||[]).includes(w):isFamilyWord(w));
    if(!Array.isArray(g.words)||g.words.length<1||g.words.length>(g.practice==='name-spelling'?2:1)||!g.words.every(allowed)||g.answer!==g.words.join(' '))add(`puzzle ${g.id}: reading must be a supported CVC word or explicit supported practice goal`);
    if(g.soundSupport!==true)add(`puzzle ${g.id}: reading needs tap-to-hear sounds`);}
   else if(g.kind==='math'){
    const m=g.math||{};let answer=null;
    if(m.type==='fact'){if(![m.a,m.b].every(n=>Number.isInteger(n)&&n>=6&&n<=12)||Math.min(m.a,m.b)>9)add(`puzzle ${g.id}: use tables 6–9+`);answer=m.a*m.b;}
    else if(m.type==='multiply'){if(![m.a,m.b].every(n=>Number.isInteger(n)&&n>=10&&n<=99))add(`puzzle ${g.id}: multiplication needs two 2-digit factors`);answer=m.a*m.b;}
    else if(m.type==='divide'){if(![m.a,m.b].every(n=>Number.isInteger(n)&&n>0)||m.b<6||m.a%m.b||m.a/m.b<6)add(`puzzle ${g.id}: division must be exact and at learner level`);answer=m.a/m.b;}
    else if(m.type==='place'){if(!Number.isInteger(m.number)||m.number<1000||m.number>9999||!Number.isInteger(m.digitIndex)||m.digitIndex<0||m.digitIndex>3)add(`puzzle ${g.id}: place value needs a 4-digit number`);answer=Number(String(m.number)[m.digitIndex])*10**(3-m.digitIndex);}
    else add(`puzzle ${g.id}: unsupported math type`);
    if(String(answer)!==g.answer)add(`puzzle ${g.id}: incorrect answer, expected ${answer}`);
   }else add(`puzzle ${g.id}: reader puzzle must be CVC reading or math`);
  }else{
   if(g.kind==='count'){if(!Number.isInteger(g.count)||g.count<1||g.count>20||g.answer!==String(g.count))add(`puzzle ${g.id}: counting must be correct and within 20`);}
   else if(g.kind==='sound'){if(!taughtLetters.map(x=>x.toUpperCase()).includes(g.letter)||!hasSound(g.letter)||g.answer!==g.letter||!g.options?.every(x=>taughtLetters.map(x=>x.toUpperCase()).includes(x)&&hasSound(x))||g.soundSupport!==true)add(`puzzle ${g.id}: sound puzzle must use taught letters with recorded sounds`);}
   else add(`puzzle ${g.id}: pre-reader needs spoken counting or letter sounds`);
  }
 }
 if(e.level==='reader'&&!puzzles.some(g=>g.kind==='tiles'&&!g.practice))add('Reader episode needs CVC reading');
 for(const l of locks){if(!rids.has(l.room)||!iids.has(l.item)||!l.label||!l.hint||!l.goal||!l.icon||!Array.isArray(l.requires))add(`lock ${l.id}: missing tool, room or hint`);for(const k of arr(l.requires))if(!refs.has(k))add(`lock ${l.id}: unknown prerequisite ${k}`);}
 for(const s of sides)if(!s.id||!s.title||!puzzles.some(g=>g.id===s.puzzle&&g.optional))add('Side quest must name an optional puzzle');
 if(puzzles.find(g=>g.id===e.finish)?.optional)add('Finish cannot be optional');
 const sideIds=new Set(sides.map(s=>s.puzzle));for(const g of puzzles)if(g.optional&&!sideIds.has(g.id))add(`puzzle ${g.id}: optional puzzle needs side quest`);
 const text=[e.title,e.goal,e.intro,e.reveal,e.recap,e.hook,...rooms.flatMap(r=>[r.name,...r.lines||[]]),...puzzles.flatMap(g=>[g.title,g.prompt,g.hint,g.goal]),...Object.values(items).map(i=>i.name),...locks.flatMap(l=>[l.label,l.hint,l.goal])].join(' ');if(e.level==='early'&&/\bMom\b/i.test(text))add('Early cast calls her Grown-up');
 return out;
}
export function checkEpisode(e,opts={}){
 const issues=episodeIssues(e,opts);if(issues.length)return {issues,states:0,refusals:0};
 const model=createWorldModel(episodeDefinition(e));let graph;
 try{graph=exploreWorld({model,limit:100000});}catch(err){return {issues:[`State proof failed: ${err.message}`],states:0,refusals:0};}
 let refusals=0;const actions=allActions(model);
 for(const [key,s]of graph.states){if(!graph.canWin.has(key)){issues.push(`Unfinishable state: room ${s.room}, solved ${s.solved.join(',')}`);break;}
  const next=model.nextGoal(s);if(!model.routeTo(s.room,next.room,s).length){issues.push(`Hint step unreachable from ${s.room}`);break;}
  if(opts.lines&&!opts.lines[next.key])issues.push(`Missing sentence for ${next.key}`);
  if(next.key!=='next-done'){const t=next.target,a=t==='friend'?{action:'quest'}:t.startsWith('gate-')?{action:'solve',gate:t.slice(5),answer:model.GATES[t.slice(5)]?.answer}:{action:'use',target:t.slice(5),item:model.LOCKS[t.slice(5)]?.item};const projected=s=>JSON.stringify([s.items,s.flags,s.solved]);try{const located={...s,room:next.room},r=model.worldAction(located,a);if(projected(r.state)===projected(located))issues.push('Hint step makes no progress');}catch{issues.push('Hint step cannot be acted on');}}
  for(const a of actions){if(a.from&&a.from!==s.room)continue;try{model.worldAction(s,a);}catch(err){if(err.missing?.length){refusals++;if(!err.message.includes(err.missing[0].label)||err.missing.some(r=>model.fulfilled(s,r.id)))issues.push('Refusal must name an unmet step');if(!model.routeTo(s.room,err.next.room,s).length)issues.push('Refusal next step is unreachable');}}}
 }
 for(const k of Object.keys(model.GATES))if(![...graph.states.values()].some(s=>s.solved.includes(k)))issues.push(`Puzzle never reachable: ${k}`);
 if(!graph.canWin.size)issues.push('Quest cannot finish from start');
 return {issues:[...new Set(issues)],states:graph.states.size,refusals};
}
export function mathDisplay(m){return m.type==='place'?String(m.number):`${m.a} ${m.type==='divide'?'÷':'×'} ${m.b} = ?`;}
