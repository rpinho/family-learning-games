import {createMazeRenderer} from './maze-renderer.mjs';
import {rookAvatar} from './rook.mjs';
import {rescueState,rescueBoard,rescueInfo,rescueClue,rescueLine} from './rescue.mjs';
import {puzzleLever,puzzleReady} from './rescue-puzzles.mjs';
// Undo is a frequent editing gesture: update the board/caption without
// starting another voice clip or interrupting an instruction already playing.
export const rescueShouldSpeak=input=>input.kind!=='undo';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rescueFinishView(s,info,busy=false){
 return `<p>🏅 ${s.badges} teamwork badge${s.badges===1?'':'s'} · ${esc(info.emoji)} ${esc(info.name)} is home!</p><button class="button primary rescue-next" data-rescue="next" ${busy?'disabled':''}>Another rescue →</button><p class="rescue-note">Done playing? Use the ☰ menu at the top.</p>`;
}
export function rescueMovementView(s,busy=false,lever=false){
 const moving=!s.paused&&(s.engine===2?['explore','exit']:['key','friend','exit']).includes(s.phase),turning=!s.paused&&s.phase!=='done'&&(s.engine===2||moving);
 const arrow=(label,kind,turn,allowed,symbol)=>`<button class="button secondary" data-rescue="${kind}" data-turn="${turn}" aria-label="${label}" ${busy||!allowed?'disabled':''}>${symbol}</button>`;
 return `<div class="rescue-control-status">${s.paused?'Paused · resume with Rook':s.phase==='done'?'Rescue complete':!moving?'Choose with Rook above':lever?'Switch found · Rook can help':'Explore'}</div><div class="maze-walk">${arrow('Turn left','turn',-1,turning,'↶')}${arrow('Walk forward','forward',0,moving,'↑')}${arrow('Turn right','turn',1,turning,'↷')}</div>`;
}
export function createRescueView(root,onAction,report){
 if(!document.querySelector('link[href="/rescue.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/rescue.css';document.head.append(style);}
 root.innerHTML='<section class="maze-shell rescue-shell"><header class="maze-header"></header><div class="maze-world"><canvas class="maze-canvas" role="img" aria-label="Rescue labyrinth with an open golden door"></canvas><div class="rescue-map"></div><div class="rescue-card"></div><div class="rescue-controls"></div></div><dialog class="rescue-menu" aria-label="Rescue menu"><h2>Your rescue is saved</h2><button class="button primary" data-rescue="menu-close">Keep playing</button><button class="button secondary" data-rescue="pause">Ⅱ Take a break</button><button class="button secondary" data-rescue="leave">Finish later · back to labyrinth</button></dialog></section>';
 const renderer=createMazeRenderer(root.querySelector('canvas'),report);let busy=false;
 const button=(label,kind,extra='')=>`<button class="button secondary" data-rescue="${kind}" ${extra} ${busy?'disabled':''}>${label}</button>`;
 function update(p,message='',waiting=false){
  busy=waiting;const s=rescueState(p),b=rescueBoard(p),info=rescueInfo(p),modern=s.engine===2,moving=!s.paused&&(modern?['explore','exit']:['key','friend','exit']).includes(s.phase),clue=s.helped&&moving?rescueClue(p):null,lever=modern?puzzleLever(p):null,colors=['🔴','🔵','🟡'];
  root.querySelector('.maze-header').innerHTML=`${button('☰','menu','aria-label="Open rescue menu"')}<div><span class="eyebrow">${esc(p.name)} · ${esc(info.theme.name)}${modern?' · CHALLENGE '+s.tier:''}</span><h1>${esc(info.title||'Rook’s Rescue Team')} <small>${s.mission}</small></h1></div><span class="maze-earned">🏅 ${s.badges}</span>${button('🔊','repeat','aria-label="Hear mission instruction"')}`;
  root.querySelector('.rescue-map').innerHTML=`<div class="rescue-map-grid" style="--size:${b.size}" role="img" aria-label="Rescue map. North is up. Switches and bridges share a numbered color. Blocks go on diamond pads.">${b.grid.flatMap((row,z)=>row.map((wall,x)=>{const n=z*b.size+x,sw=b.switches?.find(v=>v.position===n),gate=b.bridges?.indexOf(n),animal=info.animals?.find(v=>v.position===n);let mark='';if(modern){mark=s.crates.includes(n)?'📦':b.pads.includes(n)?'◇':animal&&!s.rescued.includes(n)?animal.emoji:sw&&!s.opened.includes(sw.color)?colors[sw.color]+(sw.color+1):gate>=0&&wall?(s.type==='blocks'?'🔒':colors[gate]+(gate+1)):'';}else mark=n===b.key&&['plan','key'].includes(s.phase)?'🔑':n===b.friend&&!['exit','done'].includes(s.phase)?info.emoji:n===24&&wall?'🚧':'';return `<span class="${wall?'wall':'path'} ${n===s.position?'you':''} ${b.pads?.includes(n)?'pad':''}">${n===s.position?['⬆','➡','⬇','⬅'][s.direction]:mark||(n===b.exit?'🚪':'')}</span>`;})).join('')}</div><small>North ↑ · ${['North','East','South','West'][s.direction]} ahead</small>`;
  let actions='';
  if(s.paused)actions=button('▶ Resume rescue','resume');
  else if(s.phase==='plan')actions=modern?`<div class="rescue-actions">${info.animals.map(a=>button(a.emoji+' '+a.name+' first','plan',`data-card="${a.position}"`)).join('')}</div>`:`<div class="rescue-plan">${s.plan.length?'1. 🔑 Key → 2. ?':'1. ? → 2. ?'}</div><div class="rescue-actions">${button(info.emoji+' Friend','plan','data-card="friend"')}${button('🔑 Key','plan','data-card="key"'+(s.plan.length?' disabled':''))}</div>`;
  else if(s.phase==='rook')actions=button('♜ Rook, open the gate','rook');
  else if(s.phase==='reroute')actions=button('🌿 Use the garden path','reroute');
  else if(lever)actions=`<div class="rescue-rook-action">${button(`♜ Rook: open ${colors[lever.color]} bridge ${lever.color+1}`,'rook')}</div>`;
  else if(s.phase==='done')actions=rescueFinishView(s,info,busy);
  const ordered=modern&&s.plan.length?s.plan.map(n=>info.animals.find(a=>a.position===n)).filter(Boolean):info.animals;
  const progress=modern?`<p class="rescue-note">${s.type==='switches'?b.bridges.map((_,i)=>`${colors[i]}${i+1} ${s.opened.includes(i)?'✓':'locked'}`).join(' · '):s.type==='blocks'?`📦 ${b.pads.filter(n=>s.crates.includes(n)).length}/${b.pads.length} on ◇ pads`:`${ordered.map(a=>a.emoji+(s.rescued.includes(a.position)?' ✓':'')).join(' → ')}`}</p>`:'';
  root.querySelector('.rescue-card').innerHTML=`<div class="rescue-coach">${rookAvatar(s.phase==='done'?'happy':'thinking')}<div><span class="eyebrow">${s.paused?'ON A BREAK':s.phase==='rook'||lever?'ROOK CAN HELP':s.phase==='done'?'TEAM SUCCESS':'YOUR TURN'}</span><h2>${esc(message||rescueLine(p))}</h2></div></div>${progress}${actions}${moving&&clue?`<p class="rescue-arrow">${['↑','→','↓','←'][(clue.absolute-s.direction+4)%4]} One possible next step</p>`:''}${moving&&s.helped&&modern&&s.type==='blocks'&&!puzzleReady(s)&&!clue?'<p class="rescue-note">Try Undo to free a stuck block.</p>':''}<div class="rescue-support">${s.phase!=='done'&&!s.paused?button('💡 Help','help'):''}${modern&&s.phase!=='done'?button('↶ Undo','undo',s.undo.length&&!s.paused?'':'disabled'):''}</div>`;
  root.querySelector('.rescue-controls').innerHTML=rescueMovementView(s,busy,!!lever);
  renderer.update(p,{state:s,board:b,clue});
 }
 const menu=root.querySelector('dialog');
 const click=e=>{const el=e.target.closest('[data-rescue]');if(!el||el.disabled||busy)return;const kind=el.dataset.rescue;if(kind==='menu'){menu.showModal();return;}if(kind==='menu-close'){menu.close();return;}if(menu.open)menu.close();onAction({kind,card:el.dataset.card,turn:Number(el.dataset.turn)});};
 const key=e=>{if(busy||menu.open||e.repeat||e.target.closest('input,textarea,select,button'))return;const kind={ArrowUp:'forward',ArrowLeft:'turn',ArrowRight:'turn'}[e.key];if(kind&&root.querySelector(`[data-rescue="${kind}"]:not(:disabled)`)){e.preventDefault();onAction({kind,turn:e.key==='ArrowLeft'?-1:1});}};
 root.addEventListener('click',click);window.addEventListener('keydown',key);
 return {update,dispose(){root.removeEventListener('click',click);window.removeEventListener('keydown',key);renderer.dispose();}};
}
