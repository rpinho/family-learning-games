import {recentSeeds} from './detail-rotation.mjs';
// The Book: deterministic chapter plan. Code, not the language model, decides WHAT is learned and how
// the adventure needs it (the "beats"); the model only writes the scenes and narration around them.
// Learning is a plot necessity, never a quiz: a companion shows its letter and the child collects its
// KEY; letter stepping-stones get the friends across; things are counted because the train needs that
// many seats; magic words on signs and doors make the world respond when the child reads them; a spell
// only works when its words are put back in order; pizza is shared fairly; and once per chapter a friend
// insists on something wrong and the child says NO! (then fixes it). Same learner model + date = same plan.
import {letterQuest,readerQuest,householdWords} from './quests.mjs';
import {questBeats,chooseDetails} from './quest-beats.mjs';
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
// See the count beat in earlyBeats: mostly 8..countsTo, about one in three 1-3 past it, never past it when guided practice flags slips.
export function countFor({countsTo=null,seen=null,sageCount=false},r){
 const canCount=Math.max(countsTo||0,seen||0)||5,low=Math.max(3,canCount-5);
 const stretch=!sageCount&&canCount>=10&&r()<1/3;
 return stretch?canCount+1+Math.floor(r()*3):low+Math.floor(r()*(canCount-low+1));
}
function earlyBeats(m,r,{cast,collection,things,soccer=false,focus=null,grown='Dad',family={},countsTo=null}){
 const keys=new Set((collection?.keys)||[]),known=new Set(m.literacy.letters),learning=m.literacy.learning.filter(c=>/^[A-Z]$/.test(c));
 // Only a letter with a recorded sound is taught with its sound (see word-families.mjs SOUND_LETTERS).
 const owners=letterOwners(cast).filter(o=>o.sound);
 // Today's letter: a friend's letter he is still learning, else a friend's letter not yet collected, else any.
 // A grown-up can ask for a letter to be revisited (e.g. the home hunt found nothing): focusLetter in the profile.
 // When every friend's own letter key is already his, a friend brings the next letter he is learning (the keys keep
 // growing towards the goal: 7 keys, 7 hiding places).
 const nextL=[...learning,...'MSATPBCDFGHINORU'.split('')].find(c=>/^[A-Z]$/.test(c)&&!keys.has(c)&&hasSound(c));
 const guest=owners.length&&nextL&&owners.every(o=>keys.has(o.letter))?(()=>{const f=owners[(Number(String(r()).slice(2,6))||0)%owners.length],w=pictureFor(nextL)[0]?.[0]||nextL.toLowerCase();
  return {...f,letter:nextL,sound:SOUNDS[nextL],word:w,shape:`make the shape of the letter ${nextL}`,brings:true,ownLetter:f.letter};})():null;
 const owner=(focus&&owners.find(o=>o.letter===String(focus).toUpperCase()))||owners.find(o=>learning.includes(o.letter)&&!keys.has(o.letter))||owners.find(o=>!keys.has(o.letter))||guest||pick(owners,r)||{id:null,name:'Bo',letter:'B',sound:SOUNDS.B,word:'bear',shape:'make the shape of the letter B'};
 const L=owner.letter,sound=owner.sound;
 const name=family[L]||null,word=name||owner.word,Word=name||cap(word),mid=name||word;
 const others=shuffle(near(L),r).slice(0,2);while(others.length<2)others.push(pick('MTKZX'.split('').filter(c=>c!==L),r));
 const stones=shuffle([L,L,L,...others,others[0]],r);
 // the F chapter's friend said "Bird starts with P!"): a friend claims the word starts with a look-alike letter.
 const wrong=near(L).find(c=>!others.includes(c))||near(L)[0]||(L==='M'?'N':'M'),third=near(L).find(c=>c!==wrong)||others.find(c=>c!==wrong)||'O';
 const [thing,things_,emoji]=things;
 // Count near the reported or observed range, with occasional small stretches.
 // A reported counting difficulty keeps practice within the established range.
 // Only the count beat changes: sums and take-aways stay small.
 const sageCount=[...(m.sage?.practising||[]),...(m.sage?.recentMisses||[]).map(x=>typeof x==='string'?x:JSON.stringify(x))].some(s=>/counting/i.test(s));
 const count=countFor({countsTo,seen:m.math?.countTo,sageCount},r);
 const who=(cast.find(c=>c.id!==owner.id)||cast[0]||{id:null,name:"Bo"});
 return {
  letter:L,
  beats:[
   {id:'b1',kind:'teach-letter',what:`${owner.name} shows its letter ${L} (the sound ${soundText(sound)}) and gives ${m.name} the ${L} key${name?` (${L} is for ${name})`:''}`,letter:L,sound,owner:owner.id,ownerName:owner.name,word,...(name?{family:true}:{}),shape:owner.shape,
    // Each thing said once (a line that repeats a sound or a letter sounds like a glitch to a child).
    // (the narrator never says "I": without a friend to show it, she says who does)
    lines:[owner.id?[owner.id,`Look, I ${owner.shape}.`]:['narrator',`Look, ${owner.name} can ${owner.shape}.`],['narrator',`${L} says ${sound}. ${Word} starts with ${L}.`]],tap:`Yes! ${Word} starts with ${sound}.`},
   soccer?{id:'b2',kind:'kick-letter',what:`on the soccer pitch three balls have letters on them; only the ${L} ball can score, so ${m.name} kicks the ${L} ball past the keeper into the goal (he flicks it himself)`,letter:L,sound,balls:shuffle([L,...others],r),
     spoken:`Kick the ball with ${L}. It says ${sound}.`,notIt:`That one is a different letter.`,done:`You kicked the ${L} ball in!`}
   :{id:'b2',kind:'stones',what:`letter stepping-stones: the friends can only cross on the ${L} stones, so ${m.name} taps the three ${L} stones`,letter:L,sound,stones,need:3,
    spoken:`Tap the stones with ${L}. It says ${sound}.`,notIt:`That one is a different letter.`,done:`You found all the ${L} stones!`},
   {id:'b3',kind:'count',what:`count the ${things_} because the story needs that many (seats at the table, slices, eggs to carry)`,thing,things:things_,emoji,n:count,
    spoken:`Tap each one to count the ${things_}.`,ask:`How many ${things_}?`,answer:String(count),options:numberOptions(count,r)},
   {id:'b4',kind:'no',what:`${who.name} insists "${Word} starts with ${wrong}" and wants to do something silly with it; ${m.name} says NO! and fixes it`,who:who.id,whoName:who.name,
    claim:`${Word} starts with ${wrong}!`,ask:name?`Can I put the ${wrong} key in the lock? Can I? Please?`:`Can I put the ${wrong} key in the ${mid} lock? Can I? Please?`,wrong,right:L,options:shuffle([L,wrong,third],r),
    ifYes:`Oops! The ${wrong} key does not fit. Hmm.`,caught:`You said NO! ${Word} starts with ${L}, not ${wrong}.`,fixSpoken:`Which letter does ${mid} start with?`,hint:`Listen: ${mid}. ${sound}. What sound is first?`},
   // Numbers in order (1 to 5): an outside tutor flagged ordering; a quick, satisfying play beat for everyone.
   {id:'b5',kind:'order',what:`the friends line up (for a photo, a turn or a race) and ${m.name} puts the numbers 1 to 5 in order`,numbers:[1,2,3,4,5],tiles:shuffle(['1','2','3','4','5'],r),
    spoken:'Tap the numbers in order. One, two, three, four, five!',done:'One, two, three, four, five! All in order!'}
  ],
  // A revisited letter is a Letter hunt (its shape); a new one a Sound hunt.
  quest:letterQuest(L,{sound,grown,kind:focus&&String(focus).toUpperCase()===L?'shape':'sound',family,child:m.name,friend:owner.id&&!owner.brings?{name:owner.name,emoji:owner.emoji,letter:owner.letter}:null}),
  reward:{key:L}
 };
}
// "reactions") speaks once in a NO! beat: his claim. Begging in his voice was a second cry straight after the first
export const reactionVoice=c=>/reactions/i.test(String(c?.voice||''));
export function narrateNoBeat(b,friend){if(!b||b.kind!=='no'||!reactionVoice(friend))return b;
 const name=String(friend.name||b.whoName||'a friend'),Name=name[0].toUpperCase()+name.slice(1),them=/^the\s.*s$/i.test(name)?'them':'him';
 const m=String(b.ask||'').match(/^Can I (.+?)\? Can I\? Please\?$/);
 return {...b,ask:m?`${Name} wants to ${m[1]}. Should we let ${them}?`:`${Name} really wants to. Should we let ${them}?`,askBy:'narrator',ifYesBy:'narrator'};}
