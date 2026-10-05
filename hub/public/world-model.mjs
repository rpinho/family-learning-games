import {createEpisodeModel} from './world-episode.mjs';
import {CASTLE} from './world-definitions.mjs';
export function createWorldModel(definition=CASTLE){
 if(definition.episode)return createEpisodeModel(definition);
 const {ROOMS,ITEMS,LOCKS,GATES,MAP_GATES,FRIENDS}=definition;
const friendDone=(s,room)=>definition.early?s.solved.includes(ROOMS[room].gate):room==='castle-gate'?s.doorOpen:room==='castle-forest'?s.flags.includes('acorns-traded'):room==='soccer-pitch'?s.items.includes('shovel'):room==='treehouse-town'?s.solved.includes('bakery'):room==='river-bridge'?s.solved.includes('bridge'):s.solved.includes(ROOMS[room].gate);
const adjacent=(a,b)=>!!ROOMS[a]&&(Object.values(ROOMS[a].exits).includes(b)||ROOMS[a].door?.to===b);
const freshWorld=()=>definition.early?({schema:2,world:definition.id,room:definition.startRoom,position:{x:.33,y:.97},items:[],solved:[],flags:[],collected:[],questStarted:false,doorOpen:false,treasureOpen:false,visited:[definition.startRoom],tutorial:{walk:false,talk:false},revision:0}):({schema:2,room:'castle-gate',position:{x:.33,y:.97},items:['castle-key','spyglass'],solved:[],flags:[],collected:[],questStarted:false,doorOpen:false,pipSpoken:false,treasureOpen:false,visited:['castle-gate'],tutorial:{walk:false,talk:false},revision:0});
// Read migration is pure: a completed v0 keeps its pieces and birthday door. New requests remain to do.
function upgradeWorld(s){if(definition.early)return {...freshWorld(),...s,visited:[...new Set([definition.startRoom,...(s.visited||[]),s.room])],tutorial:s.tutorial||{walk:true,talk:true}};return {...freshWorld(),...s,schema:2,flags:s.flags||[],collected:s.collected||[],treasureOpen:!!s.treasureOpen,visited:[...new Set(['castle-gate',s.room,...(s.visited||[]),...(s.solved||[]).map(k=>GATES[k]?.room).filter(Boolean),...(s.flags?.includes('acorns-traded')?['castle-forest']:[])])],tutorial:s.tutorial||{walk:true,talk:true}};}
const mapPieces=s=>MAP_GATES.filter(k=>s.solved.includes(k)).length;
function nextHint(s){
 if(definition.early)return nextGoal(s).key;
 if(!s.questStarted)return 'start';
 if(!s.flags.includes('acorns-traded'))return s.collected.filter(id=>/^acorn-/.test(id)).length===3&&!s.solved.includes('reading')?'next-rope-reading':'next-acorns';
 if(!s.items.includes('lantern'))return 'next-lantern';
 if(!s.items.includes('shovel'))return 'next-ball';
 if(!s.items.includes('net'))return 'next-net';
 if(mapPieces(s)<3)return !s.solved.includes('chess')?'next-chess':!s.solved.includes('reading')?'next-reading':'next-score';
 if(!s.solved.includes('bridge'))return 'next-bridge';
 if(!s.items.includes('island-map'))return 'next-map';
 if(!s.items.includes('star-compass'))return 'next-night';
 if(!s.treasureOpen)return 'next-treasure';
 const side=Object.entries(GATES).find(([id,g])=>g.optional&&!s.solved.includes(id));return side?'next-'+side[0]:'next-done';
}
function routeTo(from,to,state=null){
 const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),id=path.at(-1);if(id===to)return path;
 for(const next of [...Object.values(state?availableExits({...state,room:id}):ROOMS[id].exits),...(ROOMS[id].door?[ROOMS[id].door.to]:[])])if(!seen.has(next)){seen.add(next);queue.push([...path,next]);}}return [];
}
function nextGoal(s){
 if(definition.early){if(!s.questStarted)return {key:'start',text:'Tap Dad to begin',room:definition.startRoom,target:'friend',icon:'💬'};const id=Object.keys(GATES).find(k=>!s.solved.includes(k));if(id){const g=GATES[id];if(g.requires&&!s.flags.includes(g.requires)){const l=LOCKS[g.requires];return {key:'next-'+g.requires,text:l.goal,room:l.room,target:'lock-'+g.requires,icon:'🎁'};}return {key:'next-'+id,text:g.goal,room:g.room,target:'gate-'+id,icon:g.icon};}return {key:'next-done',text:'Your gift is ready! Visit your friends',room:definition.finishRoom,target:'gate-gift',icon:'🎁'};}

 const key=nextHint(s),goal=(text,room,target,icon)=>({key,text,room,target,icon});
 switch(key){
 case 'start':return goal('Tap Dad to start the adventure','castle-gate','friend','💬');
 case 'next-acorns':{const n=s.collected.filter(id=>/^acorn-/.test(id)).length;return n<3?goal(`Find 3 acorns for Picos · ${n} / 3`,'castle-forest','acorn-'+[1,2,3].find(n=>!s.collected.includes('acorn-'+n)),'🌰'):goal('Give the 3 acorns to Picos for a rope','castle-forest','friend','🌰');}
 case 'next-rope-reading':return goal('Read Picos’s sign to earn the rope','castle-forest','gate-reading','📜');
 case 'next-lantern':return goal('Help Robo count the lantern gears','workshop','gate-workshop','🏮');
 case 'next-ball':return s.items.includes('ball')?goal('Score a goal with Pip to earn the shovel','soccer-pitch','gate-kick','⚽'):goal('Tap the branch to fetch Pip’s ball','soccer-pitch','ball','⚽');
 case 'next-net':return goal('Help the baker count her rolls for a net','bakery','gate-bakery','🥖');
 case 'next-chess':return goal('Compare Bo’s captures for a map piece','chess-courtyard','gate-chess','♞');
 case 'next-reading':return goal('Read Picos’s sign for a map piece','castle-forest','gate-reading','📜');
 case 'next-score':return goal('Count Pip’s goals for a map piece','soccer-pitch','gate-score','⚽');
 case 'next-bridge':return s.flags.includes('bridge-tied')?goal('Help Snake bundle the bridge planks','river-bridge','gate-bridge','🌉'):goal('Tap the bridge gap to tie your rope','river-bridge','lock-bridge','🪢');
 case 'next-map':return s.solved.includes('moon')?goal('Tap the fluttering map to catch it with your net','castle-moon-hill','lock-runaway','🕸️'):goal('Help Loona count the stars','castle-moon-hill','gate-moon','⭐');
 case 'next-night':return s.flags.includes('night')?goal('Read Dad’s chest instruction for the star compass','castle-night','gate-night','🧭'):goal('Tap the dark path to light your lantern','castle-moon-hill','lock-night','🏮');
 case 'next-treasure':return s.flags.includes('dig')?goal('Open the captain’s treasure chest','pirate-ship','gate-pirate','🏴‍☠️'):goal('Tap the pirate X to dig with your shovel','pirate-ship','lock-dig','🏴‍☠️');
 default:{const entry=Object.entries(GATES).find(([id,g])=>g.optional&&!s.solved.includes(id));if(entry){const [id,g]=entry;return goal('Discover '+g.title,g.room,'gate-'+id,ROOMS[g.room].icon);}return goal('All discoveries collected! Visit your friends','castle-gate','birthday','🎁');}
 }
}
function goalTarget(s){const g=nextGoal(s);if(s.room===g.room)return g.target;const next=routeTo(s.room,g.room,s)[1],r=ROOMS[s.room];return r.door?.to===next?'opening':Object.keys(r.exits).find(side=>r.exits[side]===next);}
// One state-derived requirement instrument feeds the reducer, badges, captions and goal ribbon.
const fulfilled=(s,id)=>id==='quest'?s.questStarted:id==='treasure'?s.treasureOpen:id==='island-map'&&!definition.early?s.items.includes(id)&&mapPieces(s)===MAP_GATES.length:s.items.includes(id)||s.flags.includes(id)||s.solved.includes(id);
function requirement(s,id){
 let label=ITEMS[id]?.name||GATES[id]?.title||id,room=GATES[id]?.room||definition.startRoom,icon=ITEMS[id]?.icon||'star',step=id;
 if(id==='quest'){label='Talk to Dad';}
 else if(id==='treasure'){label='Find the island treasure';room='pirate-ship';}
 else if(id==='island-map'&&!definition.early){label=mapPieces(s)<MAP_GATES.length?`Island map ${mapPieces(s)} of ${MAP_GATES.length} pieces`:'The fluttering island map';step=MAP_GATES.find(k=>!s.solved.includes(k))||(s.solved.includes('moon')?'runaway':'moon');room=GATES[step]?.room||LOCKS[step]?.room;}
 else if(LOCKS[id]){room=LOCKS[id].room;label=LOCKS[id].label;}
 else if(id==='bridge-tied'){room='river-bridge';label='Tie the rope across the bridge gap';step='bridge';}
 else if(ITEMS[id]){const source=Object.entries(GATES).find(([,g])=>g.rewards.includes(id));if(source){step=source[0];room=source[1].room;}else if(id==='rope'){step='acorns';room='castle-forest';}else if(id==='ball'){room='soccer-pitch';}}
 const tasks={score:'Count Pip’s goals',moon:'Count Loona’s stars',runaway:'Catch the fluttering map',acorns:'Collect three acorns for Picos',kick:'Score a goal with Pip',reading:'Read Picos’s sign',chess:'Compare Bo’s captures',night:'Read Dad’s chest instruction'};
 return {id,label,room,icon,step,text:(tasks[step]||label)+' at the '+(ROOMS[room]?.name||room)};
}
function targetStatus(s,kind,id,item=null){
 const target=kind==='lock'?LOCKS[id]:kind==='gate'?GATES[id]:null;
 const ids=kind==='friend'?['quest',...(!definition.early&&s.room==='castle-forest'&&s.collected.filter(id=>/^acorn-/.test(id)).length===3?['reading']:[])]:kind==='collect'?['quest']:kind==='tool'?[id]:kind==='exit'?[ROOMS[s.room].exitRequires?.[id]].filter(Boolean):kind==='gate'?['quest',target?.requires].filter(Boolean):target?[target.item,target.requires,...(target.needs||[]),...(target.steps||[])].filter(Boolean):[];
 const missing=ids.filter(id=>!fulfilled(s,id)).map(id=>requirement(s,id));
 if(kind==='lock'&&target&&fulfilled(s,target.item)&&item!==null&&item!==target.item)missing.unshift({id:'tool:'+target.item,label:'Use your '+ITEMS[target.item].name,room:target.room,icon:ITEMS[target.item].icon,text:'Use your '+ITEMS[target.item].name+' here'});
 const next=missing.length?nextGoal(s):null;
 const message=missing.length?`Not yet! ${missing[0].label}. Next: ${next.text} at the ${ROOMS[next.room].name}.`:'';
 return {missing,next,message};
}
const availableExits=s=>Object.fromEntries(Object.entries(ROOMS[s.room].exits).filter(([side])=>!ROOMS[s.room].exitRequires?.[side]||fulfilled(s,ROOMS[s.room].exitRequires[side])));
function worldAction(state,b){
 const s=upgradeWorld(structuredClone(state)),reject=message=>{throw Object.assign(Error(message),{status:400});};
 const give=id=>{if(!s.items.includes(id))s.items.push(id);},flag=id=>{if(!s.flags.includes(id))s.flags.push(id);};
 const rejectStatus=status=>{throw Object.assign(Error(status.message),{status:400,missing:status.missing,next:status.next});};
 switch(b.action){
  case 'walk':{
   if(!ROOMS[b.room]||(b.room!==s.room&&!Object.values(ROOMS[s.room].exits).includes(b.room)))reject('That path does not connect to this room.');
   if(![b.x,b.y].every(Number.isFinite)||b.x<0||b.x>1||b.y<.35||b.y>1)reject('Choose a place on the ground.');
   const side=Object.keys(ROOMS[s.room].exits).find(k=>ROOMS[s.room].exits[k]===b.room);if(b.room!==s.room&&side){const status=targetStatus(s,'exit',side);if(status.missing.length)rejectStatus(status);}
   s.room=b.room;s.position={x:b.x,y:b.y};if(b.ground)s.tutorial.walk=true;break;}
  case 'enter':if(ROOMS[s.room].door?.to!==b.room)reject('Tap an opening that connects to this room.');s.room=b.room;s.position={x:.33,y:.97};break;
  case 'quest':if(s.room!==definition.startRoom)reject('Dad is at the castle gate.');s.questStarted=true;s.tutorial.talk=true;break;
  case 'pip':if(s.room!=='soccer-pitch')reject('Your friend is at the pitch.');s.pipSpoken=true;break;
  case 'collect':{
   const refusal=targetStatus(s,'collect',b.id);if(refusal.missing.length)rejectStatus(refusal);
   const acorn=/^acorn-[123]$/.test(b.id)&&s.room==='castle-forest',ball=b.id==='ball'&&s.room==='soccer-pitch';
   if(!acorn&&!ball)reject('That item is not here.');
   if(!s.collected.includes(b.id)){s.collected.push(b.id);if(ball)give('ball');}break;}
  case 'friend':{const status=targetStatus(s,'friend',s.room);if(status.missing.length)rejectStatus(status);if(definition.early)break;
   if(s.room==='castle-forest'&&s.collected.filter(id=>/^acorn-/.test(id)).length===3){flag('acorns-traded');give('rope');}
   if(s.room==='soccer-pitch'&&s.items.includes('ball'))flag('ball-returned');break;}
  case 'use':{
   const l=LOCKS[b.target];if(!l||s.room!==l.room)reject('Your tool does not fit here. Find the place it fits.');
   const refusal=targetStatus(s,'lock',b.target,b.item??'');if(refusal.missing.length)rejectStatus(refusal);
   flag(b.target==='bridge'?'bridge-tied':b.target);if(l.reward)give(l.reward);break;}
  case 'secret':
   if(b.id!=='pip-chest'||s.room!=='treehouse-town')reject('That secret is not here.');flag('pip-chest');break;
  case 'solve':{
   const g=GATES[b.gate];if(!g||s.room!==g.room)reject('Find this challenge after talking to Dad.');
   const refusal=targetStatus(s,'gate',b.gate);if(refusal.missing.length)rejectStatus(refusal);
   if(String(b.answer)!==g.answer)return {state:s,correct:false};
   if(!s.solved.includes(b.gate)){s.solved.push(b.gate);for(const id of g.rewards)give(id);}
   if(b.gate==='kick')flag('ball-returned');if(b.gate==='bridge')flag('bridge');if(b.gate==='pirate')s.treasureOpen=true;
   s.doorOpen=mapPieces(s)===MAP_GATES.length;if(definition.early&&b.gate===definition.finishGate)s.treasureOpen=true;break;}
  default:reject('Unknown world action.');
 }
 if(!s.visited.includes(s.room))s.visited.push(s.room);
 s.revision++;return {state:s,correct:b.action==='solve'?true:undefined};
}


 return {definition,ROOMS,ITEMS,LOCKS,GATES,MAP_GATES,FRIENDS,friendDone,adjacent,freshWorld,upgradeWorld,mapPieces,nextHint,routeTo,nextGoal,goalTarget,worldAction,targetStatus,fulfilled,availableExits,requirement};
}
export const {ROOMS,ITEMS,LOCKS,GATES,MAP_GATES,FRIENDS,friendDone,adjacent,freshWorld,upgradeWorld,mapPieces,nextHint,routeTo,nextGoal,goalTarget,worldAction,targetStatus,fulfilled,availableExits,requirement}=createWorldModel();

