const tick='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let stylesheet;
function loadStyle(){return stylesheet||=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/word-search/style.css';link.onload=resolve;link.onerror=()=>{stylesheet=null;link.remove();reject(Error('Could not open the letter garden.'));};document.head.append(link);});}
export function mountWordSearch(root,{player,event=()=>{}}){
 let profile=null,art=null,dead=false,busy=false,error=false,pending=null,pointer=null,anchor=null,hover=null,audio=null;
 const endpoint='/api/word-search?player='+encodeURIComponent(player);
 document.documentElement.classList.add('ws-open');
 function stopAudio(){audio?.pause();audio=null;}
 async function request(input){
  const work=(async()=>{const response=await fetch(endpoint,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:profile?.revision,...input})}:{cache:'no-store'});
   const value=await response.json();if(!response.ok)throw Error('Could not open your saved place.');return value;})();
  pending=work;try{return await work;}finally{if(pending===work)pending=null;}
 }
 async function act(input){
  if(dead||busy||error)return;busy=true;root.querySelector('.ws')?.setAttribute('aria-busy','true');
  try{
   const value=await request(input);if(dead)return;profile=value.profile;anchor=null;hover=null;render();
   if(value.result?.word){root.querySelector('[data-status]').textContent=profile.current.phase==='finish'?'You found them all.':value.result.word+' found.';}
   if(value.audio){stopAudio();audio=new Audio(value.audio);audio.play().catch(()=>{});}
  }catch{error=true;render();}finally{busy=false;root.querySelector('.ws')?.removeAttribute('aria-busy');}
 }
 function path(first,last){
  if(first===null||last===null)return [];
  const n=profile.current.size;
  if(first===last)return [first];
  const step=Math.floor(first/n)===Math.floor(last/n)&&last>first?1:last%n===first%n&&last>first?n:0;
  return step?Array.from({length:(last-first)/step+1},(_,i)=>first+i*step):[];
 }
 function paint(){
  const selected=new Set(path(anchor,hover??anchor));
  root.querySelectorAll('[data-cell]').forEach(e=>{const active=selected.has(Number(e.dataset.cell));e.classList.toggle('ws-selected',active);e.setAttribute('aria-pressed',String(active));});
 }
 function choose(cell){
  if(busy||error||profile.current.phase==='finish')return;
  if(anchor===null){anchor=cell;hover=cell;paint();}
  else {const first=anchor;anchor=null;hover=null;paint();act({type:'select',first,last:cell});}
 }
 function cellAt(x,y){
  const grid=root.querySelector('.ws-grid'),r=grid.getBoundingClientRect(),n=profile.current.size;
  if(x<r.left||x>=r.right||y<r.top||y>=r.bottom)return null;
  return Math.floor((y-r.top)/r.height*n)*n+Math.floor((x-r.left)/r.width*n);
 }
 function render(){
  if(dead)return;
  const b=profile?.current;
  const body=b?`<div class="ws-layout"><div class="ws-grid" role="group" aria-label="${b.size} by ${b.size} letter grid" style="--size:${b.size}">${b.grid.map((letter,i)=>{
   const found=b.targets.findIndex(t=>b.found.includes(t.word)&&t.cells.includes(i));
   return `<button class="ws-cell${found>=0?' ws-found ws-color-'+found:''}" data-cell="${i}" tabindex="${i===0?0:-1}" aria-label="${letter}, row ${Math.floor(i/b.size)+1}, column ${i%b.size+1}" aria-pressed="false">${letter}</button>`;
  }).join('')}</div><aside><ul class="ws-words" aria-label="Words to find">${b.targets.map((t,i)=>`<li class="${b.found.includes(t.word)?'ws-done ws-color-'+i:''}"><span class="ws-picture">${art.hasPicture(t.word.toLowerCase())?art.picture(t.word.toLowerCase()):''}</span><span class="ws-word">${t.word}</span><span class="ws-check">${b.found.includes(t.word)?tick:''}</span></li>`).join('')}</ul>${b.phase==='finish'?'<div class="ws-finish"><h2>You found them all.</h2><button data-next>Another garden <span aria-hidden="true">→</span></button></div>':'<p class="ws-note">Take your time. Your place is kept.</p>'}</aside></div>`:'<p class="ws-loading" role="status">Opening the letter garden…</p>';
  root.innerHTML=`<section class="ws" aria-label="Word Search"><header class="ws-heading"><img src="/word-search.svg" width="48" height="48" alt=""><h1>Word Search</h1></header><p class="ws-how">Drag across <span aria-hidden="true">→</span> or down <span aria-hidden="true">↓</span>. Or tap the first and last letters.</p>${body}<p class="ws-status" data-status role="status" aria-live="polite"></p>${error?'<div class="ws-error" role="status">Your place is waiting. <button data-reopen>Reopen saved place</button></div>':''}</section>`;
  root.querySelector('[data-reopen]')?.addEventListener('click',open);
  root.querySelector('[data-next]')?.addEventListener('click',()=>{stopAudio();act({type:'next'});});
  const grid=root.querySelector('.ws-grid');if(!grid)return;
  grid.onpointerdown=e=>{
   if(busy||error||b.phase==='finish'||pointer||!e.isPrimary||e.button!==0)return;
   const cell=cellAt(e.clientX,e.clientY);if(cell===null)return;
   e.preventDefault();grid.setPointerCapture(e.pointerId);pointer={id:e.pointerId,cell,x:e.clientX,y:e.clientY,moved:false};
  };
  grid.onpointermove=e=>{
   if(!pointer||pointer.id!==e.pointerId)return;e.preventDefault();
   if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>7)pointer.moved=true;
   if(pointer.moved){anchor=pointer.cell;hover=cellAt(e.clientX,e.clientY);paint();}
  };
  grid.onpointerup=e=>{
   if(!pointer||pointer.id!==e.pointerId)return;e.preventDefault();
   const p=pointer,last=cellAt(e.clientX,e.clientY);pointer=null;
   if(p.moved||Math.hypot(e.clientX-p.x,e.clientY-p.y)>7){anchor=null;hover=null;paint();if(last!==null)act({type:'select',first:p.cell,last});}
   else if(last===p.cell)choose(last);
   else {anchor=null;hover=null;paint();}
  };
  grid.onpointercancel=grid.onlostpointercapture=()=>{if(pointer){pointer=null;anchor=null;hover=null;paint();}};
  grid.onclick=e=>{if(e.detail===0&&e.target.dataset.cell!==undefined)choose(Number(e.target.dataset.cell));};
  grid.onkeydown=e=>{
   const cell=Number(e.target.dataset.cell);if(!Number.isInteger(cell))return;
   if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)choose(cell);return;}
   if(e.key==='Escape'){anchor=null;hover=null;paint();return;}
   const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-b.size,ArrowDown:b.size}[e.key];
   if(step){e.preventDefault();const next=cell+step;if(next<0||next>=b.grid.length||Math.abs(step)===1&&Math.floor(next/b.size)!==Math.floor(cell/b.size))return;
    e.target.tabIndex=-1;const button=grid.querySelector(`[data-cell="${next}"]`);button.tabIndex=0;button.focus();}
  };
 }
 async function open(){
  if(busy||dead)return;busy=true;
  try{const [,value,pictures]=await Promise.all([loadStyle(),request({type:'open'}),import('../word-blocks/art.mjs')]);if(dead)return;profile=value.profile;art=pictures;
   error=false;anchor=null;hover=null;render();
  }catch{error=true;render();}finally{busy=false;}
 }
 render();open();event('word-search-open');addEventListener('family-audio-stop',stopAudio);
 const dispose=()=>{dead=true;stopAudio();pointer=null;document.documentElement.classList.remove('ws-open');removeEventListener('family-audio-stop',stopAudio);};
 dispose.prepareLeave=async()=>{await pending;};dispose.busy=()=>pending!==null;return dispose;
}
