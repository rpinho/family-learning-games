// The unified learner model ("it knows the child"): one small, private, versioned profile per child that the Book's
// nightly chapter (and the grown-ups' readout) read. Compiled from the cross-game skill evidence (hub/skill-evidence.mjs
// with its item tags, hub/skill-items.mjs), the Book's own beat results, the Book's working model (learner.mjs: track,
// letters, words) and the grown-ups' skills focus. Pure functions only; file access is in learner-compile.mjs.
// Schema "family-learner-2" (book/SCHEMA.md). Evidence-honest:
//  - only FIRST answers count (a retry after a miss never adds success); a hint before the answer = with help;
//    independent (right, no help) is kept apart from right-with-help;
//  - an account's evidence is the account's: a profile name says whose game it was, not who held the device;
//  - nothing is called secure, too easy or too hard without enough answers (THRESHOLDS); thin evidence is named "low".
import {skillModel,SKILLS} from '../hub/skill-model.mjs';
import {wordPattern,shortVowel} from '../hub/skill-items.mjs';
import {FAMILIES,ORDER,isFamilyWord,canSoundOut,hasSound,lookAlikes} from '../hub/public/word-families.mjs';

export const PROFILE_SCHEMA='family-learner-2';
const DAY=864e5;
export const THRESHOLDS={
 history:45,        // days of evidence read
 window:21,         // days an item is judged on (older evidence only when the window has too little)
 minItem:4,         // answers before an item is "edge"
 minSecure:6,secureInd:.85,
 edge:[.5,.8],      // independent first-try rate of "practise now"
 struggleMisses:2,struggleInd:.5,minStruggle:3,
 tooHard:{n:8,ind:.25},tooEasy:{n:10,ind:.95},
 reviewDays:7       // a taught item not practised for this many days is due for review
};
const KINDS={letter:'literacy',lower:'literacy',sound:'literacy',vowel:'literacy',family:'literacy',pattern:'literacy',word:'literacy',
 fact:'math',table:'math',div:'math',divisor:'math',remainder:'math',cookies:'math',add:'math',place:'math',skip:'math',count:'math',takeaway:'math',numpattern:'math',puzzle:'math',
 chess:'chess'};
// Item kinds a profile reports on (words and single facts are evidence examples: one try each rarely says much).
const REPORTED=new Set(['letter','lower','sound','vowel','family','pattern','fact','table','div','divisor','remainder','cookies','add','place','skip','count','takeaway','numpattern','puzzle','chess']);
const round=(x,d=2)=>x==null?null:Math.round(x*10**d)/10**d;
const list=v=>Array.isArray(v)?v:[];

export function label(tag){
 const [k,v]=String(tag).split(':');
 switch(k){
  case 'letter':return `letter ${v}`;case 'lower':return `little ${v}`;case 'sound':return `the sound of ${v}`;
  case 'vowel':return `short ${v} in words`;case 'family':return `-${v} words`;case 'word':return `"${v}"`;
  case 'pattern':return ({cvc:'three-letter words (cat, pin)',blend:'words with blends (flag, frog)',digraph:'words with sh, ch, th, ck',
   'silent-e':'magic-e words (kite)','vowel-team':'vowel teams (ee, oa)','r-controlled':'ar, or, er words',rhyme:'rhyming',other:'longer words'})[v]||v;
  case 'fact':return v.replace('x',' × ');case 'table':return `the ${v} times table`;case 'div':{const [t,d]=v.split('/');return `${t} shared by ${d}`;}
  case 'divisor':return `sharing into ${v}`;case 'remainder':{const [t,d]=v.split('/');return `${t} shared by ${d} with some left over`;}
  case 'cookies':return `cookie ${v}`;case 'add':return v==='regroup'?'adding with carrying':'adding without carrying';case 'place':return 'place value';
  case 'skip':return `counting in ${v}s`;case 'count':return `counting ${v} things`;case 'takeaway':return `take away ${v}`;case 'numpattern':return `patterns (${v})`;
  case 'puzzle':return `${v} puzzles`;case 'chess':return `chess: ${v.replace(/-/g,' ')}`;
  default:return tag;
 }
}

