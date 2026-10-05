// Word families for a beginning reader: decodable CVC words (consonant, short vowel, consonant) grouped by their
// rime (-at: cat, hat, mat). A reading beat for such a reader only ever tests these words (or sight words he has
// mastered): a word he must read is short, big and decodable, and names and other words are read TO him.
// Distractors share the target's first letter and differ in the vowel or the last letter (cat / can / cot), so a
// first-letter guess cannot pass. Used by the book's plan and lint, and by the living book's stories.
export const FAMILIES={
 at:['cat','hat','mat','bat','rat','sat','pat','fat'],an:['can','man','pan','fan','ran','van','tan'],ap:['cap','map','tap','nap','lap','gap'],
 ad:['dad','had','mad','sad','bad','pad'],ag:['bag','tag','wag','rag'],am:['ham','jam','ram','yam'],
 in:['pin','bin','fin','tin','win'],ig:['big','dig','pig','wig','fig'],ip:['sip','tip','hip','dip','lip','zip'],it:['sit','hit','pit','kit','bit','fit'],
 op:['hop','mop','top','pop'],ot:['hot','pot','dot','got','not','cot','lot'],og:['dog','log','fog','hog','jog'],ox:['box','fox'],
 un:['sun','run','fun','bun'],ug:['bug','hug','mug','rug','jug','dug','tug'],ut:['nut','hut','cut'],ub:['tub','rub','cub','sub'],up:['cup','pup'],us:['bus'],um:['gum','sum','yum'],
 et:['net','pet','wet','jet','set','get','let','vet'],en:['hen','pen','ten','men','den'],ed:['bed','red','fed','wed'],eg:['leg','peg','beg']};
// The order a family is taught in (school order first), then the rest.
export const ORDER=['at','an','in','ig','op','ot','un','ug','ap','ad','ag','it','ip','og','et','en','ed','ut','ub','up','um','am','ox','us','eg'];
const WORD=new Map();for(const [rime,ws] of Object.entries(FAMILIES))for(const w of ws)WORD.set(w,rime);
export const familyOf=w=>WORD.get(String(w||'').toLowerCase())||null;
export const isFamilyWord=w=>WORD.has(String(w||'').toLowerCase());
// Readable for him: a family word, or one of his mastered sight words.
export function readable(w,{sight=[]}={}){const x=String(w||'').toLowerCase().replace(/[^a-z']/g,'');return !!x&&(isFamilyWord(x)||sight.map(s=>String(s).toLowerCase()).includes(x));}
// Look-alikes: same first letter, one letter different in the vowel or the end (one of each when possible).
export function lookAlikes(word,n=2,r=Math.random){const w=String(word).toLowerCase();if(!isFamilyWord(w))return [];
 const same0=[...WORD.keys()].filter(x=>x!==w&&x[0]===w[0]),same=same0.filter(canSoundOut).length>=n?same0.filter(canSoundOut):same0,vowel=same.filter(x=>x[2]===w[2]&&x[1]!==w[1]),end=same.filter(x=>x[1]===w[1]&&x[2]!==w[2]);
 const pick=a=>a.length?a[Math.floor(r()*a.length)]:null,out=[];
 for(const pool of [end,vowel,end,vowel]){if(out.length>=n)break;const c=pick(pool.filter(x=>!out.includes(x)));if(c)out.push(c);}
 return out.slice(0,n);}
export function isLookAlike(target,option){const a=String(target).toLowerCase(),b=String(option).toLowerCase();return a!==b&&a.length===3&&b.length===3&&a[0]===b[0]&&(a[1]!==b[1])!==(a[2]!==b[2]);}
// Letter sounds come from ONE place: the family's shared recorded letter sounds (private folder
// ~/.local/share/family-games/letter-sounds, one <letter>.wav each, provenance in letter-sounds.json; processed for
// playback by word-arcade's scripts/soundout.py, see book/narrate.py). These are the letters it has. A letter it does
// not have is never given an isolated sound (no sound-out, no "says" line, no sound hunt): narrate.py refuses it.
export const SOUND_LETTERS=new Set('abcdefghimnoprstu');
// The recording that says a letter's sound (K sounds like C).
export const soundFileLetter=c=>({k:'c'})[String(c).toLowerCase()]||String(c).toLowerCase();
export const hasSound=c=>/^[a-z]$/i.test(String(c))&&SOUND_LETTERS.has(soundFileLetter(c));
export const canSoundOut=w=>{const x=String(w||'').toLowerCase();return !!x&&[...x].every(hasSound);};
// A word sounded out slowly for the narrator's voice (letter sounds as phonemes: "[[k]]... [[æ]]... [[t]]. Cat!"),
// or null when one of its letters has no recorded sound.
const PH={a:'æ',e:'ɛ',i:'ɪ',o:'ɑ',u:'ʌ',b:'b',c:'k',d:'d',f:'f',g:'ɡ',h:'h',j:'dʒ',k:'k',l:'l',m:'m',n:'n',p:'p',r:'ɹ',s:'s',t:'t',v:'v',w:'w',x:'ks',y:'j',z:'z'};
export function soundOut(word){const w=String(word).toLowerCase();if(!canSoundOut(w))return null;return [...w].map(c=>`[[${PH[c]||c}]]`).join('... ')+`. ${w[0].toUpperCase()+w.slice(1)}!`;}
// Today's word for a reader: a family word he is stuck on, else the first family (in teaching order) he has not
// mastered yet (fewer than three of its words), else a review.
export function familyTarget(model,r=Math.random){
 const lit=model?.literacy||{},mastered=new Set((lit.wordsMastered||[]).map(s=>String(s).toLowerCase())),stuck=(lit.wordsStuck||[]).map(s=>String(s).toLowerCase()).filter(isFamilyWord);
 if(stuck.length)return stuck.find(canSoundOut)||stuck[0];
 for(const f of ORDER){const ws=FAMILIES[f],known=ws.filter(w=>mastered.has(w));if(known.length<3){const all=ws.filter(w=>!mastered.has(w)),fresh=all.filter(canSoundOut).length?all.filter(canSoundOut):all;return fresh[Math.floor(r()*fresh.length)]||ws[0];}}
 const all=ORDER.flatMap(f=>FAMILIES[f]);return all[Math.floor(r()*all.length)];
}
// Short decodable sentences for a spell (only family words and the family's own CVC names).
export const DECODABLE_SENTENCES=['Dad can run.','Max can hop.','Mom got wet.','Dad can dig.','Mom can nap.','Max got hot.','Dad had fun.','Mom can win.','Max can hug Dad.','Max can sit.'];
export const DECODABLE_NAMES=['dad','mom','max'];
