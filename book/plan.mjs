// The Book: deterministic chapter plan. Code, not the language model, decides WHAT is learned and how
// the adventure needs it (the "beats"); the model only writes the scenes and narration around them.
// Learning is a plot necessity, never a quiz: a companion shows its letter and the child collects its
// KEY; letter stepping-stones get the friends across; things are counted because the train needs that
// many seats; magic words on signs and doors make the world respond when the child reads them; a spell
// only works when its words are put back in order; pizza is shared fairly; and once per chapter a friend
// insists on something wrong and the child says NO! (then fixes it). Same learner model + date = same plan.
import {FIRST_WORDS,WORD_GROUPS,SENTENCES,SENTENCE_DISTRACT,scramble,tilesOf,endMark,shuffle} from '../hub/public/word-break.mjs';

export function rng(seedText){let h=2166136261;for(const c of String(seedText)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(a,r)=>a[Math.floor(r()*a.length)];
export const LOOK={B:'PDR',D:'BOP',P:'BRF',R:'PBK',F:'EPT',E:'FLB',T:'ILF',L:'ITE',I:'LTJ',M:'NWH',N:'MHZ',W:'MVN',V:'WYU',O:'QCD',C:'OGQ',G:'COQ',S:'ZGC',A:'HVR',H:'NAK',K:'XRH',U:'VJO',Y:'VXT',Z:'NSX',X:'KYZ',J:'LUI',Q:'OGC'};
export const SOUNDS={A:'a',B:'buh',C:'kuh',D:'duh',E:'eh',F:'fff',G:'guh',H:'hhh',I:'ih',J:'juh',K:'kuh',L:'lll',M:'mmm',N:'nnn',O:'o',P:'puh',Q:'kwuh',R:'rrr',S:'sss',T:'tuh',U:'uh',V:'vvv',W:'wuh',X:'ks',Y:'yuh',Z:'zzz'};
const WORD_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numberOptions(answer,r,near=[]){const c=[...near,answer+1,answer-1,answer+2,answer-2].filter(n=>Number.isInteger(n)&&n>=0&&n!==answer);return shuffle([answer,...[...new Set(c)].slice(0,2)],r).map(String);}
// Things to count: [library prop id, spoken plural, emoji fallback]
export const COUNT_THINGS=[['baby-dino','baby dinosaurs','🦕'],['ball','soccer balls','⚽'],['egg','dinosaur eggs','🥚'],['pizza','pizzas','🍕'],['star','stars','⭐']];
const cap=w=>w[0].toUpperCase()+w.slice(1);
const near=l=>[...(LOOK[l]||'')].filter(c=>c!==l);
const pictureFor=l=>FIRST_WORDS.filter(([w])=>w[0].toUpperCase()===l&&!w.includes('-'));

// Which friend "owns" which letter: the family's cast says so ({letter, word, shape}); otherwise the
// first letter of the friend's name.
export function letterOwners(cast){
 return (cast||[]).map(c=>{const name=c.name.replace(/^the\s+/i,'');const letter=(c.letter||name[0]).toUpperCase();
  return {id:c.id,name:c.name,letter,sound:SOUNDS[letter]||letter,word:(c.word||name.split(/\s+/)[0]).toLowerCase(),shape:c.shape||`make the shape of the letter ${letter}`};}).filter(o=>/^[A-Z]$/.test(o.letter));
}
function earlyBeats(m,r,{cast,collection,things}){
 const keys=new Set((collection?.keys)||[]),known=new Set(m.literacy.letters),learning=m.literacy.learning.filter(c=>/^[A-Z]$/.test(c));
 const owners=letterOwners(cast);
 // Today's letter: a friend's letter he is still learning, else a friend's letter not yet collected, else any.
 const owner=owners.find(o=>learning.includes(o.letter)&&!keys.has(o.letter))||owners.find(o=>!keys.has(o.letter))||pick(owners,r)||{id:null,name:'Bo',letter:'B',sound:'buh',word:'bear',shape:'make the shape of the letter B'};
 const L=owner.letter,sound=owner.sound;
 const others=shuffle(near(L),r).slice(0,2);while(others.length<2)others.push(pick('MTKZX'.split('').filter(c=>c!==L),r));
 const stones=shuffle([L,L,L,...others,others[0]],r);
 // Spaced review inside the story: the NO! beat is about an earlier key when there is one.
 const review=owners.find(o=>keys.has(o.letter)&&o.letter!==L)||owner;
 const wrong=near(review.letter).find(c=>c!==L)||near(review.letter)[0]||'M';
 const [thing,things_,emoji]=things;const count=Math.min(Math.max(3,m.math?.countTo||5),3+Math.floor(r()*4));
 const who=(cast.find(c=>c.id!==owner.id&&c.id!==review.id)||cast[0]||{id:null,name:'Bo'});
 return {
  letter:L,
  beats:[
   {id:'b1',kind:'teach-letter',what:`${owner.name} shows its letter ${L} (${L} says "${sound}") and gives ${m.name} the ${L} key`,letter:L,sound,owner:owner.id,ownerName:owner.name,word:owner.word,shape:owner.shape,
    lines:[[owner.id||'narrator',`${cap(sound)}! ${cap(sound)}! Look, I ${owner.shape}.`],['narrator',`${L}. ${L} says ${sound}. ${cap(owner.word)} starts with ${L}.`]],tap:`${L}! ${cap(sound)}!`},
   {id:'b2',kind:'stones',what:`letter stepping-stones: the friends can only cross on the ${L} stones, so ${m.name} taps the three ${L} stones`,letter:L,sound,stones,need:3,
    spoken:`Tap the stones with ${L}. ${L} says ${sound}.`,notIt:`That one is not ${L}. Find ${sound}.`,done:`Hop, hop, hop! You found all the ${L} stones!`},
   {id:'b3',kind:'count',what:`count the ${things_} because the story needs that many (seats on the train, slices, eggs to carry)`,thing,things:things_,emoji,n:count,
    spoken:`Tap each one to count the ${things_}.`,ask:`How many ${things_}?`,answer:String(count),options:numberOptions(count,r)},
   {id:'b4',kind:'no',what:`${who.name} insists "${cap(review.word)} starts with ${wrong}" and wants to do something silly with it; ${m.name} says NO! and fixes it`,who:who.id,whoName:who.name,
    claim:`${cap(review.word)} starts with ${wrong}!`,ask:`Can I put the ${wrong} key in the ${review.word} lock? Can I? Please?`,wrong,right:review.letter,options:shuffle([review.letter,wrong,near(review.letter).find(c=>c!==wrong)||'O'],r),
    ifYes:`Oops! The ${wrong} key does not fit. Hmm.`,caught:`You said NO! ${cap(review.word)} starts with ${review.letter}, not ${wrong}.`,fixSpoken:`Which letter does ${review.word} start with?`,hint:`Listen: ${review.word}. ${cap(review.sound||SOUNDS[review.letter])}. What sound is first?`}
  ],
  quest:`Find three things that start with ${L} (${sound}) and show Dad!`,
  reward:{key:L}
 };
}
function wordGroupFor(word){for(const g of WORD_GROUPS.flat())if(g.includes(word))return g;return null;}
// Magic words (the Nell mechanic): words he has mastered go quiet in the narration and glow in the scene;
// he reads them to make things happen. More of them as he masters more words.
export function magicWords(m,r,{collection}){
 const mastered=(m.literacy.wordsMastered||[]).filter(w=>/^[a-z]{2,7}$/.test(w));
 const read=new Set((collection?.words)||[]);
 const pool=mastered.length?mastered:WORD_GROUPS[0].map(g=>g[0]);
 const n=Math.min(4,2+Math.floor(mastered.length/12));
 // Mostly new-to-the-book words, one review word he has already read in the book.
 const fresh=shuffle(pool.filter(w=>!read.has(w)),r),old=shuffle(pool.filter(w=>read.has(w)),r);
 return [...fresh.slice(0,n-(old.length?1:0)),...old.slice(0,1)].slice(0,n);
}
function readerBeats(m,r,{collection}){
 const lit=m.literacy,math=m.math||{};
 const stuck=lit.wordsStuck.filter(w=>wordGroupFor(w));
 const word=stuck.length?pick(stuck.slice(0,3),r):pick(WORD_GROUPS[Math.max(0,Math.min(2,lit.wordLevel-1))],r)[0];
 const group=wordGroupFor(word)||pick(WORD_GROUPS[0],r);
 const sentence=pick(SENTENCES[Math.max(0,Math.min(2,lit.sentenceLevel-1))],r),answer=tilesOf(sentence);
 const extra=lit.sentenceLevel>=2?answer.map(w=>SENTENCE_DISTRACT[w.toLowerCase()]).find(w=>w&&!answer.some(a=>a.toLowerCase()===w)):null;
 const share=(math.hardShares||[]).filter(s=>s.total&&s.groups&&s.total%s.groups===0&&s.groups<=5&&s.total<=24).at(-1)||pick([{total:12,groups:3},{total:15,groups:5},{total:16,groups:4},{total:12,groups:4}],r);
 const each=share.total/share.groups;
 const facts=(math.factsStuck||[]).map(f=>f.split('x').map(Number)).filter(([a,b])=>a>=2&&b>=2&&a<=10&&b<=10);
 const tables=math.tables||[2,5,10];
 const [a,b]=facts.length?pick(facts,r):[pick(tables,r),2+Math.floor(r()*7)];
 // Numbers as tools: sharing when division is what he is working on, the scoreboard otherwise.
 const useShare=(math.hardShares||[]).length>0||r()<.5;
 const numberBeat=useShare?
  {id:'b3',kind:'share',what:`share ${share.total} pizza slices fairly on ${share.groups} plates (each tap deals one slice onto every plate; then he says how many each)`,total:share.total,groups:share.groups,thing:'pizza slices',
   spoken:`Tap the pizza to deal one slice onto every plate.`,ask:`How many slices on each plate?`,answer:String(each),options:numberOptions(each,r)}
  :{id:'b3',kind:'score',what:`the scoreboard: each goal is worth ${a} points and the team scored ${b} goals; he works out the points`,a,b,
   spoken:`Each goal is worth ${a} points. We scored ${b} goals. How many points?`,display:`${b} × ${a}`,answer:String(a*b),options:numberOptions(a*b,r,[a*b+a,a*b-a])};
 const ma=pick([2,5,10],r),mb=3+Math.floor(r()*5),right=ma*mb,wrongN=r()<.5?right+ma:right+1;
 return {
  beats:[
   {id:'b1',kind:'signs',what:`three signs (on trains, doors or paths) look almost the same; they need the one that says "${word}", so ${m.name} reads them all`,target:word,options:shuffle(group.slice(0,4).includes(word)?group.slice(0,3).includes(word)?group.slice(0,3):[word,...group.filter(w=>w!==word).slice(0,2)]:[word,...group.filter(w=>w!==word).slice(0,2)],r),
    spoken:`We need the one that says ${word}. Read every letter.`,notIt:`That sign says something else. Read every letter.`},
   {id:'b2',kind:'spell',what:`a magic spell has fallen apart; it only works when its words are put back in order, read word by word (not by where they lie)`,sentence,answer,tiles:scramble(extra?[...answer,extra]:answer,r),mark:endMark(sentence),
    spoken:`The spell says: ${sentence} Put the words back in order.`},
   numberBeat,
   {id:'b4',kind:'no',what:`a friend insists "${ma} × ${mb} = ${wrongN}" and wants to put it on the scoreboard; ${m.name} says NO! and fixes it`,who:null,
    claim:`${ma} times ${mb} is ${wrongN}!`,display:`${ma} × ${mb} = ${wrongN}`,ask:`Can I put ${wrongN} on the scoreboard? Can I? Please?`,wrong:String(wrongN),right:String(right),options:shuffle([String(right),String(wrongN),String(right-ma)],r),
    ifYes:`Oops! The scoreboard buzzes. That does not look right.`,caught:`You said NO! ${ma} times ${mb} is ${right}, not ${wrongN}.`,fixSpoken:`What is ${ma} times ${mb}?`,hint:`Count in ${WORD_NUM[ma]||ma}s, ${WORD_NUM[mb]||mb} times.`}
  ]
 };
}
// Who is in today's chapter: the child's fixed companions, then a rotating few from the family's cast
// (the child's own toys, like the Primer's Dinosaur, Duck, Peter and Purple). Without a cast file,
// the profile's companions.
export function chooseCast(model,{date,cast,level}){
 const fallback=(model.companions||[]).length?model.companions:[{name:'Pip',kind:'a cheerful little robot',emoji:'🤖'}];
 if(!cast?.cast?.length)return fallback.map(c=>({id:c.id||c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),...c}));
 const r=rng(`cast:${model.player}:${date}`),byId=Object.fromEntries(cast.cast.map(c=>[c.id,c]));
 const mine=cast.children?.[model.player];
 if(mine){
  const fixed=(mine.fixed||[]).map(id=>byId[id]).filter(Boolean),pool=(mine.rotate||[]).map(id=>byId[id]).filter(Boolean);
  const out=[...fixed,...shuffle(pool,r).slice(0,Math.max(0,Number(mine.perChapter??2)))];
  return out.length?out:fallback;
 }
 const n=Math.max(1,Number(cast.perChapter?.[level])||2);
 return shuffle(cast.cast,r).slice(0,n);
}
export function chooseProps(model,cast){return (cast?.children?.[model.player]?.props||[]).map(id=>(cast.props||[]).find(p=>p.id===id)).filter(Boolean);}
// Life themes (distilled privately from the family's notes): one or two per chapter, rotating by date.
export function chooseThemes(life,r){const t=(life?.themes||[]).filter(x=>x&&x.seed);return shuffle(t,r).slice(0,2);}
export function planChapter(model,{date,profile={},cast=null,collection={},life=null}={}){
 const r=rng(`${model.player}:${date}`);
 const early=(model.math?.track==='early')||model.literacy?.track==='letters';
 const members=chooseCast(model,{date,cast,level:early?'early':'reader'}),companion=members[0];
 // The letter owners for a young reader: everyone in his cast (not only today's), so keys can be collected over weeks.
 const everyone=early&&cast?.children?.[model.player]?[...(cast.children[model.player].fixed||[]),...(cast.children[model.player].rotate||[])].map(id=>cast.cast.find(c=>c.id===id)).filter(Boolean):members;
 const things=pick(COUNT_THINGS,r);
 let base;
 if(early){
  // Today's letter owner must be in today's chapter.
  base=earlyBeats(model,r,{cast:everyone,collection,things});
  const owner=everyone.find(c=>c.id===base.beats[0].owner);if(owner&&!members.some(c=>c.id===owner.id))members.push(owner);
  const noWho=everyone.find(c=>c.id===base.beats[3].who);if(noWho&&!members.some(c=>c.id===noWho.id)){base.beats[3].who=members.find(c=>c.id!==base.beats[0].owner)?.id||members[0].id;base.beats[3].whoName=(members.find(c=>c.id===base.beats[3].who)||members[0]).name;base.beats[3].what=base.beats[3].what.replace(noWho.name,base.beats[3].whoName);}
 }else{
  base=readerBeats(model,r,{collection});
  const who=members[1]||members[0];base.beats[3].who=who?.id||null;base.beats[3].whoName=who?.name||'a friend';base.beats[3].what=`${who?.name||'A friend'} ${base.beats[3].what.replace(/^a friend /,'')}`;
  base.magic=magicWords(model,r,{collection});
  base.quest=`Find the word "${base.magic[0]||base.beats[0].target}" somewhere at home, on a box or in a book, and show Dad!`;
 }
 const interests=shuffle(model.interests||[],r).slice(0,3);
 return {player:model.player,name:model.name,date,level:early?'early':'reader',sibling:profile.sibling||null,companion,cast:members,props:chooseProps(model,cast),interests,
  arc:profile.arc||null,compass:profile.compass||[],themes:chooseThemes(life,r),collection:{keys:collection?.keys||[],words:collection?.words||[]},
  ...base,magic:base.magic||[],
  dadLines:(model.recent?.dadLines||[]).map(l=>l.text),yesterday:model.recent?.yesterday||null,play:model.recent?.play||[],
  tricks:(model.tricks||[]).map(t=>t.text),previous:model.story?.book||[],running:model.story?.running||[]};
}
