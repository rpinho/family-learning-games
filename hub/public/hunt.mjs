// A real-world hunt, after the day's chapter or from the home screen: a friend announces ONE thing to look for at
// home (things that start with a sound, OR the letter/word written somewhere), with no answer pictures: hints come
// one at a time behind a growing wait. A grown-up confirms what was really found (gate + count); zero means keep
// looking. A few a day, then "tomorrow". Words, lines and voices
// come from the household's private hunts file; this module only shows and plays them.
import {fetchJSON} from './save-request.mjs';
import {parentChallenge,parentAnswerMatches} from './menu-options.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CSS=`
.hunt{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#fff6dc,#f4d9a0 70%,#e8c07a);color:#2b2118;font-family:"Nunito","Trebuchet MS",system-ui,sans-serif;overflow:auto;padding:16px}
.hunt-card{max-width:min(760px,96vw);width:100%;text-align:center}
.hunt-top{display:flex;align-items:center;justify-content:center;gap:4vmin}
.hunt-friend{height:clamp(120px,28vmin,240px);animation:hunt-bob 2.4s ease-in-out infinite;filter:drop-shadow(0 8px 10px rgba(0,0,0,.2))}
.hunt-letter{font-weight:900;font-size:clamp(110px,30vmin,260px);line-height:1;color:#ffcf3a;-webkit-text-stroke:7px #7a4a00;paint-order:stroke;text-shadow:0 10px 24px rgba(0,0,0,.25);animation:hunt-pop .8s cubic-bezier(.3,1.6,.5,1) both}
.hunt-letter small{font-size:.5em;margin-left:.08em}
.hunt-word{font-weight:900;font-size:clamp(46px,11vmin,96px);color:#3a2200;background:#fffaf0;border-radius:20px;padding:.1em .5em;box-shadow:0 8px 20px rgba(0,0,0,.2);animation:hunt-pop .8s cubic-bezier(.3,1.6,.5,1) both}
.hunt-tip{font-size:clamp(18px,3.6vmin,26px);margin:.4em 0 .8em;font-weight:700}
.hunt-kinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:0 auto 14px}
.hunt-kind{background:rgba(255,255,255,.75);border-radius:20px;padding:12px 14px;box-shadow:0 6px 16px rgba(0,0,0,.12);text-align:left}
.hunt-kind h3{margin:.1em 0 .3em;font-size:clamp(18px,3.6vmin,26px)}
.hunt-kind .pics{font-size:clamp(30px,6.5vmin,46px);letter-spacing:.12em}
.hunt-kind p{margin:.2em 0;font-size:clamp(15px,2.8vmin,19px)}
.hunt-btn{font:inherit;font-weight:900;font-size:clamp(24px,5.5vmin,40px);border:0;border-radius:999px;padding:.35em 1.1em;margin:.25em;cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.2),0 10px 22px rgba(0,0,0,.2)}
.hunt-found{background:linear-gradient(#8ee07a,#3aa84a);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25);animation:hunt-glow 1.6s ease-in-out infinite}
.hunt-next{background:linear-gradient(#ffe9a8,#f0b848);color:#3a2200}
.hunt-close{background:#fffaf0;color:#3a2200;font-size:clamp(18px,4vmin,26px)}
.hunt-goal{font-size:clamp(24px,5.5vmin,40px);margin:.2em 0 .4em}.hunt-places{font-size:clamp(30px,6vmin,44px);letter-spacing:.2em;margin:.2em 0}.hunt-hint{font-size:clamp(26px,5.5vmin,40px);font-weight:900;min-height:1.2em}.hunt-hint .pic{font-size:1.4em}.hunt-hintbtn{background:#eaf4ff;color:#2b3a52;font-size:clamp(18px,4vmin,26px)}.hunt-hintbtn:disabled{opacity:.6}
.hunt-gate{position:fixed;inset:0;z-index:42;display:grid;place-items:center;background:rgba(20,26,40,.55)}.hunt-gate-in{background:#fffaf0;border-radius:20px;padding:18px 22px;max-width:min(460px,92vw);text-align:center}.hunt-gate-in input{font:inherit;font-size:22px;padding:.3em .5em;width:10em;text-align:center}.hunt-code{font-weight:900;font-size:24px;letter-spacing:.1em}.hunt-err{color:#b8322a;min-height:1em}.hunt-counts button,.hunt-gate-btns button{font:inherit;font-weight:900;font-size:20px;min-width:48px;min-height:48px;margin:4px;border-radius:12px;border:2px solid #c9a24a;background:#fff;cursor:pointer}
.hunt-count{margin:.3em 0;font-size:15px;color:#6a5a4a}.hunt-count button{font:inherit;font-weight:900;font-size:20px;min-width:44px;min-height:44px;margin:0 3px;border-radius:12px;border:2px solid #c9a24a;background:#fffaf0;cursor:pointer}
.hunt-count button.on{background:#ffd54a}
.hunt-mode{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:16px;margin-bottom:6px}.hunt-mode select{font:inherit;font-size:18px;min-height:44px;border-radius:12px;border:2px solid #c9a24a;background:#fffaf0;padding:0 10px}
.hunt-conf i{position:fixed;top:40%;left:50%;width:12px;height:16px;border-radius:3px;animation:hunt-conf 2.2s cubic-bezier(.2,.7,.3,1) forwards;z-index:41}
@keyframes hunt-bob{50%{transform:translateY(-8px) rotate(-2deg)}}@keyframes hunt-pop{from{transform:scale(.3);opacity:0}}
@keyframes hunt-glow{50%{box-shadow:0 6px 0 rgba(0,0,0,.2),0 0 0 14px rgba(120,220,110,.25)}}@keyframes hunt-conf{to{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}
@media (prefers-reduced-motion:reduce){.hunt *{animation:none!important}}`;
function style(){if(document.getElementById('hunt-css'))return;const s=document.createElement('style');s.id='hunt-css';s.textContent=CSS;document.head.append(s);}
// (?r= the newest letter-sound re-render, from the hunt's info: a re-made clip keeps its name, so the URL changes)
let voiceRev='';
export async function huntInfo(player){try{const r=await fetchJSON('/api/book/hunt?player='+encodeURIComponent(player),{},5000);if(r?.voiceRev)voiceRev=r.voiceRev;return r;}catch{return null;}}
function post(player,body){return fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.ok?r.json():null).catch(()=>null);}
export function mountHunt(main,{player,event=()=>{},onClose=()=>{location.hash='';}}){
 style();let alive=true;const audio=new Audio();
 const say=line=>new Promise(res=>{if(!alive||!line?.text)return res();const done=()=>res();const t=setTimeout(done,Math.max(3000,line.text.length*90));
  // Only its own clip speaks a line (never the device's voice); a line without one stays silent.
  if(!line.clip){clearTimeout(t);return res();}
  audio.src='/book-voice/'+line.clip+(voiceRev?'?r='+encodeURIComponent(voiceRev):'');audio.onended=()=>{clearTimeout(t);res();};audio.play().catch(()=>{clearTimeout(t);res();});});
 const sayAll=async lines=>{for(const l of lines){if(!alive)return;await say(l);}};
 const root=document.createElement('section');root.className='hunt';root.setAttribute('aria-label','A hunt at home');main.innerHTML='';main.append(root);
 async function show(){
  const info=await huntInfo(player);if(!alive)return;
  if(!info?.available){root.innerHTML=`<div class="hunt-card"><h2>No hunts yet.</h2><button class="hunt-btn hunt-close" type="button">← Back</button></div>`;root.querySelector('.hunt-close').onclick=close;return;}
  const {hunt:h,friend,date}=info;
  // Letter or word (a small choice for grown-ups and the child; remembered on this computer, per child).
  const pick=(info.modes||[]).length>1?`<label class="hunt-mode">Hunt for a <select aria-label="Hunt for">${info.modes.map(m=>`<option value="${m}"${m===info.mode?' selected':''}>${m==='letter'?'Letter':'Word'}</option>`).join('')}</select></label>`:'';
  const wireMode=()=>{const s=root.querySelector('.hunt-mode select');if(s)s.onchange=async()=>{audio.pause();await post(player,{type:'huntMode',mode:s.value});show();};};
  if(!h||info.left<=0){
   root.innerHTML=`<div class="hunt-card">${friend?.url?`<img class="hunt-friend" src="${esc(friend.url)}" alt="">`:''}<h2 style="font-size:clamp(26px,6vmin,44px)">${esc(info.tomorrow?.text||"Let's save the next one for tomorrow!")}</h2><button class="hunt-btn hunt-close" type="button">Back to the games →</button></div>`;
   root.querySelector('.hunt-card').insertAdjacentHTML('afterbegin',pick);wireMode();
   root.querySelector('.hunt-close').onclick=close;event('hunt_tomorrow','');void say(info.tomorrow);return;}
  const big=h.letter?`<div class="hunt-letter">${esc(h.letter)}<small>${esc(h.letter.toLowerCase())}</small></div>`:`<div class="hunt-word">${esc(h.word||h.title||'')}</div>`;
  const places=h.kind==='written'&&h.places?.length?`<p class="hunt-places" aria-hidden="true">${h.places.map(esc).join(' ')}</p>`:'';
  root.innerHTML=`<div class="hunt-card">${pick}<div class="hunt-top">${friend?.url?`<img class="hunt-friend" src="${esc(friend.url)}" alt="${esc(friend.name||'')}">`:''}${big}</div>
   <p class="hunt-tip">${esc(h.tip||'')}</p><h2 class="hunt-goal">${esc(h.goal?.text||'')}</h2>${places}
   <div class="hunt-hint" aria-live="polite"></div><button class="hunt-btn hunt-hintbtn" type="button" disabled>💡 Hint</button>
   <button class="hunt-btn hunt-found" type="button">We found them! 🎉</button>
   <button class="hunt-btn hunt-close" type="button">← Back</button></div>`;
  root.querySelector('.hunt-close').onclick=close;wireMode();
  void post(player,{type:'hunt',date,page:0,id:h.id,stage:'start'});event('hunt_start',h.id);
  // Hints: one at a time, and each one waits twice as long as the last (20 s, 40 s, 80 s...).
  let hi=0,wait=20,timer=null;const hb=root.querySelector('.hunt-hintbtn'),hints=h.hints||[];
  const arm=()=>{if(hi>=hints.length){hb.remove();return;}let left=wait;hb.disabled=true;hb.textContent=`💡 Hint in ${left}s`;clearInterval(timer);
   timer=setInterval(()=>{if(!alive)return clearInterval(timer);left--;if(left<=0){clearInterval(timer);hb.disabled=false;hb.textContent='💡 Hint';}else hb.textContent=`💡 Hint in ${left}s`;},1000);};
  hb.onclick=async()=>{const x=hints[hi++];if(!x)return;root.querySelector('.hunt-hint').innerHTML=`<span class="pic">${esc(x.emoji||'')}</span> ${esc(x.word||'')}`;event('hunt_hint',`${h.id}:${hi}`);wait*=2;arm();await say(x.line);};
  // A grown-up confirms what was really found: the grown-ups' gate, then how many (0 = keep looking).
  root.querySelector('.hunt-found').onclick=()=>{audio.pause();grownUp(h,date);};
  await sayAll([h.intro,h.shapeLine,h.goal?.line].filter(Boolean));if(alive)arm();
 }
 function grownUp(h,date){
  const ch=parentChallenge();const m=document.createElement('div');m.className='hunt-gate';
  m.innerHTML=`<div class="hunt-gate-in"><h2>Grown-ups</h2><p>${esc(ch.question)}</p><p class="hunt-code">${esc(ch.code)}</p>
   <input autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" aria-label="Answer"><p class="hunt-err" role="status"></p>
   <div class="hunt-counts" hidden><p>How many real things did they find?</p>${[0,1,2,3,4,5].map(n=>`<button type="button" data-n="${n}">${n}${n===5?'+':''}</button>`).join('')}</div>
   <div class="hunt-gate-btns"><button type="button" class="hunt-cancel">Cancel</button><button type="button" class="hunt-ok">Continue</button></div></div>`;
  root.append(m);const inp=m.querySelector('input');inp.focus();
  m.querySelector('.hunt-cancel').onclick=()=>m.remove();
  m.querySelector('.hunt-ok').onclick=()=>{if(!parentAnswerMatches(ch,inp.value)){m.querySelector('.hunt-err').textContent='Not quite. Try again.';return;}
   m.querySelector('.hunt-counts').hidden=false;m.querySelector('.hunt-ok').remove();inp.remove();m.querySelector('.hunt-code').remove();};
  m.querySelectorAll('.hunt-counts button').forEach(b=>b.onclick=async()=>{const n=Number(b.dataset.n);m.remove();
   if(n<1){event('hunt_keep_looking',h.id);await say(h.keepLooking||{text:'Keep looking! You can do it.'});return;}
   await post(player,{type:'hunt',date,page:0,id:h.id,stage:'found',found:n,confirmed:true});event('hunt_found',`${h.id}:${n}`);confetti();
   await say(h.done);if(!alive)return;
   const next=await huntInfo(player);if(!alive)return;
   const nb=document.createElement('button');nb.type='button';nb.className='hunt-btn hunt-next';nb.textContent=next?.left>0?'Another hunt! 🔍':'All done for today ☀️';
   nb.onclick=()=>{if(next?.left>0)void show();else close();};root.querySelector('.hunt-found')?.replaceWith(nb);root.querySelector('.hunt-hintbtn')?.remove();});
 }
 function confetti(){const c=document.createElement('div');c.className='hunt-conf';c.innerHTML=Array.from({length:36},()=>`<i style="--dx:${(Math.random()-.5)*90}vw;--dy:${-20-Math.random()*50}vh;--r:${Math.random()*720}deg;background:hsl(${Math.random()*360},85%,60%)"></i>`).join('');root.append(c);setTimeout(()=>c.remove(),2400);}
 function close(){dispose();onClose();}
 function dispose(){if(!alive)return;alive=false;try{audio.pause();speechSynthesis.cancel();}catch{}root.remove();}
 void show();
 return dispose;
}
