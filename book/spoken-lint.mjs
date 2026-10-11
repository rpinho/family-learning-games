// What the narrator says must be a SPOKEN form, never the screen notation (a narrator reading
// "Example: S + U + N → sun. Which picture matches the sounds /k/ /a/ /t/?" aloud says "slash", "arrow", "plus").
// Lines carry `text` (what the voice renders) and `shown` (what the screen prints); only `text` is checked here.
// Isolated letter sounds stay as Kokoro phonemes in [[...]] (book/narrate.py renders them from the recorded letter
// sounds), so phoneme brackets are removed before checking.
const RULES=[
 [/\/[a-zæɑʌɛɪɔʊəɡʃʒθðŋɹ]{1,3}\//i,'phoneme slashes (/x/)'],
 [/[→←↑↓⇒⇐➜➔]/,'arrow'],
 [/[+=×÷<>≤≥−]/,'math symbol'],
 [/\d\s*[-–]\s*\d/,'minus/dash between numbers'],
 [/_{2,}/,'blank (___)'],
 [/[\/\\|*#@^~&%{}]/,'bare symbol'],
 [/\bExample:/i,'screen label "Example:"'],
 [/\p{Extended_Pictographic}/u,'emoji'],
];
export function spokenIssues(text){
 const t=String(text||'').replace(/\[\[[^\]]*\]\]/g,' ');
 return RULES.filter(([re])=>re.test(t)).map(([,why])=>why);
}
// Every narrated line in a chapter (anything with words and a voice or clip): {path,text,issues}.
export function chapterSpokenIssues(chapter){
 const out=[];
 const walk=(o,path)=>{
  if(Array.isArray(o))return o.forEach((v,i)=>walk(v,path+'['+i+']'));
  if(!o||typeof o!=='object')return;
  if(typeof o.text==='string'&&(o.voice||o.clip)){const issues=spokenIssues(o.text);if(issues.length)out.push({path,text:o.text,issues});}
  for(const [k,v]of Object.entries(o))if(v&&typeof v==='object')walk(v,path+'.'+k);
 };
 walk(chapter,'');
 return out;
}
