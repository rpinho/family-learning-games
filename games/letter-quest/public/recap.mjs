// End-of-lesson recap: one short sentence of what the child did (from Sage
// Teacher's session wrap-up, kept short on purpose), plus, for the youngest
// player, Bo the bear's berry count (from Duolingo ABC's feed-the-character
// loop, but it only ever gains: no hearts, no streaks, nothing taken away).
// Every sentence comes from a finite list so the voice clips exist in advance.
export const LESSON_SIZE=5;
export const FEEDER={name:'Bo',icon:'🐻',treat:'🍓'};
export const feeds=id=>id==='beginner'||id==='admin';
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
const kind=key=>/^(find|sequence):/.test(key)?'found':key.startsWith('trace:')?'traced':'words';
// A letter grid ("tap every D") feeds one berry per letter found.
export const berries=entries=>entries.reduce((n,h)=>n+(h.spot?3:1),0);
export const feedLine=n=>`${FEEDER.name} ate ${plural(n,'berry','berries')}!`;
export function recapSentence(found,traced,words){
 const parts=[];
 if(found)parts.push(`found ${plural(found,'letter')}`);
 if(traced)parts.push(found?`traced ${traced}`:`traced ${plural(traced,'letter')}`);
 if(words)parts.push(`made ${plural(words,'word')}`);
 if(!parts.length)return 'You finished a lesson.';
 return 'You '+(parts.length===3?`${parts[0]}, ${parts[1]} and ${parts[2]}`:parts.join(' and '))+'.';
}
// The lesson's own answers: the last five correct attempts (a lesson is five).
export function lessonEntries(history,count=LESSON_SIZE){
 const out=[];for(let i=history.length-1;i>=0&&out.length<count;i--)if(history[i].ok)out.unshift(history[i]);return out;
}
export function lessonRecap(profile){
 const entries=lessonEntries(profile.history||[]);
 const tally={found:0,traced:0,words:0},letters=[],words=[];
 for(const h of entries){
  const k=kind(h.key);tally[k]++;
  if(k==='words'){if(h.word&&!words.includes(h.word))words.push(h.word);}
  else{const c=h.key.split(':')[1];if(c&&!letters.includes(c))letters.push(c);}
 }
 const lines=[recapSentence(tally.found,tally.traced,tally.words)],treats=feeds(profile.id)?berries(entries):0;
 if(treats)lines.push(feedLine(treats));
 return {lines,letters,words,treats};
}
// Berries so far in the lesson being played (inLesson counts its correct answers).
export function lessonBerries(profile,live=0){
 return (profile.inLesson?berries(lessonEntries(profile.history||[],profile.inLesson)):0)+live;
}
export function recapVoiceLines(){
 const lines=new Set(['You finished a lesson.']);
 for(let f=0;f<=LESSON_SIZE;f++)for(let t=0;t<=LESSON_SIZE-f;t++)for(let w=0;w<=LESSON_SIZE-f-t;w++)if(f+t+w)lines.add(recapSentence(f,t,w));
 for(let n=1;n<=LESSON_SIZE*3;n++)lines.add(feedLine(n));
 return [...lines];
}
