export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shell(root,{title,prompt,scene,onDone}){
 let alive=true,current=prompt,audio=null,done=null,token=0,timer=null;const abort=new AbortController();
 const ready=fetch('/chess-voice/manifest.json',{signal:AbortSignal.timeout(4000)}).then(r=>r.ok?r.json():null).catch(()=>null);
 function stop(){token++;audio?.pause();done?.();audio=null;done=null;clearTimeout(timer);}
 async function say(text){current=text;root.querySelector('.prompt').textContent=text;stop();const mine=token,m=await ready;if(!alive||mine!==token)return;
  const clip=m?.clips?.['Study: '+text];if(!clip)return;audio=new Audio(clip);const own=audio;await new Promise(resolve=>{let ended=false;done=()=>{if(ended)return;ended=true;clearTimeout(timer);own.pause();resolve();};timer=setTimeout(done,14000);own.onended=done;own.onerror=done;void own.play().catch(done);});}
 root.innerHTML=`<article class="page"><header><small>A PLACE TO EXPLORE</small><h1>${esc(title)}</h1></header><div class="picture">${scene}<div class="start-cover"><button class="start">Open this page</button></div></div><footer><p class="prompt" role="status">${esc(prompt)}</p><div class="controls"></div><div class="tools"><button class="listen" aria-label="Hear the instruction">Hear again</button><button class="finish">Back to the Book</button></div></footer></article>`;
 const $=s=>root.querySelector(s),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 on($('.start'),'click',()=>{$('.start-cover').remove();void say(current);});on($('.listen'),'click',()=>void say(current));on($('.finish'),'click',()=>{stop();onDone();});on(document,'visibilitychange',()=>{if(document.hidden)stop();});
 return {$,on,say,signal:abort.signal,destroy(){alive=false;abort.abort();stop();}};
}
export function animate(draw,duration=1800){let id=null,start=null,dead=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function tick(t){if(dead)return;if(document.hidden){id=requestAnimationFrame(tick);start=null;return;}start??=t;const f=reduced?1:Math.min(1,(t-start)/duration);draw(f);if(f<1)id=requestAnimationFrame(tick);}
 id=requestAnimationFrame(tick);return ()=>{dead=true;if(id!==null)cancelAnimationFrame(id);};}
export function wireScene(ui,select){ui.on(ui.$('svg'),'click',e=>{const n=e.target.closest('[data-pick]');if(n)select(n.dataset.pick);});ui.on(ui.$('svg'),'keydown',e=>{if(['Enter',' '].includes(e.key)){const n=e.target.closest('[data-pick]');if(n){e.preventDefault();select(n.dataset.pick);}}});}
