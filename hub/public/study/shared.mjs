export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shell(root,{title,prompt,scene,onDone}){
 let alive=true,current=prompt,audio=null,settle=null,token=0,timer=null,busy=false;const abort=new AbortController();
 const ready=fetch('/chess-voice/manifest.json',{signal:AbortSignal.timeout(4000)}).then(r=>r.ok?r.json():null).catch(()=>null);
 function stop(){token++;audio?.pause();settle?.();audio=null;settle=null;clearTimeout(timer);busy=false;root.classList.remove('speaking');}
 async function say(text){if(busy)return;current=text;root.querySelector('.prompt').textContent=text;busy=true;root.classList.add('speaking');const mine=++token,m=await ready;if(!alive||mine!==token)return;
  const clip=m?.clips?.['Study: '+text];if(!clip){busy=false;root.classList.remove('speaking');root.querySelector('.voice-status').textContent='Sound is unavailable. Hear again to retry.';return;}root.querySelector('.voice-status').textContent='';
  const own=audio=new Audio(clip);await new Promise(resolve=>{let ended=false;settle=()=>{if(ended)return;ended=true;clearTimeout(timer);own.pause();resolve();};timer=setTimeout(settle,45000);own.onended=settle;own.onerror=()=>{root.querySelector('.voice-status').textContent='Sound is unavailable. Hear again to retry.';settle();};void own.play().catch(own.onerror);});if(alive&&mine===token){busy=false;root.classList.remove('speaking');}}
 root.innerHTML=`<article class="page"><header><small>A PAGE TO TRY TOGETHER</small><h1>${esc(title)}</h1></header><div class="picture">${scene}<div class="start-cover"><button class="start">Open this page</button></div></div><footer><p class="prompt" role="status">${esc(prompt)}</p><div class="controls"></div><div class="voice-status" role="status"></div><div class="tools"><button class="listen" aria-label="Hear the instruction">Hear again</button><button class="finish">Back to the Book</button></div></footer></article>`;
 const $=s=>root.querySelector(s),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 on($('.start'),'click',()=>{$('.start-cover').remove();void say(current);});on($('.listen'),'click',()=>{if(!busy)void say(current);});on($('.finish'),'click',()=>{stop();onDone();});on(document,'visibilitychange',()=>{if(document.hidden)stop();});
 return {$,on,say,signal:abort.signal,get blocked(){return busy||!alive||!!$('.start-cover');},destroy(){alive=false;abort.abort();stop();}};
}
export function wireScene(ui,select){const choose=e=>{if(ui.blocked)return;const n=e.target.closest('[data-pick]');if(n)select(n.dataset.pick);};ui.on(ui.$('svg'),'click',choose);ui.on(ui.$('svg'),'keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(e);}});}
export function animate(draw,duration=1200){let id=null,start=null,dead=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function tick(t){if(dead)return;if(document.hidden){id=requestAnimationFrame(tick);start=null;return;}start??=t;const f=reduced?1:Math.min(1,(t-start)/duration);draw(f);if(f<1)id=requestAnimationFrame(tick);}
 id=requestAnimationFrame(tick);return ()=>{dead=true;if(id!==null)cancelAnimationFrame(id);};}
