// The Book: today's chapter, opened once a day before the games (no menu, no choice to make).
// Page by page, always narrated; challenges use the shared word-break checkpoint; one page asks the
// child to catch the narrator's deliberate mistake. Finishing it lands him back where he was.
import {wordBreak,onceThisSession,IDLE_REPEAT_MS,IDLE_REPEATS} from './word-break.mjs';
import {fetchJSON} from './save-request.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const UI={mistakePrompt:'Uh oh. I think I made a mistake. Can you find it?',howTo:'Tap the part that is wrong.',notIt:'That part is right. Keep looking!',tryAgain:'Try again.'};
export const bare=t=>String(t).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
// Mistake taps: the wrong token is the only winner; everything else is "right, keep looking".
export function isWrongToken(token,mistake){return bare(token)===String(mistake.wrong);}
export async function loadBook(player){try{return await fetchJSON('/api/book?player='+encodeURIComponent(player),{},6000);}catch{return null;}}
export function lastPlace(player,storage=globalThis.localStorage){try{const v=JSON.parse(storage.getItem('family-games-last:'+player)||'null');return v&&Date.now()-v.at<36*36e5&&typeof v.hash==='string'?v.hash:'';}catch{return '';}}
export function rememberPlace(player,hash,storage=globalThis.localStorage){try{if(hash&&hash!=='#')storage.setItem('family-games-last:'+player,JSON.stringify({hash,at:Date.now()}));}catch{}}
function post(player,body,keepalive=false){return fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive}).then(r=>r.ok?r.json():null).catch(()=>null);}
export function mountBook(main,{player,book,event=()=>{},onDone=()=>{}}){
 const ch=book.chapter,date=book.date,clips=ch.voice?.clips||{};
 let page=Math.min(Math.max(0,book.progress?.page||0),ch.pages.length-1),audio=null,alive=true,finished=false,timers=[];
 const later=(fn,ms)=>{const t=setTimeout(()=>{if(alive)fn();},ms);timers.push(t);return t;};
 const clearTimers=()=>{timers.forEach(clearTimeout);timers=[];};
 // Narration: the chapter's own Kokoro clip, else the device voice. Resolves when the line ends.
 function speak(text){
  return new Promise(resolve=>{
   if(!alive||!text)return resolve();
   try{audio?.pause();}catch{}try{speechSynthesis.cancel();}catch{}
   const fallback=()=>{try{const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.onend=u.onerror=()=>resolve();speechSynthesis.speak(u);later(resolve,Math.max(2500,text.length*85));}catch{resolve();}};
   const file=clips[text];if(!file)return fallback();
   const a=new Audio('/book-voice/'+file);audio=a;let done=false;const end=()=>{if(!done){done=true;resolve();}};
   a.onended=end;a.onerror=()=>{if(!done){done=true;fallback();}};
   a.play().catch(()=>{if(!done){done=true;fallback();}});
   later(end,Math.max(4000,text.length*120));
  });
 }
 const say=(text,essential)=>{void speak(text);};
 function shell(inner,{nav=true}={}){
  main.innerHTML=`<section class="book book-${ch.level}" aria-label="${esc(ch.name)}'s book">${inner}${nav?`<div class="book-nav"><button class="book-hear" type="button" aria-label="Hear it again">🔊</button><div class="book-dots" aria-hidden="true">${ch.pages.map((_,i)=>`<i class="${i<page?'done':i===page?'now':''}"></i>`).join('')}</div><button class="book-next" type="button" aria-label="Next page" disabled>→</button></div>`:''}</section>`;
  return main.querySelector('.book');
 }
 const lineHTML=p=>p.lines.map((l,i)=>`<span class="book-line" data-i="${i}">${esc(l)}</span>`).join(' ');
 async function narrate(root,p){
  for(let i=0;i<p.lines.length&&alive;i++){const el=root.querySelector(`.book-line[data-i="${i}"]`);el?.classList.add('reading');await speak(p.lines[i]);el?.classList.remove('reading');}
 }
 function wireStory(root,p){
  const next=root.querySelector('.book-next');
  root.querySelector('.book-hear').onclick=()=>void narrate(root,p);
  root.querySelectorAll('.book-line').forEach(el=>el.onclick=()=>void speak(p.lines[Number(el.dataset.i)]));
  next.onclick=()=>go(page+1);
  const unlock=()=>{if(alive)next.disabled=false;};
  later(unlock,Math.max(3500,p.text.length*70));
  narrate(root,p).then(unlock);
 }
 function showStory(p){
  const teach=p.teach?`<div class="book-teach" aria-label="${esc(p.teach.word)} starts with ${esc(p.teach.letter)}"><span class="book-teach-pic">${esc(p.teach.picture)}</span><span class="book-teach-letter">${esc(p.teach.letter)}</span></div>`:'';
  const root=shell(`<div class="book-scene" aria-hidden="true">${esc(p.scene||ch.companion.emoji)}</div>${teach}<p class="book-text">${lineHTML(p)}</p>`);
  wireStory(root,p);
 }
 async function showChallenge(p){
  const root=shell(`<div class="book-scene" aria-hidden="true">${esc(ch.companion.emoji)}</div><p class="book-text">${lineHTML(p)}</p>`);
  root.querySelector('.book-hear').onclick=()=>void narrate(root,p);
  await narrate(root,p);if(!alive)return;
  const item={...p.item};if(item.kind==='math'&&item.display)item.picture=item.display;
  const started=Date.now(),open=wordBreak({player,item,speak:say,reason:'book'});
  const eyebrow=[...document.querySelectorAll('dialog.wb .wb-eyebrow')].at(-1);if(eyebrow)eyebrow.textContent='STORY CHALLENGE';
  const r=await open;if(!alive)return;
  void post(player,{type:'result',date,page,result:{kind:p.item.kind,misses:r.misses,ms:Date.now()-started}});
  event('book_challenge',`${p.item.kind}:${r.misses}`);
  go(page+1);
 }
 async function showMistake(p){
  const m=p.mistake,early=ch.level==='early'&&Array.isArray(m.tokens);
  const text=early?`<p class="book-text">${lineHTML(p)}</p><div class="book-claim">${m.tokens.map(t=>`<button type="button" class="book-token big" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
   :`<p class="book-text tappable">${p.text.split(/\s+/).map(t=>`<button type="button" class="book-token" data-t="${esc(t)}">${esc(t)}</button>`).join(' ')}</p>`;
  const root=shell(`<div class="book-scene" aria-hidden="true">🔎${esc(ch.companion.emoji)}</div>${text}`);
  const next=root.querySelector('.book-next');next.hidden=true;
  let misses=0,hints=0,caught=false,repeats=0,idle=null;const started=Date.now();
  const prompt=()=>speak(UI.mistakePrompt);
  const nudge=()=>{clearTimeout(idle);if(caught||repeats>=IDLE_REPEATS)return;idle=later(()=>{repeats++;void prompt();nudge();},IDLE_REPEAT_MS);};
  root.querySelector('.book-hear').onclick=()=>{void prompt();nudge();};
  const tokens=[...root.querySelectorAll('.book-token')];tokens.forEach(b=>b.disabled=true);
  await narrate(root,p);
  if(!alive)return;
  await prompt();if(onceThisSession('book-mistake-how'))await speak(UI.howTo);
  tokens.forEach(b=>b.disabled=false);nudge();
  tokens.forEach(b=>b.onclick=async()=>{
   if(caught||!alive)return;nudge();
   if(isWrongToken(b.dataset.t,m)){
    caught=true;clearTimeout(idle);b.classList.add('caught');tokens.forEach(x=>x.classList.remove('glow'));
    event('book_mistake_caught',String(misses));
    await speak(m.caught);if(!alive)return;
    const r=await wordBreak({player,item:m.fix.kind==='math'&&m.fix.display?{...m.fix,picture:m.fix.display}:m.fix,speak:say,reason:'book-fix'});
    if(!alive)return;
    void post(player,{type:'result',date,page,result:{kind:'mistake',misses,hints,ms:Date.now()-started}});
    go(page+1);return;
   }
   misses++;b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');
   if(misses===2){hints++;await speak(m.hint);}else void speak(UI.notIt);
   if(misses>=4)tokens.filter(x=>isWrongToken(x.dataset.t,m)).forEach(x=>x.classList.add('glow'));
  });
 }
 function cover(){
  const root=shell(`<div class="book-cover"><div class="book-companion" aria-hidden="true">${esc(ch.companion.emoji)}</div><p class="book-kicker">${esc(ch.name)}'s Book · Chapter ${ch.number}</p><h1>${esc(ch.title)}</h1><button class="book-open" type="button" aria-label="Open the book">📖</button></div>`,{nav:false});
  root.querySelector('.book-open').onclick=async()=>{
   // The tap also unlocks audio on tablets.
   root.querySelector('.book-open').disabled=true;event('book_open',`${date}:${page}`);
   await speak(ch.cover);if(alive)show();
  };
 }
 function show(){
  clearTimers();if(!alive)return;window.scrollTo(0,0);
  const p=ch.pages[page];
  if(p.kind==='challenge')return void showChallenge(p);
  if(p.kind==='mistake')return void showMistake(p);
  showStory(p);
 }
 function go(n){
  if(!alive)return;
  if(n>=ch.pages.length){finished=true;void post(player,{type:'finish',date,page:ch.pages.length});event('book_finish',date);stop();onDone({finished:true});return;}
  page=n;void post(player,{type:'page',date,page});show();
 }
 function stop(){alive=false;clearTimers();try{audio?.pause();}catch{}try{speechSynthesis.cancel();}catch{}document.querySelectorAll('dialog.wb').forEach(d=>{try{d.close();}catch{}d.remove();});}
 void post(player,{type:'open',date,page});
 cover();
 const dispose=()=>{if(!alive)return;if(!finished){void post(player,{type:'leave',date,page},true);event('book_leave',`${date}:${page}`);}stop();};
 dispose.book=true;
 return dispose;
}
