// The Book: today's chapter as a full-screen, narrated picture book, opened once a day before the games.
// Every page is a picture composed from the chapter's picture library; turning a page (tap anywhere,
// swipe, or on its own after the narration and a pause) plays that page's narration straight away.
// The first tap on the cover unlocks sound for the session; one <audio> element is reused for every line.
// Learning happens inside the story ("beats"): letter keys, stepping-stones, counting, magic words he
// reads to make things happen, spells, sharing, and the NO! beat where a friend wants to do something wrong.
import {layoutActors,layoutTrain,coverBand} from './book-scene.mjs';
import {IDLE_REPEAT_MS,IDLE_REPEATS,shuffle} from './word-break.mjs';
import {fetchJSON} from './save-request.mjs';
import {listenOnce,recognise,listenAvailable,checkMic,micState} from './listen.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const THROW_X=0.44,AUTO_ADVANCE_MS=2200,TAP_GUARD_MS=700,LINE_GAP_MS=320;
export async function loadBook(player,{preview=false,date=''}={}){try{return await fetchJSON(`/api/book${preview?'/preview':''}?player=${encodeURIComponent(player)}${date?'&date='+date:''}`,{},6000);}catch{return null;}}
export function lastPlace(player,storage=globalThis.localStorage){try{const v=JSON.parse(storage.getItem('family-games-last:'+player)||'null');return v&&Date.now()-v.at<36*36e5&&typeof v.hash==='string'?v.hash:'';}catch{return '';}}
export function rememberPlace(player,hash,storage=globalThis.localStorage){try{if(hash&&hash!=='#')storage.setItem('family-games-last:'+player,JSON.stringify({hash,at:Date.now()}));}catch{}}
function post(player,body,keepalive=false){return fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive}).then(r=>r.ok?r.json():null).catch(()=>null);}
// Test hook: every play() attempt is recorded (clip, page, whether the browser allowed it).
const audit=globalThis.__bookAudio||(globalThis.__bookAudio=[]);
export function mountBook(main,{player,book,event=()=>{},onDone=()=>{},preview=false,startPage=0}){
 const ch=book.chapter,date=book.date,art=ch.art||{backgrounds:{},actors:{},props:{}},early=ch.level==='early';
 const keys=new Set(book.collection?.keys||[]);
 let page=preview?0:Math.min(Math.max(0,book.progress?.page||0),ch.pages.length-1),alive=true,finished=false,turn=0,timers=[],shownAt=0,canNext=false,autoTimer=null;
 const later=(fn,ms)=>{const t=setTimeout(()=>{if(alive)fn();},ms);timers.push(t);return t;};
 const clearTimers=()=>{timers.forEach(clearTimeout);timers=[];};
 const root=document.createElement('section');root.className=`bk bk-${ch.level}`;root.setAttribute('aria-label',`${ch.name}'s book`);
 root.innerHTML=`<div class="bk-view"></div><div class="bk-chrome"><button class="bk-exit" type="button" aria-label="Back to the games">✕</button><button class="bk-hear" type="button" aria-label="Hear it again">🔊</button>${early?'<div class="bk-keys" aria-hidden="true"></div>':''}<div class="bk-dots" aria-hidden="true"></div><div class="bk-tapnext" aria-hidden="true">👉</div>${preview?'<div class="bk-preview-bar">PREVIEW · nothing is saved</div>':''}</div>`;
 main.innerHTML='';main.append(root);
 const view=root.querySelector('.bk-view'),dots=root.querySelector('.bk-dots'),tapnext=root.querySelector('.bk-tapnext');
 // ---- listening: is there a recogniser on this machine, and is the microphone allowed? (never asks here) ----
 let canListen=false;void listenAvailable().then(v=>{canListen=v;});void checkMic();
 // ---- sound: one element, reused (unlocked by the first tap on the cover) ----
 const audio=new Audio();audio.preload='auto';let current=null;
 function deviceSpeak(text){return new Promise(res=>{try{const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.onend=u.onerror=()=>res();speechSynthesis.speak(u);setTimeout(res,Math.max(2500,text.length*85));}catch{res();}});}
 function stopSound(){try{audio.pause();}catch{}try{speechSynthesis.cancel();}catch{}current?.();current=null;}
 function speak(line){
  return new Promise(resolve=>{
   if(!alive||!line?.text)return resolve();
   stopSound();let done=false;const my=turn;
   const fin=()=>{if(done)return;done=true;clearTimeout(t);talking(null);if(current===fin)current=null;resolve();};
   current=fin;talking(line.who);
   const t=setTimeout(fin,Math.max(4000,line.text.length*140));
   if(!line.clip){deviceSpeak(line.text).then(fin);return;}
   audio.onended=fin;audio.onerror=()=>{if(!done){audit.push({clip:line.clip,page,ok:false,err:'load'});deviceSpeak(line.text).then(fin);}};
   audio.src='/book-voice/'+line.clip;
   let p;try{p=audio.play();}catch(e){p=Promise.reject(e);}
   // Interrupted by the next line (AbortError) just ends this one; only a refusal falls back to the device voice.
   Promise.resolve(p).then(()=>audit.push({clip:line.clip,page,turn:my,ok:true,at:Date.now()}),e=>{const err=String(e?.name||e);audit.push({clip:line.clip,page,turn:my,ok:false,err});if(done)return;if(err==='AbortError')fin();else deviceSpeak(line.text).then(fin);});
  });
 }
 // A short breath between lines, like a person reading aloud.
 async function speakAll(lines,my){let first=true;for(const l of lines||[]){if(!alive||my!==turn)return false;if(!first)await new Promise(r=>later(r,LINE_GAP_MS));first=false;if(!alive||my!==turn)return false;await speak(l);}return alive&&my===turn;}
 function preload(i){const p=ch.pages[i];if(!p)return;const files=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(v.clip)files.add(v.clip);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};walk(p);
  for(const f of files)fetch('/book-voice/'+f).catch(()=>{});const b=art.backgrounds[p.scene?.bg];if(b){const im=new Image();im.src=b.url;}}
 function talking(who){view.querySelectorAll('.bk-actor').forEach(a=>a.classList.toggle('talking',!!who&&a.dataset.id===who));}
 // ---- pictures ----
 function actorsHTML(scene,{ground=0.93,scale=1,maxHeight=1,avoid=null}={}){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight;
  // A train in the picture always carries the friends (all aboard!).
  if((scene.ride||scene.props.some(p=>p.id==='train'))&&art.props.train?.seats){return trainHTML(scene,W,H);}
  return layoutActors(scene.actors,art,{width:W,height:H,ground,scale,maxHeight,avoid}).map((a,i)=>{const P=art.actors[a.id].poses[a.pose];
   return `<div class="bk-actor${P.fly||a.pose==='fly'?' fly':''}" data-id="${esc(a.id)}" data-pose="${esc(a.pose)}" style="left:${(a.left*100).toFixed(2)}%;width:${(a.width*100).toFixed(2)}%;height:${(a.height*100).toFixed(2)}%;bottom:${(a.bottom*100).toFixed(2)}%;--from:${a.left+a.width/2<0.5?-40:40}vw;animation-delay:${i*0.15}s"><div style="animation-delay:${-i*0.7}s;animation-duration:${(2.2+i*0.37).toFixed(2)}s"><img src="${esc(P.url)}" alt="${esc(art.actors[a.id].name)}"></div></div>`;}).join('');
 }
 function trainHTML(scene,W,H){
  const T=art.props.train,L=layoutTrain(scene.actors,art,{width:W,height:H});
  if(L){
   // Wagons repeat so every friend has his own; each is drawn after its rider (the front wall hides only his legs).
   const t=L.train,pc=v=>(v*100).toFixed(3)+'%';
   const piece=p=>{const span=p.src[1]-p.src[0];return `<div class="bk-car ${p.kind}" style="left:${pc((p.left-t.left)/t.width)};width:${pc(p.width/t.width)}"><img src="${esc(T.url)}" alt="" style="width:${pc(1/span)};margin-left:${pc(-p.src[0]/span)}"></div>`;};
   const rider=r=>{const P=art.actors[r.id].poses[r.pose]||Object.values(art.actors[r.id].poses)[0];
    return `<div class="bk-actor rider" data-id="${esc(r.id)}" data-pose="${esc(r.pose)}" style="left:${pc((r.left-t.left)/t.width)};width:${pc(r.width/t.width)};height:${pc(r.height/t.height)};bottom:${pc((r.bottom-t.bottom)/t.height)}"><div><img src="${esc(P.url)}" alt="${esc(art.actors[r.id].name)}"></div></div>`;};
   const inner=L.parts.map(p=>p.kind==='wagon'?(L.riders.find(r=>r.wagon===p.i)?rider(L.riders.find(r=>r.wagon===p.i)):'')+piece(p):piece(p)).join('');
   return `<div class="bk-prop train cars" style="left:${pc(t.left)};width:${pc(t.width)};height:${pc(t.height)};bottom:${pc(t.bottom)}">${inner}</div>`;
  }
  const h=Math.min(T.h*1.2,0.4),w=h*T.ar*H/W,left=(1-w)/2,bottom=0.06;
  const seats=T.seats||[[.5,.4]];
  const riders=scene.actors.slice(0,seats.length).map((a,i)=>{const P=art.actors[a.id].poses[a.pose]||Object.values(art.actors[a.id].poses)[0];const rh=h*0.8*Math.min(1,(art.actors[a.id].h||0.4)/0.6),rw=rh*P.ar*H/W,[sx,sy]=seats[i];
   return `<div class="bk-actor" data-id="${esc(a.id)}" style="left:${((left+sx*w-rw/2)*100).toFixed(2)}%;width:${(rw*100).toFixed(2)}%;height:${(rh*100).toFixed(2)}%;bottom:${((bottom+h*(1-sy))*100).toFixed(2)}%"><div><img src="${esc(P.url)}" alt=""></div></div>`;}).join('');
  return riders+`<div class="bk-prop train" style="left:${(left*100).toFixed(2)}%;width:${(w*100).toFixed(2)}%;height:${(h*100).toFixed(2)}%;bottom:${(bottom*100).toFixed(2)}%"><img src="${esc(T.url)}" alt="the train"></div>`;
 }
 function propsHTML(scene,{ground=0.93,play=false}={}){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight;
  // On a page where he plays with a ball, the only ball is the one he kicks or throws.
  return scene.props.filter(p=>(p.id!=='train'||!art.props.train?.seats)&&!(play&&p.id==='ball')).map((p,i)=>{const P=art.props[p.id];if(!P)return '';const h=P.h,w=h*P.ar*H/W;const x=[0.8,0.12,0.62][i%3]-w/2;
   return `<div class="bk-prop" style="left:${(x*100).toFixed(2)}%;width:${(w*100).toFixed(2)}%;height:${(h*100).toFixed(2)}%;bottom:${((1-ground)*100).toFixed(2)}%"><img src="${esc(P.url)}" alt=""></div>`;}).join('');
 }
 function fxHTML(fx,burst=false){
  const set={sparkles:'✨',stars:'⭐',confetti:'🎉',hearts:'💛',bubbles:'🫧'}[fx];if(!set)return '<div class="bk-fx"></div>';
  const n=burst?18:10;return `<div class="bk-fx${burst?' burst':''}">${Array.from({length:n},(_,i)=>`<i style="left:${burst?50:(8+Math.random()*84).toFixed(1)}%;top:${burst?45:(6+Math.random()*60).toFixed(1)}%;font-size:${(18+Math.random()*26).toFixed(0)}px;animation-delay:${(Math.random()*(burst?0.2:2.4)).toFixed(2)}s;--dx:${((Math.random()-.5)*80).toFixed(0)}vw;--dy:${((Math.random()-.5)*70).toFixed(0)}vh">${set}</i>`).join('')}</div>`;
 }
 function burst(fx='sparkles'){view.querySelector('.bk-page')?.insertAdjacentHTML('beforeend',fxHTML(fx,true));view.querySelectorAll('.bk-actor').forEach(a=>{a.classList.remove('hop');void a.offsetWidth;a.classList.add('hop');});}
 function cheer(){const pg=ch.pages[page];if(!pg)return;for(const el of view.querySelectorAll('.bk-actor')){const A=art.actors[el.dataset.id];const P=A?.poses.cheer||A?.poses.happy;if(P)el.querySelector('img').src=P.url;}}
 function renderDots(){dots.innerHTML=ch.pages.map((_,i)=>`<i class="${i<page?'done':i===page?'now':''}"></i>`).join('');const k=root.querySelector('.bk-keys');if(k)k.innerHTML=[...keys].map(l=>`<b>🔑${esc(l)}</b>`).join('');}
 function setNext(on){canNext=on;tapnext.classList.toggle('on',on);}
 // ---- navigation: tap anywhere / swipe; each turn speaks the new page at once ----
 let touchX=null;
 root.addEventListener('pointerdown',e=>{touchX=e.clientX;},{passive:true});
 root.addEventListener('pointerup',e=>{
  if(e.target.closest('button'))return;
  const dx=touchX===null?0:e.clientX-touchX;touchX=null;
  if(Date.now()-shownAt<TAP_GUARD_MS||page<0)return;
  if(dx>60&&page>0){go(page-1,{back:true});return;}
  if(canNext)go(page+1);
 });
 root.querySelector('.bk-exit').onclick=()=>{document.getElementById('home')?.click();};
 root.querySelector('.bk-hear').onclick=()=>{if(page>=0)replay();};
 // Parallax: the picture and the characters shift a little, in opposite directions, with the finger or the tilt.
 const parallax=(x,y)=>{const pg=view.querySelector('.bk-page:last-child');if(!pg||matchMedia('(prefers-reduced-motion: reduce)').matches)return;pg.style.setProperty('--px',x.toFixed(3));pg.style.setProperty('--py',y.toFixed(3));};
 root.addEventListener('pointermove',e=>parallax(e.clientX/innerWidth-.5,e.clientY/innerHeight-.5),{passive:true});
 const tilt=e=>{if(e.gamma!=null)parallax(Math.max(-1,Math.min(1,e.gamma/30))/2,Math.max(-1,Math.min(1,(e.beta-45)/30))/2);};addEventListener('deviceorientation',tilt);
 function page_(){return ch.pages[page];}
 // Where the characters may stand on this page so the page's words, buttons and play things never cover them.
 function stage(p,beat){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight,wide=W>H*1.05,kind=p.beat?.kind;
  const ground=beat?0.64:0.93,scale=beat?0.72:1;
  // The top band belongs to the page's words: a beat's board, letter or pizza (30%), a magic word (34%), a caption (14%).
  const maxHeight=ground-(beat?0.30:p.magic?0.34:p.caption?0.15:0.05);
  // Bands the characters step out of: the goal (keeper) and the ball's column, the things he counts or shares,
  // the big letter a friend teaches, and the spot where he holds the ball to throw.
  const ball=Math.max(56,Math.min(W,H)*0.16)/W,mid=(a,b)=>[a,b];let avoid=null;
  if(p.action?.kind==='kick'||kind==='kick-letter'){if(wide){const g=art.backgrounds[p.scene.bg]?.goal||[0.38,0.3,0.24,0.17];const [a,b]=coverBand(g,{width:W,height:H});avoid=[Math.min(a,0.5-ball)-0.04,Math.max(b,0.5+ball)+0.04];}else avoid=mid(0.5-ball*0.75,0.5+ball*0.75);}
  else if(p.action?.kind==='throw')avoid=[THROW_X-ball*0.6,THROW_X+ball*0.6];
  else if(wide&&['count','share'].includes(kind))avoid=[0.26,0.74];
  else if(wide&&kind==='teach-letter')avoid=[0.5-Math.min(W,H)*0.13/W,0.5+Math.min(W,H)*0.13/W];
  return {ground,scale,maxHeight,avoid};
 }
 function pageFrame(p,{beat=false}={}){
  const b=art.backgrounds[p.scene.bg];
  const st=stage(p,beat),{ground,scale}=st;
  const cap=p.caption&&!p.magic&&!(p.beat&&['teach-letter'].includes(p.beat.kind))?`<button class="bk-caption" type="button">${esc(p.caption)}</button>`:'';
  view.querySelector('.bk-page')?.classList.add('out');
  const old=view.querySelector('.bk-page');if(old)setTimeout(()=>old.remove(),350);
  const el=document.createElement('div');el.className='bk-page';
  el.innerHTML=`${b?`<img class="bk-bg" src="${esc(b.url)}" alt="">`:''}<div class="bk-layer">${propsHTML(p.scene,{ground,play:!!p.action||p.beat?.kind==='kick-letter'})}${actorsHTML(p.scene,st)}</div>${fxHTML(p.scene.fx)}${cap}<div class="bk-play"></div>`;
  view.append(el);
  el.querySelector('.bk-caption')?.addEventListener('click',()=>{const l=(p.say||[]).find(x=>x.text.toLowerCase().includes(p.caption.toLowerCase()));if(l)void speak(l);});
  return el;
 }
 function replay(){const p=page_();const my=++turn;void speakAll(p.say,my);}
 function cover(){
  page=-1;const p=ch.pages[0],b=art.backgrounds[ch.cover?.scene?.bg||p.scene.bg];
  const hero=p.scene.actors.find(a=>a.id===player)||p.scene.actors[0];const H=hero&&art.actors[hero.id]?.poses[hero.pose];
  view.innerHTML=`<div class="bk-page">${b?`<img class="bk-bg" src="${esc(b.url)}" alt="">`:''}<div class="bk-cover"><div class="card"><div class="kicker">${esc(ch.name)}'s Book · Chapter ${esc(ch.number)}</div><h1>${esc(ch.title)}</h1>${H?`<img src="${esc(H.url)}" alt="" style="height:min(22vh,180px)">`:''}<br><button class="bk-open" type="button" aria-label="Open the book">📖</button></div></div></div>`;
  dots.innerHTML='';renderDots();
  view.querySelector('.bk-open').onclick=async e=>{
   e.currentTarget.disabled=true;if(!preview)event('book_open',`${date}:${page}`);
   // This tap is the user gesture that unlocks sound for the whole session.
   const start=preview?Math.min(Math.max(0,startPage|0),ch.pages.length-1):book.progress?.page?Math.min(book.progress.page,ch.pages.length-1):0;
   await speak(ch.cover?.line);if(alive)go(start);
  };
  preload(0);
 }
 function go(n,{back=false}={}){
  if(!alive)return;clearTimers();stopSound();setNext(false);
  if(n>=ch.pages.length)return void ending();
  page=Math.max(0,n);if(!preview&&!back)void post(player,{type:'page',date,page});
  renderDots();shownAt=Date.now();const my=++turn;audit.push({page,shown:shownAt});
  const p=page_();preload(page+1);
  if(p.kind==='beat')return void runBeat(p,my);
  const el=pageFrame(p);
  (async()=>{
   if(!await speakAll(p.say,my))return;
   if(p.action){await act(el,p,my);if(my!==turn)return;}
   if(p.magic){await magic(el,p,my);if(my!==turn)return;}
   setNext(true);later(()=>{if(my===turn&&canNext)go(page+1);},AUTO_ADVANCE_MS);
  })();
 }
 // ---- he plays: actions that move the story; the narration reacts only after he acts ----
 function setPose(el,id,pose){const a=el.querySelector(`.bk-actor[data-id="${CSS.escape(id)}"]`),P=art.actors[id]?.poses[pose];if(a&&P){a.querySelector('img').src=P.url;a.dataset.pose=pose;}return a;}
 function rectOf(node){const r=node.getBoundingClientRect(),R=root.getBoundingClientRect();return {x:r.left-R.left,y:r.top-R.top,w:r.width,h:r.height};}
 // Where the goal is on screen: the picture's own goal (fractions of the image, which is drawn "cover").
 function goalRect(p){const g=art.backgrounds[p.scene.bg]?.goal||[0.38,0.3,0.24,0.17];const img=view.querySelector('.bk-page:last-child .bk-bg');
  const W=root.clientWidth,H=root.clientHeight,nw=img?.naturalWidth||1600,nh=img?.naturalHeight||1067,k=Math.max(W/nw,H/nh),dw=nw*k,dh=nh*k,ox=(W-dw)/2,oy=(H-dh)/2;
  return {x:ox+g[0]*dw,y:oy+g[1]*dh,w:g[2]*dw,h:g[3]*dh,drawn:!!art.backgrounds[p.scene.bg]?.goal};}
 function ballEl(el,{x,y,size,label}){const B=art.props.ball;const b=document.createElement('button');b.type='button';b.className='bk-ball';b.style.cssText=`left:${x-size/2}px;top:${y-size/2}px;width:${size}px;height:${size}px`;
  b.innerHTML=`${B?`<img src="${esc(B.url)}" alt="">`:'<span>⚽</span>'}${label?`<b>${esc(label)}</b>`:''}`;el.append(b);return b;}
 function flyTo(node,to,{ms=700,spin=720,scale=0.4,arc=0}={}){const f=rectOf(node),dx=to.x-(f.x+f.w/2),dy=to.y-(f.y+f.h/2);
  const anim=node.animate([{transform:'translate(0,0) rotate(0) scale(1)'},{transform:`translate(${dx/2}px,${dy/2-arc}px) rotate(${spin/2}deg) scale(${(1+scale)/2})`,offset:.5},{transform:`translate(${dx}px,${dy}px) rotate(${spin}deg) scale(${scale})`}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:ms,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});return anim.finished.catch(()=>{});}
 // Swipe or tap: resolves with the point he aimed at (a tap on the ball aims at the middle of the goal).
 function flick(node,my){return new Promise(res=>{let s=null;node.onpointerdown=e=>{s={x:e.clientX,y:e.clientY};node.setPointerCapture?.(e.pointerId);};
  node.onpointerup=e=>{if(my!==turn)return;const R=root.getBoundingClientRect();const d=s?{x:e.clientX-s.x,y:e.clientY-s.y}:{x:0,y:0};node.onpointerdown=node.onpointerup=null;res({dx:d.x,dy:d.y,x:e.clientX-R.left,y:e.clientY-R.top});};});}
 function keeperFor(el,p){const ids=p.scene.actors.map(a=>a.id).filter(id=>id!==player);const pick=ids.find(id=>art.actors[id]?.poses.dive)||ids.find(id=>id!=='dad')||ids[0];return pick;}
 // The keeper stands in the goal, ready and swaying (a friend who can dive, else any friend but Dad).
 function placeKeeper(el,p,g){const kp=keeperFor(el,p),k=kp&&el.querySelector(`.bk-actor[data-id="${CSS.escape(kp)}"]`);if(!k)return;
  setPose(el,kp,art.actors[kp].poses.idle?'idle':k.dataset.pose);const P=art.actors[kp].poses[k.dataset.pose];const h=g.h*1.3,w=h*P.ar,H=root.clientHeight;
  k.style.cssText+=`;left:${g.x+g.w/2-w/2}px;width:${w}px;height:${h}px;bottom:${H-(g.y+g.h)}px;animation:none`;k.classList.add('keeper-ready');}
 function goalFrame(el,g){if(g.drawn)return;el.insertAdjacentHTML('beforeend',`<div class="bk-goal" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"></div>`);}
 async function shoot(el,p,my,ball,aim){
  const g=goalRect(p),keeperId=keeperFor(el,p),kp=keeperId&&el.querySelector(`.bk-actor[data-id="${CSS.escape(keeperId)}"]`);
  setPose(el,player,'kick');
  const side=aim&&Math.abs(aim.dx)>30?Math.sign(aim.dx):(Math.random()<.5?-1:1),tx=g.x+g.w/2+side*g.w*0.28,ty=g.y+g.h*0.55;
  if(kp){kp.classList.add('keeper');setPose(el,keeperId,'dive');kp.animate([{transform:'translateX(0) rotate(0)'},{transform:`translateX(${-side*g.w*0.35}px) rotate(${-side*25}deg)`}],{duration:550,fill:'forwards',easing:'ease-out'});}
  await flyTo(ball,{x:tx,y:ty},{ms:650,scale:0.35,arc:40});if(my!==turn)return;
  el.insertAdjacentHTML('beforeend',`<div class="bk-net" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"></div><div class="bk-goaltext">GOAL!</div>`);
  burst('confetti');setPose(el,player,'cheer');for(const a of p.scene.actors)if(a.id!==keeperId)setPose(el,a.id,art.actors[a.id]?.poses.cheer?'cheer':art.actors[a.id]?.poses.happy?'happy':a.pose);
  await speak(ch.ui.goal);
 }
 async function act(el,p,my){
  const a=p.action,W=root.clientWidth,H=root.clientHeight,size=Math.max(56,Math.min(W,H)*0.16),started=Date.now();
  if(a.kind==='kick'){
   const g=goalRect(p);goalFrame(el,g);placeKeeper(el,p,g);
   const ball=ballEl(el,{x:W/2,y:H*0.82,size});ball.classList.add('pulse');
   const aim=await flick(ball,my);if(my!==turn)return;ball.classList.remove('pulse');
   await shoot(el,p,my,ball,aim);
  }else if(a.kind==='throw'){
   const fetcher=a.fetcher||p.scene.actors.map(x=>x.id).find(id=>id!==player&&id!=='dad');const f=fetcher&&el.querySelector(`.bk-actor[data-id="${CSS.escape(fetcher)}"]`);
   const ball=ballEl(el,{x:W*THROW_X,y:H*0.74,size:size*0.7});ball.classList.add('pulse');
   const aim=await flick(ball,my);if(my!==turn)return;ball.classList.remove('pulse');setPose(el,player,'throw');void speak(ch.ui.fetch);
   const to={x:Math.min(W*0.9,Math.max(W*0.55,W*0.75+aim.dx*0.3)),y:H*0.8};await flyTo(ball,to,{ms:900,scale:0.6,arc:H*0.35,spin:540});if(my!==turn)return;
   if(f){setPose(el,fetcher,'run');const fr=rectOf(f);await f.animate([{transform:'translateX(0)'},{transform:`translateX(${to.x-(fr.x+fr.w/2)}px)`}],{duration:900,easing:'ease-in-out',fill:'forwards'}).finished.catch(()=>{});
    if(my!==turn)return;ball.remove();setPose(el,fetcher,art.actors[fetcher].poses.happy?'happy':'idle');f.classList.add('hop');}
   burst('hearts');setPose(el,player,'cheer');
  }else if(a.kind==='drive'){
   const lever=document.createElement('button');lever.type='button';lever.className='bk-btn go';lever.textContent='🚂 GO!';el.append(lever);
   await new Promise(res=>{lever.onclick=()=>{lever.remove();res();};});if(my!==turn)return;void speak(ch.ui.go);
   const train=el.querySelectorAll('.bk-prop.train, .bk-layer > .bk-actor');const dx=W*0.9;
   el.insertAdjacentHTML('beforeend','<div class="bk-puffs"><i></i><i></i><i></i></div>');
   await Promise.all([...train].map(n=>n.animate([{translate:'0 0'},{translate:`${dx}px 0`}],{duration:2600,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{})));
  }
  if(my!==turn)return;if(!preview)event('book_action',`${a.kind}:${Date.now()-started}`);
  await speakAll(a.after,my);
 }
 // ---- say it aloud (push-to-talk) ----
 // Tap the word (or the letter), say it, and the world responds. One miss: "so close, once more". Two misses: the
 // word glows and the narrator says it; then whatever he says counts (he is echoing her). Never a scolding.
 // No recogniser, or the microphone blocked: the tap itself counts (and a blocked microphone shows a card once).
 const micUsable=()=>canListen&&!micState().blocked;let cardShown=false;
 function micCard(why){
  cardShown=true;const c=document.createElement('div');c.className='bk-card';
  const head=why==='no-mic'?"There's no microphone here.":why==='insecure'?'The microphone needs the secure address.':'Ask a grown-up to turn on the microphone.';
  c.innerHTML=`<div class="bk-card-in"><div class="bk-card-mic">🎤</div><h2>${esc(head)}</h2>
   <p class="grown">For grown-ups: in Chrome tap the icon left of the address, then <b>Permissions → Microphone → Allow</b> (or ⋮ → Settings → Site settings → Microphone). In the installed app: long-press its icon → <b>App info → Permissions → Microphone → Allow</b>. On a Chromebook: the icon in the address bar, or Settings → Privacy and security → Site settings → Microphone. Everything he says stays on this home computer and is never recorded.</p>
   <div class="bk-card-btns"><button class="bk-btn" type="button" data-a="tap">Tap instead 👆</button><button class="bk-btn" type="button" data-a="retry">Try again 🎤</button></div></div>`;
  view.querySelector('.bk-page:last-child')?.append(c);if(why!=='insecure'&&why!=='no-mic')void speak(ch.ui.askGrownUp);
  return new Promise(res=>c.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();c.remove();res(b.dataset.a);}));
 }
 function sayIt(btn,{target,kind,my,help=[],onDone}){
  let attempts=0,misses=0,busy=false,done=false;
  const badge=document.createElement('span');badge.className='bk-mic-badge';badge.setAttribute('aria-hidden','true');btn.append(badge);
  const paint=()=>{badge.textContent=micUsable()?'🎤':'';};paint();const paintTimer=setInterval(()=>{if(!alive||done)clearInterval(paintTimer);else paint();},1000);
  const finish=via=>{done=true;clearInterval(paintTimer);badge.remove();btn.classList.remove('listening','thinking');onDone({via,misses,attempts});};
  btn.onclick=e=>{e?.stopPropagation?.();if(done||busy||my!==turn)return;
   if(!micUsable()){
    if(canListen&&micState().blocked&&!cardShown){void micCard(micState().why).then(a=>{if(a==='tap'&&my===turn)finish('tap');});return;}
    return finish('tap');}
   busy=true;stopSound();attempts++;btn.classList.add('listening');
   // Called inside the tap: this is when the browser shows its permission prompt the first time.
   listenOnce({onLevel:v=>btn.style.setProperty('--lvl',v.toFixed(2))}).then(async({pcm,speech})=>{
    btn.classList.remove('listening');if(my!==turn||done)return void(busy=false);
    if(!speech){busy=false;await speak(ch.ui.listenNothing);return;}
    btn.classList.add('thinking');let r=null;try{r=await recognise({player,target,kind,attempt:attempts,preview,pcm});}catch{}
    btn.classList.remove('thinking');busy=false;if(my!==turn||done)return;
    if(preview&&r){el_heard(btn,r);}
    // If the recogniser is having a bad moment, he is never stuck: it counts.
    if(!r)return finish('tap');
    if(r.match)return finish('voice');
    if(misses>=2)return finish('echo');
    misses++;btn.classList.remove('soft-miss');void btn.offsetWidth;btn.classList.add('soft-miss');
    if(misses===1)await speak(ch.ui.listenAgain);
    else{btn.classList.add('glow');await speakAll(help,turn);if(my===turn)await speak(ch.ui.listenEcho);}
   },async err=>{btn.classList.remove('listening');busy=false;paint();if(my!==turn||done)return;
    const a=await micCard(micState().why||(err?.name==='NotFoundError'?'no-mic':'denied'));paint();if(a==='tap'&&my===turn)finish('tap');});
  };
  return {nudge:()=>micUsable()&&!done};
 }
 // Grown-ups' preview: show what the recogniser heard, to try it out.
 function el_heard(btn,r){const b=document.createElement('div');b.className='bk-heard';b.textContent=`heard: “${r.heard||'…'}” ${r.match?'✓':'✗'} (${r.ms} ms)`;btn.parentElement?.append(b);setTimeout(()=>b.remove(),4000);}
 // A magic word: the narrator goes quiet, the word glows on something in the picture, he reads it.
 function magic(el,p,my){
  return new Promise(resolve=>{
   const btn=document.createElement('button');btn.type='button';btn.className='bk-magic';btn.innerHTML=`<small>${esc(p.magic.object||'magic word')}</small>${esc(p.magic.word)}`;el.append(btn);
   const started=Date.now();let repeats=0,done=false;
   const nudge=()=>later(()=>{if(done||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(ch.ui.readIt);nudge();},IDLE_REPEAT_MS);
   // With a microphone, the word itself is the button he taps to read it aloud.
   void speak(ch.ui.readIt).then(async()=>{if(micUsable()&&!done&&my===turn)await speak(ch.ui.listenTap);nudge();});
   const respond=async({via,misses})=>{if(done)return;done=true;btn.classList.add('read');burst('sparkles');cheer();
    if(!preview){void post(player,{type:'result',date,page,result:{kind:'magic',misses,ms:Date.now()-started,via,...(via!=='echo'?{earned:{word:p.magic.word}}:{})}});event('book_magic',`${p.magic.word}:${via}`);}
    await speak(p.magic.read);if(my!==turn)return resolve();await speakAll(p.magic.after,my);resolve();};
   sayIt(btn,{target:{kind:'word',word:p.magic.word},kind:'magic',my,help:[p.magic.read],onDone:respond});
  });
 }
 function finishBeat(p,my,result){
  if(!preview){void post(player,{type:'result',date,page,result:{kind:p.beat.kind,misses:result.misses||0,ms:result.ms||0,...(result.via?{via:result.via}:{}),...(result.earned?{earned:result.earned}:{})}});event('book_beat',`${p.beat.kind}:${result.misses||0}`);}
  setNext(true);later(()=>{if(my===turn&&canNext)go(page+1);},1600);
 }
 // Buttons with the usual rules: wrong wiggles and says try again; two misses glow the right one.
 function choices(play,values,{cls='',answer,onRight,onWrong,label=v=>v,spokenWrong,prompt,my}){
  play.innerHTML='';let misses=0,done=false,repeats=0;
  const nudge=()=>later(()=>{if(done||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(prompt);nudge();},IDLE_REPEAT_MS);nudge();
  for(const v of values){const b=document.createElement('button');b.type='button';b.className=`bk-btn ${cls}`;b.textContent=label(v);b.dataset.v=v;
   b.onclick=()=>{if(done||my!==turn)return;
    if(String(v)===String(answer)){done=true;b.classList.add('right');onRight(misses);return;}
    misses++;b.classList.remove('wiggle');void b.offsetWidth;b.classList.add('wiggle');onWrong?.(misses);
    if(misses>=2){play.querySelector(`[data-v="${CSS.escape(String(answer))}"]`)?.classList.add('glow');void speak(prompt);}else void speak(spokenWrong||ch.ui.tryAgain);};
   play.append(b);}
 }
 async function runBeat(p,my){
  const el=pageFrame(p,{beat:true}),b=p.beat,play=el.querySelector('.bk-play'),started=Date.now();
  if(!await speakAll(p.say,my))return;
  const done=r=>finishBeat(p,my,{ms:Date.now()-started,...r});
  switch(b.kind){
   case 'teach-letter':{
    // The letter can be tapped at any moment; the friend finishes showing it first.
    const g=document.createElement('button');g.type='button';g.className='bk-glyph';g.textContent=b.letter;g.setAttribute('aria-label',`The letter ${b.letter}`);el.append(g);
    let tapped=false,shown=false;
    const finish=async(r={misses:0})=>{g.classList.add('tapped');burst('sparkles');await speak(b.tap);if(my===turn)done({misses:r.misses||0,...(r.via?{via:r.via}:{})});};
    g.onclick=()=>{if(tapped||my!==turn)return;tapped=true;if(shown)void finish();else g.classList.add('tapped');};
    if(!await speakAll(b.lines,my))return;shown=true;
    // With a microphone he says it: its sound, its name, or the friend's name ("Lll!", "L!", "Loona!").
    if(micUsable()){g.classList.remove('tapped');let said=false;
     sayIt(g,{target:{kind:'letter',letter:b.letter,names:[b.ownerName||art.actors[b.owner]?.name].filter(Boolean)},kind:'letter',my,help:[b.tap],onDone:r=>{said=true;void finish(r);}});
     await speak(ch.ui.sayLetter);
     let n=0;const again=()=>later(()=>{if(said||my!==turn||n>=IDLE_REPEATS)return;n++;void speak(ch.ui.sayLetter);again();},IDLE_REPEAT_MS);again();return;}
    if(tapped)return void finish();
    let repeats=0;const nudge=()=>later(()=>{if(tapped||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(b.tap);nudge();},IDLE_REPEAT_MS);nudge();
    return;}
   case 'stones':{
    await speak(b.spoken);if(my!==turn)return;
    play.innerHTML='';let found=0,misses=0,repeats=0;const nudge=()=>later(()=>{if(found>=b.need||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(b.spoken);nudge();},IDLE_REPEAT_MS);nudge();
    b.stones.forEach((l,i)=>{const s=document.createElement('button');s.type='button';s.className='bk-btn stone';s.textContent=l;s.style.transform=`translateY(${(i%2?-1:1)*1.5}vmin) rotate(${(i%3-1)*4}deg)`;
     s.onclick=async()=>{if(s.classList.contains('lit')||found>=b.need||my!==turn)return;
      if(l===b.letter){s.classList.add('lit');found++;view.querySelector('.bk-actor')?.classList.add('hop');void speak(b.tap);
       if(found>=b.need){await new Promise(r=>later(r,900));if(my!==turn)return;burst('stars');await speak(b.done);if(my!==turn)return;
        const earned=b.letter;keys.add(earned);renderDots();el.insertAdjacentHTML('beforeend',`<div class="bk-key-fly">🔑</div>`);done({misses,earned:{key:earned}});}}
      else{misses++;s.classList.remove('wiggle');void s.offsetWidth;s.classList.add('wiggle');void speak(b.notIt);if(misses>=2)[...play.children].find(x=>x.textContent===b.letter&&!x.classList.contains('lit'))?.classList.add('glow');}};
     play.append(s);});
    return;}
   case 'kick-letter':{
    const g=goalRect(p);goalFrame(el,g);placeKeeper(el,p,g);
    await speak(b.spoken);if(my!==turn)return;
    const W=root.clientWidth,H=root.clientHeight,size=Math.max(64,Math.min(W,H)*0.17);let misses=0,done_=false,repeats=0;
    const nudge=()=>later(()=>{if(done_||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(b.spoken);nudge();},IDLE_REPEAT_MS);nudge();
    const balls=b.balls.map((l,i)=>{const x=W*(0.5+(i-(b.balls.length-1)/2)*Math.min(0.26,0.8/b.balls.length)),bl=ballEl(el,{x,y:H*0.8,size,label:l});bl.dataset.v=l;return bl;});
    await new Promise(res=>{for(const bl of balls){let st=null;
     bl.onpointerdown=e=>{st={x:e.clientX,y:e.clientY};};
     bl.onpointerup=async e=>{if(done_||my!==turn)return;const aim={dx:st?e.clientX-st.x:0,dy:st?e.clientY-st.y:0};st=null;
      if(bl.dataset.v!==b.letter){misses++;bl.classList.remove('wiggle');void bl.offsetWidth;bl.classList.add('wiggle');void speak(b.notIt);if(misses>=2)balls.find(x=>x.dataset.v===b.letter)?.classList.add('glow');return;}
      done_=true;balls.filter(x=>x!==bl).forEach(x=>x.classList.add('used'));await shoot(el,p,my,bl,aim);res();};}});
    if(my!==turn)return;await speak(b.done);if(my!==turn)return;
    keys.add(b.letter);renderDots();el.insertAdjacentHTML('beforeend',`<div class="bk-key-fly">🔑</div>`);done({misses,earned:{key:b.letter}});
    return;}
   case 'count':{
    await speak(b.spoken);if(my!==turn)return;
    const box=document.createElement('div');box.className='bk-things';el.append(box);const P=art.props[b.thing];
    const spots=shuffle(Array.from({length:b.n},(_,i)=>i));let counted=0;
    for(let i=0;i<b.n;i++){const t=document.createElement('button');t.type='button';t.className='bk-thing';const k=spots[i];
     const cols=Math.ceil(Math.sqrt(b.n*1.6)),x=(k%cols+0.5)/cols*100+(Math.random()-.5)*6,y=(Math.floor(k/cols)+0.5)/Math.ceil(b.n/cols)*100+(Math.random()-.5)*8;
     t.style.cssText=`left:${x}%;top:${y}%;width:clamp(56px,13vmin,120px);height:clamp(56px,13vmin,120px);font-size:clamp(44px,10vmin,96px)`;
     t.innerHTML=P?`<img src="${esc(P.url)}" alt="">`:`<span>${esc(b.emoji)}</span>`;
     t.onclick=async()=>{if(t.dataset.n||my!==turn)return;counted++;t.dataset.n=counted;t.insertAdjacentHTML('beforeend',`<b>${counted}</b>`);t.classList.add('counted');await speak(ch.ui.numbers[String(counted)]);
      if(counted===b.n&&my===turn){await speak(b.ask);if(my!==turn)return;
       choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.ask,my,onRight:async m=>{burst('confetti');await speak(b.done);if(my===turn)done({misses:m});}});}};
     box.append(t);}
    return;}
   case 'signs':{
    await speak(b.spoken);if(my!==turn)return;
    choices(play,b.options,{cls:'sign word',answer:b.target,prompt:b.spoken,spokenWrong:b.notIt,my,onRight:async m=>{burst('sparkles');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
    return;}
   case 'spell':{
    await speak(b.spoken);if(my!==turn)return;
    const slots=document.createElement('div');slots.className='bk-slots';slots.innerHTML=b.answer.map(()=>'<span>&nbsp;</span>').join('')+`<em>${esc(b.mark)}</em>`;el.append(slots);
    play.innerHTML='';let step=0,misses=0,here=0;
    for(const w of b.tiles){const t=document.createElement('button');t.type='button';t.className='bk-btn word';t.textContent=w;
     t.onclick=async()=>{if(step>=b.answer.length||t.classList.contains('used')||my!==turn)return;
      if(w!==b.answer[step]){misses++;here++;t.classList.remove('wiggle');void t.offsetWidth;t.classList.add('wiggle');void speak(ch.ui.tryAgain);
       if(here>=2)[...play.children].find(x=>x.textContent===b.answer[step]&&!x.classList.contains('used'))?.classList.add('glow');return;}
      t.classList.add('used');[...play.children].forEach(x=>x.classList.remove('glow'));slots.children[step].textContent=w;step++;here=0;
      if(step===b.answer.length){burst('sparkles');cheer();await speak(b.done);if(my===turn)done({misses});}};
     play.append(t);}
    return;}
   case 'share':{
    await speak(b.spoken);if(my!==turn)return;
    const plates=document.createElement('div');plates.className='bk-plates';plates.innerHTML=Array.from({length:b.groups},()=>'<div class="bk-plate"></div>').join('');el.append(plates);
    const P=art.props.pizza;const pz=document.createElement('button');pz.type='button';pz.className='bk-pizza';pz.innerHTML=`${P?`<img src="${esc(P.url)}" alt="the pizza">`:'<span style="font-size:90px">🍕</span>'}<b>${b.total}</b>`;el.append(pz);
    // Each tap deals one round: a slice onto every plate (fair sharing, the way children do it).
    let dealt=0;pz.onclick=async()=>{if(dealt>=b.total||my!==turn)return;for(const plate of plates.children){if(dealt>=b.total)break;plate.insertAdjacentHTML('beforeend','<span>🍕</span>');dealt++;}pz.querySelector('b').textContent=b.total-dealt;
     if(dealt===b.total){pz.style.visibility='hidden';await speak(b.ask);if(my!==turn)return;
      choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.ask,my,onRight:async m=>{burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});}};
    return;}
   case 'score':{
    const board=document.createElement('div');board.className='bk-board';board.textContent=`${b.display} = ?`;el.append(board);
    await speak(b.spoken);if(my!==turn)return;
    choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.spoken,my,onRight:async m=>{board.textContent=`${b.display} = ${b.answer}`;burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
    return;}
   case 'no':return void noBeat(el,p,my,done);
  }
  done({misses:0});
 }
 // The NO! beat: a friend insists on something wrong and begs to do it. He says NO!, then fixes it.
 async function noBeat(el,p,my,done){
  const b=p.beat,play=el.querySelector('.bk-play');
  const board=document.createElement('div');board.className='bk-board';
  board.innerHTML=early?`<span>${esc(b.claim.text.replace(/!$/,''))}</span>`:`<span>${esc(b.display)}</span>`;
  if(early){const w=b.claim.text.split(' ')[0];board.innerHTML=`<span class="pic">${esc(w)}</span><span>→</span><span>${esc(b.wrong)}</span>`;}
  el.append(board);
  const who=el.querySelector(`.bk-actor[data-id="${CSS.escape(b.who||'')}"]`);
  await speak(b.claim);if(my!==turn)return;await speak(b.ask);if(my!==turn)return;
  const offer=async()=>{
   play.innerHTML='';const no=document.createElement('button');no.type='button';no.className='bk-btn no';no.textContent='NO!';
   const ok=document.createElement('button');ok.type='button';ok.className='bk-btn ok';ok.textContent='Okay…';play.append(no,ok);
   void speak(ch.ui.noPrompt);
   ok.onclick=async()=>{if(my!==turn)return;play.innerHTML='';board.classList.add('buzz');await speak(b.ifYes);board.classList.remove('buzz');if(my!==turn)return;await speak(b.ask);if(my===turn)offer();};
   no.onclick=async()=>{if(my!==turn)return;play.innerHTML='';burst('confetti');who?.classList.add('hop');await speak(b.caught);if(my!==turn)return;await speak(b.fixSpoken);if(my!==turn)return;
    choices(play,b.options,{cls:early?'key':'ball',answer:b.right,prompt:b.fixSpoken,my,onWrong:m=>{if(m===2)void speak(b.hint);},onRight:async m=>{
     board.innerHTML=early?`<span class="pic">${esc(b.claim.text.split(' ')[0])}</span><span>→</span><span>${esc(b.right)}</span>`:`<span>${esc(b.display.replace(/=.*$/,'= '+b.right))}</span>`;
     burst('stars');await speak(ch.ui.yes);if(my===turn)done({misses:m});}});};
  };
  offer();
 }
 async function ending(){
  const my=++turn;finished=true;setNext(false);
  if(!preview){void post(player,{type:'finish',date,page:ch.pages.length});event('book_finish',date);}
  const el=view.querySelector('.bk-page')||view;
  const q=ch.quest;
  el.insertAdjacentHTML('beforeend',`<div class="bk-quest">${q?`<h2>🗺️ A quest for you and Dad</h2><p>${esc(q.text.replace(/^A quest for you and Dad:\s*/,''))}</p>${q.hints?.length?`<div class="bk-hint"></div><button class="bk-btn bk-hintbtn" type="button">🔍 A hint, please</button>`:''}${q.dad?`<p class="bk-dadnote">${esc(q.dad)}</p>`:''}`:'<h2>The end, for today</h2>'}<button class="bk-btn bk-done" type="button">${preview?'Close':'Play games →'}</button></div>`);
  el.querySelector('.bk-quest .bk-done').onclick=()=>{stop();onDone({finished:true});};
  // Came back empty-handed? One hint picture at a time (things most homes have).
  let hint=0;const hb=el.querySelector('.bk-hintbtn');
  if(hb)hb.onclick=async()=>{const h=q.hints[hint++];if(!h)return;el.querySelector('.bk-hint').innerHTML=`<span class="pic">${esc(h.emoji)}</span><b>${esc(h.word)}</b>`;if(hint>=q.hints.length)hb.remove();if(!preview)event('book_hint',`${date}:${hint}`);await speak(h.line);};
  if(ch.quest)await speak(ch.quest);if(my===turn)await speak(ch.ui.nextTime);
 }
 function stop(){alive=false;clearTimers();stopSound();removeEventListener('deviceorientation',tilt);try{audio.removeAttribute('src');audio.load();}catch{}}
 if(!preview)void post(player,{type:'open',date,page});
 // Grown-ups' preview only: checks and dad can jump to a page.
 if(preview)globalThis.__bookGo=n=>go(n);
 cover();
 const dispose=()=>{if(!alive)return;if(!finished&&!preview){void post(player,{type:'leave',date,page:Math.max(0,page)},true);event('book_leave',`${date}:${page}`);}stop();root.remove();};
 dispose.book=true;
 return dispose;
}
