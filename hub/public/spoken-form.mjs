// The narrator says a SPOKEN form, never the screen notation. A prompt such as
// "Example: S + U + N → sun. Which picture matches the sounds /k/ /a/ /t/?" must not be read aloud as "slash",
// "arrow" or "plus". A line keeps `shown` (what the screen prints) and `text` (what the voice renders). spokenForm()
// is the safety net every narrated line passes through: math symbols become words, a /x/ letter sound becomes the
// recorded letter sound (Kokoro phoneme [[x]], which book/narrate.py renders from the recorded letter sounds), and
// screen-only labels and pictures are dropped or named. An authored spoken form says it better; this keeps any
// remaining notation from ever reaching the voice. book/spoken-lint.mjs enforces it.
import {hasSound} from './word-families.mjs';
// Letter (or /phoneme/ spelling) -> the IPA the recorded letter sound is filed under (book/narrate.py PH2LETTER).
const LETTER_IPA={a:'æ',b:'b',c:'k',d:'d',e:'ɛ',f:'f',g:'ɡ',h:'h',i:'ɪ',k:'k',m:'m',n:'n',o:'ɑ',p:'p',r:'ɹ',s:'s',t:'t',u:'ʌ'};
const IPA=new Set(Object.values(LETTER_IPA));
export const EMOJI_WORDS={'🌼':'flower','🍃':'leaf','⭐':'star','🍎':'apple','🎃':'pumpkin','🌙':'moon','☀️':'sun','🐱':'cat','🧢':'cap','🛏️':'cot','🧦':'sock','🚢':'ship','🐸':'frog','🍕':'pizza','🎁':'present','🔑':'key','🏮':'lantern'};
// One letter sound as the narrator's recorded sound, or null when there is no recording for it.
export function letterSound(x){
 const s=String(x||'').toLowerCase().replace(/[ˈˌ]/g,'');
 if(IPA.has(s))return `[[${s}]]`;
 if(s.length===1&&hasSound(s)&&LETTER_IPA[s])return `[[${LETTER_IPA[s]}]]`;
 return null;
}
// "[[k]]... [[æ]]... [[t]]" (the pause book/narrate.py puts between recorded sounds), or the letters said as words.
export function soundSequence(sounds){const each=sounds.map(letterSound);return each.every(Boolean)?each.join('... '):sounds.map(s=>String(s).toUpperCase()).join(', ');}
const EMOJI=/\p{Extended_Pictographic}️?/gu;
export function spokenForm(text){
 const parts=String(text??'').split(/(\[\[[^\]]*\]\])/);
 return parts.map((p,i)=>i%2?p:plain(p)).join('').replace(/\s{2,}/g,' ').replace(/\s+([,.!?])/g,(_,mark)=>mark).trim();
}
function plain(t){
 let s=t.replace(/\n+/g,' ');
 s=s.replace(/\bExample:\s*/gi,'For example, ');
 // Letters blended into a word: "S + U + N → sun" -> "[[s]]... [[ʌ]]... [[n]] makes sun".
 s=s.replace(/\b([A-Za-z])((?:\s*\+\s*[A-Za-z]\b)+)\s*(?:→|->|=)\s*([A-Za-z]+)/g,(all,a,rest,word)=>soundSequence([a,...rest.split('+').map(x=>x.trim()).filter(Boolean)])+' makes '+word);
 // Phoneme slashes: "/k/ /a/ /t/" -> "[[k]]... [[æ]]... [[t]]".
 s=s.replace(/\/([a-zæɑʌɛɪɡɹ]{1,2})\/(?:[\s,]*\/([a-zæɑʌɛɪɡɹ]{1,2})\/)*/gi,all=>soundSequence([...all.matchAll(/\/([^\/\s]+)\//g)].map(m=>m[1])));
 s=s.replace(/_{2,}/g,'blank');
 s=s.replace(/(\d)\s*[−–-]\s*(?=\d)/g,(_,digit)=>digit+' minus ').replace(/−/g,' minus ');
 s=s.replace(/\s*\+\s*/g,' plus ').replace(/\s*×\s*/g,' times ').replace(/\s*÷\s*/g,' divided by ');
 s=s.replace(/\s*≥\s*/g,' is at least ').replace(/\s*≤\s*/g,' is at most ').replace(/\s*>\s*/g,' is more than ').replace(/\s*<\s*/g,' is less than ');
 s=s.replace(/\s*=\s*/g,' is ');
 s=s.replace(/\s*(?:→|->|⇒|➜|➔)\s*/g,', then ');
 s=s.replace(EMOJI,e=>{const w=EMOJI_WORDS[e]||EMOJI_WORDS[e.replace(/️/g,'')];return w?' '+w+' ':' ';});
 s=s.replace(/[\/\\|*#@^~&%{}]/g,' ');
 return s;
}
// A runtime line with a clean voice text; `shown` keeps the notation for the caption only when it differs.
export function spokenLine(text,voice={}){const said=spokenForm(text);return said===String(text)?{text,...voice}:{text:said,shown:String(text),...voice};}
