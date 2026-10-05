import {selectBackground} from './book-painted-layout.mjs';
import {createCoachAudio} from './chess/audio.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountQuestIntro(main,{player,book,preview=false,onExit,onDone}){
 const ch=book.chapter,ep=ch.episode,root=document.createElement('div'),audio=createCoachAudio();root.className='bk-root quest-intro';root.style.cssText='position:fixed;inset:0;z-index:100;background:#172d26;display:grid;place-items:center;color:#fff;';main.append(root);
 const bg=selectBackground(ch.art.backgrounds[ch.pages[0].scene.bg],{width:innerWidth,height:innerHeight});root.style.background=`linear-gradient(#172d2644,#172d26dd), url("${bg.url}") center / cover`;
 root.innerHTML=`<button class="quest-close" aria-label="Close quest" style="position:absolute;right:12px;top:12px;z-index:2;min-width:48px;min-height:48px">×</button><div class="quest-card" style="max-width:560px;padding:24px;text-align:center"><h1>${esc(ep.title)}</h1><p>${esc(book.progress?.finished?ep.recap:ep.intro)}</p><button class="quest-hear" style="min-width:48px;min-height:48px" aria-label="Hear the story">🔊</button> <button class="quest-open" style="min-height:48px">${book.progress?.finished?'Visit your world':'Let’s go! 👣'}</button></div>`;
 const dispose=()=>{audio.dispose();root.remove();};root.querySelector('.quest-close').onclick=()=>{dispose();(onExit||onDone)?.();};
 root.querySelector('.quest-hear').onclick=()=>{audio.unlock();const l=ep.lines[book.progress?.finished?'recap':'intro'];if(l?.clip)audio.play('/book-voice/'+l.clip);};
 root.querySelector('.quest-open').onclick=()=>{audio.stop();const q=new URLSearchParams({player,...preview?{preview:'1',review:'1',date:ch.date}:{}});if(!preview){location.href='/world?'+q;return;}root.querySelector('.quest-card').remove();const frame=document.createElement('iframe');frame.title='Playable quest preview';frame.src='/world?'+q;frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0';root.append(frame);};return dispose;
}
