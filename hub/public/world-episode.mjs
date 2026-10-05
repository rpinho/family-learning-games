// Pure episode compiler/reducer. IDs are namespaced by child/date; inventory is additive.
export const EPISODE_SCHEMA='family-world-episode-1';
export function episodeDefinition(episode,base=null,history=[]){
 const prefix=episode.id+'--',id=x=>prefix+x;
 const ROOMS=Object.fromEntries(Object.entries(base?.ROOMS||{}).map(([k,r])=>[k,{...r,exits:{...r.exits},gate:undefined,gates:[],exitRequires:{},exitLock:{}}]));
 const ITEMS={...(base?.ITEMS||{})},GATES={},LOCKS={},FRIENDS={...(base?.FRIENDS||{})};
 for(const ep of [...history.filter(e=>e.id!==episode.id),episode]){
  const p=ep.id+'--',ns=x=>p+x;
  for(const r of ep.rooms){ROOMS[ns(r.id)]={...r,bg:r.bg,exits:Object.fromEntries(Object.entries(r.exits||{}).map(([s,to])=>[s,ns(to)])),exitRequires:Object.fromEntries(Object.entries(r.exitRequires||{}).map(([s,k])=>[s,ns(k)])),door:r.door?{...r.door,to:ns(r.door.to)}:undefined,gates:ep.puzzles.filter(g=>g.room===r.id).map(g=>ns(g.id))};FRIENDS[ns(r.id)]=r.lines;}
  for(const [k,v]of Object.entries(ep.items))ITEMS[ns(k)]=v;
  for(const g of ep.puzzles){GATES[ns(g.id)]={...g,room:ns(g.room),requires:(g.requires||[]).map(ns),rewards:(g.rewards||[]).map(ns),goal:g.goal||g.title};const r=ROOMS[ns(g.room)];r.gate??=ns(g.id);}
  for(const l of ep.locks)LOCKS[ns(l.id)]={...l,room:ns(l.room),item:ns(l.item),requires:(l.requires||[]).map(ns),goal:l.goal||l.label};
  if(base){const entry=ep.entry||{room:base.startRoom,side:'top'};const anchor=ROOMS[entry.room];if(anchor){
   // Grow a chain of daily regions from the hub, retaining every earlier region.
   const opposite={top:'bottom',bottom:'top',left:'right',right:'left'}[entry.side];let tail=entry.room;const seen=new Set();
   while(ROOMS[tail].exits[entry.side]&&!seen.has(tail)){seen.add(tail);tail=ROOMS[tail].exits[entry.side];}
   ROOMS[tail].exits[entry.side]=ns(ep.start);ROOMS[ns(ep.start)].exits[opposite]=tail;
  }}
 }
 return {id:base?.id||'quest',episode,early:episode.level==='early',startRoom:id(episode.start),finishRoom:id(episode.puzzles.find(g=>g.id===episode.finish)?.room),finishGate:id(episode.finish),ROOMS,ITEMS,GATES,LOCKS,FRIENDS,MAP_GATES:episode.puzzles.filter(g=>!g.optional).map(g=>id(g.id))};
}
export function createEpisodeModel(definition){
 const {ROOMS,ITEMS,GATES,LOCKS,FRIENDS,MAP_GATES,episode}=definition,quest=episode.id+'--quest',finish=definition.finishGate;
 const fulfilled=(s,k)=>k===quest?s.flags.includes(quest):s.items.includes(k)||s.flags.includes(k)||s.solved.includes(k);
 const freshWorld=()=>({schema:3,world:definition.id,room:definition.startRoom,position:{x:.33,y:.97},items:[],solved:[],flags:[],collected:[],visited:[definition.startRoom],attempts:{},questStarted:false,doorOpen:false,treasureOpen:false,tutorial:{walk:false,talk:false},revision:0});
 const upgradeWorld=old=>{const s={...freshWorld(),...old,schema:3};s.flags=old.flags||[];s.visited=old.visited||[old.room||definition.startRoom];s.attempts=old.attempts||{};s.questStarted=fulfilled(s,quest);s.treasureOpen=s.solved.includes(finish);s.doorOpen=s.treasureOpen;if(!ROOMS[s.room])s.room=definition.startRoom;return s;};
 const availableExits=s=>Object.fromEntries(Object.entries(ROOMS[s.room].exits).filter(([side])=>!ROOMS[s.room].exitRequires?.[side]||fulfilled(s,ROOMS[s.room].exitRequires[side])));
 function routeTo(from,to,s=null){const q=[[from]],seen=new Set([from]);for(let i=0;i<q.length;i++){const path=q[i],r=ROOMS[path.at(-1)];if(path.at(-1)===to)return path;for(const n of [...Object.values(s?availableExits({...s,room:path.at(-1)}):r.exits),...(r.door?[r.door.to]:[])])if(!seen.has(n)){seen.add(n);q.push([...path,n]);}}return [];}
 function requirement(s,k){if(k===quest)return {id:k,label:'Talk to your guide',room:definition.startRoom,target:'friend',key:'start',icon:'💬'};
  const g=GATES[k],l=LOCKS[k],source=Object.entries(GATES).find(([,g])=>g.rewards.includes(k));
  if(g)return {id:k,label:g.title,text:g.goal,room:g.room,target:'gate-'+k,key:'next-'+k,icon:g.icon||'⭐'};
  if(l)return {id:k,label:l.label,text:l.goal,room:l.room,target:'lock-'+k,key:'next-'+k,icon:'🔑'};
  if(source)return {...requirement(s,source[0]),id:k,label:ITEMS[k]?.name||k};
  return {id:k,label:ITEMS[k]?.name||k,room:definition.startRoom,target:'friend',key:'start',icon:'💬'};
 }
 const needs=k=>GATES[k]?[quest,...GATES[k].requires]:LOCKS[k]?[quest,LOCKS[k].item,...LOCKS[k].requires]:[];
 function nextGoal(s){if(!fulfilled(s,quest))return {...requirement(s,quest),text:'Talk to your guide to begin'};
  const target=s.solved.includes(finish)?Object.keys(GATES).find(k=>k.startsWith(episode.id+'--')&&GATES[k].optional&&!s.solved.includes(k)):finish;
  if(!target)return {key:'next-done',text:'Your quest is complete. Visit your friends',room:definition.finishRoom,target:'gate-'+finish,icon:'⭐'};
  const descend=(k,seen=new Set())=>{if(seen.has(k))return requirement(s,k);seen.add(k);for(const n of needs(k))if(!fulfilled(s,n)){if(!GATES[n]&&!LOCKS[n]){const source=Object.entries(GATES).find(([,g])=>g.rewards.includes(n));if(source)return descend(source[0],seen);}return descend(n,seen);}return requirement(s,k);};
  const g=descend(target);return {...g,text:g.text||g.label};
 }
 function targetStatus(s,kind,k,item=null){const keys=kind==='gate'||kind==='lock'?needs(k):kind==='exit'?[ROOMS[s.room].exitRequires?.[k]].filter(Boolean):kind==='tool'?[k]:kind==='friend'?(s.room===definition.startRoom?[]:[quest]):[];
  const missing=keys.filter(n=>!fulfilled(s,n)).map(n=>requirement(s,n));
  if(kind==='lock'&&LOCKS[k]&&fulfilled(s,LOCKS[k].item)&&item!==null&&item!==LOCKS[k].item)missing.unshift({id:'tool:'+LOCKS[k].item,label:'Use your '+ITEMS[LOCKS[k].item].name});
  const next=missing.length?nextGoal(s):null;return {missing,next,message:missing.length?`Not yet! ${missing[0].label}. Next: ${next.text} at the ${ROOMS[next.room].name}.`:''};
 }
 function worldAction(old,b){const s=upgradeWorld(structuredClone(old));const reject=(message,extra={})=>{throw Object.assign(Error(message),{status:400,...extra});};const check=(kind,k,item)=>{const r=targetStatus(s,kind,k,item);if(r.missing.length)reject(r.message,r);};
  switch(b.action){
   case 'walk':case 'enter':{const r=ROOMS[s.room];if(!ROOMS[b.room]||(b.action==='enter'?r.door?.to!==b.room:b.room!==s.room&&!Object.values(r.exits).includes(b.room)))reject('That path does not connect to this room.');if(b.action==='walk'){if(![b.x,b.y].every(Number.isFinite)||b.x<0||b.x>1||b.y<.35||b.y>1)reject('Choose a place on the ground.');const side=Object.keys(r.exits).find(k=>r.exits[k]===b.room);if(side)check('exit',side);if(b.ground)s.tutorial.walk=true;}s.room=b.room;s.position={x:b.x??.33,y:b.y??.97};break;}
   case 'quest':if(s.room!==definition.startRoom)reject('Find your guide at '+ROOMS[definition.startRoom].name+'.');if(!s.flags.includes(quest))s.flags.push(quest);s.tutorial.talk=true;break;
   case 'friend':check('friend',s.room);break;
   case 'use':{const l=LOCKS[b.target];if(!l||l.room!==s.room)reject('Find the place where this tool fits.');check('lock',b.target,b.item??'');if(!s.flags.includes(b.target))s.flags.push(b.target);break;}
   case 'hint':{const g=GATES[b.gate];if(!g||g.room!==s.room)reject('Find this challenge in its room.');s.attempts??={};const t=s.attempts[b.gate]??={misses:0};if(!t.finished)t.help=true;break;}
   case 'solve':{const g=GATES[b.gate];if(!g||g.room!==s.room)reject('Find this challenge in its room.');check('gate',b.gate);s.attempts??={};const t=s.attempts[b.gate]??={misses:0};if(String(b.answer)!==g.answer){if(!t.finished)t.misses++;s.revision++;return {state:s,correct:false};}if(!t.finished){t.finished=true;t.at=new Date().toISOString();if(g.kind==='tiles')t.help=true;}if(!s.solved.includes(b.gate)){s.solved.push(b.gate);for(const k of g.rewards)if(!s.items.includes(k))s.items.push(k);}break;}
   default:reject('Unknown world action.');
  }
  if(!s.visited.includes(s.room))s.visited.push(s.room);s.revision++;return {state:upgradeWorld(s),correct:b.action==='solve'?true:undefined};
 }
 return {definition,ROOMS,ITEMS,GATES,LOCKS,FRIENDS,MAP_GATES,freshWorld,upgradeWorld,worldAction,fulfilled,requirement,targetStatus,availableExits,routeTo,nextGoal,nextHint:s=>nextGoal(s).key,mapPieces:s=>MAP_GATES.filter(k=>s.solved.includes(k)).length,friendDone:(s,r)=>ROOMS[r].gates?.every(k=>s.solved.includes(k)),goalTarget:s=>{const g=nextGoal(s);if(g.room===s.room)return g.target;const n=routeTo(s.room,g.room,s)[1];return ROOMS[s.room].door?.to===n?'opening':Object.keys(ROOMS[s.room].exits).find(k=>ROOMS[s.room].exits[k]===n);}};
}
