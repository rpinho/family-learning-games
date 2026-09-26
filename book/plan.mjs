// The Book: deterministic chapter plan. Code, not the language model, decides WHAT is practised
// (letters, words, sentences, facts, the deliberate mistake) from the learner model; the model only
// writes the story around it. Same learner model + date = same plan.
import {FIRST_WORDS,WORD_GROUPS,SENTENCES,SENTENCE_DISTRACT,scramble,tilesOf,endMark,shuffle} from '../hub/public/word-break.mjs';

export function rng(seedText){let h=2166136261;for(const c of String(seedText)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(a,r)=>a[Math.floor(r()*a.length)];
const LOOK={B:'PDR',D:'BOP',P:'BRF',R:'PBK',F:'EPT',E:'FLB',T:'ILF',L:'ITE',I:'LTJ',M:'NWH',N:'MHZ',W:'MVN',V:'WYU',O:'QCD',C:'OGQ',G:'COQ',S:'ZGC',A:'HVR',H:'NAK',K:'XRH',U:'VJO',Y:'VXT',Z:'NSX',X:'KYZ',J:'LUI',Q:'OGC'};
const WORD_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numberOptions(answer,r,near=[]){const c=[...near,answer+1,answer-1,answer+2,answer-2].filter(n=>Number.isInteger(n)&&n>=0&&n!==answer);return shuffle([answer,...[...new Set(c)].slice(0,2)],r).map(String);}
export const COUNT_THINGS=[['🍪','cookies'],['⚽','soccer balls'],['🦖','dinosaurs'],['🍯','honey pots'],['⭐','stars'],['🍎','apples']];

function earlyPlan(m,r){
 const known=new Set(m.literacy.letters);
 const learning=m.literacy.learning.filter(c=>/^[A-Z]$/.test(c)&&FIRST_WORDS.some(([w])=>w[0].toUpperCase()===c));
 const pool=learning.length?learning.slice(0,4):[...known].filter(c=>FIRST_WORDS.some(([w])=>w[0].toUpperCase()===c)).slice(0,6);
 const letter=pick(pool.length?pool:['B'],r);
 const words=FIRST_WORDS.filter(([w])=>w[0].toUpperCase()===letter&&!w.includes('-'));
 const [word,picture]=pick(words,r);
 const other=(learning.filter(c=>c!==letter)[0])||[...known].find(c=>c!==letter&&FIRST_WORDS.some(([w])=>w[0].toUpperCase()===c))||'B';
 const [word2,picture2]=pick(FIRST_WORDS.filter(([w])=>w[0].toUpperCase()===other&&!w.includes('-')),r);
 const near=l=>[...(LOOK[l]||'')].filter(c=>c!==l);
 const opts=(l)=>shuffle([l,...shuffle(near(l),r).slice(0,2)],r);
 const [thing,things]=pick(COUNT_THINGS,r),count=Math.min(m.math?.countTo||6,4+Math.floor(r()*4));
 const wrong=near(letter).find(c=>c!==other)||near(letter)[0];
 return {
  level:'early',words:[120,200],teach:{letter,word,picture},
  challenges:[
   {id:'c1',practises:`the letter ${letter} (just taught)`,item:{kind:'find-letter',track:'letters',spoken:`Find the letter ${letter}.`,answer:letter,options:opts(letter)}},
   {id:'c2',practises:`first sound of ${word2}`,item:{kind:'first-letter',track:'letters',spoken:`Which letter does ${word2} start with?`,picture:picture2,word:word2,answer:other,options:opts(other)}},
   {id:'c3',practises:`counting to ${count}`,item:{kind:'count',track:'letters',spoken:`How many ${things}? Count them.`,picture:thing.repeat(count),answer:String(count),options:numberOptions(count,r)}}
  ],
  mistake:{id:'m1',kind:'letter',claim:`${word[0].toUpperCase()+word.slice(1)} starts with ${wrong}.`,tokens:[picture,word,'starts with',wrong],wrong,right:letter,
   hint:`Listen: ${word}. What sound do you hear first?`,caught:`You caught me! ${word[0].toUpperCase()+word.slice(1)} starts with ${letter}, not ${wrong}.`,
   fix:{kind:'first-letter',track:'letters',spoken:`Which letter does ${word} start with?`,picture,word,answer:letter,options:opts(letter)}}
 };
}
function wordGroupFor(word,level){for(const g of WORD_GROUPS.flat())if(g.includes(word))return g;return null;}
function readerPlan(m,r){
 const lit=m.literacy,math=m.math||{};
 const stuck=lit.wordsStuck.filter(w=>wordGroupFor(w));
 const word=stuck.length?pick(stuck.slice(0,3),r):pick(WORD_GROUPS[Math.max(0,lit.wordLevel-1)],r)[0];
 const group=wordGroupFor(word)||pick(WORD_GROUPS[0],r);
 const sentence=pick(SENTENCES[Math.max(0,Math.min(2,lit.sentenceLevel-1))],r),answer=tilesOf(sentence);
 const extra=lit.sentenceLevel>=2?answer.map(w=>SENTENCE_DISTRACT[w.toLowerCase()]).find(w=>w&&!answer.some(a=>a.toLowerCase()===w)):null;
 const share=(math.hardShares||[]).filter(s=>s.total&&s.groups&&s.total%s.groups===0).at(-1)||pick([{total:12,groups:3},{total:15,groups:5},{total:16,groups:4},{total:18,groups:3}],r);
 const each=share.total/share.groups;
 const facts=(math.factsStuck||[]).map(f=>f.split('x').map(Number)).filter(([a,b])=>a>=2&&b>=2);
 const tables=math.tables||[2,5,10];
 const [a,b]=facts.length?pick(facts,r):[pick(tables,r),2+Math.floor(r()*8)];
 // The mistake uses an easy fact so the error is plainly visible: 2, 5 or 10 times table, off by one group or by one.
 const ma=pick([2,5,10],r),mb=3+Math.floor(r()*5),right=ma*mb,wrongN=r()<.5?right+ma:right+1;
 return {
  level:'reader',words:[250,400],teach:null,
  challenges:[
   {id:'c1',practises:`reading the word ${word} (look-alikes)`,item:{kind:'read-word',track:'words',spoken:`Find the word ${word}.`,answer:word,options:shuffle(group.slice(0,4).includes(word)?group.slice(0,4):[word,...group.filter(w=>w!==word).slice(0,3)],r)}},
   {id:'c2',practises:'building a sentence by reading each word (not by position)',item:{kind:'sentence',track:'words',spoken:sentence,sentence,answer,tiles:scramble(extra?[...answer,extra]:answer,r),mark:endMark(sentence)}},
   {id:'c3',practises:`sharing ${share.total} into ${share.groups} equal groups`,item:{kind:'math',track:'words',spoken:`${share.total} cookies shared on ${share.groups} plates. How many on each plate?`,display:`${share.total} ÷ ${share.groups} = ?`,answer:String(each),options:numberOptions(each,r,[each+share.groups>0?each+1:each+2])}},
   {id:'c4',practises:`times table fact ${a} × ${b}`,item:{kind:'math',track:'words',spoken:`What is ${a} times ${b}?`,display:`${a} × ${b} = ?`,answer:String(a*b),options:numberOptions(a*b,r,[a*b+a,a*b-a])}}
  ],
  mistake:{id:'m1',kind:'math',claim:`${ma} × ${mb} = ${wrongN}`,wrong:String(wrongN),right:String(right),
   hint:`Count in ${WORD_NUM[ma]||ma}s, ${WORD_NUM[mb]||mb} times.`,caught:`You caught me! ${ma} times ${mb} is ${right}, not ${wrongN}.`,
   fix:{kind:'math',track:'words',spoken:`What is ${ma} times ${mb}?`,display:`${ma} × ${mb} = ?`,answer:String(right),options:shuffle([String(right),String(wrongN),String(right-ma)],r)}}
 };
}
export function planChapter(model,{date,profile={}}={}){
 const r=rng(`${model.player}:${date}`);
 const early=(model.math?.track==='early')||model.literacy?.track==='letters';
 const base=early?earlyPlan(model,r):readerPlan(model,r);
 const companion=(model.companions||[])[0]||{name:'Pip',kind:'a cheerful little robot',emoji:'🤖'};
 const interests=shuffle(model.interests||[],r).slice(0,2);
 return {player:model.player,name:model.name,date,sibling:profile.sibling||null,companion,interests,...base,
  dadLines:(model.recent?.dadLines||[]).map(l=>l.text),yesterday:model.recent?.yesterday||null,play:model.recent?.play||[],
  tricks:(model.tricks||[]).map(t=>t.text),previous:model.story?.book||[],running:model.story?.running||[]};
}
