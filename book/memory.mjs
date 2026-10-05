// Story memory (2026-10-01, Primer capability #5 "long arcs that remember"; Fable 5.1 ranked it first).
// The writer already saw the last five summaries ("STORY SO FAR"), but nothing made it pick up the last hook or remember
// 10-02 chess chapter. This picks, deterministically from the chapter files (no extra model call):
//   lastHook: how the previous chapter ended (template hooks are generic and skipped),
//   callback: one older moment (2+ chapters back, up to 30), rotating so the last three chapters never reuse one.
// The brief asks for them; it is NOT a lint rule (a missing callback must never send a chapter to the template).
// memoryUse() measures afterwards whether they made it in, for the morning report.
const GENERIC_HOOK=/^(Another locked door is waiting|The map has one more stop)/i;
const isTemplate=c=>/^template/.test(String(c?.meta?.source||''));
const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};

export function storyMemory(prev=[],{date=''}={}){
 const chapters=prev.filter(c=>c&&c.date&&c.date<date);
 const last=chapters.at(-1)||null;
 const lastHook=last?.hook&&!GENERIC_HOOK.test(last.hook)&&!isTemplate(last)?{date:last.date,title:last.title,hook:last.hook}:null;
 const recentlyUsed=new Set(chapters.slice(-3).map(c=>c.meta?.callback?.date).filter(Boolean));
 const pool=chapters.slice(0,-2).filter(c=>c.summary&&!isTemplate(c)&&!recentlyUsed.has(c.date));
 const pick=pool.length?pool[hash(date)%pool.length]:null;
 return {lastHook,callback:pick?{date:pick.date,title:pick.title,summary:pick.summary}:null};
}

export function memoryBrief(memory){
 if(!memory||(!memory.lastHook&&!memory.callback))return '';
 let out='';
 if(memory.lastHook)out+=`PICK UP LAST TIME: the last chapter ("${memory.lastHook.title}") ended with: "${memory.lastHook.hook}". In the first two pages, follow it or answer it in one or two short lines, then go on to today's place.\n`;
 if(memory.callback)out+=`REMEMBER (one line only): earlier in his Book, in "${memory.callback.title}": ${memory.callback.summary} Somewhere in today's story, let a friend or the narrator remember it in ONE short warm line ("Like the time you..."). Never retell it, never make it a worry.\n`;
 return out+'\n';
}

const STOP=new Set('the a an and or of to in on at for with his her their your you he she it is was are be this that what where who how from into inside behind next time does do did will can little tiny map'.split(' '));
const words=t=>String(t||'').toLowerCase().match(/[a-z']{4,}/g)?.filter(w=>!STOP.has(w))||[];
const spoken=(story,n=99)=>(story?.episode?[{say:[{text:story.episode.intro}]},...story.episode.rooms.map(r=>({say:r.lines.map(text=>({text}))})),{say:[{text:story.episode.reveal},{text:story.episode.recap}]}]:story?.pages||[]).slice(0,n).flatMap(p=>(p.say||[]).map(s=>Array.isArray(s)?s[1]:s?.text||'')).join(' ').toLowerCase();
// Did the chapter pick up the hook (in its first three pages) and use the callback (anywhere)? Two shared content words.
export function memoryUse(story,memory){
 // two shared content words, or one long distinctive one ("waterfall": 10-02 picked up the hook with it alone)
 const hit=(keys,text)=>{const k=[...new Set(words(keys))],found=k.filter(w=>text.includes(w));return k.length>0&&(found.length>=Math.min(2,k.length)||found.some(w=>w.length>=7));};
 return {hook:memory?.lastHook?hit(memory.lastHook.hook,spoken(story,3)):null,
  callback:memory?.callback?hit(memory.callback.title+' '+memory.callback.summary,spoken(story)):null};
}
