const tick='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stylesheet;
function loadStyle(){return stylesheet||=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/word-search/style.css';link.onload=resolve;link.onerror=()=>{stylesheet=null;link.remove();reject(Error('Could not open the letter garden.'));};document.head.append(link);});}
export function mountWordSearch(root,{player,event=()=>{},transport=null,showAnother=true,storyDate=null,showHint=transport===null,onChange=()=>{}}){
 let storyGarden=null,expertAvailable=false,daily=null,hint=null,celebrate=false,wordAudio={},namePictures={},audioEpoch=0,heardKey=null,heard=new Set();
 let profile=null,art=null,dead=false,busy=false,error=false,pending=null,pointer=null,anchor=null,hover=null,audio=null;
 const endpoint='/api/word-search'+(storyDate?'/story':'')+'?player='+encodeURIComponent(player)+(storyDate?'&date='+encodeURIComponent(storyDate):'');
 document.documentElement.classList.add('ws-open');
 function stopAudio(){globalThis.speechSynthesis?.cancel();audioEpoch++;if(audio){audio.onended=null;audio.pause();audio=null;}}
 function accept(value){
  profile=value.profile;storyGarden=value.storyGarden||null;expertAvailable=value.expertAvailable===true;daily=value.daily||null;wordAudio=value.wordAudio||{};namePictures=value.namePictures||{};
  const b=profile.current,key=b?'word-search-heard:'+player+':'+b.date+':'+b.grid.join(''):null;
  if(key!==heardKey){
   stopAudio();heardKey=key;heard=new Set();
   try{const saved=JSON.parse(localStorage.getItem('word-search-heard:'+player)||'null');if(saved?.board===key&&Array.isArray(saved.words))heard=new Set(saved.words.filter(w=>b.targets.some(t=>t.word===w)));}catch{}
  }
 }
 function playWord(word,fallback=null){
  globalThis.familyAudio?.interrupt();stopAudio();
  const clips=wordAudio[word]||{word:fallback},epoch=audioEpoch,key=heardKey;
  if(dead)return;
  if(!clips?.word){if(globalThis.speechSynthesis){const utterance=new SpeechSynthesisUtterance(word.toLowerCase());utterance.lang='en-US';utterance.rate=.8;speechSynthesis.speak(utterance);}return;}
  const play=(url,after=()=>{})=>{
   if(dead||epoch!==audioEpoch)return;
   const current=audio=new Audio(url);
   current.onended=()=>{if(audio===current&&epoch===audioEpoch){audio=null;after();}};
   current.play().catch(()=>{if(audio===current)stopAudio();});
  };
  play(clips.word,()=>{
   if(!clips.who||heard.has(word))return;
   play(clips.who,()=>{heard.add(word);try{localStorage.setItem('word-search-heard:'+player,JSON.stringify({board:key,words:[...heard]}));}catch{}});
  });
 }
 async function request(input){
  const work=(async()=>{if(transport)return transport(input);const response=await fetch(endpoint,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:profile?.revision,...input})}:{cache:'no-store'});
   const value=await response.json();if(!response.ok)throw Error('Could not open your saved place.');return value;})();
  pending=work;try{return await work;}finally{if(pending===work)pending=null;}
 }
 async function act(input){
  if(dead||busy||error)return;busy=true;
  if(input.type==='select')stopAudio();const epoch=audioEpoch;root.querySelector('.ws')?.setAttribute('aria-busy','true');
  try{
   const value=await request(input);if(dead)return;accept(value);hint=value.result?.hint||null;celebrate=!!value.result?.goalReached;anchor=null;hover=null;render();paint();
   if(value.result?.word){root.querySelector('[data-status]').textContent=celebrate?'Five gardens today. Lovely finding!':profile.current.phase==='finish'?'You found them all.':value.result.word+' found.';}
   if(value.result?.nearMiss&&profile.current.mode==='expert')root.querySelector('[data-status]').textContent='So close! Check each letter.';
   if(hint){const n=profile.current.size,at=cell=>`row ${Math.floor(cell/n)+1}, column ${cell%n+1}`;root.querySelector('[data-status]').textContent=`${hint.word?hint.word+': from':'Look from'} ${at(hint.cells[0])} to ${at(hint.cells.at(-1))}.`;}
   if(value.result?.word&&epoch===audioEpoch)playWord(value.result.word,value.audio);onChange(value);
  }catch{error=true;render();}finally{busy=false;root.querySelector('.ws')?.removeAttribute('aria-busy');}
 }
 function path(first,last){
  if(first===null||last===null)return [];
  const n=profile.current.size;
  if(first===last)return [first];
  const dr=Math.floor(last/n)-Math.floor(first/n),dc=last%n-first%n,length=Math.max(Math.abs(dr),Math.abs(dc));
  if(dr&&dc&&Math.abs(dr)!==Math.abs(dc))return [];
  if(dr&&dc&&!profile.current.diagonals||(!profile.current.backwards&&(dr<0||dc<0)))return [];
  return Array.from({length:length+1},(_,i)=>first+i*(Math.sign(dr)*n+Math.sign(dc)));
 }
 function paint(){
  const selected=new Set(path(anchor,hover??anchor));
  root.querySelectorAll('[data-cell]').forEach(e=>{const active=selected.has(Number(e.dataset.cell));e.classList.toggle('ws-selected',active);e.classList.toggle('ws-hint',!!hint?.cells.includes(Number(e.dataset.cell)));e.setAttribute('aria-pressed',String(active));});
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
  const body=b?`<div class="ws-layout"><div translate="no" class="notranslate ws-grid" role="group" aria-label="${b.size} by ${b.size} letter grid" style="--size:${b.size}">${b.grid.map((letter,i)=>{
   const found=b.targets.findIndex(t=>b.found.includes(t.word)&&t.cells.includes(i));
   return `<button translate="no" class="notranslate ws-cell${found>=0?' ws-found ws-color-'+found:''}" data-cell="${i}" tabindex="${i===0?0:-1}" aria-label="${letter}, row ${Math.floor(i/b.size)+1}, column ${i%b.size+1}" aria-pressed="false">${letter}</button>`;
  }).join('')}</div><aside><ul translate="no" class="notranslate ws-words" aria-label="Words to find">${b.targets.map((t,i)=>{const hidden=b.mode==='expert'&&!b.found.includes(t.word),canHear=!!wordAudio[t.word]?.word||!!globalThis.speechSynthesis,tag=canHear?'button':'div';return `<li class="${b.found.includes(t.word)?'ws-done ws-color-'+i:''}"><${tag} class="ws-word-control"${canHear?` data-word="${esc(t.word)}" aria-label="${hidden?'Hear picture clue '+(i+1):'Hear '+esc(t.word)}"`:''}><span class="ws-picture" aria-hidden="true">${namePictures[t.word]?`<span class="ws-face">${esc(namePictures[t.word].initial)}${/^\/word-search-face\/[A-Z]{3,10}\?player=\w{1,24}$/.test(namePictures[t.word].url||'')?`<img src="${esc(namePictures[t.word].url)}" alt="">`:''}</span>`:art.hasPicture(t.word.toLowerCase())?art.picture(t.word.toLowerCase()):''}</span>${hidden?'':`<span translate="no" class="notranslate ws-word${t.word.length>8?' ws-long':''}">${t.word}</span>`}<span class="ws-check">${b.found.includes(t.word)?tick:canHear?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z M17 8q5 4 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</span></${tag}></li>`;}).join('')}</ul>${b.phase==='finish'?`<div class="ws-finish"><h2>You found them all.</h2>${showAnother&&!storyDate?'<button data-next>Another garden <span aria-hidden="true">→</span></button>':''}${showAnother&&!storyDate&&expertAvailable?'<button data-expert>Expert garden <span aria-hidden="true">→</span></button>':''}${!storyDate&&storyGarden?`<a class="ws-story" href="#story-garden/${esc(storyGarden.date)}">Story garden today <span aria-hidden="true">→</span></a>`:''}${storyDate?'<a class="ws-story" href="#word-search">Back to Word Search →</a>':''}</div>`:`${showHint?'<button data-hint>Show a word</button>':''}<p class="ws-note">Take your time. Your place is kept.</p>`}</aside></div>`:'<p class="ws-loading" role="status">Opening the letter garden…</p>';
  const filled=Math.min(daily?.count||0,5),dailyRow=daily?`<div class="ws-daily${celebrate?' ws-celebrate':''}" role="group" aria-label="Gardens today: ${filled} of 5"><div class="ws-daily-icons" aria-hidden="true">${Array.from({length:5},(_,i)=>{
   const full=i<filled,icon=full?(daily.icons.golden||daily.icons.lit):(daily.icons.dark||daily.icons.unlit);
   return `<span class="ws-day-icon${full?' ws-day-filled':''}">${icon?`<img src="${esc(icon)}" alt="">`:esc(daily.item.glyph)}</span>`;
  }).join('')}</div><p>${filled===5?'Five gardens today. Lovely finding!':filled+' of 5 gardens today'}</p></div>`:'';
  const directions=b?.diagonals?'Look in any direction, including diagonally ↘.':b?.backwards?'Look right →, down ↓, left ←, or up ↑.':'Drag across → or down ↓.';
  root.innerHTML=`<section class="ws${b?.mode==='expert'?' ws-expert':''}" aria-label="Word Search"><header class="ws-heading"><img src="/word-search.svg" width="48" height="48" alt=""><h1>${storyDate?'Story garden':'Word Search'}</h1></header>${dailyRow}<p class="ws-how">${directions} Or tap the first and last letters.${(Object.values(wordAudio).some(c=>c?.word)||!!globalThis.speechSynthesis)?' Tap a word to hear it.':''}</p>${body}<p class="ws-status" data-status role="status" aria-live="polite"></p>${error?'<div class="ws-error" role="status">Your place is waiting. <button data-reopen>Reopen saved place</button></div>':''}</section>`;
  root.querySelectorAll('.ws-face img').forEach(img=>{img.addEventListener('error',()=>img.remove());if(img.complete&&!img.naturalWidth)img.remove();});
  root.querySelectorAll('[data-word]').forEach(button=>button.addEventListener('click',()=>playWord(button.dataset.word)));
  root.querySelector('[data-reopen]')?.addEventListener('click',open);
  root.querySelector('[data-hint]')?.addEventListener('click',()=>act({type:'hint'}));
  root.querySelector('[data-next]')?.addEventListener('click',()=>{stopAudio();act({type:'next',...(expertAvailable?{mode:'normal'}:{})});});
  root.querySelector('[data-expert]')?.addEventListener('click',()=>{stopAudio();act({type:'next',mode:'expert'});});
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
  try{const [,value,pictures]=await Promise.all([loadStyle(),request({type:'open'}),import('../word-blocks/art.mjs')]);if(dead)return;accept(value);art=pictures;
   error=false;celebrate=false;hint=null;anchor=null;hover=null;render();onChange(value);
  }catch{error=true;render();}finally{busy=false;}
 }
 render();open();event('word-search-open');addEventListener('family-audio-stop',stopAudio);
 async function refreshDay(){if(dead||busy||pending||!daily||storyDate||document.hidden)return;try{const value=await request();if(!dead&&!busy&&value.profile.revision>=profile.revision&&value.daily?.date!==daily.date){accept(value);hint=null;celebrate=false;render();}}catch{}}
 const timer=setInterval(refreshDay,30000);addEventListener('visibilitychange',refreshDay);
 const dispose=()=>{clearInterval(timer);removeEventListener('visibilitychange',refreshDay);dead=true;stopAudio();pointer=null;document.documentElement.classList.remove('ws-open');removeEventListener('family-audio-stop',stopAudio);};
 dispose.prepareLeave=async()=>{await pending;};dispose.busy=()=>pending!==null;return dispose;
}
