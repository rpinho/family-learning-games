import {createPond,pondAction,pondResult,INTRO} from './model.mjs';
import {pondPicture,leafPicture} from './scene.mjs';
// The caller owns narration and persistence. The review page deliberately provides no save adapter.
export function mountPond(root,{mode='count',speak=()=>{},stopSpeech=()=>{},onResult=()=>{},onContinue=()=>{}}={}){
 let state=createPond(mode),disposed=false,frame=0,running=false,token=0;
 const timers=new Set(),later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);if(!disposed)fn();},ms);timers.add(t);};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const positions=[[33,57,-13],[46,68,12],[63,51,-22],[71,68,18],[48,45,-8]];
 root.innerHTML=`<article class="pond-book"><header class="pond-heading"><div><div class="pond-kicker">The little book of noticing</div><h1>The leaf that found its way</h1></div><div class="pond-page-number">a moment by the water</div></header><div class="pond-world">${pondPicture}<svg class="pond-current" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><path/></svg><div class="pond-objects"></div></div><footer class="pond-copy"><div><p class="pond-prompt" aria-live="polite"></p><p class="pond-note"></p><div class="pond-progress" aria-hidden="true"></div></div><div class="pond-actions"><button class="pond-tool" data-act="replay" aria-label="Hear the instruction again">Hear it ↻</button><button class="pond-tool" data-act="help">Show me</button><button class="pond-tool primary" data-act="continue">Keep the story going →</button></div></footer></article>`;
 const world=root.querySelector('.pond-world'),objects=root.querySelector('.pond-objects'),prompt=root.querySelector('.pond-prompt'),note=root.querySelector('.pond-note');
 let line=INTRO[state.mode];
 const say=text=>{line=text;speak(text);};
 function ripple(x,y){const e=document.createElement('i');e.className='pond-ripple';e.style.left=x+'%';e.style.top=y+'%';world.append(e);later(()=>e.remove(),1250);}
 function render(){
  root.dataset.phase=state.phase;root.dataset.count=state.counted.length;
  root.querySelector('[data-act=help]').hidden=state.phase==='done';
  root.querySelector('[data-act=continue]').textContent=state.phase==='done'?'Back to the story →':'Keep the story going →';
  root.querySelector('.pond-current path').setAttribute('d',state.mode==='flow'?(state.gate==='reeds'?'M556 198Q541 270 581 333Q692 342 789 454':'M556 198Q541 270 510 338Q360 339 230 466'):'');
  if(state.mode==='count'){
   prompt.textContent=state.phase==='done'?'Five leaves. Each one counted once.':'Touch each leaf. How many are here?';
   note.textContent=state.phase==='done'?'One touch, one leaf. Take your time, then turn the page.':'The leaves stay still while you count.';
   objects.innerHTML=positions.map(([x,y,r],id)=>`<button class="pond-leaf ${state.counted.includes(id)?'counted':''}" style="left:${x}%;top:${y}%;--tilt:${r}deg" data-leaf="${id}" aria-label="${state.counted.includes(id)?'Counted leaf '+(state.counted.indexOf(id)+1):'Count this leaf'}" aria-disabled="${state.counted.includes(id)}">${leafPicture}<span>${state.counted.includes(id)?state.counted.indexOf(id)+1:''}</span></button>`).join('');
   root.querySelector('.pond-progress').innerHTML=positions.map((_,i)=>`<i class="${i<state.counted.length?'on':''}"></i>`).join('');
  }else{
   const phase=state.phase;
   prompt.textContent=phase==='observe'?'Where will the stream carry the leaf?':phase==='float'?'Let’s watch the water.':phase==='done'?'The same leaf. A different path.':state.gate==='reeds'?'The current carried it to the reeds.':'The current carried it to the flowers.';
   note.textContent=phase==='observe'?'Follow the small marks in the water. Choose a bank.':phase==='float'?'Your idea is saved. Watch where the leaf goes.':phase==='done'?'Tell someone: what changed the way the leaf moved?':'Turn the wooden gate. Predict, then try the other path.';
   const last=state.trials.at(-1),atBank=phase==='explain'||phase==='done';
   objects.innerHTML=`<button class="pond-gate" data-act="gate" aria-label="Turn the water gate" ${phase==='float'?'disabled':''} style="--gate-angle:${state.gate==='reeds'?30:-30}deg"></button><div class="pond-leaf floating-leaf" style="left:${atBank?(state.gate==='reeds'?79:23):55}%;top:${atBank?66:38}%" aria-hidden="true">${leafPicture}</div><button class="pond-bank ${state.prediction==='flowers'?'chosen':''}" data-bank="flowers" ${phase!=='observe'?'disabled':''}>✿ Flowers</button><button class="pond-bank ${state.prediction==='reeds'?'chosen':''}" data-bank="reeds" ${phase!=='observe'?'disabled':''}>Reeds ≋</button>`;
   root.querySelector('.pond-progress').innerHTML='';
   if(last&&phase==='explain'&&!last.matched)note.textContent='Your idea was different. Watching is how we find out. Turn the gate to try again.';
  }
 }
 function dispatch(action){state=pondAction(state,action);render();onResult(pondResult(state));}
 function animate(){
  const my=++token,leaf=objects.querySelector('.floating-leaf'),to=state.gate==='reeds'?79:23;
  let elapsed=0,last=null;running=true;
  const step=now=>{if(disposed||my!==token)return;if(last!==null&&!document.hidden)elapsed+=Math.min(now-last,60);last=now;
   const t=reduced.matches?1:Math.min(1,elapsed/2600),e=t*t*(3-2*t);
   leaf.style.left=(55+(to-55)*e)+'%';leaf.style.top=(38+28*t)+'%';leaf.style.setProperty('--tilt',(Math.sin(t*4)*12)+'deg');
   if(t<1){frame=requestAnimationFrame(step);return;}running=false;dispatch({type:'arrive'});ripple(to,66);say(state.phase==='done'? 'The gate changed the stream. Now the leaf follows a different path.':state.gate==='reeds'?'The water carries the leaf to the reeds.':'The water carries the leaf to the flowers.');
  };frame=requestAnimationFrame(step);
 }
 function click(e){
  const button=e.target.closest('button');if(!button||disposed)return;
  if(button.dataset.leaf!==undefined){const id=Number(button.dataset.leaf);if(state.counted.includes(id))return;dispatch({type:'count',id});ripple(...positions[id]);say(String(state.counted.length));if(state.phase==='done')line='Five leaves. You counted each leaf once.';return;}
  if(button.dataset.bank){if(running||state.phase!=='observe')return;stopSpeech();dispatch({type:'predict',bank:button.dataset.bank});animate();return;}
  switch(button.dataset.act){
   case 'gate':if(running)return;dispatch({type:'gate'});line=INTRO.flow;return;
   case 'replay':speak(line);return;
   case 'help':dispatch({type:'help'});say(state.mode==='count'?INTRO.count:'You can change the gate and try the other path.');if(state.mode==='count'){const id=positions.findIndex((_,i)=>!state.counted.includes(i));if(id>=0)ripple(...positions[id]);}else objects.querySelector('.pond-gate').focus();return;
   case 'continue':onResult({...pondResult(state),skipped:state.phase!=='done'});onContinue();return;
  }
 }
 root.addEventListener('click',click);render();
 // Narration begins with the caller's user gesture; never start a second automatic voice loop.
 return {start:()=>say(INTRO[state.mode]),getState:()=>structuredClone(state),destroy(){disposed=true;++token;cancelAnimationFrame(frame);for(const t of timers)clearTimeout(t);stopSpeech();root.removeEventListener('click',click);root.replaceChildren();}};
}
