import {hasSound} from './word-families.mjs';
// Reusable, keyboard-accessible sound controls. They never submit an answer.
import {createCoachAudio} from './chess/audio.mjs';
export function readingAudio({player,onHelp=()=>{},enabled=()=>true}={}){
 const audio=createCoachAudio();let turn=0;
 const play=async(word,mode='blend')=>{if(!enabled()||(mode==='letter'&&!hasSound(word)&&String(word).toLowerCase()!=='x'))return false;onHelp();const mine=++turn;audio.unlock();
  const r=await fetch('/api/book/phonics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player,word:String(word).toLowerCase(),mode})});
  if(!r.ok)return false;const {clip}=await r.json();if(mine!==turn||!enabled())return;
  audio.play('/book-voice/'+clip);await audio.finished();return true;};
 return {letter:c=>play(c,'letter'),word:w=>play(w),stop(){turn++;audio.stop();}};
}
export function addReadingSupport(button,word,{letter,blend,onHelp=()=>{},showLetters=true}){
 if(!/^[a-z]+$/i.test(word))return null;
 const doc=button.ownerDocument,row=doc.createElement('span');row.className='reading-support';
 const add=(label,aria,fn)=>{const b=doc.createElement('span');b.className='reading-sound';b.setAttribute('role','button');b.tabIndex=0;b.textContent=label;b.setAttribute('aria-label',aria);
  const act=e=>{e.preventDefault();e.stopPropagation();onHelp();Promise.resolve(fn()).then(ok=>{if(ok===false){let status=row.querySelector('.reading-status');if(!status){status=doc.createElement('span');status.className='reading-status';status.setAttribute('role','status');row.append(status);}status.textContent='Ask a grown-up to say this sound.';}}).catch(()=>{});};b.onclick=act;b.onkeydown=e=>{if(['Enter',' '].includes(e.key))act(e);};row.append(b);};
 for(const c of showLetters?word:[])add(c,`Hear the sound of ${c}`,()=>letter(c));
 add('🔊 Hear it',`Hear ${word} blended`,()=>blend(word));button.append(row);return row;
}
