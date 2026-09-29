import {createPond,pondAction,pondResult,INTRO} from './model.mjs';
import {pondPicture,leafPicture} from './scene.mjs';
import {calmSound} from './sound.mjs';
const bird='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M24 64Q12 27 40 19Q71 8 74 43L90 50L73 57Q70 90 38 83L13 90Z" fill="#cdac62" stroke="#725434" stroke-width="2"/><path d="M30 48Q62 38 56 68Q35 79 30 48" fill="#747f62"/><circle cx="62" cy="35" r="3"/></svg>';
const key='<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="40" cy="30" r="17" fill="none" stroke="#e6cb7d" stroke-width="9"/><path d="M40 48V84H59V73H40" stroke="#e6cb7d" stroke-width="9" fill="none"/></svg>';
const map='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M12 20L37 13L64 22L88 13V81L62 90L35 80L12 87Z" fill="#f4e1ac" stroke="#94754b" stroke-width="3"/><path d="M24 64Q48 25 76 48" fill="none" stroke="#637e68" stroke-width="4" stroke-dasharray="4 5"/><path d="M65 38L78 52M78 38L65 52" stroke="#906645" stroke-width="4"/></svg>';
export function mountPond(root,{mode='count',speak=async()=>{},stopSpeech=()=>{},onResult=()=>{},onContinue=()=>{},companion=null}={}){
 let state=createPond(mode),disposed=false,frame=0,token=0,line=INTRO[state.mode],speaking=Promise.resolve();
 const sound=calmSound('/pond/water.m4a'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const positions=[[33,57,-13],[46,68,12],[63,51,-22],[71,68,18],[48,45,-8]];
 const say=text=>{line=text;const my=token;speaking=speaking.then(async()=>{if(disposed||my!==token)return;const release=sound.duck();try{await speak(text);}finally{release();}});return speaking;};
 root.innerHTML=`<article class="pond-book"><header class="pond-heading"><div><div class="pond-kicker">A page of the journey</div><h1>${state.mode==='count'?'A raft for a friend':'The missing map'}</h1></div><button class="pond-tool" data-act="sound" aria-pressed="true">Water on ♪</button></header><div class="pond-world">${pondPicture}<svg class="pond-current" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><path/></svg><div class="pond-objects"></div></div><footer class="pond-copy"><div><p class="pond-prompt" aria-live="polite"></p><p class="pond-note"></p></div><div class="pond-actions"><button class="pond-tool" data-act="replay">Hear it ↻</button><button class="pond-tool" data-act="help">A clue</button><button class="pond-tool primary" data-act="launch">Launch the boat →</button><button class="pond-tool primary" data-act="continue" hidden>Turn the page →</button></div></footer></article>`;
 const objects=root.querySelector('.pond-objects'),prompt=root.querySelector('.pond-prompt'),note=root.querySelector('.pond-note');
 const companionHTML=()=>{if(!companion)return bird;const img=document.createElement('img');img.src=companion;img.alt='Our travelling companion';return img.outerHTML;};
 let soundOn=true;
 function render(){
  root.dataset.phase=state.phase;root.dataset.count=state.counted.length;
  root.querySelector('[data-act=help]').hidden=state.phase!=='build';root.querySelector('[data-act=launch]').hidden=state.mode!=='flow'||state.phase!=='build';root.querySelector('[data-act=continue]').hidden=state.phase!=='done';
  const done=state.phase==='done',crossing=state.phase==='crossing';
  prompt.textContent=done?(state.mode==='count'?'The key is safe with our friend.':'The map is on board. We found the way!'):crossing?'Across the quiet water…':state.mode==='count'?'Touch five leaves to build a raft.':'Carry the boat to the map. Turn the wooden gates.';
  note.textContent=done?'Turn the page to see where it leads.':state.mode==='count'?'Each leaf becomes part of the raft.':state.trials.length?state.trials.at(-1).bank==='stones'?'The stones stop the boat. Change the upper gate.':'The reeds stop the boat. Change the lower gate.':'Look at both channels. You can change your plan before you launch.';
  const raft=state.mode==='count'?`<div class="pond-raft" style="left:${done?79:24}%;top:${done?68:73}%">${state.counted.map((_,i)=>`<div class="raft-leaf" style="left:${i*15}%">${leafPicture}</div>`).join('')}<div class="pond-friend">${companionHTML()}</div></div>`:`<div class="pond-raft boat" style="left:${done?79:55}%;top:${done?68:28}%"><div class="boat-hull"></div><div class="pond-friend">${companionHTML()}</div></div>`;
  objects.innerHTML=raft+`<div class="pond-treasure ${done?'collected':''}" style="left:81%;top:66%">${state.mode==='count'?key:map}</div>`;
  if(state.mode==='count'){
   objects.insertAdjacentHTML('beforeend',positions.map(([x,y,r],id)=>state.counted.includes(id)?'':`<button class="pond-leaf" style="left:${x}%;top:${y}%;--tilt:${r}deg" data-leaf="${id}" aria-label="Add a leaf to the raft">${leafPicture}</button>`).join(''));
   if(state.counted.length)objects.insertAdjacentHTML('beforeend',`<span class="raft-count" aria-label="${state.counted.length} leaves on the raft">${state.counted.length}</span>`);
  }else{
   root.querySelector('.pond-current path').setAttribute('d',`M550 195L${state.gates[0]?'560 340':'320 310'}${state.gates[0]?(state.gates[1]?'Q690 365 790 475':'Q460 385 265 470'):''}`);
   objects.insertAdjacentHTML('beforeend',state.gates.map((open,id)=>`<button class="pond-gate gate-${id}" data-gate="${id}" aria-label="Turn ${id===0?'upper':'lower'} gate" aria-pressed="${open}" ${crossing||done?'disabled':''} style="left:${id?56:55}%;top:${id?48:28}%;--gate-angle:${open?35:-35}deg"></button>`).join('')+'<span class="pond-obstacle stones">● ●</span><span class="pond-obstacle reeds">≋</span>');
  }
 }
 function dispatch(action){state=pondAction(state,action);render();onResult(pondResult(state));}
 function cross(){
  const my=token,raft=objects.querySelector('.pond-raft');let elapsed=0,last=null;
  const end=state.mode==='count'||state.gates.every(Boolean)?[79,68]:!state.gates[0]?[32,44]:[26,67];
  const start=state.mode==='count'?[24,73]:[55,28],bend=state.mode==='count'?[51,61]:state.gates[0]?[56,48]:[44,35];
  function step(now){if(disposed||my!==token)return;if(last!==null&&!document.hidden)elapsed+=Math.min(now-last,60);last=now;const t=reduced.matches?1:Math.min(1,elapsed/3300),u=1-t;
   raft.style.left=(u*u*start[0]+2*u*t*bend[0]+t*t*end[0])+'%';raft.style.top=(u*u*start[1]+2*u*t*bend[1]+t*t*end[1])+'%';
   if(t<1){frame=requestAnimationFrame(step);return;}dispatch({type:'arrive'});sound.pluck(2);say(state.phase==='done'?(state.mode==='count'?LINES_KEY:LINES_MAP):state.trials.at(-1).bank==='stones'?'The boat stopped at the stones. Turn the first gate toward the pond.':'The boat reached the reeds. Turn the second gate toward the map.');
  }frame=requestAnimationFrame(step);
 }
 const LINES_KEY='The raft reached the key. Let us see what it opens.',LINES_MAP='The boat reached the map! Now we can find the bridge.';
 function click(e){const b=e.target.closest('button');if(!b||disposed)return;sound.start();
  if(b.dataset.leaf!==undefined){if(state.phase!=='build')return;const id=Number(b.dataset.leaf);if(state.counted.includes(id))return;dispatch({type:'count',id});sound.pluck(state.counted.length-1);say(['One.','Two.','Three.','Four.','Five.'][state.counted.length-1]);if(state.phase==='crossing'){say('Five leaves make a raft. Our friend can cross!');cross();}return;}
  if(b.dataset.gate!==undefined){if(state.phase!=='build')return;dispatch({type:'gate',id:Number(b.dataset.gate)});sound.pluck(Number(b.dataset.gate));return;}
  switch(b.dataset.act){case 'launch':if(state.phase==='build'){dispatch({type:'launch'});cross();}break;case 'replay':say(line);break;case 'help':dispatch({type:'help'});say(state.mode==='count'?INTRO.count:'Watch where the water goes when you turn a gate.');break;case 'sound':soundOn=!soundOn;sound.setEnabled(soundOn);b.textContent=soundOn?'Water on ♪':'Water off';b.setAttribute('aria-pressed',soundOn);break;case 'continue':if(state.phase==='done')onContinue(pondResult(state));break;}
 }
 root.addEventListener('click',click);render();
 return {start(){sound.start();return say(INTRO[state.mode]);},getState:()=>structuredClone(state),destroy(){disposed=true;token++;cancelAnimationFrame(frame);stopSpeech();sound.destroy();root.removeEventListener('click',click);root.replaceChildren();}};
}
