// Child-tolerant matching of a short transcript against what the page expects him to say.
// Targets: {kind:'word', word, also?:[…]} (a word he reads aloud), or {kind:'letter', letter, names?:[…]}
// (a letter: its sound, its name, a word that starts with that sound, or a friend's name).
// Close is good enough: a child's vowel, a voiced/unvoiced slip (b/p, d/t, g/k) or a recogniser's spelling
// ("Mattt" for "mat") still counts. A different word (a guess from the first letter) does not.
const LETTER_NAMES={a:['a','ay','eh','ah'],b:['b','be','bee','bi','bea'],c:['c','see','sea','si'],d:['d','dee','de'],e:['e','ee'],f:['f','ef','eff'],g:['g','gee','ji'],h:['h','aitch','haitch'],i:['i','eye','aye'],j:['j','jay'],k:['k','kay'],l:['l','el','ell','elle'],m:['m','em'],n:['n','en'],o:['o','oh','owe'],p:['p','pee','pea'],q:['q','queue','cue'],r:['r','are','ar'],s:['s','es','ess'],t:['t','tee','tea'],u:['u','you','yu'],v:['v','vee'],w:['w'],x:['x','ex'],y:['y','why'],z:['z','zee','zed']};
// Sound classes: a child (or the recogniser) may slip between these.
const CLASS={b:'B',p:'B',d:'D',t:'D',g:'K',k:'K',c:'K',q:'K',v:'F',f:'F',s:'S',z:'S',m:'M',n:'N',l:'L',r:'R',w:'W',j:'J',h:'H',x:'KS',y:'Y'};
const VOWEL=/[aeiou]/;
export const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z' ]+/g,' ').replace(/'/g,'').replace(/\s+/g,' ').trim();
// A word's consonant skeleton with vowels collapsed: "mat" -> "MVD", "bed" -> "BVD", "Mattt" -> "MVD".
export function skeleton(w){
 let s=normalize(w).replace(/\s/g,'');if(!s)return '';
 s=s.replace(/(.)\1+/g,'$1').replace(/ph/g,'f').replace(/ck/g,'k').replace(/th/g,'d').replace(/sh|ch/g,'s').replace(/wh/g,'w').replace(/kn/g,'n').replace(/gh/g,'');
 if(s.length>3)s=s.replace(/([^aeiou])e$/,'$1');
 let out='';for(const ch of s){const c=VOWEL.test(ch)?'V':ch==='y'&&out&&!out.endsWith('V')?'V':(CLASS[ch]??'');if(c&&!out.endsWith(c))out+=c;}
 return out;
}
export function levenshtein(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let prev=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[n];}
function wordMatch(t,w){
 if(!t||!w)return null;if(t===w)return 'exact';
 const st=skeleton(t),sw=skeleton(w);if(st&&st===sw)return 'close';
 // Longer words: one slip anywhere is still the word ("dinosaur" / "dinosour").
 if(w.length>=5&&levenshtein(t,w)<=Math.floor(w.length/5))return 'close';
 if(sw.length>=4&&levenshtein(st,sw)<=1)return 'close';
 return null;
}
// The first sound of a heard word, as a class ("Lulu" -> "L", "circle" -> "S", "cat" -> "K").
function firstSound(t){const s=skeleton(t);return s.replace(/^V/,'')[0]||'';}
export function matchUtterance(text,target){
 const heard=normalize(text),tokens=heard.split(' ').filter(Boolean);
 if(!tokens.length)return {match:false,how:'silence',heard};
 if(target?.kind==='word'){
  const words=[target.word,...(target.also||[])].map(normalize).filter(Boolean);
  // A reader may read a two-word phrase as one or two tokens.
  for(const w of words){const joined=tokens.join('');if(w.includes(' ')&&(heard.includes(w)||joined===w.replace(/ /g,'')))return {match:true,how:'exact',heard};
   for(const t of tokens){const how=wordMatch(t,w);if(how)return {match:true,how,heard};}}
  return {match:false,how:'different',heard};
 }
 if(target?.kind==='letter'){
  const L=normalize(target.letter).slice(0,1),cls=VOWEL.test(L)?'V':(CLASS[L]||L.toUpperCase());
  for(const n of (target.names||[]).map(normalize).filter(Boolean))for(const t of tokens)if(wordMatch(t,n))return {match:true,how:'name',heard};
  for(const t of tokens){
   if((LETTER_NAMES[L]||[L]).includes(t))return {match:true,how:'letter-name',heard};
   // The sound on its own ("lll", "luh", "la") or any word that starts with it ("Lulu", "lion").
   if(VOWEL.test(L)){if(t[0]===L||(t.length<=3&&VOWEL.test(t[0])))return {match:true,how:'sound',heard};continue;}
   if(firstSound(t)===cls||t[0]===L)return {match:true,how:'sound',heard};
  }
  return {match:false,how:'different',heard};
 }
 return {match:false,how:'no-target',heard};
}
// Words that nudge the recogniser toward what the page is about (never the only evidence).
export function promptFor(target){
 if(target?.kind==='word')return [target.word,...(target.also||[])].join(', ')+'.';
 if(target?.kind==='letter')return `${target.letter.toUpperCase()}. ${(target.names||[]).join(', ')}.`;
 return '';
}
// Candidate readings for the recogniser to rank when the free transcription does not settle it: the expected
// reading(s) against plausible wrong ones (what the recogniser itself heard, and near-misses a child might say).
const SWAP_FIRST=['b','d','m','s','p','k','f','n','t','h','g'],SWAP_LAST=['t','d','n','g','p','s'];
const LETTER_SOUNDS={a:['Ah'],b:['Buh'],c:['Kuh'],d:['Duh'],e:['Eh'],f:['Fff'],g:['Guh'],h:['Huh'],i:['Ih'],j:['Juh'],k:['Kuh'],l:['Lll','Luh'],m:['Mmm'],n:['Nnn'],o:['Oh'],p:['Puh'],q:['Kwuh'],r:['Rrr'],s:['Sss'],t:['Tuh'],u:['Uh'],v:['Vvv'],w:['Wuh'],x:['Ks'],y:['Yuh'],z:['Zzz']};
export function rankFor(target,text=''){
 const heard=normalize(text).split(' ').filter(t=>t.length>=2);
 if(target?.kind==='word'){
  const w=normalize(target.word),sw=skeleton(w),others=new Set();
  for(const t of heard)if(skeleton(t)!==sw&&!w.includes(' '))others.add(t);
  if(!w.includes(' ')){
   for(const c of SWAP_FIRST){const v=VOWEL.test(w[0])?c+w:c+w.slice(1);if(skeleton(v)!==sw){others.add(v);}if(others.size>=5)break;}
   if(w.length<=6&&!VOWEL.test(w.at(-1)))for(const c of SWAP_LAST){const v=w.slice(0,-1)+c;if(skeleton(v)!==sw)others.add(v);if(others.size>=8)break;}
  }
  return {target:[target.word,...(target.also||[])],others:[...others].slice(0,8)};
 }
 if(target?.kind==='letter'){
  const L=normalize(target.letter).slice(0,1),cls=CLASS[L];
  const tg=[L.toUpperCase(),...(LETTER_SOUNDS[L]||[]),...(target.names||[])];
  const pool=['m','s','b','t','k','f','a','o'].filter(x=>x!==L&&CLASS[x]!==cls).slice(0,4);
  const others=new Set([...pool.map(x=>x.toUpperCase()),...pool.map(x=>LETTER_SOUNDS[x][0])]);
  for(const t of heard)if(!matchUtterance(t,target).match)others.add(t);
  return {target:tg,others:[...others].slice(0,8)};
 }
 return null;
}
// The decision, shared by the hub and its check: what it heard (child-tolerant), else whether the expected reading
// explains the sound better than the wrong readings. r = the recogniser's answer {text, speech, rank?, error?}.
export function decide(r,target){
 if(!r||r.error)return {match:false,how:'error',heard:''};
 const m=matchUtterance(r.speech<0.2?'':r.text,target);
 // (Not used: the recogniser's other readings. Measured 2026-09-28 with 5 beam hypotheses: every wrong letter sound
 // was accepted (48/48) and decoding took 3.6 s instead of ~1.3 s; a lone letter's alternatives include anything.)
 if(!m.match&&m.how!=='silence'&&r.rank?.best==='target')return {...m,match:true,how:'ranked'};
 return m;
}