// First answers per item with their tags (the skill model's rule: first answer only, an earlier hint = with help).
export function itemFirsts(evidence,player,cutoff,{history=THRESHOLDS.history}={}){
 const rows=list(evidence).filter(e=>e&&e.player===player&&Number.isFinite(e.at)&&e.at<cutoff&&e.at>=cutoff-history*DAY)
  .sort((a,b)=>a.at-b.at||String(a.item).localeCompare(String(b.item))||(b.hint?1:0)-(a.hint?1:0));
 const hinted=new Set(),seen=new Set(),out=[];
 for(const e of rows){
  if(e.hint){if(e.item)hinted.add(e.item);continue;}
  if(typeof e.ok!=='boolean'||!e.item||seen.has(e.item))continue;
  seen.add(e.item);
  out.push({at:e.at,ok:e.ok,help:!!e.help||hinted.has(e.item),tags:list(e.tags),source:e.source||null,chose:e.chose||null,skill:e.skill||null,...Object.fromEntries(['task','readTask','choices','ms','taggingRepaired','taggingUnresolved','modelled','gapPosition'].filter(k=>k in e).map(k=>[k,e[k]]))});
 }
 return out;
}
// Practice times per tag, including practice without right/wrong (a hunt for a letter, tracing).
function practiceTimes(evidence,player,cutoff,history){
 const t={};for(const e of list(evidence))if(e&&e.player===player&&Number.isFinite(e.at)&&e.at<cutoff&&e.at>=cutoff-history*DAY)for(const tag of list(e.tags))(t[tag]||=[]).push(e.at);
 return t;
}
function rate(xs){const n=xs.length;if(!n)return {n:0,ind:null,help:null,miss:null};let ind=0,help=0,miss=0;for(const x of xs){if(!x.ok)miss++;else if(x.help)help++;else ind++;}return {n,ind:ind/n,help:help/n,miss:miss/n};}
export function classify(r,{t=THRESHOLDS}={}){
 if(!r.n)return 'none';
 const misses=Math.round(r.miss*r.n);
 if(r.n>=t.tooEasy.n&&r.ind>=t.tooEasy.ind)return 'too-easy';
 if(r.n>=t.tooHard.n&&r.ind<t.tooHard.ind&&r.miss>=.5)return 'too-hard';
 if(r.n>=t.minSecure&&r.ind>=t.secureInd)return 'secure';
 if(r.n>=t.minStruggle&&misses>=t.struggleMisses&&r.ind<t.struggleInd)return 'struggle';
 if(r.n>=t.minItem&&r.ind>=t.edge[0]&&r.ind<=t.edge[1])return 'edge';
 if(r.n>=t.minItem&&r.ind>t.edge[1])return 'nearly-secure';
 return 'thin';
}
// Per tag: rate over the window (or the newest answers when the window is thin), this week, last seen, examples.
export function itemStats(firsts,cutoff,{t=THRESHOLDS,practice={}}={}){
 const by={};for(const f of firsts)for(const tag of f.tags)(by[tag]||=[]).push(f);
 const out={};
 for(const [tag,xs] of Object.entries(by)){
  const inWin=xs.filter(x=>x.at>=cutoff-t.window*DAY),older=inWin.length<t.minItem&&xs.length>inWin.length;
  const basis=older?xs.slice(-12):inWin,r=rate(basis),week=rate(xs.filter(x=>x.at>=cutoff-7*DAY));
  const times=[...xs.map(x=>x.at),...list(practice[tag])],last=Math.max(...times);
  const word=x=>(x.tags.find(s=>s.startsWith('word:'))||'').slice(5)||null;
  out[tag]={tag,kind:tag.split(':')[0],n:r.n,ind:round(r.ind),help:round(r.help),miss:round(r.miss),window:older?'older':`${t.window}d`,
   week:{n:week.n,ind:round(week.ind),miss:round(week.miss)},total:xs.length,daysSince:Math.floor((cutoff-last)/DAY)+1,
   days:new Set(xs.map(x=>Math.floor(x.at/DAY))).size,sources:[...new Set(xs.map(x=>x.source).filter(Boolean))],
   status:classify(r,{t}),
   misses:xs.filter(x=>!x.ok).slice(-4).map(x=>({daysAgo:Math.floor((cutoff-x.at)/DAY)+1,...(word(x)?{word:word(x)}:{}),...(x.chose?{chose:x.chose}:{})})),
   wins:xs.filter(x=>x.ok&&!x.help).slice(-3).map(word).filter(Boolean)};
 }
 return out;
}
// The Book's own beat results ({page, kind, misses, hints} per day, with the chapter's beat) as evidence records.
export function bookEvidence({progress,chapters={},player}){
 const out=[];
 for(const [date,day] of Object.entries(progress?.days||{})){const ch=chapters[date];if(!ch)continue;
  for(const r of list(day.results)){const g=ch.episode?.puzzles?.[r.page-1],b=g?episodeBeat(g):ch.pages?.[r.page]?.beat;if(!b||!b.kind||b.kind==='fork')continue;
   const at=Date.parse(r.at||day.startedAt||date+'T12:00:00Z');if(!Number.isFinite(at))continue;
   const tags=beatTags(b);if(!tags.length)continue;
   out.push({player,source:'book',skill:null,at,item:`book:${date}:${r.page}`,ok:(r.misses||0)===0&&r.correct!==false,help:(r.hints||0)>0||!!r.helpUnknown,...(r.helpUnknown?{helpUnknown:true}:{}),tags,readTask:b.kind==='signs'&&g?.kind!=='tiles',choices:b.options?.length||0,ms:r.firstTapMs??r.detail?.firstTapMs??null});}
  for(const h of list(day.hunts)){const m=String(h.id||'').match(/^([a-z])(?:-|$)/i);if(m&&h.foundAt)out.push({player,source:'book',at:Date.parse(h.foundAt),ok:null,tags:['letter:'+m[1].toUpperCase()]});}
 }
 return out;
}
const wt=w=>{const x=String(w||'').toLowerCase();if(!/^[a-z]{2,10}$/.test(x))return [];const p=wordPattern(x),v=shortVowel(x);return ['word:'+x,'pattern:'+p,...(v?['vowel:'+v]:[]),...(p==='cvc'?['family:'+x.slice(1)]:[])];};
export function episodeBeat(g){return g.kind==='tiles'?{kind:'signs',target:g.answer}:g.kind==='sound'?{kind:'stones',letter:g.letter}:g.kind==='count'?{kind:'count',n:g.count}:g.math?.type==='divide'?{kind:'share',total:g.math.a,groups:g.math.b}:g.math?.type==='fact'||g.math?.type==='multiply'?{kind:'score',a:g.math.a,b:g.math.b}:{kind:'puzzle',variant:'place'};}
export function beatTags(b){
 switch(b.kind){
  case 'signs':return wt(b.target);
  case 'stones':case 'kick-letter':return b.letter?['letter:'+String(b.letter).toUpperCase()]:[];
  case 'share':return b.total&&b.groups?['div:'+b.total+'/'+b.groups,'divisor:'+b.groups]:[];
  case 'remainder':return b.total&&b.groups?['remainder:'+b.total+'/'+b.groups]:[];
  case 'score':return b.a&&b.b?['fact:'+Math.min(b.a,b.b)+'x'+Math.max(b.a,b.b)]:[];
  case 'count':return b.n?['count:'+(b.n<=5?'1-5':b.n<=10?'6-10':'11-20')]:[];
  case 'puzzle':return ['puzzle:'+(b.variant||'puzzle'),...(b.variant==='nines'&&/9 × (\d+)/.test(b.display||'')?['fact:'+[9,Number(b.display.match(/9 × (\d+)/)[1])].sort((x,y)=>x-y).join('x')]:[])];
  case 'no':return b.right&&/^[A-Z]$/.test(b.right)?['letter:'+b.right]:[];
  default:return [];
 }
}
const brief=s=>({item:s.tag,label:label(s.tag),n:s.n,ind:s.ind,help:s.help,miss:s.miss,window:s.window,daysSince:s.daysSince,confidence:s.n>=8?'good':s.n>=5?'fair':'low',
 ...(s.misses.length&&s.miss>0?{recentMisses:s.misses}:{}),...(s.week.n?{week:s.week}:{})});
