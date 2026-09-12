import {mazeTheme} from './maze-themes.mjs';
import {mazeOpen} from './maze.mjs';
import {newPuzzle,puzzleState,puzzleBoard,puzzleInfo,puzzleClue,puzzleLine,puzzleAction,PUZZLE_LINES} from './rescue-puzzles.mjs';
export {PUZZLE_LINES};
export const RESCUE_LINES={plan:'First the key. Then our friend. Make our plan.',key:'Your turn. Find the key. The map can help.',rook:'We found the key! My turn to open the gate.',change:'The short bridge is closed. Let’s take the garden path.',friend:'New plan! Follow the garden path to our friend.',exit:'Our friend is safe! Lead us to the golden door.',done:'Rescue complete! One teamwork badge. A good place to stop.',pause:'Take your time. Your rescue is saved.',wall:'A wall. Try turning. Our progress is safe.',order:'The key opens the gate. Put the key first.',help:'Follow the golden arrow. We can do this together.'};
const FRIENDS=[['🐢','Turtle'],['🦊','Fox'],['🐧','Penguin'],['🐰','Rabbit'],['🐻','Bear'],['🐱','Cat'],['🦉','Owl'],['🐶','Dog'],['🐸','Frog'],['🐨','Koala'],['🦔','Hedgehog'],['🦝','Raccoon']];
export function rescueState(p){return p.rescue||puzzleState(p);}
export function rescueBoard(p){
 if(rescueState(p).engine===2)return puzzleBoard(p);
 const s=rescueState(p),variant=(s.mission-1)%3;
 // A loop with three layouts. The north doorway is genuinely open to the outdoors.
 const rows=['###.###','#.....#','#.###.#','#.....#','#.###.#','#.....#','#######'];
 const grid=rows.map(r=>[...r].map(c=>c==='#'?1:0));
 const key=[36,40,22][variant],friend=[12,8,26][variant];
 const gateClosed=['plan','key','rook'].includes(s.phase);
 if(gateClosed)grid[1][3]=1;
 // The announced short bridge closes only after the key, never under the player.
 if(['reroute','friend','exit','done'].includes(s.phase))grid[3][3]=1;
 const markers=[...(['plan','key'].includes(s.phase)?[{position:key,kind:'key'}]:[]),...(!['exit','done'].includes(s.phase)?[{position:friend,kind:'friend'}]:[])];
 return {size:7,grid,start:38,exit:3,key,friend,markers,seed:`rescue:${s.mission}:${s.phase}`,theme:mazeTheme(s.mission),level:s.mission};
}
export function rescueInfo(p){if(rescueState(p).engine===2)return puzzleInfo(p);const s=rescueState(p),[emoji,name]=FRIENDS[(s.mission-1)%FRIENDS.length];return {emoji,name,theme:rescueBoard(p).theme,chapter:Math.floor((s.mission-1)/FRIENDS.length)+1};}
export function rescueTarget(p){const s=rescueState(p),b=rescueBoard(p);return s.phase==='key'?b.key:s.phase==='friend'?b.friend:b.exit;}
export function rescueClue(p){
 if(rescueState(p).engine===2)return puzzleClue(p);
 const b=rescueBoard(p),s=rescueState(p),target=rescueTarget(p),queue=[[s.position,[]]],seen=new Set([s.position]);
 for(let i=0;i<queue.length;i++){const [n,path]=queue[i];if(n===target)return path.length?{absolute:path[0]}:null;for(const v of mazeOpen(b,n)){if(!seen.has(v.position)){seen.add(v.position);queue.push([v.position,[...path,v.direction]]);}}}
 return null;
}
export function rescueLine(p){const s=rescueState(p);if(s.engine===2)return puzzleLine(p);return RESCUE_LINES[s.paused?'pause':s.phase==='reroute'?'change':s.phase];}
export function rescueAction(p,input){
 if(rescueState(p).engine===2)return puzzleAction(p,input);
 const before=rescueState(p);
 if(input.mission!==before.mission)throw Error('This rescue changed. Refresh to continue.');
 const s=structuredClone(before),draft={...p,rescue:s};let line='',kind=input.kind;
 if(kind==='pause'){s.paused=true;s.pauses++;line=RESCUE_LINES.pause;}
 else if(kind==='resume'){s.paused=false;line=rescueLine(draft);}
 else if(s.paused)throw Error('Resume your rescue first.');
 else if(kind==='help'){s.helped=true;s.helpCount++;line=['key','friend','exit'].includes(s.phase)?RESCUE_LINES.help:rescueLine(draft);}
 else if(kind==='plan'&&s.phase==='plan'){
  const expected=s.plan.length?'friend':'key';
  if(input.card!==expected){line=RESCUE_LINES.order;kind='clue';}
  else{s.plan.push(expected);if(s.plan.length===2){s.phase='key';line=RESCUE_LINES.key;}}
 }else if(kind==='rook'&&s.phase==='rook'){s.phase='reroute';line=RESCUE_LINES.change;}
 else if(kind==='reroute'&&s.phase==='reroute'){s.phase='friend';line=RESCUE_LINES.friend;}
 else if(kind==='turn'&&['key','friend','exit'].includes(s.phase)){
  if(![-1,1].includes(input.turn))throw Error('Invalid turn');s.direction=(s.direction+input.turn+4)%4;
 }else if(kind==='forward'&&['key','friend','exit'].includes(s.phase)){
  const b=rescueBoard(draft),step=mazeOpen(b,s.position).find(n=>n.direction===s.direction);
  if(s.phase!=='exit'&&(step?.position===b.exit||(s.position===b.exit&&s.direction===0))){kind='exit-needs-friend';line=PUZZLE_LINES.missingFriend;}
  else if(!step){kind='wall';line=RESCUE_LINES.wall;}
  else{s.position=step.position;s.moves++;if(s.position===rescueTarget(draft)){
   s.phase=s.phase==='key'?'rook':s.phase==='friend'?'exit':'done';s.helped=false;line=rescueLine(draft);
   if(s.phase==='done'){s.badges++;s.history.push({mission:s.mission,moves:s.moves,helpCount:s.helpCount,pauses:s.pauses,completedAt:new Date().toISOString()});s.history=s.history.slice(-100);kind='complete';}
  }}
 }else if(kind==='next'&&s.phase==='done'){
  p.rescue=newPuzzle(p,s.mission+1,s);p.revision++;return {kind,line:puzzleLine(p)};
 }else throw Error('That action is not available in this rescue.');
 p.rescue=s;p.revision++;return {kind,line};
}
