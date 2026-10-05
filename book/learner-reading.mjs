// Pure reading assessment. Saves' cumulative hit counters and spelling tasks cannot prove a read.
import {itemFirsts} from './learner-profile.mjs';
import {wordPattern,shortVowel} from '../hub/skill-items.mjs';
export const READING_RULE={windowDays:30,minAttempts:4,minMasteryReads:4,minMasteryDays:2,masteryRate:.8,guessMs:2000};
const wordOf=e=>(e.tags||[]).find(t=>t.startsWith('word:'))?.slice(5);
const independent=e=>e.ok&&!e.help&&!e.modelled&&!e.taggingUnresolved;
const guess=e=>e.choices>1&&e.ms!=null&&e.ms<READING_RULE.guessMs;
const day=(at,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
export function readingAssessment(evidence,player,now,{timeZone='UTC'}={}){
 const firsts=itemFirsts(evidence,player,now,{history:READING_RULE.windowDays});
 const reads=firsts.filter(e=>e.readTask&&wordOf(e));
 const by={};for(const e of reads)(by[wordOf(e)]??=[]).push(e);
 const words={};const mastered=[],almost=[],stuck=[],above=[];
 for(const [word,rows]of Object.entries(by)){
  const scored=rows.filter(e=>!guess(e)&&!e.modelled&&!e.taggingUnresolved),wins=scored.filter(independent);
  const qualifying=wins.filter(e=>!e.taggingRepaired&&(e.choices<=1||e.ms!=null));
  const recent=scored.slice(-5),rate=scored.length?wins.length/scored.length:0;
  const days=new Set(qualifying.map(e=>day(e.at,timeZone))).size;
  const secure=rows.length>=5&&qualifying.length>=READING_RULE.minMasteryReads&&days>=READING_RULE.minMasteryDays&&
   (rate>=READING_RULE.masteryRate||(recent.length===5&&recent.every(e=>independent(e)&&!e.taggingRepaired&&e.ms!=null)));
  const rawRate=rows.filter(independent).length/rows.length;
  const pattern=wordPattern(word);
  words[word]={attempts:rows.length,scored:scored.length,firstTry:wins.length,rate:+rate.toFixed(3),rawRate:+rawRate.toFixed(3),masteryReads:qualifying.length,masteryDays:days,
   guesses:rows.filter(guess).length,repaired:rows.filter(e=>e.taggingRepaired).length,pattern,lastSeen:new Date(rows.at(-1).at).toISOString().slice(0,10)};
  if(secure)mastered.push(word);
  else if(pattern!=='cvc'&&word.length>3)above.push(word);
  else if(rows.length>=READING_RULE.minAttempts&&rawRate<=1/3)stuck.push(word);
  else if(rows.length>=READING_RULE.minAttempts)almost.push(word);
 }
 const features={};
 const add=(key,e)=>{const s=features[key]??={attempts:0,firstTry:0,guesses:0,eligible:0,eligibleWins:0};s.attempts++;if(independent(e))s.firstTry++;if(guess(e)){s.guesses++;return;}s.eligible++;if(independent(e))s.eligibleWins++;};
 for(const e of reads){const w=wordOf(e),v=shortVowel(w);if(v)add('short-'+v,e);if(w.endsWith('ck'))add('ck',e);if(/[aeiou][^aeiou]{2}$/.test(w)&&!/(ck|sh|ch|th|ng)$/.test(w))add('final-blends',e);}
 for(const e of firsts)if(e.gapPosition)add(e.gapPosition,e);
 for(const s of Object.values(features)){s.rate=+(s.firstTry/s.attempts).toFixed(3);s.eligibleRate=s.eligible?+(s.eligibleWins/s.eligible).toFixed(3):null;}
 const vowels=Object.entries(features).filter(([k,v])=>k.startsWith('short-')&&v.attempts>=4).sort((a,b)=>a[1].rate-b[1].rate||b[1].attempts-a[1].attempts).map(([k])=>k);
 const weak=vowels.filter(k=>features[k].rate<.6);
 const focus=[...weak,...['final-consonant','ck','final-blends'].filter(k=>features[k]?.attempts>=4&&features[k].rate<.6)];
 const rank=w=>{const i=vowels.indexOf('short-'+shortVowel(w));return i<0?99:i;};
 stuck.sort((a,b)=>rank(a)-rank(b)||words[b].attempts-words[a].attempts||a.localeCompare(b));
 almost.sort((a,b)=>words[b].rawRate-words[a].rawRate||words[b].attempts-words[a].attempts||a.localeCompare(b));
 // A higher level needs success on harder words AND the prerequisite CVC vowels, across days.
 const cvc=reads.filter(e=>wordPattern(wordOf(e))==='cvc'),hard=reads.filter(e=>['blend','digraph'].includes(wordPattern(wordOf(e))));
 const higher=hard.length>=12&&hard.filter(e=>independent(e)&&!guess(e)).length/hard.length>=.8&&
  new Set(hard.filter(independent).map(e=>day(e.at,timeZone))).size>=2&&cvc.length>=12&&cvc.filter(e=>independent(e)&&!guess(e)).length/cvc.length>=.7;
 return {wordsMastered:mastered.sort(),wordsAlmost:almost,wordsStuck:stuck,wordsAboveLevel:above.sort(),wordLevel:higher?2:1,
  readingEvidence:words,readingFeatures:features,readingFocus:focus,readingSupport:{letterSounds:true,hearIt:true,letterFirst:true,aboveLevel:'hear-and-build',unsupported:'mastered-only',unrecordedSound:'adult-model'},masteryRule:READING_RULE,
  readingTricks:reads.filter(e=>guess(e)&&!e.ok).length>=4?[{id:'word-tap-through',text:'taps word choices quickly without reading them',source:'logs',evidence:{fastMisses:reads.filter(e=>guess(e)&&!e.ok).length}}]:[]};
}
