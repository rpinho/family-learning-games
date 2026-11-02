import {scenePicture,shelfPicture,coin} from './art.mjs';
import {NUMBER_WORDS} from './content.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 24h27M26 12l12 12-12 12" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const letter=v=>v==='b'||v==='d'?`<svg class="wb-letter" viewBox="0 0 60 72" aria-hidden="true"><path d="${v==='b'?'M15 9v51m0-21c0-25 34-25 34 0s-34 25-34 0':'M45 9v51m0-21c0-25-34-25-34 0s34 25 34 0'}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>`:esc(v);
let sheet;
function loadStyle(){return sheet||=new Promise((yes,no)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/word-blocks/style.css';link.onload=yes;link.onerror=()=>{sheet=null;link.remove();no(Error('Could not open the shelf.'));};document.head.append(link);});}
export function mountWordBlocks(root,{player,event=()=>{}}){
 let data=null,view='shelf',dead=false,busy=false,error='',audio=null,hideTimer=null,pointer=null,pendingRequest=null;
 const endpoint='/api/word-blocks?player='+encodeURIComponent(player);
 const request=input=>{
  const work=(async()=>{const response=await fetch(endpoint,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:data.profile.revision,...input})}:{cache:'no-store'});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Could not save your place.');return value;})();pendingRequest=work;return work.finally(()=>{if(pendingRequest===work)pendingRequest=null;});
 };
 const stopAudio=()=>{audio?.pause();audio=null;};
 function scheduleHide(){
  clearTimeout(hideTimer);const s=data?.profile.current;
  if(s?.activity==='coins'&&s.phase==='play'&&s.open.length===2)hideTimer=setTimeout(()=>act({type:'hide'}),Math.max(20,s.hideAfter-data.serverNow+30));
 }
 async function act(input){
  if(busy||dead)return;busy=true;error='';root.querySelector('.wb')?.setAttribute('aria-busy','true');
  try{
   const value=await request(input);if(dead)return;data=value;
   if(input.type==='start')view='play';
   render();
   if(value.result?.action==='press'&&!value.result.right){for(const i of value.result.wrong){root.querySelector(`[data-turn="${i}"]`)?.classList.add('wb-wiggle');}setTimeout(()=>root.querySelectorAll('.wb-wiggle').forEach(e=>e.classList.remove('wb-wiggle')),450);}
   if(value.audio){stopAudio();audio=new Audio(value.audio);audio.play().catch(()=>{});}
   scheduleHide();
  }catch(e){error=e.message;render();}finally{busy=false;root.querySelector('.wb')?.removeAttribute('aria-busy');}
 }
 function cube(values,value,i,fixed,sentence){
  const longest=Math.max(...values.map(v=>v.length)),weight=Math.max(3,longest);
  return `<button style="--word-weight:${weight};--word-font:${Math.min(36,Math.floor(200/(longest*.62)))}px;--mobile-font:${Math.min(24,Math.floor(110/(longest*.62)))}px" class="wb-cube${values.length===1?' wb-fixed':''}${sentence?' wb-word':''}" data-turn="${i}" ${fixed?'disabled':''} aria-label="${fixed?'Fixed':'Turn'} block ${i+1}: ${esc(value)}"><span class="wb-rotor" style="transform:rotateX(${-90*values.indexOf(value)}deg)">${Array.from({length:4},(_,face)=>`<span class="wb-face" style="transform:rotateX(${face*90}deg) translateZ(var(--depth))">${sentence?esc(values[face]||''):letter(values[face]||'')}</span>`).join('')}</span>${fixed?'':'<span class="wb-grip" aria-hidden="true">⌃<br>⌄</span>'}</button>`;
 }
 function render(){
  if(dead)return;
  const s=data?.profile.current;
  let body='';
  if(!data)body='<div class="wb-loading" role="status">Opening the shelf…</div>';
  else if(view==='shelf')body=`<div class="wb-shelf">${['spelling','sentences','coins'].map((activity,i)=>`<button data-activity="${activity}" aria-label="${['Turn the Blocks','Word block sentences','Coin Match'][i]}"><span class="wb-mini-picture">${shelfPicture(activity)}</span>${activity==='coins'?'<span class="wb-mini-coins" aria-hidden="true">'+coin()+coin()+'</span>':`<span class="wb-mini-rod" aria-hidden="true">${(activity==='spelling'?['c','u','p']:['a','fox','ran']).map(w=>`<i>${w}</i>`).join('')}<b>→</b></span>`}${(s?.activity===activity&&s.phase!=='finish'||data.profile.paused?.[activity])?'<span class="wb-resume" aria-hidden="true">↪</span>':''}</button>`).join('')}</div>`;
  else if(s?.phase==='finish')body=`<div class="wb-finish">${shelfPicture(s.activity)}<button data-shelf aria-label="Back to the shelf">${arrow}</button></div>`;
  else if(s?.activity==='coins')body=`<div class="wb-coins" data-phase="${s.phase}">${s.cards.map((c,i)=>{const open=s.open.includes(i)||s.matched.includes(i);return `<button class="wb-coin ${open?'wb-faceup':''} ${s.matched.includes(i)?'wb-matched':''}" data-flip="${i}" ${s.matched.includes(i)||s.open.includes(i)?'disabled':''} aria-label="${open?esc(c.kind==='number'?c.n:NUMBER_WORDS[c.n]):'Turn coin '+(i+1)}">${open?`<span>${esc(c.kind==='number'?c.n:NUMBER_WORDS[c.n]).replaceAll('-','-<wbr>')}</span>`:coin()}</button>`;}).join('')}</div>`;
  else if(s){
   const sentence=s.activity==='sentences',right=s.phase==='right';
   body=`<div class="wb-work ${sentence?'wb-sentence':''} ${right?'wb-right':''}" data-phase="${s.phase}" data-step="${s.step}">${sentence?`<div class="wb-scene">${scenePicture(s.scene)}</div>`:''}<div class="wb-rod">${sentence?'':`<div class="wb-picture">${scenePicture(s.scene)}</div>`}<div class="wb-blocks">${s.choices.map((c,i)=>cube(c,s.values[i],i,c.length===1||right,sentence&&s.scene)).join('')}</div><button class="wb-press" ${right?'data-next':'data-press'} aria-label="${right?'Next picture':'Check the blocks'}">${arrow}</button></div><div class="wb-direction" aria-hidden="true"><span></span>→</div></div>`;
  }
  root.innerHTML=`<section class="wb" aria-label="Word Blocks"><nav><button data-shelf aria-label="Back to the shelf">${arrow}</button><span aria-hidden="true">${view==='shelf'?'Word Blocks':''}</span></nav>${body}${error?`<div class="wb-error" role="status">${esc(error)} <button data-reopen>Reopen saved place</button></div>`:''}${view==='shelf'&&data?'<details class="wb-grown"><summary>Grown-ups</summary><p>Only a first correct press after 2.5 seconds counts as careful spelling practice. Guessed pictures return later. Nothing here adds known words. Six pictures make a short visit.</p><p>First careful spellings: '+esc(Object.entries(data.profile.words).filter(([w,n])=>!w.includes(' ')&&n.careful).map(([w,n])=>w+' ('+n.careful+')').join(', ')||'None yet.')+'</p></details>':''}</section>`;
  root.querySelectorAll('[data-activity]').forEach(b=>b.onclick=()=>act({type:'start',activity:b.dataset.activity,compact:matchMedia('(max-width:430px)').matches}));
  root.querySelectorAll('[data-shelf]').forEach(b=>b.onclick=()=>{stopAudio();view='shelf';render();});
  root.querySelector('[data-press]')?.addEventListener('click',()=>act({type:'press'}));
  root.querySelector('[data-next]')?.addEventListener('click',()=>{stopAudio();act({type:'next'});});
  root.querySelectorAll('[data-flip]').forEach(b=>b.onclick=()=>act({type:'flip',index:Number(b.dataset.flip)}));
  root.querySelector('[data-reopen]')?.addEventListener('click',open);
  root.querySelectorAll('[data-turn]').forEach(b=>{
   b.onpointerdown=e=>{if(b.disabled||busy)return;e.preventDefault();b.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY};};
   b.onpointerup=e=>{if(!pointer||pointer.id!==e.pointerId)return;const dy=e.clientY-pointer.y;pointer=null;e.preventDefault();turn(b,dy>24?-1:1);};
   b.onpointercancel=()=>pointer=null;
   b.onclick=e=>{if(e.detail===0)turn(b,1);};
   b.onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();turn(b,e.key==='ArrowDown'?-1:1);}};
  });
 }
 function turn(b,direction){
  if(busy||b.disabled)return;
  const s=data.profile.current,i=Number(b.dataset.turn),values=s.choices[i],at=values.indexOf(s.values[i]),next=(at+direction+values.length)%values.length;
  let angle=-90*next;if(direction===1&&next<at)angle-=360;if(direction===-1&&next>at)angle+=360;
  const rotor=b.querySelector('.wb-rotor');rotor.style.transform=`rotateX(${angle}deg)`;
  // Keep the GPU-only turn alive while the save travels; rerender after its finish.
  b.classList.add('wb-turning');
  const t=performance.now();actTurn({type:'turn',index:i,direction},t);
 }
 async function actTurn(input,started){
  busy=true;
  try{
   const value=await request(input);await new Promise(r=>setTimeout(r,Math.max(0,190-(performance.now()-started))));if(dead)return;data=value;
   const button=root.querySelector(`[data-turn="${input.index}"]`),rotor=button?.querySelector('.wb-rotor'),s=value.profile.current;
   // Retain the four composited faces through repeated turns; only the transform changes.
   if(rotor){rotor.style.transition='none';rotor.style.transform=`rotateX(${-90*s.choices[input.index].indexOf(s.values[input.index])}deg)`;requestAnimationFrame(()=>{rotor.style.transition='';});button.setAttribute('aria-label',`Turn block ${input.index+1}: ${s.values[input.index]}`);button.classList.remove('wb-turning');}
  }catch(e){error=e.message;render();}finally{busy=false;}
 }
 async function open(){try{await loadStyle();const value=await request();if(dead)return;data=value;error='';view=data.profile.current&&data.profile.current.phase!=='finish'?'play':'shelf';render();scheduleHide();}catch(e){error=e.message;render();}}
 root.innerHTML='<section class="wb" aria-label="Word Blocks"><div class="wb-loading" role="status">Opening the shelf…</div></section>';open();event('word-blocks-open');
 addEventListener('family-audio-stop',stopAudio);
 const dispose=()=>{dead=true;stopAudio();clearTimeout(hideTimer);removeEventListener('family-audio-stop',stopAudio);};
 dispose.prepareLeave=async()=>{await pendingRequest;};dispose.busy=()=>pendingRequest!==null;return dispose;
}