function wordGroupFor(word){for(const g of WORD_GROUPS.flat())if(g.includes(word))return g;return null;}
// Familiar words go quiet in the narration and glow in the scene;
// he reads them to make things happen. More of them as he masters more words.
export function magicWords(m,r,{collection,decodable=false}){
 let mastered=(m.literacy.masteryRule?m.literacy.wordsMastered||[]:[]).filter(w=>/^[a-z]{2,7}$/.test(w));
 // A beginning reader's magic words are decodable family words only (his mastered ones, else today's family).
 if(decodable)mastered=mastered.filter(isFamilyWord);
 const read=new Set((collection?.words)||[]);
 const pool=mastered;
 const n=Math.min(4,2+Math.floor(mastered.length/12));
 // Mostly new-to-the-book words, one review word he has already read in the book.
 const fresh=shuffle(pool.filter(w=>!read.has(w)),r),old=shuffle(pool.filter(w=>read.has(w)),r);
 return [...fresh.slice(0,n-(old.length?1:0)),...old.slice(0,1)].slice(0,n);
}
// A beginning reader (decodable): every word he must read is a CVC word from a word family (cat, big, hop), and
// look-alikes share its first letter and differ in the vowel or the end (cat / can / cot): a first-letter guess
// cannot pass. After each tap a friend sounds the tapped word out (c-a-t, cat), right or wrong.
function readerBeats(m,r,{collection,decodable=false,floor=null}){
 const lit=m.literacy,math=m.math||{},F=floor||{};
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
 // him harder stuff than we are… that's probably one reason why he goes there". Nothing below the floor.)
 const span=([lo,hi])=>lo+Math.floor(r()*(hi-lo+1));
 const share=F.share?(()=>{const g=span(F.share.groups),e=span(F.share.each);return {total:g*e,groups:g};})():(math.hardShares||[]).filter(s=>s.total&&s.groups&&s.total%s.groups===0&&s.groups<=5&&s.total<=24).at(-1)||pick([{total:12,groups:3},{total:15,groups:5},{total:16,groups:4},{total:12,groups:4}],r);
 const each=share.total/share.groups;
 const minT=F.tables?Math.min(...F.tables):2,facts=(math.factsStuck||[]).map(f=>f.split('x').map(Number)).filter(([a,b])=>a>=2&&b>=2&&a<=10&&b<=10&&Math.max(a,b)>=minT);
 const tables=F.tables||math.tables||[2,5,10];
 const [a,b]=facts.length?pick(facts,r):[pick(tables,r),F.tables?3+Math.floor(r()*7):2+Math.floor(r()*7)];
 // Numbers as tools: sharing when division is what he is working on, the scoreboard otherwise.
 const useShare=(math.hardShares||[]).length>0||r()<.5;
 const numberBeat=useShare?
  {id:'b3',kind:'share',what:`share ${share.total} pizza slices fairly on ${share.groups} plates (each tap deals one slice onto every plate; then he says how many each)`,total:share.total,groups:share.groups,thing:'pizza slices',
   spoken:`${share.total} pizza slices, shared fairly on ${WORD_NUM[share.groups]||share.groups} plates. Tap the pizza to deal one slice onto every plate.`,ask:`How many slices on each plate?`,answer:String(each),options:numberOptions(each,r)}
  :{id:'b3',kind:'score',what:`the scoreboard: each goal is worth ${a} points and the team scored ${b} goals; he works out the points`,a,b,
   spoken:`Each goal is worth ${a} points. We scored ${b} goals. What is ${b} times ${a}?`,display:`${b} × ${a}`,answer:String(a*b),options:numberOptions(a*b,r,[a*b+a,a*b-a])};
 const ma=pick([2,5,10],r),mb=3+Math.floor(r()*5),right=ma*mb,wrongN=r()<.5?right+ma:right+1;
 // Reported place-value practice selects a matching error-checking beat.
 const sagePV=(m.sage?.practising||[]).some(s=>/place value/i.test(s));
 let tens=2+Math.floor(r()*7),ones=[1,2,3,4,5,6,7,8,9].filter(d=>d!==tens)[Math.floor(r()*8)],pv=tens*10+ones,place=10,placeName='tens';
 if(F.placeValueDigits>=3){const n=F.placeValueDigits;const ds=Array.from({length:n},(_,i)=>i===0?1+Math.floor(r()*9):Math.floor(r()*10));const pos=n-1-(r()<.5?0:1);tens=ds[n-1-pos]||ds[0];
  if(!tens){ds[n-1-pos]=1+Math.floor(r()*9);tens=ds[n-1-pos];}pv=Number(ds.join(''));place=10**pos;placeName=pos===3?'thousands':pos===2?'hundreds':'tens';}
 const noBeat=sagePV?{id:'b4',kind:'no',what:`a friend insists the ${tens} in ${pv} is worth just ${tens} (its face value, not its place value) and wants to write that on the scoreboard; ${m.name} says NO! and fixes it`,who:null,
    claim:`The ${tens} in ${pv} is worth ${tens}!`,display:`${tens} in ${pv} = ${tens}`,pv:{n:pv,digit:tens,claimed:tens},ask:`Can I write ${tens} on the scoreboard? Can I? Please?`,wrong:String(tens),right:String(tens*place),options:shuffle([String(tens*place),String(tens),String(tens*(place===10?100:place/10))],r),
    ifYes:`Oops! The scoreboard buzzes. That does not look right.`,caught:`You said NO! The ${tens} in ${pv} is in the ${placeName} place. It is worth ${tens*place}.`,fixSpoken:`What is the ${tens} in ${pv} worth?`,hint:place===10?`${pv} is ${WORD_NUM[tens]||tens} tens and ${WORD_NUM[ones]||ones} ones.`:`In ${pv}, the ${tens} is in the ${placeName} place.`,source:'sage'}
  :null;
 return {
  beats:[
   {id:'b1',kind:'signs',what:`three signs (on doors, gates or paths) look almost the same; they need the one that says "${word}", so ${m.name} reads them all`,target:word,options,
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
// Chapters use fixed companions and rotating actors from the private cast.
// Without a cast file, use the profile's companions.
export function chooseCast(model,{date,cast,level}){
 const fallback=(model.companions||[]).length?model.companions:[{name:'Pip',kind:'a cheerful little robot',emoji:'🤖'}];
 if(!cast?.cast?.length)return fallback.map(c=>({id:c.id||c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),...c}));
 const r=rng(`cast:${model.player}:${date}`),byId=Object.fromEntries(cast.cast.map(c=>[c.id,c]));
 const mine=cast.children?.[model.player];
 if(mine){
  const regular=model.player==='explorer'&&byId['rainbow-hedgehog']?['rainbow-hedgehog']:[];
  const fixed=[...new Set([...(mine.fixed||[]),...regular])].map(id=>byId[id]).filter(Boolean),pool=(mine.rotate||[]).filter(id=>!fixed.some(c=>c.id===id)).map(id=>byId[id]).filter(Boolean);
  // Optional weights ({id: n}) make favourites appear more often; without them every friend is equally likely.
  const w=mine.weights||{},left=shuffle(pool,r),picks=[];
  for(let k=Math.max(0,Number(mine.perChapter??2));k>0&&left.length;k--){const tot=left.reduce((s,c)=>s+Math.max(0,Number(w[c.id]??1)),0);let x=r()*tot,i=0;
   for(;i<left.length-1;i++){x-=Math.max(0,Number(w[left[i].id]??1));if(x<0)break;}picks.push(left.splice(i,1)[0]);}
  // Optional guests visit on a fixed cadence without changing the child's
  // regular friends or making a guest a letter-key owner.
  const day=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);
  const guests=(mine.guests||[]).filter(g=>Number.isInteger(g.every)&&g.every>=2&&Number.isFinite(day)&&day%g.every===0).map(g=>byId[g.id]).filter(Boolean);
  const out=[...fixed,...picks,...guests.filter(g=>!fixed.some(c=>c.id===g.id)&&!picks.some(c=>c.id===g.id))];
  return out.length?out:fallback;
 }
 const n=Math.max(1,Number(cast.perChapter?.[level])||2);
 return shuffle(cast.cast,r).slice(0,n);
}
// Per child: who leads and how often a grown-up comes along (see planChapter), and whether the picture is full.
export const GROWNUP_CADENCE={explorer:{lead:'dad',every:{mom:3}}};
export const CROWD={beginner:true};
export function chooseProps(model,cast){return (cast?.children?.[model.player]?.props||[]).map(id=>(cast.props||[]).find(p=>p.id===id)).filter(Boolean);}
// Life themes (distilled privately from the family's notes): one or two per chapter, rotating by date.
export function chooseThemes(life,r,avoid=new Set()){const t=(life?.themes||[]).filter(x=>x&&x.seed&&!avoid.has(x.id||x.seed));return shuffle(t,r).slice(0,2);}
export function planChapter(model,{date,profile={},cast=null,collection={},life=null,previous=[]}={}){
 const r=rng(`${model.player}:${date}`);
 const early=(model.math?.track==='early')||model.literacy?.track==='letters';
 const members=chooseCast(model,{date,cast,level:early?'early':'reader'}),companion=members[0];
 // The letter owners for a young reader: everyone in his cast (not only today's), so keys can be collected over weeks.
 const everyone=early&&cast?.children?.[model.player]?[...(cast.children[model.player].fixed||[]),...(cast.children[model.player].rotate||[])].map(id=>cast.cast.find(c=>c.id===id)).filter(Boolean):members;
 const things=pick(COUNT_THINGS,r);
 // The grown-ups: the household's list; a household cast without one still has Mom and Dad (both are in every book).
 const GROWNUPS=cast?.grownups?.length?cast.grownups:cast?[{id:'dad',name:'Dad'},{id:'mom',name:'Mom',alsoCalled:['Grown-up']}]:[{id:'dad',name:'Dad'}];
 // can set its own (profile grownupCadence {lead, every:{id:n}}). Others: the grown-ups take turns leading.
 const cadence=profile.grownupCadence||GROWNUP_CADENCE[model.player]||null,day=Math.floor(Date.parse(String(date)+'T00:00:00Z')/864e5);
 const TODAY=cadence?.every?GROWNUPS.filter(g=>{const n=Number(cadence.every[g.id]);return !(n>1)||!Number.isFinite(day)||day%n===0;}):GROWNUPS;
 const leadOf=list=>(cadence?.lead&&list.find(g=>g.id===cadence.lead))||list[(Number(String(date).replace(/-/g,''))||0)%list.length];
 const gl=TODAY.length?TODAY:GROWNUPS,leadName=leadOf(gl).name;
 let base;
 if(early){
  // Today's letter owner must be in today's chapter.
  base=earlyBeats(model,r,{grown:leadName,family:householdWords({name:model.name,sibling:profile.sibling||null,grownups:GROWNUPS,cast,profile}),focus:profile.focusLetter||null,cast:everyone,collection,things,soccer:(model.interests||[]).includes('soccer')||(profile.interests||[]).includes('soccer'),countsTo:Number.isInteger(profile.countsTo)?profile.countsTo:null});
  const owner=everyone.find(c=>c.id===base.beats[0].owner);if(owner&&!members.some(c=>c.id===owner.id))members.push(owner);
  const noWho=everyone.find(c=>c.id===base.beats[3].who);if(noWho&&!members.some(c=>c.id===noWho.id)){base.beats[3].who=members.find(c=>c.id!==base.beats[0].owner)?.id||members[0].id;base.beats[3].whoName=(members.find(c=>c.id===base.beats[3].who)||members[0]).name;base.beats[3].what=base.beats[3].what.replace(noWho.name,base.beats[3].whoName);}
 }else{
  // A beginning reader reads only decodable family words (a grown-up can open it up: profile reading "open").
  const decodable=(profile.reading||'decodable')==='decodable';
  base=readerBeats(model,r,{collection,decodable,floor:profile.mathFloor||null});base.reading=decodable?'decodable':'open';base.sight=(profile.sightWords||[]).map(String);
  // (a quiet friend never does the NO! beat's begging: a chattier friend does)
  const who=members.slice(1).find(c=>!c.quiet)||members.find(c=>!c.quiet)||members[1]||members[0];base.beats[3].who=who?.id||null;base.beats[3].whoName=who?.name||'a friend';base.beats[3].what=`${who?.name||'A friend'} ${base.beats[3].what.replace(/^a friend /,'')}`;
  base.masteredWords=[...(model.literacy.wordsMastered||[])];
  base.magic=magicWords(model,r,{collection,decodable});
  base.quest=readerQuest(base.magic.length?base.magic:[base.beats[0].target],{grown:leadName,seed:Number(String(date).replace(/-/g,''))||0});
 }
 {const i=base.beats.findIndex(b=>b.kind==='no');if(i>=0)base.beats[i]=narrateNoBeat(base.beats[i],members.find(c=>c.id===base.beats[i].who)||everyone.find(c=>c.id===base.beats[i].who));}
 // Interest details (the household's private profile "details"): one or two small story touches per chapter.
 const used=recentSeeds(previous),details=chooseDetails(profile,{date,avoid:used.details});
 // A quest-style book (profile bookStyle "quest"): the reading stays where it is, but the chapter plays like a game:
 // maths and logic puzzles at his real level, and a fork whose choice decides the chapter's quest item.
 const quest=!early&&profile.bookStyle==='quest';
 if(quest){const q=questBeats(model,{date,details,have:(collection?.items||[]).map(i=>i?.id??i),floor:profile.mathFloor||null});const [signs,spell,,no]=base.beats;
  base.beats=[signs,q.puzzles[0],spell,q.fork,q.puzzles[1],no].map((b,i)=>({...b,id:`b${i+1}`}));}
 // The key arc (profile keyGoal, e.g. 7): which key this chapter wins and which hiding place it opens; the last key
 // is the finale. Keys he already has are counted from his collection.
 let keyArc=null;
 if(early&&Number(profile.keyGoal)>0){const have=new Set((collection?.keys||[]).map(String)),L=base.beats[0]?.letter,goal=Number(profile.keyGoal);
  const n=Math.min(goal,have.size+(L&&!have.has(L)?1:0)),places=(profile.hidingPlaces||[]).filter(Boolean);
  keyArc={goal,have:[...have].slice(0,goal),letter:L,number:n,place:places.length?places[(Math.max(1,n)-1)%places.length]:null,finale:n>=goal};}
 // Golden letter keys (profile keyStyle "golden").
 if(early&&profile.keyStyle==='golden')for(const b of base.beats)if(b.what)b.what=b.what.replace(/\bthe ([A-Z]) key\b/g,'the golden $1 key');
 if(early){const food=details.find(d=>d.count);const cb=base.beats.find(b=>b.kind==='count');
  if(food&&cb){const [one,many,emoji]=food.count;cb.thing=one;cb.things=many;cb.emoji=emoji;cb.spoken=`Tap each one to count the ${many}.`;cb.ask=`How many ${many}?`;cb.what=`count the ${many} (${food.seed})`;}}
 const interests=shuffle(model.interests||[],r).slice(0,3);
 // The grown-ups take turns leading the adventure (balanced by date); the other may appear too.
 const grownups=gl.map(g=>({id:g.id,name:g.name,...(g.alsoCalled?{alsoCalled:g.alsoCalled}:{}),...(g.note?{note:g.note}:{})}));
 const lead=grownups.find(g=>g.id===leadOf(gl).id)||grownups[0];
 return {grownups,lead,player:model.player,name:model.name,date,level:early?'early':'reader',sibling:profile.sibling||null,companion,cast:members,props:chooseProps(model,cast),interests,
  arc:profile.arc||null,compass:profile.compass||[],themes:chooseThemes(life,r,used.themes),blockedSeeds:[...(profile.details||[]).filter(d=>used.details.has(d.id)),...(life?.themes||[]).filter(t=>used.themes.has(t.id||t.seed))],collection:{keys:collection?.keys||[],words:collection?.words||[]},
  ...base,magic:base.magic||[],actions:ACTIONS,minActions:early?2:1,
  dadLines:(model.recent?.dadLines||[]).map(l=>l.text),yesterday:model.recent?.yesterday||null,play:model.recent?.play||[],
  tricks:(model.tricks||[]).map(t=>t.text),previous:model.story?.book||[],running:model.story?.running||[],
  details,keyArc,familyWords:householdWords({name:model.name,sibling:profile.sibling||null,grownups:GROWNUPS,cast,profile}),allowRemainders:profile.allowRemainders===true,style:quest?'quest':(profile.bookStyle||'classic'),theme:profile.bookTheme||null,keyStyle:profile.keyStyle||null,
  // a grown-up may opt in to the drawn chess and labyrinth boards (profile boardPuzzles: true; off by default)
  boardPuzzles:profile.boardPuzzles===true,crowd:profile.crowd??CROWD[model.player]??false,
  // his own maths (Number Park): a scenario's number beats use his tables, his stuck facts and his hardest fair shares
  math:{track:model.math?.track||null,tables:model.math?.tables||[],factsStuck:model.math?.factsStuck||[],hardShares:model.math?.hardShares||[]}};
}
