// Only fixed phonics content can reach the voice renderer; callers cannot supply narration text/voices.
import {hasSound,soundOut} from './public/word-families.mjs';
const PH={a:'æ',e:'ɛ',i:'ɪ',o:'ɑ',u:'ʌ',b:'b',c:'k',d:'d',f:'f',g:'ɡ',h:'h',k:'k',m:'m',n:'n',p:'p',r:'ɹ',s:'s',t:'t'};
export function phonicsLine(word,mode){
 if(typeof word!=='string'||!(/^[a-z]{1,10}$/.test(word)))return null;
 if(mode==='letter'&&word==='x')return {text:'[[k]]... [[s]]',voice:'af_heart',speed:.8};
 if(mode==='letter')return word.length===1&&hasSound(word)?{text:`[[${PH[word]}]]`,voice:'af_heart',speed:.8}:null;
 if(mode!=='blend')return null;const text=soundOut(word);return {text:text||`${word[0].toUpperCase()+word.slice(1)}.`,voice:'af_heart',speed:.8};
}
