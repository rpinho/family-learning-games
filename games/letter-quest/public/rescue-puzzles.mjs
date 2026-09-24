import {mazeTheme} from './maze-themes.mjs';
import {mazeOpen} from './maze.mjs';

export const PUZZLE_LINES={
 switches:'Find the switches. Rook can open their matching bridges.',
 blocks:'Push the blocks onto the glowing pads. Undo lets you try another way.',
 trail:'Choose who to rescue first. Then find your own route.',
 explore:'Follow your plan. You can choose a different route.',
 lever:'A switch! Ask Rook to open its matching bridge.',
 opened:'Bridge open! Your turn to explore.',
 push:'The block moved. Find a way to its glowing pad.',
 stuck:'No room to push. Try another side, or Undo.',
 ready:'The way is open. Find our friend!',
 saved:'A friend is safe! Find the next one.',
 exit:'Everyone is safe! Find the golden doorway.',
 missingFriend:'Find your friend first. Then come back to the exit.',
 missingFriends:'Find the other friends first. Then come back to the exit.',
 done:'Rescue complete! One teamwork badge. Ready to stop or explore again?',
 wall:'That way is closed. Look for another route.',
 undo:'One move back. Try a different idea.',
 pause:'Your rescue is saved. Come back when you are ready.',
 help:'The golden arrow shows one next step. You can still choose your own way.',
 plan:'Choose a friend on the plan card first.',
 locked:'The bridge needs its matching switch.',
 pads:'Both blocks need to stay on their pads.',
 turning:'Look around. Rook is waiting by the switch.'
};
const TYPES=['switches','blocks','trail'];
const ANIMALS=[['🐢','Turtle'],['🦊','Fox'],['🐧','Penguin'],['🐰','Rabbit'],['🐻','Bear'],['🐱','Cat'],['🦉','Owl'],['🐶','Dog'],['🐸','Frog'],['🐨','Koala'],['🦔','Hedgehog'],['🦝','Raccoon']];
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function puzzleTier(p,type,history=p.rescue?.history||[]){
 const base=p.id==='beginner'?1:2,cap=3;
 const runs=history.filter(h=>h.engine===2&&h.type===type),last=runs.at(-1);
 if(!last)return base;
 if(last.helpCount>=3||last.blocked>=8)return Math.max(1,last.tier-1);
 const pair=runs.slice(-2);
 if(pair.length===2&&pair.every(h=>h.tier===last.tier&&h.helpCount===0&&h.undos<=1&&h.blocked<4))return Math.min(cap,last.tier+1);
 return last.tier;
}
export function newPuzzle(p,mission=1,previous={}){
 const history=previous.history||[],serial=(previous.puzzleSerial||0)+1,type=TYPES[(serial-1)%3],tier=puzzleTier(p,type,history);
 const s={engine:2,mission,puzzleSerial:serial,type,tier,seed:hash(`${p.id}:${mission}:${serial}`),phase:type==='trail'?'plan':'explore',position:null,direction:0,paused:false,helped:false,moves:0,helpCount:0,pauses:0,blocked:0,undos:0,badges:previous.badges||0,history,opened:[],rescued:[],plan:[],crates:[],undo:[]};
 const b=baseBoard(s);s.position=b.start;s.crates=[...b.crates];
 const open=mazeOpen(b,s.position);s.direction=open[0]?.direction||0;
 return s;
}
export function puzzleState(p){return p.rescue?.engine===2?p.rescue:newPuzzle(p);}
function pathTo(b,start,goal){
 const queue=[[start]],seen=new Set([start]);
 for(let i=0;i<queue.length;i++){const path=queue[i],n=path.at(-1);if(n===goal)return path;for(const v of mazeOpen(b,n))if(!seen.has(v.position)){seen.add(v.position);queue.push([...path,v.position]);}}
 return [];
}
function baseBoard(s){
 const random=rng(s.seed),size=s.type==='blocks'?(s.tier===3?9:7):5+2*s.tier;
 const grid=Array.from({length:size},()=>Array(size).fill(1)),start=(size-2)*size+1;let exit=size-2;
 let switches=[],bridges=[],pads=[],crates=[],friends=[];
 if(s.type==='blocks'){
  exit=Math.floor(size/2);
  for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++)grid[z][x]=0;
  // Side lanes always remain clear: every authored crate can be pushed toward its pad.
  for(let z=2;z<size-2;z++)for(let x=3;x<size-3;x++)if(random()<.35)grid[z][x]=1;
  const pattern=s.seed%3,near=1+Math.floor(random()*2),far=size-3;
  if(pattern===0){pads=[near*size+1];crates=[far*size+1];if(s.tier>=2){pads.push(near*size+size-2);crates.push(far*size+size-2);}}
  else if(pattern===1){pads=[size+near];crates=[size+far];if(s.tier>=2){pads.push((size-2)*size+near);crates.push((size-2)*size+far);}}
  else{pads=[near*size+1];crates=[far*size+1];if(s.tier>=2){pads.push((size-2)*size+near);crates.push((size-2)*size+far);}}
  friends=[size+Math.floor(size/2)];
  // The exit gate is the boundary cell, so a crate on a side pad cannot block the only exit.
  bridges=[exit];grid[0][exit]=0;
 }else{
  const stack=[start];grid[size-2][1]=0;
  while(stack.length){const n=stack.at(-1),x=n%size,z=Math.floor(n/size),candidates=[];
   for(const [dx,dz] of dirs){const xx=x+dx*2,zz=z+dz*2;if(xx>0&&xx<size-1&&zz>0&&zz<size-1&&grid[zz][xx])candidates.push([xx,zz,dx,dz]);}
   if(!candidates.length){stack.pop();continue;}const [xx,zz,dx,dz]=candidates[Math.floor(random()*candidates.length)];grid[z+dz][x+dx]=0;grid[zz][xx]=0;stack.push(zz*size+xx);
  }
  grid[0][exit]=0;
  const b={size,grid},route=pathTo(b,start,exit);
  if(s.type==='switches'){
   const count=s.tier===1?1:s.tier===2?2:3;
   for(let i=0;i<count;i++){
    const at=Math.max(2,Math.floor((i+1)*((route.length-3)/(count+1))));
    bridges.push(route[at]);switches.push({position:route[Math.max(0,at-2)],color:i});
   }
   friends=[route.at(-2)];
  }else{
   // Extra passages create actual alternative routes, not one forced corridor.
   for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++)if(grid[z][x]&&random()<.22&&((!grid[z][x-1]&&!grid[z][x+1])||(!grid[z-1][x]&&!grid[z+1][x])))grid[z][x]=0;
   const leaves=[];for(let n=0;n<size*size;n++)if(!grid[Math.floor(n/size)][n%size]&&n!==start&&n!==exit)leaves.push(n);
   leaves.sort((a,b)=>pathTo({size,grid},start,b).length-pathTo({size,grid},start,a).length);
   const first=leaves[Math.floor(random()*Math.min(4,leaves.length))];friends=[first];
   const second=leaves.find(n=>n!==first&&pathTo({size,grid},first,n).length>size)||leaves.find(n=>n!==first);if(second!==undefined)friends.push(second);
   if(s.tier===3){const third=leaves.find(n=>!friends.includes(n)&&friends.every(f=>pathTo({size,grid},f,n).length>size/2));if(third!==undefined)friends.push(third);}
  }
 }
 return {size,grid,start,exit,switches,bridges,pads,crates,friends,seed:s.seed,theme:mazeTheme(s.mission),level:s.mission};
}
// Immutable geometry is cached separately from per-move state. Bounds memory in long-running servers.
const boards=new Map();
export function puzzleBase(s){const key=`${s.seed}:${s.type}:${s.tier}`;if(!boards.has(key)){if(boards.size>=128)boards.delete(boards.keys().next().value);boards.set(key,baseBoard(s));}return boards.get(key);}
export function puzzleReady(s,b=puzzleBase(s)){return s.type==='blocks'?b.pads.every(n=>s.crates.includes(n)):s.type==='switches'?b.bridges.every((_,i)=>s.opened.includes(i)):true;}
export function puzzleBoard(p){
 const s=puzzleState(p),b=puzzleBase(s),grid=b.grid.map(r=>[...r]);
 if(s.type==='switches')b.bridges.forEach((n,i)=>{if(!s.opened.includes(i))grid[Math.floor(n/b.size)][n%b.size]=1;});
 if(s.type==='blocks'&&!puzzleReady(s,b))grid[0][b.exit]=1;
 const markers=[...b.switches.map(v=>({...v,kind:'switch',active:s.opened.includes(v.color)})),...b.bridges.map((position,color)=>({position,color,kind:'bridge',closed:!!grid[Math.floor(position/b.size)][position%b.size]})),...b.pads.map(position=>({position,kind:'pad'})),...s.crates.map(position=>({position,kind:'crate'})),...b.friends.filter(n=>!s.rescued.includes(n)).map(position=>({position,kind:'friend'}))];
 return {...b,grid,markers,bridgeCells:b.bridges,seed:`puzzle:${s.seed}:${s.opened}:${s.crates}:${s.rescued}`};
}
export function puzzleInfo(p){const s=puzzleState(p),b=puzzleBase(s),animals=b.friends.map((position,i)=>{const [emoji,name]=ANIMALS[(s.mission-1+i)%ANIMALS.length];return {position,emoji,name};});return {...animals[0],animals,theme:b.theme,chapter:Math.floor((s.mission-1)/12)+1,title:{switches:'Bridge Workshop',blocks:'Block Movers',trail:'Trail Scouts'}[s.type]};}
export function puzzleLever(p){const s=puzzleState(p);return puzzleBase(s).switches.find(v=>v.position===s.position&&!s.opened.includes(v.color));}
export function puzzleLine(p){const s=puzzleState(p);if(s.paused)return PUZZLE_LINES.pause;if(s.phase==='done')return PUZZLE_LINES.done;if(s.phase==='plan')return PUZZLE_LINES.trail;if(s.phase==='exit')return PUZZLE_LINES.exit;if(puzzleLever(p))return PUZZLE_LINES.lever;if(puzzleReady(s)&&s.type!=='trail')return PUZZLE_LINES.ready;return s.type==='trail'?PUZZLE_LINES.explore:PUZZLE_LINES[s.type];}
function snapshot(s){return {position:s.position,direction:s.direction,opened:[...s.opened],crates:[...s.crates],rescued:[...s.rescued],phase:s.phase,plan:[...s.plan]};}
function saveUndo(s){s.undo.push(snapshot(s));s.undo=s.undo.slice(-100);}
export function puzzleAction(p,input){
 const initial=puzzleState(p);if(input.mission!==initial.mission)throw Error('This rescue changed. Refresh to continue.');
 const s=structuredClone(initial),b=puzzleBase(s),draft={...p,rescue:s};let kind=input.kind,line='';
 if(kind==='next'&&s.phase==='done'){p.rescue=newPuzzle(p,s.mission+1,s);p.revision++;return {kind,line:puzzleLine(p)};}
 if(kind==='pause'){s.paused=true;s.pauses++;line=PUZZLE_LINES.pause;}
 else if(kind==='resume'){s.paused=false;line=puzzleLine(draft);}
 else if(s.paused)throw Error('Resume your rescue first.');
 else if(kind==='help'){s.helped=true;s.helpCount++;line=s.type==='blocks'?PUZZLE_LINES.blocks:PUZZLE_LINES.help;}
 else if(kind==='undo'&&s.undo.length&&s.phase!=='done'){Object.assign(s,s.undo.pop());s.undos++;line=PUZZLE_LINES.undo;}
 else if(kind==='plan'&&s.phase==='plan'){
  const position=Number(input.card);if(!b.friends.includes(position))throw Error('Choose a friend on this plan.');
  s.plan=[position,...b.friends.filter(n=>n!==position)];s.phase='explore';line=PUZZLE_LINES.explore;
 }else if(kind==='rook'&&s.phase==='explore'){
  const lever=puzzleLever(draft);if(!lever)throw Error('Find a switch for Rook first.');
  saveUndo(s);s.opened.push(lever.color);line=PUZZLE_LINES.opened;
 }else if(kind==='turn'&&s.phase!=='done'){
  if(![-1,1].includes(input.turn))throw Error('Invalid turn');s.direction=(s.direction+input.turn+4)%4;
 }else if(kind==='forward'&&['explore','exit'].includes(s.phase)){
  const board=puzzleBoard(draft),step=mazeOpen(board,s.position).find(v=>v.direction===s.direction);
  if(s.rescued.length<b.friends.length&&(step?.position===b.exit||(s.position===b.exit&&s.direction===0))){
   kind='exit-needs-friend';line=b.friends.length-s.rescued.length===1?PUZZLE_LINES.missingFriend:PUZZLE_LINES.missingFriends;
  }
  else if(!step){s.blocked++;kind='wall';line=PUZZLE_LINES.wall;}
  else{
   const crate=s.crates.indexOf(step.position),beyond=crate>=0?mazeOpen(board,step.position).find(v=>v.direction===s.direction)?.position:undefined;
   if(crate>=0&&(beyond===undefined||s.crates.includes(beyond)||beyond===b.exit)){s.blocked++;kind='wall';line=PUZZLE_LINES.stuck;}
   else{
    const wasReady=puzzleReady(s,b);saveUndo(s);if(crate>=0){s.crates[crate]=beyond;kind='push';line=PUZZLE_LINES.push;}
    s.position=step.position;s.moves++;
    if(!wasReady&&puzzleReady(s,b)){kind='opened';line=PUZZLE_LINES.ready;}
    if(puzzleLever(draft))line=PUZZLE_LINES.lever;
    if(puzzleReady(s,b)&&b.friends.includes(s.position)&&!s.rescued.includes(s.position)){s.rescued.push(s.position);line=PUZZLE_LINES.saved;}
    if(s.phase!=='exit'&&s.rescued.length===b.friends.length&&puzzleReady(s,b)){s.phase='exit';if(s.position!==b.exit)line=PUZZLE_LINES.exit;}
    if(s.phase==='exit'&&s.position===b.exit){
     s.phase='done';s.badges++;s.undo=[];s.history.push({engine:2,type:s.type,tier:s.tier,mission:s.mission,moves:s.moves,helpCount:s.helpCount,pauses:s.pauses,undos:s.undos,blocked:s.blocked,completedAt:new Date().toISOString()});s.history=s.history.slice(-100);kind='complete';line=PUZZLE_LINES.done;
    }
   }
  }
 }else throw Error('That action is not available.');
 p.rescue=s;p.revision++;return {kind,line};
}
export function puzzleClue(p){
 const s=puzzleState(p),b=puzzleBoard(p);let target;
 if(s.phase==='exit')target=b.exit;
 else if(s.type==='switches'&&!puzzleReady(s))target=b.switches.find(v=>!s.opened.includes(v.color))?.position;
 else if(s.type==='blocks'&&!puzzleReady(s)){
  // A genuine one-step Sokoban solver. Includes player position and every block; no fake arrow.
  const solution=solveBlocks(s,16000);return solution.length?{absolute:solution[0]}:null;
 }else target=(s.plan.length?s.plan:b.friends).find(n=>!s.rescued.includes(n));
 for(const n of s.crates)b.grid[Math.floor(n/b.size)][n%b.size]=1;
 const path=pathTo(b,s.position,target);if(path.length<2)return null;
 return {absolute:mazeOpen(b,s.position).find(v=>v.position===path[1]).direction};
}
export function solveBlocks(s,limit=16000){
 const b=puzzleBase(s),queue=[{position:s.position,crates:[...s.crates],path:[]}],keyFor=(position,crates)=>position+':'+[...crates].sort((a,b)=>a-b).join(','),seen=new Set([keyFor(s.position,s.crates)]);
 for(let i=0;i<queue.length&&i<limit;i++){
  const q=queue[i];
  if(b.pads.every(n=>q.crates.includes(n)))return q.path;
  for(const step of mazeOpen(b,q.position)){
   if(step.position===b.exit)continue;
   const crates=[...q.crates],at=crates.indexOf(step.position);
   if(at>=0){const next=mazeOpen(b,step.position).find(v=>v.direction===step.direction)?.position;if(next===undefined||next===b.exit||crates.includes(next))continue;crates[at]=next;}
   const key=keyFor(step.position,crates);if(seen.has(key)||queue.length>=limit)continue;seen.add(key);queue.push({position:step.position,crates,path:[...q.path,step.direction]});
  }
 }
 return [];
}
