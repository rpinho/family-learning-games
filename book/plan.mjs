// The Book: deterministic chapter plan. Code, not the language model, decides WHAT is learned and how
// the adventure needs it (the "beats"); the model only writes the scenes and narration around them.
// Learning is a plot necessity, never a quiz: a companion shows its letter and the child collects its
// KEY; letter stepping-stones get the friends across; things are counted because the train needs that
// many seats; magic words on signs and doors make the world respond when the child reads them; a spell
// only works when its words are put back in order; pizza is shared fairly; and once per chapter a friend
// insists on something wrong and the child says NO! (then fixes it). Same learner model + date = same plan.
import {letterQuest,readerQuest} from './quests.mjs';
import {FIRST_WORDS,WORD_GROUPS,SENTENCES,SENTENCE_DISTRACT,scramble,tilesOf,endMark,shuffle} from '../hub/public/word-break.mjs';
import {FAMILIES,familyOf,isFamilyWord,lookAlikes,soundOut,familyTarget,DECODABLE_SENTENCES,hasSound} from '../hub/public/word-families.mjs';

export function rng(seedText){let h=2166136261;for(const c of String(seedText)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(a,r)=>a[Math.floor(r()*a.length)];
export const LOOK={B:'PDR',D:'BOP',P:'BRF',R:'PBK',F:'EPT',E:'FLB',T:'ILF',L:'ITE',I:'LTJ',M:'NWH',N:'MHZ',W:'MVN',V:'WYU',O:'QCD',C:'OGQ',G:'COQ',S:'ZGC',A:'HVR',H:'NAK',K:'XRH',U:'VJO',Y:'VXT',Z:'NSX',X:'KYZ',J:'LUI',Q:'OGC'};
// Letter sounds: ONE clean phoneme each, as Letter Quest voices them (narrate.py speaks a short [[...]] on its own,
// isolated, at a gentle speed). Never text ("Lll" is read as letter names), never a stretched or schwa'd sound
// ("[[lll]]" came out as "lol", "[[bə]]. [[bə]], [[bə]]" as "boo-boo-ya").
export const SOUNDS={A:'[[æ]]',B:'[[b]]',C:'[[k]]',D:'[[d]]',E:'[[ɛ]]',F:'[[f]]',G:'[[ɡ]]',H:'[[h]]',I:'[[ɪ]]',J:'[[dʒ]]',K:'[[k]]',L:'[[l]]',M:'[[m]]',N:'[[n]]',O:'[[ɑ]]',P:'[[p]]',Q:'[[kw]]',R:'[[ɹ]]',S:'[[s]]',T:'[[t]]',U:'[[ʌ]]',V:'[[v]]',W:'[[w]]',X:'[[ks]]',Y:'[[j]]',Z:'[[z]]'};
// A sound for text shown to grown-ups (e.g. the quest card): /s/.
export const soundText=s=>'/'+String(s).replace(/^\[\[|\]\]$/g,'')+'/';
const WORD_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function numberOptions(answer,r,near=[]){const c=[...near,answer+1,answer-1,answer+2,answer-2].filter(n=>Number.isInteger(n)&&n>=0&&n!==answer);return shuffle([answer,...[...new Set(c)].slice(0,2)],r).map(String);}
// Things to count: [library prop id, spoken plural, emoji fallback]
// Things the child DOES with his finger to move the story (no learning attached; he plays).
export const ACTIONS={kick:'he flicks the ball into the goal past a diving keeper (a soccer pitch or the garden; a friend or Dad is the keeper)',throw:'he throws a ball and a friend runs to fetch it',drive:'he pulls the lever and drives the train to the next place (the train carries everyone)'};
export const COUNT_THINGS=[['baby-dino','baby dinosaurs','🦕'],['ball','soccer balls','⚽'],['egg','dinosaur eggs','🥚'],['pizza','pizzas','🍕'],['star','stars','⭐']];
const cap=w=>w.startsWith('[[')?w:w[0].toUpperCase()+w.slice(1);
const near=l=>[...(LOOK[l]||'')].filter(c=>c!==l);
const pictureFor=l=>FIRST_WORDS.filter(([w])=>w[0].toUpperCase()===l&&!w.includes('-'));

// Which friend "owns" which letter: the family's cast says so ({letter, word, shape}); otherwise the
// first letter of the friend's name.
export function letterOwners(cast){
 return (cast||[]).map(c=>{const name=c.name.replace(/^the\s+/i,'');const letter=(c.letter||name[0]).toUpperCase();
  return {id:c.id,name:c.name,letter,sound:hasSound(letter)?SOUNDS[letter]:null,word:(c.word||name.split(/\s+/)[0]).toLowerCase(),shape:c.shape||`make the shape of the letter ${letter}`};}).filter(o=>/^[A-Z]$/.test(o.letter));
}
function earlyBeats(m,r,{cast,collection,things,soccer=false,focus=null,grown='Dad'}){
 const keys=new Set((collection?.keys)||[]),known=new Set(m.literacy.letters),learning=m.literacy.learning.filter(c=>/^[A-Z]$/.test(c));
 // Only a letter with a recorded sound is taught with its sound (see word-families.mjs SOUND_LETTERS).
 const owners=letterOwners(cast).filter(o=>o.sound);
 // Today's letter: a friend's letter he is still learning, else a friend's letter not yet collected, else any.
 // A grown-up can ask for a letter to be revisited (e.g. the home hunt found nothing): focusLetter in the profile.
 const owner=(focus&&owners.find(o=>o.letter===String(focus).toUpperCase()))||owners.find(o=>learning.includes(o.letter)&&!keys.has(o.letter))||owners.find(o=>!keys.has(o.letter))||pick(owners,r)||{id:null,name:'Bo',letter:'B',sound:SOUNDS.B,word:'bear',shape:'make the shape of the letter B'};
 const L=owner.letter,sound=owner.sound;
 const others=shuffle(near(L),r).slice(0,2);while(others.length<2)others.push(pick('MTKZX'.split('').filter(c=>c!==L),r));
 const stones=shuffle([L,L,L,...others,others[0]],r);
 // Spaced review inside the story: the NO! beat is about an earlier key when there is one.
 const review=owners.find(o=>keys.has(o.letter)&&o.letter!==L)||owner;
 const wrong=near(review.letter).find(c=>c!==L)||near(review.letter)[0]||'M';
 const [thing,things_,emoji]=things;
 // An outside tutor (Sage) flags counting: count 6 to 9 things (just past what he is sure of), else 3 to 6.
 const sageCount=[...(m.sage?.practising||[]),...(m.sage?.recentMisses||[]).map(x=>typeof x==='string'?x:JSON.stringify(x))].some(s=>/counting/i.test(s));
 const count=sageCount?6+Math.floor(r()*4):Math.min(Math.max(3,m.math?.countTo||5),3+Math.floor(r()*4));
 const who=(cast.find(c=>c.id!==owner.id&&c.id!==review.id)||cast[0]||{id:null,name:'Bo'});
 return {
  letter:L,
  beats:[
   {id:'b1',kind:'teach-letter',what:`${owner.name} shows its letter ${L} (the sound ${soundText(sound)}) and gives ${m.name} the ${L} key`,letter:L,sound,owner:owner.id,ownerName:owner.name,word:owner.word,shape:owner.shape,
    // Each thing said once (a line that repeats a sound or a letter sounds like a glitch to a child).
    lines:[[owner.id||'narrator',`Look, I ${owner.shape}.`],['narrator',`${L} says ${sound}. ${cap(owner.word)} starts with ${L}.`]],tap:`Yes! ${cap(owner.word)} starts with ${sound}.`},
   soccer?{id:'b2',kind:'kick-letter',what:`on the soccer pitch three balls have letters on them; only the ${L} ball can score, so ${m.name} kicks the ${L} ball past the keeper into the goal (he flicks it himself)`,letter:L,sound,balls:shuffle([L,...others],r),
     spoken:`Kick the ball with ${L}. ${L} says ${sound}.`,notIt:`That one is a different letter.`,done:`You kicked the ${L} ball in!`}
   :{id:'b2',kind:'stones',what:`letter stepping-stones: the friends can only cross on the ${L} stones, so ${m.name} taps the three ${L} stones`,letter:L,sound,stones,need:3,
    spoken:`Tap the stones with ${L}. ${L} says ${sound}.`,notIt:`That one is a different letter.`,done:`You found all the ${L} stones!`},
   {id:'b3',kind:'count',what:`count the ${things_} because the story needs that many (seats on the train, slices, eggs to carry)`,thing,things:things_,emoji,n:count,
    spoken:`Tap each one to count the ${things_}.`,ask:`How many ${things_}?`,answer:String(count),options:numberOptions(count,r)},
   {id:'b4',kind:'no',what:`${who.name} insists "${cap(review.word)} starts with ${wrong}" and wants to do something silly with it; ${m.name} says NO! and fixes it`,who:who.id,whoName:who.name,
    claim:`${cap(review.word)} starts with ${wrong}!`,ask:`Can I put the ${wrong} key in the ${review.word} lock? Can I? Please?`,wrong,right:review.letter,options:shuffle([review.letter,wrong,near(review.letter).find(c=>c!==wrong)||'O'],r),
    ifYes:`Oops! The ${wrong} key does not fit. Hmm.`,caught:`You said NO! ${cap(review.word)} starts with ${review.letter}, not ${wrong}.`,fixSpoken:`Which letter does ${review.word} start with?`,hint:`Listen: ${review.word}. ${review.sound||SOUNDS[review.letter]}. What sound is first?`},
   // Numbers in order (1 to 5): an outside tutor flagged ordering; a quick, satisfying play beat for everyone.
   {id:'b5',kind:'order',what:`the friends line up (for the train, a photo or a race) and ${m.name} puts the numbers 1 to 5 in order`,numbers:[1,2,3,4,5],tiles:shuffle(['1','2','3','4','5'],r),
    spoken:'Tap the numbers in order. One, two, three, four, five!',done:'One, two, three, four, five! All in order!'}
  ],
  // A revisited letter is a Letter hunt (its shape); a new one a Sound hunt.
  quest:letterQuest(L,{sound,grown,kind:focus&&String(focus).toUpperCase()===L?'shape':'sound',friend:owner.id?{name:owner.name,emoji:owner.emoji}:null}),
  reward:{key:L}
 };
}
function wordGroupFor(word){for(const g of WORD_GROUPS.flat())if(g.includes(word))return g;return null;}
// Magic words (the Nell mechanic): words he has mastered go quiet in the narration and glow in the scene;
// he reads them to make things happen. More of them as he masters more words.
export function magicWords(m,r,{collection,decodable=false}){
 let mastered=(m.literacy.wordsMastered||[]).filter(w=>/^[a-z]{2,7}$/.test(w));
 // A beginning reader's magic words are decodable family words only (his mastered ones, else today's family).
 if(decodable){mastered=mastered.filter(isFamilyWord);if(mastered.length<2){const t=familyTarget(m,r);mastered=[...new Set([...mastered,...FAMILIES[familyOf(t)]])];}}
 const read=new Set((collection?.words)||[]);
 const pool=mastered.length?mastered:WORD_GROUPS[0].map(g=>g[0]);
 const n=Math.min(4,2+Math.floor(mastered.length/12));
 // Mostly new-to-the-book words, one review word he has already read in the book.
 const fresh=shuffle(pool.filter(w=>!read.has(w)),r),old=shuffle(pool.filter(w=>read.has(w)),r);
 return [...fresh.slice(0,n-(old.length?1:0)),...old.slice(0,1)].slice(0,n);
}
// A beginning reader (decodable): every word he must read is a CVC word from a word family (cat, big, hop), and
// look-alikes share its first letter and differ in the vowel or the end (cat / can / cot): a first-letter guess
// cannot pass. After each tap a friend sounds the tapped word out (c-a-t, cat), right or wrong.
function readerBeats(m,r,{collection,decodable=false}){
 const lit=m.literacy,math=m.math||{};
 let word,options,sentence,answer,extra=null;
 if(decodable){word=familyTarget(m,r);let la=lookAlikes(word,2,r);
  // A word without two look-alikes (sun) gives way to a family word that has them.
  if(la.length<2){word=FAMILIES[familyOf(word)].find(x=>lookAlikes(x,2).length>=2)||'cat';la=lookAlikes(word,2,r);}
  options=shuffle([word,...la],r);
  sentence=pick(DECODABLE_SENTENCES,r);answer=tilesOf(sentence);
  if(lit.sentenceLevel>=2){const w=answer.find(x=>isFamilyWord(x));extra=w?lookAlikes(w,1,r)[0]||null:null;}}
 else{const stuck=lit.wordsStuck.filter(w=>wordGroupFor(w));
  word=stuck.length?pick(stuck.slice(0,3),r):pick(WORD_GROUPS[Math.max(0,Math.min(2,lit.wordLevel-1))],r)[0];
  const group=wordGroupFor(word)||pick(WORD_GROUPS[0],r);
  options=shuffle(group.slice(0,4).includes(word)?group.slice(0,3).includes(word)?group.slice(0,3):[word,...group.filter(w=>w!==word).slice(0,2)]:[word,...group.filter(w=>w!==word).slice(0,2)],r);
  sentence=pick(SENTENCES[Math.max(0,Math.min(2,lit.sentenceLevel-1))],r);answer=tilesOf(sentence);
  extra=lit.sentenceLevel>=2?answer.map(w=>SENTENCE_DISTRACT[w.toLowerCase()]).find(w=>w&&!answer.some(a=>a.toLowerCase()===w)):null;}
 const sounds=decodable?Object.fromEntries([...options,...answer.filter(isFamilyWord),...(extra?[extra]:[])].map(w=>[w.toLowerCase(),soundOut(w)]).filter(([,t])=>t)):null;
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
 // An outside tutor (Sage) says he is practising place value (he says a digit's face value): the NO! beat is that mistake.
 const sagePV=(m.sage?.practising||[]).some(s=>/place value/i.test(s));
 const tens=2+Math.floor(r()*7),ones=[1,2,3,4,5,6,7,8,9].filter(d=>d!==tens)[Math.floor(r()*8)],pv=tens*10+ones;
 const noBeat=sagePV?{id:'b4',kind:'no',what:`a friend insists the ${tens} in ${pv} is worth just ${tens} (its face value, not its place value) and wants to write that on the scoreboard; ${m.name} says NO! and fixes it`,who:null,
    claim:`The ${tens} in ${pv} is worth ${tens}!`,display:`${tens} in ${pv} = ${tens}`,ask:`Can I write ${tens} on the scoreboard? Can I? Please?`,wrong:String(tens),right:String(tens*10),options:shuffle([String(tens*10),String(tens),String(pv)],r),
    ifYes:`Oops! The scoreboard buzzes. That does not look right.`,caught:`You said NO! The ${tens} in ${pv} is in the tens place. It is worth ${tens*10}.`,fixSpoken:`What is the ${tens} in ${pv} worth?`,hint:`${pv} is ${WORD_NUM[tens]||tens} tens and ${WORD_NUM[ones]||ones} ones.`,source:'sage'}
  :null;
 return {
  beats:[
   {id:'b1',kind:'signs',what:`three signs (on trains, doors or paths) look almost the same; they need the one that says "${word}", so ${m.name} reads them all`,target:word,options,
    spoken:`We need the one that says ${word}. Read every letter.`,notIt:`That sign says something else. Read every letter.`,...(sounds?{sounds}:{})},
   {id:'b2',kind:'spell',what:`a magic spell has fallen apart; it only works when its words are put back in order, read word by word (not by where they lie)`,sentence,answer,tiles:scramble(extra?[...answer,extra]:answer,r),mark:endMark(sentence),
    spoken:`The spell says: ${sentence} Put the words back in order.`,...(sounds?{sounds}:{})},
   numberBeat,
   noBeat||{id:'b4',kind:'no',what:`a friend insists "${ma} × ${mb} = ${wrongN}" and wants to put it on the scoreboard; ${m.name} says NO! and fixes it`,who:null,
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
  // Optional weights ({id: n}) make favourites appear more often; without them every friend is equally likely.
  const w=mine.weights||{},left=shuffle(pool,r),picks=[];
  for(let k=Math.max(0,Number(mine.perChapter??2));k>0&&left.length;k--){const tot=left.reduce((s,c)=>s+Math.max(0,Number(w[c.id]??1)),0);let x=r()*tot,i=0;
   for(;i<left.length-1;i++){x-=Math.max(0,Number(w[left[i].id]??1));if(x<0)break;}picks.push(left.splice(i,1)[0]);}
  const out=[...fixed,...picks];
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
 const gl=(cast?.grownups?.length?cast.grownups:[{id:'dad',name:'Dad'}]),leadName=gl[(Number(String(date).replace(/-/g,''))||0)%gl.length].name;
 let base;
 if(early){
  // Today's letter owner must be in today's chapter.
  base=earlyBeats(model,r,{grown:leadName,focus:profile.focusLetter||null,cast:everyone,collection,things,soccer:(model.interests||[]).includes('soccer')||(profile.interests||[]).includes('soccer')});
  const owner=everyone.find(c=>c.id===base.beats[0].owner);if(owner&&!members.some(c=>c.id===owner.id))members.push(owner);
  const noWho=everyone.find(c=>c.id===base.beats[3].who);if(noWho&&!members.some(c=>c.id===noWho.id)){base.beats[3].who=members.find(c=>c.id!==base.beats[0].owner)?.id||members[0].id;base.beats[3].whoName=(members.find(c=>c.id===base.beats[3].who)||members[0]).name;base.beats[3].what=base.beats[3].what.replace(noWho.name,base.beats[3].whoName);}
 }else{
  // A beginning reader reads only decodable family words (a grown-up can open it up: profile reading "open").
  const decodable=(profile.reading||'decodable')==='decodable';
  base=readerBeats(model,r,{collection,decodable});base.reading=decodable?'decodable':'open';base.sight=(profile.sightWords||[]).map(String);
  const who=members[1]||members[0];base.beats[3].who=who?.id||null;base.beats[3].whoName=who?.name||'a friend';base.beats[3].what=`${who?.name||'A friend'} ${base.beats[3].what.replace(/^a friend /,'')}`;
  base.magic=magicWords(model,r,{collection,decodable});
  base.quest=readerQuest(base.magic.length?base.magic:[base.beats[0].target],{grown:leadName,seed:Number(String(date).replace(/-/g,''))||0});
 }
 const interests=shuffle(model.interests||[],r).slice(0,3);
 // The grown-ups take turns leading the adventure (balanced by date); the other may appear too.
 const grownups=(cast?.grownups?.length?cast.grownups:[{id:'dad',name:'Dad'}]).map(g=>({id:g.id,name:g.name,...(g.alsoCalled?{alsoCalled:g.alsoCalled}:{}),...(g.note?{note:g.note}:{})}));
 const lead=grownups[(Number(String(date).replace(/-/g,''))||0)%grownups.length];
 return {grownups,lead,player:model.player,name:model.name,date,level:early?'early':'reader',sibling:profile.sibling||null,companion,cast:members,props:chooseProps(model,cast),interests,
  arc:profile.arc||null,compass:profile.compass||[],themes:chooseThemes(life,r),collection:{keys:collection?.keys||[],words:collection?.words||[]},
  ...base,magic:base.magic||[],actions:ACTIONS,minActions:early?2:1,
  dadLines:(model.recent?.dadLines||[]).map(l=>l.text),yesterday:model.recent?.yesterday||null,play:model.recent?.play||[],
  tricks:(model.tricks||[]).map(t=>t.text),previous:model.story?.book||[],running:model.story?.running||[]};
}
