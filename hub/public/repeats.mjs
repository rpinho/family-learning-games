// Shared by the Book and the hunts. A line is skipped when the line just before it (ended under REPEAT_MS ago, on any
// page) was the same clip or the same words; and a friend whose voice opens with his cry (the private reaction
// The server marks those lines cry:true; the voice id is the fallback. An explicit replay (Hear it again) always speaks.
export const REPEAT_MS=12000;
const CRY_VOICE=/^local:[\w-]*-(reactions|clean)-v\d/;
export const cries=l=>!!l&&(l.cry===true||CRY_VOICE.test(String(l.voice||'')));
export function repeatOf(line,prev,now=Date.now()){
 if(!line||!prev||now-prev.at>REPEAT_MS)return null;
 if((line.clip&&line.clip===prev.clip)||line.text===prev.text)return 'same-line';
 if(cries(line)&&cries(prev)&&line.voice===prev.voice&&(line.who||'')===(prev.who||''))return 'same-friend';
 return null;}
// What to remember about a line once it has been spoken (its end time is refreshed when it finishes).
export const heard=line=>({text:line.text,clip:line.clip,voice:line.voice,who:line.who,cry:line.cry,at:Date.now()});