// How much an item matters for this child now: struggles before the edge, today's and this week's before older ones,
// the grown-ups' area priorities (skills focus), more misses, and enough answers to trust it.
const STATUS_W={struggle:1.5,edge:1.2,'nearly-secure':.6};
export const recencyW=d=>d<=1?2:d<=2?1.6:d<=7?1.2:.7;
function weight(s,{focus}){const area={letter:'sounds',lower:'sounds',sound:'sounds',vowel:'reading',family:'reading',pattern:'reading',chess:'chess'}[s.kind]||(KINDS[s.kind]==='math'?(['div','divisor','remainder','fact','table','cookies'].includes(s.kind)?'muldiv':'number'):null);
 const pri=1+(focus?.context?.[area]||0)+(focus?.focus?.[area]||0);
 return (STATUS_W[s.status]||.3)*recencyW(s.daysSince)*pri*(1+(s.miss||0))*(s.n>=8?1:s.n>=5?.85:.7);}

// ---------- the Book's plan hints ----------
const DECODE_ORDER=ORDER;
// Decodable words with a vowel: words he missed first, then family words he has not read cleanly, in teaching order.
export function vowelWords(v,{missed=[],mastered=[]}={}){
 const ok=w=>isFamilyWord(w)&&canSoundOut(w)&&w[1]===v&&lookAlikes(w,2,()=>0).length>=2;
 const m=new Set(mastered);
 const fresh=DECODE_ORDER.filter(f=>f[0]===v).flatMap(f=>FAMILIES[f]).filter(w=>ok(w)&&!m.has(w));
 return [...new Set([...missed.filter(ok),...fresh])].slice(0,6);
}
function letterPlan(cands,{early,keys}){
 // Early: a letter with a recorded sound; a letter he has not won as a key yet first (the key story moves on).
 const ok=s=>{const L=s.tag.split(':')[1].toUpperCase();return /^[A-Z]$/.test(L)&&(!early||hasSound(L));};
 const xs=cands.filter(ok);if(!xs.length)return null;
 const fresh=xs.filter(s=>!keys.has(s.tag.split(':')[1].toUpperCase())),s=(fresh[0]||xs[0]);
 const L=s.tag.split(':')[1].toUpperCase();
 return {letter:L,lowercase:s.kind==='lower',item:s.tag,status:s.status,keyOwned:keys.has(L),why:why(s)};
}
const pct=x=>x==null?'n/a':Math.round(x*100)+'%';
export function why(s){const ms=s.misses.slice(-2).map(m=>m.word?(m.chose?`${m.word} (chose ${m.chose})`:m.word):m.chose?`chose ${m.chose}`:null).filter(Boolean);
 return `${pct(s.ind)} right first try on their own (${s.n} answers, ${s.window})${s.help?`, ${pct(s.help)} with help`:''}${ms.length?`; missed ${ms.join(', ')}`:''}${s.daysSince<=1?'; met in the last 24 hours':s.daysSince<=2?'; met in the last 2 days':''}`;}
