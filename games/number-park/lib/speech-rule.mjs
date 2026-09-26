// Sound rule.
// CONTENT: the question itself, or the specific number/letter/word/shape to find. Always plays, even with the
// sound button off, and repeats once if the child is idle.
// INSTRUCTIONS: how to play ("Tap and count.", "Drag a picture into the gap."). Once per session per line, and
// only with sound on. Repeated instructions are what made the kids turn sound off.
// Narration and praise (recap, story, chimes) obey the sound button.
export const sentences=t=>String(t).match(/[^.?!]+[.?!]+|[^.?!]+$/g)?.map(x=>x.trim()).filter(Boolean)||[];
export const isContent=s=>/\?$/.test(s)||/\d/.test(s)||/^(Count only the |Trace a |Reading (sound|word) |Find the (letter|little letter|word) |Which letter )/.test(s);
export function splitSpeech(lines){
 const content=[],instructions=[];
 for(const line of lines){const parts=sentences(line);
  if(!parts.length||parts.every(isContent))content.push(line);
  else if(!parts.some(isContent))instructions.push(line);
  else for(const part of parts)(isContent(part)?content:instructions).push(part);}
 return {content,instructions};
}
// firstTime(line) -> true only the first time this session. Returns what to say now and the content to repeat.
export function planSpeech(lines,{sound,firstTime}){
 const {content,instructions}=splitSpeech(lines),once=sound?instructions.filter(l=>firstTime(l)):[];
 return {say:[...once,...content],content};
}
export function sessionOnce(prefix='np-said-once:',store=globalThis.sessionStorage,memory=new Set()){
 return key=>{try{const k=prefix+key;if(store.getItem(k))return false;store.setItem(k,'1');return true;}catch{if(memory.has(key))return false;memory.add(key);return true;}};
}
// Voice clips needed for the split parts (added by scripts/build-voice.py).
export function speechParts(lines){const out=new Set();for(const line of lines){const {content,instructions}=splitSpeech([line]);for(const x of [...content,...instructions])if(x!==line)out.add(x);}return [...out];}