// Foot coordinates, with the whole standee (including its bob) kept clear.
export const overlap=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
export function bodyAt(p,{w,h}){return {x0:p.x-w/2,x1:p.x+w/2,y0:p.y-h-.006,y1:p.y+.003};}
// The body must stay on screen; only his FEET collide (he may stand in front of a chest or a wall, nearer the viewer,
// never on it). 2026-10-02: with the family drawn big the whole-body check left nowhere to stand near the chest.
export function feetAt(p,{w}){return {x0:p.x-w*.3,x1:p.x+w*.3,y0:p.y-.05,y1:p.y+.003};}
export function freeFoot(p,size,blocks){const r=bodyAt(p,size),f=feetAt(p,size);return r.x0>=0&&r.x1<=1&&r.y1<=1&&r.y0>=.12&&!blocks.some(b=>overlap(b.ui?r:f,b));} // (buttons such as signposts are never covered by his body)
// A small visibility grid finds a walk around objects; no straight-line tunnelling.
export function walkPath(from,to,size,blocks,{step=.018}={}){
 const nodes=[],cols=Math.ceil(1/step),rows=Math.ceil(.65/step);
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const p={x:i/cols,y:.35+j/rows*.645};if(freeFoot(p,size,blocks))nodes.push(p);}
 if(!nodes.length)return [];
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),nearest=p=>nodes.reduce((a,b)=>dist(a,p)<dist(b,p)?a:b);
 const start=freeFoot(from,size,blocks)?from:nearest(from),goal=freeFoot(to,size,blocks)?to:nearest(to);
 nodes.push(start,goal);const startI=nodes.length-2,goalI=nodes.length-1;
 const clear=(a,b)=>{const n=Math.ceil(dist(a,b)/.005);for(let k=0;k<=n;k++){const t=n?k/n:0;if(!freeFoot({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},size,blocks))return false;}return true;};
 if(clear(start,goal))return [start,goal];
 const costs=new Map([[startI,0]]),prev=new Map(),open=new Set([startI]);
 while(open.size){const i=[...open].reduce((a,b)=>costs.get(a)+dist(nodes[a],goal)<costs.get(b)+dist(nodes[b],goal)?a:b);open.delete(i);if(i===goalI){const path=[];let k=i;while(k!==undefined){path.unshift(nodes[k]);k=prev.get(k);}return path;}
  for(let k=0;k<nodes.length;k++){const d=dist(nodes[i],nodes[k]);if(k===i||d>step*1.8||!clear(nodes[i],nodes[k]))continue;const cost=costs.get(i)+d;if(cost<(costs.get(k)??Infinity)){costs.set(k,cost);prev.set(k,i);open.add(k);}}
 }
 return [];
}