function mathPlan(cands,{facts,stats={}}){
 for(const s of cands){const [k,v]=[s.kind,s.tag.split(':')[1]];
  if(k==='div'){const [t,d]=v.split('/').map(Number);if(t>0&&d>=2&&d<=5&&t<=24&&t%d===0)return {kind:'share',total:t,groups:d,item:s.tag,status:s.status,why:why(s)};
   if(d>=2&&d<=5){const each=Math.max(2,Math.min(5,Math.round(t/d)||3));return {kind:'share',total:d*each,groups:d,item:s.tag,status:s.status,why:why(s)+` (book-sized: ${d*each} shared by ${d})`};}}
  if(k==='divisor'){const d=Number(v);if(d>=2&&d<=5){
   // The sharing with that many plates he met most recently and found hardest (book-sized), else a middle one.
   const mine=Object.values(stats).filter(x=>x.kind==='div'&&x.tag.endsWith('/'+d)).map(x=>({t:Number(x.tag.slice(4).split('/')[0]),x})).filter(({t})=>t<=24&&t%d===0&&t/d>=3)
    .sort((a,b)=>(b.x.miss||0)-(a.x.miss||0)||a.x.daysSince-b.x.daysSince||b.t-a.t);
   const total=mine[0]?.t||d*Math.min(6,Math.max(4,Math.floor(24/d)));
   return {kind:'share',total,groups:d,item:s.tag,status:s.status,why:why(s)+(mine[0]?` (${total} shared by ${d}: ${pct(mine[0].x.ind)} on its own)`:'')};}}
  if(k==='remainder'){const [t,d]=v.split('/').map(Number);if(t>d&&d>=2&&d<=5&&t<=20&&t%d)return {kind:'remainder',total:t,groups:d,item:s.tag,status:s.status,why:why(s)};}
  if(k==='fact'){const [a,b]=v.split('x').map(Number);if(a>=2&&b>=2&&a<=10&&b<=10)return {kind:'fact',a,b,item:s.tag,status:s.status,why:why(s)};}
  if(k==='table'){const a=Number(v);if(a>=2&&a<=10){const b=[6,7,8,4,3].find(x=>x!==a);return {kind:'fact',a,b,item:s.tag,status:s.status,why:why(s)};}}
  if(k==='count'&&facts==='early'){const [lo,hi]=v.split('-').map(Number);return {kind:'count',n:Math.min(hi,Math.max(lo,lo+2)),item:s.tag,status:s.status,why:why(s)};}
 }
 return null;
}
export function bookPlanFrom({stats,level,keys=new Set(),mastered=[],facts}){
 const byStatus=st=>Object.values(stats).filter(s=>REPORTED.has(s.kind)&&st.includes(s.status));
 const ranked=xs=>xs.sort((a,b)=>b._w-a._w||a.tag.localeCompare(b.tag));
 // Only what he met in the last two weeks steers a chapter (older items are for review).
 const pool=ranked([...byStatus(['struggle']),...byStatus(['edge'])].filter(s=>s.daysSince<=14));
 const early=level==='early';
 const letters=pool.filter(s=>['letter','lower','sound'].includes(s.kind));
 const letterFocus=letterPlan(letters,{early,keys});
 const vowels=pool.filter(s=>s.kind==='vowel'),families=pool.filter(s=>s.kind==='family'),patterns=pool.filter(s=>s.kind==='pattern');
 const wordPatterns=[];
 for(const s of vowels){const v=s.tag.split(':')[1],ws=s.misses.map(m=>m.word).filter(Boolean),missed=[...new Set(ws)].sort((a,b)=>ws.filter(x=>x===b).length-ws.filter(x=>x===a).length||ws.lastIndexOf(b)-ws.lastIndexOf(a));
  const words=vowelWords(v,{missed,mastered});if(words.length)wordPatterns.push({pattern:'cvc-short-'+v,vowel:v,item:s.tag,status:s.status,words,why:why(s)});}
 for(const s of families){const f=s.tag.split(':')[1];if(!FAMILIES[f]||wordPatterns.some(w=>w.vowel===f[0]))continue;
  const words=FAMILIES[f].filter(w=>canSoundOut(w)&&lookAlikes(w,2,()=>0).length>=2);if(words.length)wordPatterns.push({pattern:'family-'+f,vowel:f[0],item:s.tag,status:s.status,words:words.slice(0,6),why:why(s)});}
 // Blends and digraphs are named for the grown-ups and the prompt; a decodable reader's beats stay CVC.
 for(const s of patterns)if(['blend','digraph','silent-e','vowel-team'].includes(s.tag.split(':')[1]))wordPatterns.push({pattern:s.tag.split(':')[1],item:s.tag,status:s.status,words:[],why:why(s),note:'named only: his book words stay three-letter family words'});
 const math=pool.filter(s=>KINDS[s.kind]==='math');
 const mathFocus=mathPlan(math,{facts,stats});
 const top=wordPatterns.find(w=>w.words.length);
 const challengeIdea=!early&&top?`a sign he must read to open the way: "${top.words[0]}", beside look-alikes that differ only in the vowel, so the short ${top.vowel} decides it`
  :early&&letterFocus?`the ${letterFocus.letter} key is the one that opens today's door; he finds the ${letterFocus.letter} by its sound`
  :mathFocus?.kind==='share'?`${mathFocus.total} things must be shared fairly by ${mathFocus.groups} friends before the adventure can go on`:null;
 // An early (letters) book has no word reading: its words stay in struggles/edge for the grown-ups, not in the plan.
 return {letterFocus,wordPatterns:early?[]:wordPatterns.slice(0,3),mathFocus,challengeIdea};
}

