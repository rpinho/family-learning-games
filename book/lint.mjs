// The Book: deterministic content-safety and level lint for a generated chapter.
// Every generated chapter passes this or is repaired once, and otherwise replaced by the template.
// Private additions (a surname, a school, a town) come from profiles.json "_lint.extra", never from code.
export const SAFETY=[
 // violence beyond cartoon mischief
 ['violence',/\b(kill(s|ed|ing)?|murder\w*|blood\w*|guns?|knife|knives|swords?|weapons?|bombs?|explod\w*|wars?|battle\w*|attack\w*|punch\w*|stab\w*|hurt(s|ing)?|injur\w*|wound\w*|bleed\w*|fight\w*|destroy\w*|slap\w*|beat (him|her|them|up)|shoot (him|her|them)|poison\w*|drown\w*|burn(s|ed|t|ing)?|on fire|choke\w*|trap(ped)? forever)\b/i],
 // scary, death, loss, abuse
 ['scary',/\b(scary|scared|scare[sd]?|terrif\w*|terror|horror|nightmares?|monsters?|ghosts?|zombies?|witch\w*|demons?|devils?|haunt\w*|creepy|evil|spooky|skeletons?|vampires?)\b/i],
 ['death or loss',/\b(dead|death|die[sd]?|dying|funeral|grave|heaven|ghost|lost forever|alone forever|never came back|abandon\w*|orphan\w*|gone forever)\b/i],
 ['abuse or danger',/\b(abus\w*|kidnap\w*|strangers?|runaway|ran away from home|locked (him|her) in|yell(ed|s)? at (him|her)|punish\w*|spank\w*)\b/i],
 // no real family medical events, and no illness at all
 ['illness or medical',/\b(hospital\w*|doctors?|nurses?|sick\w*|ill|illness\w*|strokes?|medicine\w*|pills?|ambulance\w*|surgery|operation|disease\w*|virus\w*|fever\w*|cancer|heart attack|wheelchair\w*|injection\w*|numb|numbness|therapy|clinic\w*|x-ray|bandage\w*|cough\w*|germs?)\b/i],
 ['grandparents',/\b(grand(ma|mother|pa|father|parents?)|granny|gran|av[oóô]s?|vov[oóô]s?)\b/i],
 // brands and real public figures
 ['brand',/\b(lego|minecraft|roblox|fortnite|pok[eé]mon|pikachu|disney|marvel|pixar|nintendo|mario|sonic|youtube|tiktok|netflix|ipad|iphone|google|nike|adidas|coca[- ]?cola|pepsi|mcdonald\w*|oreos?|nutella|cookie monster|sesame street|elmo|barbie|hot wheels|paw patrol|bluey|peppa|batman|superman|spider-?man|star wars|jedi|harry potter|duolingo|messi|ronaldo|neymar|mbapp[eé]|tesla|spacex|chatgpt|openai|mbot\w*|makeblock|playstation|xbox|fifa|premier league)\b/i],
 // personal data
 ['personal data',/(https?:\/\/|www\.|@[a-z0-9-]+\.[a-z]{2,}|\b\d{5,}\b|\b\d{3}[-. ]\d{3,4}[-. ]?\d{0,4}\b|\b(street|avenue|road|lane|apartment|zip code|phone number|password)\b)/i]
];
const NUMBER_WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const WORDS=s=>String(s).match(/[A-Za-zÀ-ÿ']+/g)||[];
const SENTENCES=s=>String(s).split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
export const splitLines=SENTENCES;
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9×÷+=\- ]+/g,' ').replace(/\s+/g,' ').trim();
export const tokens=s=>String(s).split(/\s+/).map(t=>t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(Boolean);
export function safetyIssues(text,{extra=[]}={}){
 const out=[];
 for(const [label,re] of SAFETY){const m=String(text).match(re);if(m)out.push(`${label}: "${m[0]}"`);}
 for(const w of extra){if(!w)continue;const re=new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');if(re.test(text))out.push(`private word: "${w}"`);}
 return out;
}
// Arithmetic statements in the text ("3 × 4 = 12", "12 ÷ 3 = 4", "2 + 2 = 4"). Returns the wrong ones.
export function wrongEquations(text){
 const out=[];const re=/(\d+)\s*([×x*÷\/+\-−])\s*(\d+)\s*=\s*(\d+)/g;let m;
 while((m=re.exec(text))){const [a,op,b,c]=[Number(m[1]),m[2],Number(m[3]),Number(m[4])];
  const v=op==='÷'||op==='/'?a/b:op==='+'?a+b:op==='-'||op==='−'?a-b:a*b;if(v!==c)out.push(m[0].replace(/\s+/g,' '));}
 return out;
}
export const LEVELS={
 early:{words:[100,220],avgSentence:10,maxWordLength:10,pageWords:45},
 reader:{words:[230,430],avgSentence:16,maxWordLength:13,pageWords:85}
};
export const SCENE_EMOJI=new Set([...'🐻🤖⚽🥅🏆🦖🦕🌳🌲🌸🌻🌈☀️🌙⭐🌟✨☁️🍪🍯🍎🍌🥕🧁🎂🍕🏠🏡🏰⛺🚀🛸🚂🚌🚲🛝🪁🎈🎁📚📖✏️🎨🧩♟️🎯🏹🪀🦊🐶🐱🐰🐸🐢🦉🐝🦋🐞🐟🐙🦆🐔🐷🐮🐑🦁🐯🐘🦒🐒🐧🐳🌊⛵🏖️⛰️🌋🗺️🔦🔑🧸🎵🥁🎺🎸🍂❄️⛄🌧️💡🔧🔩⚙️🛠️📦🧺🪺🥚🌽🍓🫐🍉🧃🥛🧀🍞🥄🍽️🪴🌵🍄🐿️🦔🦜🦩🐌🧦🧤🧣🎩👑🛶🚁✈️🚜🚒🏗️🧱🪨🌰🌉🧭🎡🪜🛷🏀🎾🏐🥇🎉🎊🌞🌝🔭🧲🪐🌠']);
const graphemes=s=>[...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(String(s))].map(x=>x.segment).filter(x=>x.trim());
export function lintChapter(ch,plan,{extra=[]}={}){
 const issues=[];const L=LEVELS[plan.level]||LEVELS.reader;
 if(!ch||typeof ch!=='object'||!Array.isArray(ch.pages))return ['not a chapter object with pages'];
 if(typeof ch.title!=='string'||!ch.title.trim()||ch.title.length>70)issues.push('title missing or longer than 70 characters');
 const pages=ch.pages;
 if(pages.length<5||pages.length>16)issues.push(`needs 5-16 pages, has ${pages.length}`);
 const texts=pages.map(p=>String(p?.text||''));
 const all=[ch.title,...texts,ch.summary||'',ch.hook||'',ch.bedtimeQuestion||''].join('\n');
 issues.push(...safetyIssues(all,{extra}));
 // structure
 for(const c of plan.challenges){const n=pages.filter(p=>p?.challenge===c.id).length;if(n!==1)issues.push(`challenge ${c.id} must appear exactly once (found ${n})`);}
 const mi=pages.findIndex(p=>p?.mistake===plan.mistake.id);
 if(pages.filter(p=>p?.mistake===plan.mistake.id).length!==1)issues.push(`mistake ${plan.mistake.id} must appear exactly once`);
 if(pages[0]&&(pages[0].challenge||pages[0].mistake))issues.push('the first page must be a story page');
 if(pages.at(-1)&&(pages.at(-1).challenge||pages.at(-1).mistake))issues.push('the last page must be a story page that ends the chapter');
 pages.forEach((p,i)=>{if(!p||typeof p.text!=='string'||!p.text.trim())issues.push(`page ${i+1} has no text`);
  const n=WORDS(p?.text).length;if(n>L.pageWords)issues.push(`page ${i+1} has ${n} words (max ${L.pageWords})`);
  if(p?.scene!==undefined){const g=graphemes(p.scene);if(g.length>5||g.some(e=>!SCENE_EMOJI.has(e)&&!SCENE_EMOJI.has(e.replace(/️/g,''))))issues.push(`page ${i+1} scene must be 1-5 emoji from the allowed set`);}});
 if(plan.teach){
  const ti=pages.findIndex(p=>p?.teach);const t=pages[ti];
  if(ti<0)issues.push('needs one page with "teach": true that teaches the letter first');
  else{
   const w=WORDS(t.text).map(x=>x.toLowerCase());
   if(!w.includes(plan.teach.word))issues.push(`the teach page must say the word "${plan.teach.word}"`);
   if(!new RegExp(`\\b${plan.teach.letter}\\b`).test(t.text))issues.push(`the teach page must name the letter ${plan.teach.letter}`);
   const c1=pages.findIndex(p=>p?.challenge===plan.challenges[0].id);
   if(c1>=0&&c1<ti)issues.push('teach the letter before its challenge');
   if(mi>=0&&mi<ti)issues.push('teach the letter before the mistake');
  }
 }
 // hints, never answers: a challenge's lead-in must not give its answer away
 for(const c of plan.challenges){const p=pages.find(x=>x?.challenge===c.id);if(!p)continue;const it=c.item;
  if(it.kind==='sentence'&&norm(p.text).includes(norm(it.sentence)))issues.push(`challenge ${c.id} page writes out the sentence; the child must build it`);
  if(['math','count','first-letter'].includes(it.kind)&&tokens(p.text).some(t=>t===String(it.answer)||(/^\d+$/.test(it.answer)&&t.toLowerCase()===NUMBER_WORDS[Number(it.answer)])))issues.push(`challenge ${c.id} page gives away the answer ${it.answer}`);}
 if(mi>=0){
  const text=pages[mi].text;
  if(!norm(text).includes(norm(plan.mistake.claim)))issues.push(`the mistake page must contain exactly: "${plan.mistake.claim}"`);
  if(plan.mistake.kind==='math'){const n=tokens(text).filter(t=>t===plan.mistake.wrong).length;if(n!==1)issues.push(`the wrong number ${plan.mistake.wrong} must appear exactly once on the mistake page (found ${n})`);}
 }
 // the only wrong sum anywhere is the planned mistake
 const wrong=wrongEquations(all).filter(e=>norm(e)!==norm(plan.mistake.claim));
 if(wrong.length)issues.push(`unplanned arithmetic mistakes: ${wrong.join('; ')}`);
 // level
 const story=texts.join(' '),words=WORDS(story),count=words.length;
 if(count<L.words[0]||count>L.words[1])issues.push(`story has ${count} words, needs ${L.words[0]}-${L.words[1]}`);
 const sentences=SENTENCES(story);const avg=sentences.length?count/sentences.length:0;
 if(avg>L.avgSentence)issues.push(`sentences average ${avg.toFixed(1)} words (max ${L.avgSentence}); use shorter sentences`);
 const names=new Set([plan.name,plan.companion?.name,plan.sibling,'Mom','Dad'].filter(Boolean).map(s=>s.toLowerCase()));
 const long=[...new Set(words.filter(w=>w.length>L.maxWordLength&&!names.has(w.toLowerCase())))];
 if(long.length)issues.push(`words too long for this reader: ${long.slice(0,6).join(', ')}`);
 if(!new RegExp(`\\b${plan.name}\\b`).test(story))issues.push(`the hero ${plan.name} must be in the story`);
 if(plan.companion?.name&&!new RegExp(`\\b${plan.companion.name}\\b`).test(story))issues.push(`the companion ${plan.companion.name} must be in the story`);
 // a first name followed by another capitalised word mid-sentence looks like a full name
 const full=story.match(new RegExp(`\\b(${[plan.name,plan.sibling].filter(Boolean).join('|')})\\s+([A-Z][a-z]+)`,'g'))||[];
 const allowedNext=new Set(['and','Mom','Dad',plan.companion?.name,plan.name,plan.sibling].filter(Boolean));
 for(const f of full){const next=f.split(/\s+/)[1];if(!allowedNext.has(next))issues.push(`looks like a full name: "${f}"`);}
 for(const k of ['summary','hook','bedtimeQuestion'])if(typeof ch[k]!=='string'||!ch[k].trim())issues.push(`${k} missing`);
 return [...new Set(issues)];
}
// Dad's free-text line is only used when it passes the same safety rules.
export function safeDadLine(text,opts){const t=String(text||'').trim().slice(0,160);return t&&!safetyIssues(t,opts).length?t:null;}
