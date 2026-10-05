// really hard to make a mistake"). Static checks on the authored data plus a model checker that explores EVERY state
// the server's own reducer (worldAction) can reach: the quest must be finishable from the start and from every state
// a child can get into, every hint must exist, every tool must come from somewhere, every puzzle must be right.
import paintedLayouts from './book-art-layouts.json' with {type:'json'};
import {checkEpisode} from '../book/episodes/format.mjs';
import {questGoals,goalsByRoom,multiplicationFacts,knownFact,factSupport} from './public/world-progress.mjs';
import {scenePuzzleIssues} from './public/world-scene-puzzles.mjs';
import {castleMathIssues} from './public/world-definitions.mjs';
import {createWorldModel} from './public/world-model.mjs';
const castle=createWorldModel();

const won=s=>s.treasureOpen&&s.doorOpen;
const key=s=>JSON.stringify([s.room,[...s.items].sort(),[...s.solved].sort(),[...s.flags].sort(),[...s.collected].sort(),s.questStarted,s.doorOpen,s.treasureOpen]);

// Every action a child could trigger, derived from the data (never hand-listed, so new content is explored too).
export function allActions(model=castle){const {ROOMS,GATES,LOCKS}=model,acts=[];
 for(const [id,r] of Object.entries(ROOMS)){for(const to of Object.values(r.exits))acts.push({action:'walk',room:to,x:.5,y:.97,from:id});if(r.door)acts.push({action:'enter',room:r.door.to,from:id});}
 acts.push({action:'quest'},{action:'friend'});if(!model.definition.early&&!model.definition.episode)acts.push({action:'pip'},{action:'secret',id:'pip-chest'});
 for(const id of (model.definition.early||model.definition.episode?[]:['acorn-1','acorn-2','acorn-3','ball']))acts.push({action:'collect',id,from:id==='ball'?'soccer-pitch':'castle-forest'});
 for(const [target,l] of Object.entries(LOCKS))acts.push({action:'use',target,item:l.item,from:l.room});
 for(const [gate,g] of Object.entries(GATES))acts.push({action:'solve',gate,answer:g.answer,from:g.room});
 return acts;}

export function exploreWorld({model=castle,start=model.freshWorld(),limit=200000}={}){
 const {worldAction}=model,acts=allActions(model),seen=new Map(),edges=new Map(),queue=[start];seen.set(key(start),start);
 // Indexing the queue avoids repeatedly copying its entire pending tail. Local actions
 // carry their authored room, just as travel already did; wrong-room attempts cannot change a state.
 for(let head=0;head<queue.length;head++){const s=queue[head],k=key(s),out=[];
  for(const a of acts){if(!model.definition.episode&&model.GATES[a.gate]?.optional)continue;if(a.from&&a.from!==s.room)continue;let r;try{r=worldAction(s,a);}catch{continue;}
   const n=r.state,nk=key(n);if(nk===k)continue;out.push(nk);if(!seen.has(nk)){seen.set(nk,n);queue.push(n);if(seen.size>limit)throw Error('state space too large');}}
  edges.set(k,out);}
 // States from which a win is still reachable (reverse search from the won states).
 const rev=new Map();for(const [k,out] of edges)for(const n of out){if(!rev.has(n))rev.set(n,[]);rev.get(n).push(k);}
 const canWin=new Set([...seen].filter(([,s])=>won(s)).map(([k])=>k)),q=[...canWin];
 while(q.length){const k=q.pop();for(const p of rev.get(k)||[])if(!canWin.has(p)){canWin.add(p);q.push(p);}}
 return {states:seen,canWin,edges};}