// One size-aware placement rule for room arrivals, friends and interactive props.
// Reservations are whole boxes, independent of the foot-only walking collision rule.
export function worldSpot(preferred,size,reservations,{floor=.55,pad=.012}={}){
 const valid=p=>{const b=bodyAt(p,size);return b.x0>=pad&&b.x1<=1-pad&&b.y0>=.16&&b.y1<=1-pad&&p.y>=floor&&!reservations.some(r=>overlap(b,r));};
 if(valid(preferred))return {...preferred};
 let best=null,cost=Infinity;
 for(let y=Math.max(floor,size.h+.17);y<=1-pad-.003;y+=.01)for(let x=size.w/2+pad;x<=1-size.w/2-pad;x+=.01){
  const p={x,y};if(!valid(p))continue;const d=(x-preferred.x)**2+(y-preferred.y)**2;
  if(d<cost){cost=d;best=p;}
 }
 if(!best)throw Error('No clear room spot for '+JSON.stringify(size));
 return best;
}

// A wide guest can use the only space a taller family member needs. Try the
// small group's placement orders before accepting any positions on screen.
export function worldGroupSpots(actors,reservations,options){
 const search=(remaining,blocks,placed)=>{
  if(!remaining.length)return placed;
  for(const actor of remaining){let p;try{p=worldSpot(actor.preferred,actor.size,blocks,options);}catch{continue;}
   const result=search(remaining.filter(a=>a!==actor),[...blocks,{...bodyAt(p,actor.size),name:actor.id}],{...placed,[actor.id]:p});
   if(result)return result;
  }
  return null;
 };
 const result=search(actors,reservations,{});
 if(!result)throw Error('No clear room arrangement for the family and friends.');
 return result;
}