// ---------- the profile ----------
// evidence: skill evidence records ({player, source, skill, at, item, ok, help, hint, tags, chose}) from the games'
// logs plus bookEvidence(); bookModel: the Book's working model (learner.mjs); focus: the grown-ups' skills focus.
export function compileProfile({player,now=Date.now(),cutoff=now,evidence=[],bookModel=null,focus=null,collection={},files={}}){
 const t=THRESHOLDS;
 const firsts=itemFirsts(evidence,player,cutoff);
 const practice=practiceTimes(evidence,player,cutoff,t.history);
 const planningFirsts=firsts.map(e=>e.readTask===false?{...e,tags:e.tags.filter(t=>!['word','vowel','family','pattern'].includes(t.split(':')[0]))}:e).filter(e=>!(e.choices>1&&e.ms!=null&&e.ms<2000));
 const stats=itemStats(planningFirsts,cutoff,{practice});
 for(const s of Object.values(stats))s._w=weight(s,{focus});
 const sm=skillModel({evidence:evidence.filter(e=>e.skill&&SKILLS[e.skill]),player,cutoff,profile:focus});
 const level=bookModel?.math?.track==='early'||bookModel?.literacy?.track==='letters'?'early':'reader';
 const keys=new Set(list(collection.keys).map(k=>String(k).toUpperCase()));
 const pick=st=>Object.values(stats).filter(s=>REPORTED.has(s.kind)&&st.includes(s.status)).sort((a,b)=>b._w-a._w||a.tag.localeCompare(b.tag));
 const strengths=pick(['secure','too-easy']).sort((a,b)=>b.n-a.n).slice(0,10).map(brief);
 const edge=pick(['edge']).slice(0,10).map(brief);
 const struggles=pick(['struggle']).slice(0,10).map(brief);
 // Review: what he has shown or been taught (secure, edge, a key he won) and has not met for a week.
 const taught=[...Object.values(stats).filter(s=>REPORTED.has(s.kind)&&['secure','nearly-secure','edge','too-easy'].includes(s.status)),
  ...[...keys].map(k=>stats['letter:'+k]||{tag:'letter:'+k,kind:'letter',n:0,daysSince:null})];
 const seenReview=new Set(),review=[];
 for(const s of taught){if(seenReview.has(s.tag))continue;seenReview.add(s.tag);
  if(s.daysSince==null||s.daysSince>t.reviewDays)review.push({item:s.tag,label:label(s.tag),daysSince:s.daysSince,why:s.daysSince==null?'a letter key from his book, no game answers since':`last met ${s.daysSince} days ago`});}
 review.sort((a,b)=>(b.daysSince??99)-(a.daysSince??99));
 const doNot={tooHard:[...pick(['too-hard']).map(s=>({item:s.tag,label:label(s.tag),n:s.n,ind:s.ind,why:why(s)})),
   ...Object.entries(sm.skills).filter(([,x])=>x.status==='too-hard').map(([k,x])=>({item:'skill:'+k,label:SKILLS[k].label,n:x.n,ind:x.ind}))],
  tooEasy:[...pick(['too-easy']).map(s=>({item:s.tag,label:label(s.tag),n:s.n,ind:s.ind})),
   ...Object.entries(sm.skills).filter(([,x])=>x.status==='too-easy').map(([k,x])=>({item:'skill:'+k,label:SKILLS[k].label,n:x.n,ind:x.ind}))]};
 const bookPlan=bookPlanFrom({stats,level,keys,mastered:list(bookModel?.literacy?.wordsMastered),facts:bookModel?.math?.track||'facts'});
 const lit=bookModel?.literacy;
 if(level!=='early'&&lit?.readingFocus?.length){
  const vowels=lit.readingFocus.filter(f=>f.startsWith('short-'));
  bookPlan.wordPatterns=vowels.slice(0,3).map(f=>{const v=f.slice(-1),s=lit.readingFeatures[f];return {pattern:'cvc-short-'+v,vowel:v,item:'vowel:'+v,status:s.rate<.5?'struggle':'edge',words:vowelWords(v,{missed:lit.wordsStuck||[],mastered:lit.wordsMastered||[]}),why:`${Math.round(s.rate*100)}% independent first try (${s.attempts} reading answers, 30d)`};});
  bookPlan.readingFocus=lit.readingFocus;bookPlan.confidenceWords=(lit.wordsAlmost||[]).filter(w=>lit.readingEvidence[w]?.rawRate<=.8).slice(0,16);bookPlan.hearAndBuildWords=lit.wordsAboveLevel||[];bookPlan.soundFocus=lit.readingFocus.filter(f=>['final-consonant','ck','final-blends'].includes(f));bookPlan.readingSupport=lit.readingSupport;
  const p=bookPlan.wordPatterns[0];if(p)bookPlan.challengeIdea=`a sign with "${p.words[0]}" beside look-alikes; tap each letter to hear its sound, then Hear it blends the word; practise beside a confidence word`;
 }
 const listed=new Set([...strengths,...edge,...struggles].map(x=>x.item));
 for(const k of ['letterFocus','mathFocus'])if(bookPlan[k]?.item)listed.add(bookPlan[k].item);for(const w of bookPlan.wordPatterns)listed.add(w.item);
 const evidenceOut=Object.fromEntries([...listed].filter(k=>stats[k]).sort().map(k=>{const s=stats[k];return [k,{n:s.n,ind:s.ind,help:s.help,miss:s.miss,window:s.window,total:s.total,days:s.days,daysSince:s.daysSince,week:s.week,sources:s.sources,misses:s.misses,wins:s.wins}];}));
 const counts={};for(const e of evidence)if(e&&e.player===player&&e.at<cutoff&&e.at>=cutoff-t.history*DAY&&typeof e.ok==='boolean')counts[e.source||'?']=(counts[e.source||'?']||0)+1;
 return {schema:PROFILE_SCHEMA,player,builtAt:new Date(now).toISOString(),cutoff:new Date(cutoff).toISOString(),level,
  thresholds:{firstAnswersOnly:true,history:t.history,window:t.window,minItem:t.minItem,minSecure:t.minSecure,edge:t.edge,reviewDays:t.reviewDays},
  literacy:lit?Object.fromEntries(['wordLevel','sentenceLevel','wordsMastered','wordsAlmost','wordsStuck','wordsAboveLevel','readingEvidence','readingFeatures','readingFocus','readingSupport','masteryRule'].filter(k=>k in lit).map(k=>[k,lit[k]])):null,
  skills:Object.fromEntries(Object.entries(sm.skills).map(([k,x])=>[k,{status:x.status,n:x.n,ind:x.ind,assisted:x.assisted,miss:x.miss,trend:x.trend,daysSince:x.daysSince}])),
  strengths,edge,struggles,review:review.slice(0,8),doNot,bookPlan,evidence:evidenceOut,
  sources:{answers:counts,firstAnswers:firsts.length,focus:!!focus,bookModel:files.bookModel||null,life:files.life||null,sage:files.sage||null},
  notes:['Accounts, not people: answers are credited to the profile that was signed in.','Right with help is not independent; only first answers count.',...(evidence.some(e=>e?.player===player&&e.helpUnknown)?['Older Book replay logs omit hint data; unknown assistance is counted as supported, never independent.']:[]),'Not a clinical or school assessment.']};
}
