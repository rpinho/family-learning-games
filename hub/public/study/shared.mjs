export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function narrator(){
 let a=null,token=0,finish=null;
 const ready=fetch('/chess-voice/manifest.json').then(r=>r.ok?r.json():{clips:{}}).catch(()=>({clips:{}}));
 function stop(){token++;a?.pause();finish?.();a=null;finish=null;}
 return {stop,async say(text){stop();const mine=token,m=await ready;if(mine!==token||!m.clips?.[text])return false;
  return new Promise(resolve=>{const audio=new Audio(m.clips[text]);a=audio;const timeout=setTimeout(done,14000);function done(){clearTimeout(timeout);audio.pause();if(a===audio){a=null;finish=null;}resolve(true);}finish=done;audio.onended=done;audio.onerror=done;void audio.play().catch(done);});}};
}
export function shell(root,{title,prompt,background,onDone}){
 const abort=new AbortController(),voice=narrator();let current=prompt,alive=true;
 root.innerHTML=`<article class="page"><header><span class="eyebrow">A PAGE IN THE WOODS</span><h1>${esc(title)}</h1></header><div class="picture"><img class="backdrop" src="${esc(background)}" alt="A quiet forest path"><div class="objects"></div></div><footer><p class="prompt" role="status">${esc(prompt)}</p><div class="tools"><button class="listen" aria-label="Hear the instruction">◖))</button><button class="finish">Back to the page →</button></div></footer></article>`;
 const $=s=>root.querySelector(s),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:abort.signal});
 function say(t){if(!alive)return;current=t;$('.prompt').textContent=t;void voice.say(t);}
 on($('.listen'),'click',()=>say(current));on($('.finish'),'click',()=>{voice.stop();onDone();});
 on(document,'visibilitychange',()=>{if(document.hidden)voice.stop();});
 let begun=false;on(root,'pointerdown',()=>{if(!begun){begun=true;void voice.say(current);}});
 return {$,on,say,voice,signal:abort.signal,destroy(){alive=false;abort.abort();voice.stop();}};
}
export function rafLoop(draw,{document:doc=globalThis.document,motion=globalThis.matchMedia('(prefers-reduced-motion: reduce)'),raf=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
 let id=null,last=-Infinity,dead=false;
 function tick(t){id=null;if(dead||doc.hidden||motion.matches)return;if(t-last>=1000/30){draw(t);last=t;}id=raf(tick);}
 function sync(){if(id!==null)cancel(id);id=null;last=-Infinity;if(dead)return;if(motion.matches){draw(0);return;}if(!doc.hidden)id=raf(tick);}
 doc.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);sync();
 return ()=>{dead=true;if(id!==null)cancel(id);doc.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);};
}
