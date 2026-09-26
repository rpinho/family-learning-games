// The Book: today's chapter as a full-screen, narrated picture book, opened once a day before the games.
// Every page is a picture composed from the chapter's picture library; turning a page (tap anywhere,
// swipe, or on its own after the narration and a pause) plays that page's narration straight away.
// The first tap on the cover unlocks sound for the session; one <audio> element is reused for every line.
// Learning happens inside the story ("beats"): letter keys, stepping-stones, counting, magic words he
// reads to make things happen, spells, sharing, and the NO! beat where a friend wants to do something wrong.
import {layoutActors} from './book-scene.mjs';
import {IDLE_REPEAT_MS,IDLE_REPEATS,shuffle} from './word-break.mjs';
import {fetchJSON} from './save-request.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const AUTO_ADVANCE_MS=2200,TAP_GUARD_MS=700;
export async function loadBook(player,{preview=false,date=''}={}){try{return await fetchJSON(`/api/book${preview?'/preview':''}?player=${encodeURIComponent(player)}${date?'&date='+date:''}`,{},6000);}catch{return null;}}
export function lastPlace(player,storage=globalThis.localStorage){try{const v=JSON.parse(storage.getItem('family-games-last:'+player)||'null');return v&&Date.now()-v.at<36*36e5&&typeof v.hash==='string'?v.hash:'';}catch{return '';}}
export function rememberPlace(player,hash,storage=globalThis.localStorage){try{if(hash&&hash!=='#')storage.setItem('family-games-last:'+player,JSON.stringify({hash,at:Date.now()}));}catch{}}
function post(player,body,keepalive=false){return fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive}).then(r=>r.ok?r.json():null).catch(()=>null);}
// Test hook: every play() attempt is recorded (clip, page, whether the browser allowed it).
const audit=globalThis.__bookAudio||(globalThis.__bookAudio=[]);
export function mountBook(main,{player,book,event=()=>{},onDone=()=>{},preview=false}){
 const ch=book.chapter,date=book.date,art=ch.art||{backgrounds:{},actors:{},props:{}},early=ch.level==='early';
 const keys=new Set(book.collection?.keys||[]);
 let page=preview?0:Math.min(Math.max(0,book.progress?.page||0),ch.pages.length-1),alive=true,finished=false,turn=0,timers=[],shownAt=0,canNext=false,autoTimer=null;
 const later=(fn,ms)=>{const t=setTimeout(()=>{if(alive)fn();},ms);timers.push(t);return t;};
 const clearTimers=()=>{timers.forEach(clearTimeout);timers=[];};
 const root=document.createElement('section');root.className=`bk bk-${ch.level}`;root.setAttribute('aria-label',`${ch.name}'s book`);
 root.innerHTML=`<div class="bk-view"></div><div class="bk-chrome"><button class="bk-exit" type="button" aria-label="Back to the games">✕</button><button class="bk-hear" type="button" aria-label="Hear it again">🔊</button>${early?'<div class="bk-keys" aria-hidden="true"></div>':''}<div class="bk-dots" aria-hidden="true"></div><div class="bk-tapnext" aria-hidden="true">👉</div>${preview?'<div class="bk-preview-bar">PREVIEW · nothing is saved</div>':''}</div>`;
 main.innerHTML='';main.append(root);
 const view=root.querySelector('.bk-view'),dots=root.querySelector('.bk-dots'),tapnext=root.querySelector('.bk-tapnext');
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
   Promise.resolve(p).then(()=>audit.push({clip:line.clip,page,turn:my,ok:true,at:Date.now()}),e=>{audit.push({clip:line.clip,page,turn:my,ok:false,err:String(e?.name||e)});if(!done)deviceSpeak(line.text).then(fin);});
  });
 }
 async function speakAll(lines,my){for(const l of lines||[]){if(!alive||my!==turn)return false;await speak(l);}return alive&&my===turn;}
 function preload(i){const p=ch.pages[i];if(!p)return;const files=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(v.clip)files.add(v.clip);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};walk(p);
  for(const f of files)fetch('/book-voice/'+f).catch(()=>{});const b=art.backgrounds[p.scene?.bg];if(b){const im=new Image();im.src=b.url;}}
 function talking(who){view.querySelectorAll('.bk-actor').forEach(a=>a.classList.toggle('talking',!!who&&a.dataset.id===who));}
 // ---- pictures ----
 function actorsHTML(scene,{ground=0.93,scale=1}={}){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight;
  // A train in the picture always carries the friends (all aboard!).
  if((scene.ride||scene.props.some(p=>p.id==='train'))&&art.props.train?.seats){return trainHTML(scene,W,H);}
  return layoutActors(scene.actors,art,{width:W,height:H,ground,scale}).map((a,i)=>{const P=art.actors[a.id].poses[a.pose];
   return `<div class="bk-actor${P.fly||a.pose==='fly'?' fly':''}" data-id="${esc(a.id)}" style="left:${(a.left*100).toFixed(2)}%;width:${(a.width*100).toFixed(2)}%;height:${(a.height*100).toFixed(2)}%;bottom:${(a.bottom*100).toFixed(2)}%;animation-delay:${i*0.12}s"><div style="animation-delay:${-i*0.7}s"><img src="${esc(P.url)}" alt="${esc(art.actors[a.id].name)}"></div></div>`;}).join('');
 }
 function trainHTML(scene,W,H){
  const T=art.props.train,h=Math.min(T.h*1.2,0.4),w=h*T.ar*H/W,left=(1-w)/2,bottom=0.06;
  const seats=T.seats||[[.5,.4]];
  const riders=scene.actors.slice(0,seats.length).map((a,i)=>{const P=art.actors[a.id].poses[a.pose]||Object.values(art.actors[a.id].poses)[0];const rh=h*0.62,rw=rh*P.ar*H/W,[sx,sy]=seats[i];
   return `<div class="bk-actor" data-id="${esc(a.id)}" style="left:${((left+sx*w-rw/2)*100).toFixed(2)}%;width:${(rw*100).toFixed(2)}%;height:${(rh*100).toFixed(2)}%;bottom:${((bottom+h*(1-sy))*100).toFixed(2)}%"><div><img src="${esc(P.url)}" alt=""></div></div>`;}).join('');
  return riders+`<div class="bk-prop train" style="left:${(left*100).toFixed(2)}%;width:${(w*100).toFixed(2)}%;height:${(h*100).toFixed(2)}%;bottom:${(bottom*100).toFixed(2)}%"><img src="${esc(T.url)}" alt="the train"></div>`;
 }
 function propsHTML(scene,{ground=0.93}={}){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight;
  return scene.props.filter(p=>p.id!=='train'||!art.props.train?.seats).map((p,i)=>{const P=art.props[p.id];if(!P)return '';const h=P.h,w=h*P.ar*H/W;const x=[0.8,0.12,0.62][i%3]-w/2;
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
 function page_(){return ch.pages[page];}
 function pageFrame(p,{beat=false}={}){
  const b=art.backgrounds[p.scene.bg];
  const ground=beat?0.64:0.93,scale=beat?0.72:1;
  const cap=p.caption&&!p.magic&&!(p.beat&&['teach-letter'].includes(p.beat.kind))?`<button class="bk-caption" type="button">${esc(p.caption)}</button>`:'';
  view.querySelector('.bk-page')?.classList.add('out');
  const old=view.querySelector('.bk-page');if(old)setTimeout(()=>old.remove(),350);
  const el=document.createElement('div');el.className='bk-page';
  el.innerHTML=`${b?`<img class="bk-bg" src="${esc(b.url)}" alt="">`:''}${propsHTML(p.scene,{ground})}${actorsHTML(p.scene,{ground,scale})}${fxHTML(p.scene.fx)}${cap}<div class="bk-play"></div>`;
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
   const start=book.progress?.page&&!preview?Math.min(book.progress.page,ch.pages.length-1):0;
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
   if(p.magic){await magic(el,p,my);if(my!==turn)return;}
   setNext(true);later(()=>{if(my===turn&&canNext)go(page+1);},AUTO_ADVANCE_MS);
  })();
 }
 // A magic word: the narrator goes quiet, the word glows on something in the picture, he reads it.
 function magic(el,p,my){
  return new Promise(resolve=>{
   const btn=document.createElement('button');btn.type='button';btn.className='bk-magic';btn.innerHTML=`<small>${esc(p.magic.object||'magic word')}</small>${esc(p.magic.word)}`;el.append(btn);
   const started=Date.now();let repeats=0,done=false;
   const nudge=()=>later(()=>{if(done||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(ch.ui.readIt);nudge();},IDLE_REPEAT_MS);
   void speak(ch.ui.readIt).then(nudge);
   btn.onclick=async()=>{if(done)return;done=true;btn.classList.add('read');burst('sparkles');cheer();
    if(!preview){void post(player,{type:'result',date,page,result:{kind:'magic',misses:0,ms:Date.now()-started,earned:{word:p.magic.word}}});event('book_magic',p.magic.word);}
    await speak(p.magic.read);if(my!==turn)return resolve();await speakAll(p.magic.after,my);resolve();};
  });
 }
 function finishBeat(p,my,result){
  if(!preview){void post(player,{type:'result',date,page,result:{kind:p.beat.kind,misses:result.misses||0,ms:result.ms||0,...(result.earned?{earned:result.earned}:{})}});event('book_beat',`${p.beat.kind}:${result.misses||0}`);}
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
    const finish=async()=>{g.classList.add('tapped');burst('sparkles');await speak(b.tap);if(my===turn)done({misses:0});};
    g.onclick=()=>{if(tapped||my!==turn)return;tapped=true;if(shown)void finish();else g.classList.add('tapped');};
    if(!await speakAll(b.lines,my))return;shown=true;
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
  el.insertAdjacentHTML('beforeend',`<div class="bk-quest">${ch.quest?`<h2>🗺️ A quest for you and Dad</h2><p>${esc(ch.quest.text.replace(/^A quest for you and Dad:\s*/,''))}</p>`:'<h2>The end, for today</h2>'}<button class="bk-btn" type="button">${preview?'Close':'Play games →'}</button></div>`);
  el.querySelector('.bk-quest .bk-btn').onclick=()=>{stop();onDone({finished:true});};
  if(ch.quest)await speak(ch.quest);if(my===turn)await speak(ch.ui.nextTime);
 }
 function stop(){alive=false;clearTimers();stopSound();try{audio.removeAttribute('src');audio.load();}catch{}}
 if(!preview)void post(player,{type:'open',date,page});
 cover();
 const dispose=()=>{if(!alive)return;if(!finished&&!preview){void post(player,{type:'leave',date,page:Math.max(0,page)},true);event('book_leave',`${date}:${page}`);}stop();root.remove();};
 dispose.book=true;
 return dispose;
}
