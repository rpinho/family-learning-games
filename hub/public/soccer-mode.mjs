import {mountDribble} from './dribble-ui.mjs';
import {mountClassic} from './dribble-classic.mjs';
export function mountSoccer(root,options){
 const key='family-soccer-mode:'+options.player;let mode='live',child,alive=true,switching=false;
 try{if(localStorage.getItem(key)==='classic')mode='classic';}catch{}
 root.innerHTML='<div class="soccer-mode-bar"><label for="soccer-mode">Play style <select id="soccer-mode"><option value="live">Live dribbling</option><option value="classic">Original puzzle · take turns</option></select></label><span class="mode-note">You can switch any time. Both saves are kept.</span><span class="mode-error" role="status"></span></div><div class="soccer-game"></div>';
 const select=root.querySelector('select'),surface=root.querySelector('.soccer-game'),error=root.querySelector('.mode-error');
 function mount(){select.value=mode;child=(mode==='live'?mountDribble:mountClassic)(surface,options);}
 select.onchange=async()=>{
  if(switching)return;const next=select.value;switching=true;select.disabled=true;error.textContent='';
  try{await child?.prepareLeave?.();if(!alive)return;child?.();mode=next;try{localStorage.setItem(key,mode);}catch{}mount();options.event('soccer_mode',mode);}
  catch(e){select.value=mode;error.textContent=e.message||'Could not save yet. Please try again.';}
  finally{switching=false;if(alive)select.disabled=false;}
 };
 mount();const dispose=()=>{alive=false;child?.();};dispose.busy=()=>switching||child?.busy?.();return dispose;
}
