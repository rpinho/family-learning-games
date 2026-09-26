// Bo's adventure: a running story that stars the child (a small
// first step toward the Primer in The Diamond Age, whose story starred its
// reader and bent to what she did). Every finished lesson adds one short beat:
// the next stop of the walk, and the letter he actually practised. It only
// ever grows and never gates anything. Finite lines, so voice clips exist.
import {lessonRecap} from './recap.mjs';
export const tellsBoStory=id=>id==='beginner'||id==='admin';
const team=()=>'Bo';
export const BO_PLACES=[
 {icon:'🏡',walk:'set off from the cozy cave'},
 {icon:'🌳',walk:'walked into the berry forest'},
 {icon:'🪨',walk:'crossed the river on stepping stones'},
 {icon:'🍯',walk:'climbed the tall honey tree'},
 {icon:'🦉',walk:'met a friendly owl'},
 {icon:'🦋',walk:'followed butterflies to the meadow'},
 {icon:'🌷',walk:'found a secret garden'},
 {icon:'⭐',walk:'watched the stars from the hill'}
];
export const placeLine=(id,place)=>`${team(id)} ${BO_PLACES[place].walk}.`;
export const letterLine=(id,letter)=>`Bo found the letter ${letter}.`;
// Called when a lesson completes (after its last attempt is in history).
export function addBoBeat(p,now=new Date()){
 const story=p.boStory??={count:0,beats:[]};
 const place=story.count%BO_PLACES.length,letter=lessonRecap(p).letters.find(c=>/^[A-Z]$/i.test(c))?.toUpperCase();
 const lines=[placeLine(p.id,place),...(letter?[letterLine(p.id,letter)]:[])];
 story.beats=[...story.beats,{at:now.toISOString(),place,letter:letter||null,lines,lesson:p.completed}].slice(-60);
 story.count++;
 return story.beats.at(-1);
}
export const beatIcon=b=>BO_PLACES[b.place]?.icon||'🐻';
export function boStoryVoiceLines(){
 const lines=[];
 for(const id of ['beginner','admin']){
  for(let place=0;place<BO_PLACES.length;place++)lines.push(placeLine(id,place));
  for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')lines.push(letterLine(id,c));
 }
 return lines;
}
