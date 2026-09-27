// A real-world hunt, after the day's chapter or from the home screen: a friend announces what to look for at home
// (things that start with a sound, and the letter or word written somewhere), the child goes and hunts off-screen,
// then "We found them!" celebrates and offers the next hunt. A few a day, then "tomorrow". Words, lines and voices
// come from the household's private hunts file; this module only shows and plays them.
import {fetchJSON} from './save-request.mjs';
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
.hunt-count{margin:.3em 0;font-size:15px;color:#6a5a4a}.hunt-count button{font:inherit;font-weight:900;font-size:20px;min-width:44px;min-height:44px;margin:0 3px;border-radius:12px;border:2px solid #c9a24a;background:#fffaf0;cursor:pointer}
.hunt-count button.on{background:#ffd54a}
.hunt-conf i{position:fixed;top:40%;left:50%;width:12px;height:16px;border-radius:3px;animation:hunt-conf 2.2s cubic-bezier(.2,.7,.3,1) forwards;z-index:41}
@keyframes hunt-bob{50%{transform:translateY(-8px) rotate(-2deg)}}@keyframes hunt-pop{from{transform:scale(.3);opacity:0}}
@keyframes hunt-glow{50%{box-shadow:0 6px 0 rgba(0,0,0,.2),0 0 0 14px rgba(120,220,110,.25)}}@keyframes hunt-conf{to{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}
@media (prefers-reduced-motion:reduce){.hunt *{animation:none!important}}`;
function style(){if(document.getElementById('hunt-css'))return;const s=document.createElement('style');s.id='hunt-css';s.textContent=CSS;document.head.append(s);}
export async function huntInfo(player){try{return await fetchJSON('/api/book/hunt?player='+encodeURIComponent(player),{},5000);}catch{return null;}}
function post(player,body){return fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.ok?r.json():null).catch(()=>null);}
export function mountHunt(main,{player,event=()=>{},onClose=()=>{location.hash='';}}){
 style();let alive=true;const audio=new Audio();
 const say=line=>new Promise(res=>{if(!alive||!line?.text)return res();const done=()=>res();const t=setTimeout(done,Math.max(3000,line.text.length*90));
  if(!line.clip){try{const u=new SpeechSynthesisUtterance(line.text);u.onend=()=>{clearTimeout(t);res();};speechSynthesis.speak(u);}catch{res();}return;}
  audio.src='/book-voice/'+line.clip;audio.onended=()=>{clearTimeout(t);res();};audio.play().catch(()=>{clearTimeout(t);res();});});
 const sayAll=async lines=>{for(const l of lines){if(!alive)return;await say(l);}};
 const root=document.createElement('section');root.className='hunt';root.setAttribute('aria-label','A hunt at home');main.innerHTML='';main.append(root);
 async function show(){
  const info=await huntInfo(player);if(!alive)return;
  if(!info?.available){root.innerHTML=`<div class="hunt-card"><h2>No hunts yet.</h2><button class="hunt-btn hunt-close" type="button">← Back</button></div>`;root.querySelector('.hunt-close').onclick=close;return;}
  const {hunt:h,friend,date}=info;
  if(!h||info.left<=0){
   root.innerHTML=`<div class="hunt-card">${friend?.url?`<img class="hunt-friend" src="${esc(friend.url)}" alt="">`:''}<h2 style="font-size:clamp(26px,6vmin,44px)">${esc(info.tomorrow?.text||"Let's save the next one for tomorrow!")}</h2><button class="hunt-btn hunt-close" type="button">Back to the games →</button></div>`;
   root.querySelector('.hunt-close').onclick=close;event('hunt_tomorrow','');void say(info.tomorrow);return;}
  const big=h.letter?`<div class="hunt-letter">${esc(h.letter)}<small>${esc(h.letter.toLowerCase())}</small></div>`:`<div class="hunt-word">${esc(h.word||h.title||'')}</div>`;
  const kinds=[h.sound,h.written].filter(Boolean).map(k=>`<div class="hunt-kind"><h3>${esc(k.title)}</h3><div class="pics" aria-hidden="true">${(k.pics||[]).map(esc).join(' ')}</div><p>${esc(k.hint||'')}</p></div>`).join('');
  root.innerHTML=`<div class="hunt-card"><div class="hunt-top">${friend?.url?`<img class="hunt-friend" src="${esc(friend.url)}" alt="${esc(friend.name||'')}">`:''}${big}</div>
   <p class="hunt-tip">${esc(h.tip||'')}</p><div class="hunt-kinds">${kinds}</div>
   <button class="hunt-btn hunt-found" type="button">We found them! 🎉</button>
   <div class="hunt-count">Grown-ups: how many did they find? ${[1,2,3,4,5].map(n=>`<button type="button" data-n="${n}">${n}${n===5?'+':''}</button>`).join('')}</div>
   <button class="hunt-btn hunt-close" type="button">← Back</button></div>`;
  let found=0;root.querySelectorAll('.hunt-count button').forEach(b=>b.onclick=()=>{found=Number(b.dataset.n);root.querySelectorAll('.hunt-count button').forEach(x=>x.classList.toggle('on',x===b));});
  root.querySelector('.hunt-close').onclick=close;
  void post(player,{type:'hunt',date,page:0,id:h.id,stage:'start'});event('hunt_start',h.id);
  root.querySelector('.hunt-found').onclick=async e=>{e.currentTarget.disabled=true;audio.pause();
   await post(player,{type:'hunt',date,page:0,id:h.id,stage:'found',found});event('hunt_found',`${h.id}:${found}`);confetti();
   await say(h.done||info.cheer);if(!alive)return;
   const next=await huntInfo(player);if(!alive)return;
   const nb=document.createElement('button');nb.type='button';nb.className='hunt-btn hunt-next';nb.textContent=next?.left>0?'Another hunt! 🔍':'All done for today ☀️';
   nb.onclick=()=>{if(next?.left>0)void show();else close();};root.querySelector('.hunt-found').replaceWith(nb);root.querySelector('.hunt-count')?.remove();};
  await sayAll([h.intro,h.shapeLine,h.sound?.line,h.written?.line].filter(Boolean));
 }
 function confetti(){const c=document.createElement('div');c.className='hunt-conf';c.innerHTML=Array.from({length:36},()=>`<i style="--dx:${(Math.random()-.5)*90}vw;--dy:${-20-Math.random()*50}vh;--r:${Math.random()*720}deg;background:hsl(${Math.random()*360},85%,60%)"></i>`).join('');root.append(c);setTimeout(()=>c.remove(),2400);}
 function close(){dispose();onClose();}
 function dispose(){if(!alive)return;alive=false;try{audio.pause();speechSynthesis.cancel();}catch{}root.remove();}
 void show();
 return dispose;
}