const evalEq=e=>{const t=String(e).replace(/=.*$/,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');return /^[\d\s+*/()-]+$/.test(t)?Function(`return (${t})`)():null;};

export function checkWorld({model=castle,lines=null,tablesFloor=2,taughtLetters=[],factEvidence=model.definition.learning?.factEvidence||[],mapGoals=goalsByRoom,minOpenGoals=3}={}){if(model.definition.episode)return checkEpisode(model.definition.episode,{lines,taughtLetters:taughtLetters.length?taughtLetters:model.definition.episode.learning?.taughtLetters||[]});const {ROOMS,ITEMS,LOCKS,GATES,FRIENDS,freshWorld,nextHint}=model;const issues=[];const found=new Set();const add=m=>{if(!found.has(m)){found.add(m);issues.push(m);}};
 // Geography: exits lead somewhere real and come back the other way (a sign always has a sign home).
 for(const [id,r] of Object.entries(ROOMS)){
  for(const [side,to] of Object.entries(r.exits)){if(!ROOMS[to]){add(`${id}: ${side} exit leads to unknown room ${to}`);continue;}
   const back=({left:'right',right:'left',top:'bottom',bottom:'top'})[side];if(ROOMS[to].exits[back]!==id)add(`${id} → ${to}: no ${back} signpost back from ${to}`);}
  if(r.door&&!ROOMS[r.door.to])add(`${id}: door leads to unknown room ${r.door.to}`);
  if(r.door&&ROOMS[r.door.to]?.door?.to!==id)add(`${id}: door to ${r.door.to} has no way back out`);
  for(const [side,lock] of Object.entries(r.exitLock||{})){if(!LOCKS[lock]&&!GATES[lock])add(`${id}: ${side} exit locked by unknown ${lock}`);if(!r.exits[side])add(`${id}: lock on missing ${side} exit`);}
  if(r.gate&&!GATES[r.gate])add(`${id}: unknown gate ${r.gate}`);
  if(!FRIENDS[id]&&r.friend)add(`${id}: friend ${r.friend} has nothing to say (FRIENDS)`);
  if(FRIENDS[id]&&FRIENDS[id].length<2)add(`${id}: friend needs a before and an after line`);}
 // Puzzles: the answer is one of the options, options differ, the equation really gives the answer, his level.
 for(const [id,g] of Object.entries(GATES)){
  if(!ROOMS[g.room])add(`gate ${id}: unknown room ${g.room}`);else if(!(ROOMS[g.room].gates||[ROOMS[g.room].gate]).includes(id))add(`gate ${id}: room ${g.room} does not place it`);
  if(!g.options.includes(g.answer))add(`gate ${id}: answer ${g.answer} is not an option`);
  if(g.kind==='tiles'&&g.words.join(' ')!==g.answer)add(`gate ${id}: tile words do not match answer`);
  if(g.kind==='place'&&Number(g.answer)!==Number(String(g.number)[g.digitIndex])*10**(String(g.number).length-1-g.digitIndex))add(`gate ${id}: digit value is wrong`);
  if(new Set(g.options).size!==g.options.length)add(`gate ${id}: duplicate options`);
  if(g.equation){const v=evalEq(g.equation);if(v==null)add(`gate ${id}: equation "${g.equation}" cannot be checked`);
   else if(/^\d+$/.test(g.answer)&&v!==Number(g.answer))add(`gate ${id}: ${String(g.equation).replace(/\s*=.*$/,'')} is ${v}, not ${g.answer}`);
  }
  for(const [a,b] of multiplicationFacts(g)){
   const quick=g.quick===true||g.mathMode==='quick'||g.factMode==='quick'||g.math?.mode==='quick';
   const evidence=g.factEvidence||factEvidence||{};
   if(quick&&!knownFact(evidence,a,b))add(`gate ${id}: quick fact ${a} × ${b} needs independent first-try evidence, excluding fast taps`);
   if(!quick&&!factSupport(g)?.text)add(`gate ${id}: practise ${a} × ${b} with arrays or skip-counting support on request`);
  }
  if(g.equation){const d=String(g.equation).match(/(\d+)\s*÷\s*(\d+)/);if(d&&(+d[1])%(+d[2])!==0)add(`gate ${id}: ${d[0]} leaves a remainder`);}
  if(g.inScene||g.scenePuzzle&&['count','order','subtract','compare'].includes(g.scenePuzzle.mode)||g.sceneTargets||g.paintedTargets||g.scene?.targets||g.painted?.targets){
   const scene=g.scenePuzzle||g.scene||g.painted||{},targets=g.sceneTargets||g.paintedTargets||scene.targets;
   if(scene.painted||targets)for(const orientation of ['wide','tall']){const bg=paintedLayouts[scene.source||ROOMS[g.room]?.bg||g.room],source=orientation==='tall'?bg?.variants?.portrait||bg:bg,measured=(Array.isArray(targets)?targets:targets?.[orientation])||source?.targets?.[scene.painted]||[];
    if(!measured.length||measured.some(t=>!Array.isArray(t.r)||t.r.length!==4||t.r.some(n=>!Number.isFinite(n)||n<0||n>1)))add(`gate ${id}: in-scene ${orientation} targets are not measured painted objects`);
    if(scene.mode==='count'&&Number(g.answer)!==measured.length+(scene.startAt||0))add(`gate ${id}: count answer disagrees with the ${orientation} painting`);
    if(scene.mode==='subtract'&&Number(g.answer)!==measured.length-scene.takeAway)add(`gate ${id}: subtraction answer disagrees with the ${orientation} painting`);
   }
   if(!(Array.isArray(targets)?targets.length:targets?.wide?.length&&targets?.tall?.length)&&!scene.painted&&!scene.layout&&!g.layout)add(`gate ${id}: in-scene puzzle needs measured painted targets`);
   if(g.answerInPrompt===true||g.bannerObjects||g.abstractObjects||g.equation)add(`gate ${id}: in-scene counting is answerable without the scene`);
   if(scene.mode==='count'&&g.count&&typeof g.prompt==='string'&&[g.count,Number(g.answer)].filter(Number.isFinite).some(n=>new RegExp('\\b('+n+'|'+['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'][n]+')\\s+(stones?|mats?|objects?|pizzas?|flowers?)\\b','i').test(g.prompt)))add(`gate ${id}: prompt gives away the in-scene count`);
  }
  if(model.definition.early&&model.definition.contentVersion>=4&&['count','order','more','comparison'].includes(g.kind)&&!g.scenePuzzle&&!g.inScene)add(`gate ${id}: counting requires the real scene, not abstract banner objects`);
  if(!model.definition.early)for(const issue of castleMathIssues(g,{factEvidence}))add(`gate ${id}: ${issue}`);
  if(model.definition.early&&model.definition.contentVersion>=4){
   if(g.kind==='count'&&(!g.scenePuzzle||g.scenePuzzle.mode==='count')||g.scenePuzzle?.mode==='count')add(`gate ${id}: pure counting is below the demonstrated arithmetic level`);
   if(g.scenePuzzle)for(const issue of scenePuzzleIssues(g,paintedLayouts[ROOMS[g.room]?.bg]))add(`gate ${id}: ${issue}`);
  }
  if(model.definition.early){for(const v of g.options)if(!g.pictures?.[v]&&!['count','order','pattern'].includes(g.kind))add(`gate ${id}: text-only option ${v} requires reading`);for(const n of [g.count,...(g.counts||[])].filter(n=>n!==undefined))if(!Number.isInteger(n)||n<1||n>20)add(`gate ${id}: count ${n} exceeds early counting range`);for(const letter of g.letters||[])if(!taughtLetters.includes(letter))add(`gate ${id}: ${letter} has not been taught`);if(g.kind==='more'&&g.answer!==g.options[g.counts.indexOf(Math.max(...g.counts))])add(`gate ${id}: basket answer is not the larger group`);}
  if(!g.hint)add(`gate ${id}: no hint`);}
 // Tools: everything a lock needs can be obtained.
 const sources=new Set([...freshWorld().items,...Object.values(GATES).flatMap(g=>g.rewards||[]),...Object.values(LOCKS).map(l=>l.reward).filter(Boolean),'rope','shovel','ball']);
 for(const [id,l] of Object.entries(LOCKS)){if(!ITEMS[l.item])add(`lock ${id}: unknown item ${l.item}`);if(!sources.has(l.item))add(`lock ${id}: ${l.item} can never be obtained`);if(!l.hint)add(`lock ${id}: no hint`);}
 // Invalid authored graphs or puzzles cannot produce a meaningful state census.
 if(issues.length)return {issues,states:0,refusals:0,optionalStates:0,hints:[]};
 // Model check: finishable from the start and from EVERY reachable state; every hint names a real line.
 // Optional gates only add collectibles after the main win; their independent subsets are checked below.
 const {states,canWin}=exploreWorld({model});
 let refusals=0,maxOpenGoals=0,mapStates=0;
 const progressCache=new Map();
 for(const [stateKey,s] of states){let checkedGoal=false;
  const progressKey=JSON.stringify([s.items,s.solved,s.flags,s.collected,s.questStarted]);let goals=progressCache.get(progressKey);if(!goals){goals=questGoals(model,s);progressCache.set(progressKey,goals);}
  const pins=mapGoals(model,s,goals);mapStates++;for(const g of goals)if(!g.done&&!pins[g.room]?.some(p=>p.id===g.id))add(`map: unfinished ${g.id} is missing at ${g.room}`);
  if(maxOpenGoals<minOpenGoals){const open=questGoals(model,s).filter(g=>g.open&&['gate','lock'].includes(g.kind));maxOpenGoals=Math.max(maxOpenGoals,open.length);}
  for(const kind of ['lock','gate','exit','collect','friend'])for(const id of kind==='friend'?[s.room]:kind==='collect'?s.room==='castle-forest'?['acorn-1','acorn-2','acorn-3']:s.room==='soccer-pitch'?['ball']:[]:Object.keys(kind==='lock'?LOCKS:kind==='gate'?GATES:ROOMS[s.room].exits)){
   const t=kind==='lock'?LOCKS[id]:kind==='gate'?GATES[id]:null;if(t&&t.room!==s.room)continue;
   if(kind==='lock')for(const selected of s.items.filter(item=>ITEMS[item]&&item!==t.item)){
    const wrong=model.targetStatus(s,kind,id,selected);refusals++;
    if(!wrong.missing.length||!wrong.message.includes(wrong.missing[0].label)||wrong.missing.some(r=>r.id.startsWith('tool:')?r.id!=='tool:'+t.item||selected===t.item:model.fulfilled(s,r.id)))add(`refusal lock ${id}: wrong tool does not identify an unmet constraint`);
    if(!model.routeTo(s.room,wrong.next.room,s).length||!canWin.has(stateKey))add(`refusal lock ${id}: wrong-tool next goal is unreachable`);
   }
   const status=model.targetStatus(s,kind,id);if(!status.missing.length)continue;refusals++;
   if(!status.message.includes(status.missing[0].label)||status.missing.some(r=>model.fulfilled(s,r.id)))add(`refusal ${kind} ${id}: does not name an unmet requirement`);
   if(!model.routeTo(s.room,status.next.room,s).length||!canWin.has(stateKey))add(`refusal ${kind} ${id}: next goal is unreachable`);
   if(!checkedGoal&&!won(s)){checkedGoal=true;const g=status.next,t=g.target;const action=t==='friend'?{action:s.questStarted?'friend':'quest'}:t.startsWith('gate-')?{action:'solve',gate:t.slice(5),answer:GATES[t.slice(5)]?.answer}:t.startsWith('lock-')?{action:'use',target:t.slice(5),item:LOCKS[t.slice(5)]?.item}:{action:'collect',id:t};
    try{const result=model.worldAction({...s,room:g.room},action).state;if(key(result)===key({...s,room:g.room}))add('refusal: next goal makes no progress');}catch{add('refusal: next goal cannot be acted on with the current state');}
   }
   const action=kind==='friend'?{action:'friend'}:kind==='collect'?{action:'collect',id}:kind==='lock'?{action:'use',target:id,item:t.item}:kind==='gate'?{action:'solve',gate:id,answer:t.answer}:{action:'walk',room:ROOMS[s.room].exits[id],x:.5,y:.97};
   try{model.worldAction(s,action);add(`refusal ${kind} ${id}: reducer accepted a missing requirement`);}catch(e){if(e.message!==status.message)add(`refusal ${kind} ${id}: reducer message disagrees`);}
  }
 }
 // Optional rewards cannot remove progression. Check their complete reachable subset after a canonical win.
 const completed={...model.freshWorld(),questStarted:true,doorOpen:true,treasureOpen:true,items:[...sources].filter(id=>!ITEMS[id]?.collection),solved:Object.keys(GATES).filter(id=>!GATES[id].optional),flags:['acorns-traded','ball-returned','bridge-tied','bridge','night','runaway','dig'],collected:['acorn-1','acorn-2','acorn-3','ball']};
 const optional=Object.entries(GATES).filter(([,g])=>g.optional);
 for(let mask=0;mask<2**optional.length;mask++){let s=structuredClone(completed);for(const [i,[id,g]] of optional.entries())if(mask&(1<<i)){s.solved.push(id);s.items.push(...g.rewards);}
  const pins=mapGoals(model,s);mapStates++;for(const goal of questGoals(model,s))if(!goal.done&&!pins[goal.room]?.some(p=>p.id===goal.id))add(`map: unfinished ${goal.id} is missing at ${goal.room}`);
  for(const [id,g] of optional){s.room=g.room;const goal=model.nextGoal(s);if(!model.routeTo(s.room,goal.room,s).length)add(`optional ${id}: next goal is unreachable`);try{const result=model.worldAction(s,{action:'solve',gate:id,answer:g.answer}).state;if(!won(result)||!result.items.includes(g.rewards[0]))add(`optional ${id}: breaks completed quest or loses its reward`);}catch{add(`optional ${id}: prerequisite is unreachable in this completed subset`);}}
 }
 if(![...states.values()].some(won))add('the quest cannot be finished from a fresh start');
 const stuck=[...states].filter(([k])=>!canWin.has(k)).map(([,s])=>s);
 if(stuck.length)add(`${stuck.length} reachable states can never be finished (e.g. room ${stuck[0].room}, items ${stuck[0].items.join(',')})`);
 const hints=new Set([...states.values()].map(nextHint));
 if(lines)for(const h of hints)if(!lines[h])add(`hint ${h} has no voice line`);
 for(const s of states.values())if(!won(s)&&nextHint(s)==='next-done'){add(`hint says "done" before the quest is finished (room ${s.room})`);break;}
 if(maxOpenGoals<minOpenGoals)add(`non-linear play needs at least ${minOpenGoals} goals open at once; found ${maxOpenGoals}`);
 return {issues,states:states.size,refusals,maxOpenGoals,mapStates,optionalStates:2**optional.length,hints:[...hints]};}
