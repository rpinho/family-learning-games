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
 // no clinical, therapy or school-report language (a child's book is never a report about him)
 ['clinical or school-report language',/\b(OT|IEP|ADHD)\b/],
 ['clinical or school-report language',/\b(occupational|therap\w*|diagnos\w*|disorders?|autis\w*|sensory|dysregulat\w*|regulat(e|es|ed|ing|ion)|agitat\w*|behaviou?rs?|meltdowns?|tantrums?|observ(ation|ations|ed by)|evaluat\w*|assessments?|report cards?|interventions?|concerns?|concerned|struggl\w*|deficits?|anxi(ety|ous)|special needs|dyslexi\w*|mirrored|left-handed|teachers?|principal|classroom assistant|counsel\w*|psycholog\w*|meetings?|in trouble|naughty|bad boy)\b/i],
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
// allow: names a family has chosen for its own toys (e.g. a plush named after a character). They pass
// the brand rule only; every other rule still applies.
export function safetyIssues(text,{extra=[],allow=[]}={}){
 const out=[],ok=new Set(allow.map(a=>a.toLowerCase()));
 for(const [label,re] of SAFETY){
  const all=[...String(text).matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))].map(m=>m[0]);
  const hit=label==='brand'?all.find(m=>!ok.has(m.toLowerCase())):all[0];
  if(hit)out.push(`${label}: "${hit}"`);
 }
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
// Spoken narration per level (the child reads only captions and magic words).
export const LEVELS={
 early:{pages:[7,11],words:[110,330],avgSentence:10,maxWordLength:10,pageWords:45,lineWords:16,captionWords:1,captionWordLength:10},
 reader:{pages:[8,12],words:[160,430],avgSentence:14,maxWordLength:12,pageWords:60,lineWords:22,captionWords:6,captionWordLength:8}
};
export const sayOf=p=>(Array.isArray(p?.say)?p.say:[]).map(l=>Array.isArray(l)?{who:String(l[0]||'').toLowerCase(),text:String(l[1]||'')}:{who:String(l?.who||'').toLowerCase(),text:String(l?.text||'')});
const pageText=p=>[...sayOf(p).map(l=>l.text),...(p?.magic?.after?sayOf({say:p.magic.after}).map(l=>l.text):[])].join(' ');
export function lintChapter(ch,plan,{extra=[],allow=[],speakers=null,actors=null,dadId='dad'}={}){
 const issues=[];const L=LEVELS[plan.level]||LEVELS.reader;
 if(!ch||typeof ch!=='object'||!Array.isArray(ch.pages))return ['not a chapter object with pages'];
 if(typeof ch.title!=='string'||!ch.title.trim()||ch.title.length>60)issues.push('title missing or longer than 60 characters');
 const pages=ch.pages;
 if(pages.length<L.pages[0]||pages.length>L.pages[1])issues.push(`needs ${L.pages[0]}-${L.pages[1]} pages, has ${pages.length}`);
 const castNames=(plan.cast||[plan.companion]).filter(Boolean).map(c=>c.name);
 const allowedWho=new Set(speakers||['narrator','dad',...(plan.cast||[]).map(c=>c.id)]);
 const all=[ch.title,...pages.flatMap(p=>[pageText(p),p?.caption||'',p?.magic?.object||'']),ch.summary||'',ch.hook||''].join('\n');
 issues.push(...safetyIssues(all,{extra,allow}));
 // beats: each exactly once, in the planned order, never the first or last page
 const at=b=>pages.findIndex(p=>p?.beat===b.id);
 let last=-1;
 for(const b of plan.beats){const n=pages.filter(p=>p?.beat===b.id).length;if(n!==1){issues.push(`beat ${b.id} (${b.kind}) must appear exactly once (found ${n})`);continue;}
  const i=at(b);if(i<last)issues.push(`beat ${b.id} must come after the beats before it`);last=Math.max(last,i);}
 if(pages[0]?.beat)issues.push('the first page must be a story page');
 if(pages.at(-1)?.beat)issues.push('the last page must be a story page that ends the chapter');
 // magic words: each on one story page, never said by the narrator before he reads it
 for(const w of plan.magic||[]){const on=pages.filter(p=>String(p?.magic?.word||'').toLowerCase()===w);
  if(on.length!==1){issues.push(`magic word "${w}" must be on exactly one page (found ${on.length})`);continue;}
  const p=on[0];if(p.beat)issues.push(`magic word "${w}" must be on a story page, not a beat page`);
  if(new RegExp(`\\b${w}\\b`,'i').test(sayOf(p).map(l=>l.text).join(' ')))issues.push(`the narrator must not say the magic word "${w}" before he reads it (page ${pages.indexOf(p)+1})`);
  if(!sayOf({say:p.magic.after||[]}).length)issues.push(`magic word "${w}" needs "after" lines: what happens when he reads it`);}
 for(const p of pages)if(p?.magic&&!(plan.magic||[]).includes(String(p.magic.word||'').toLowerCase()))issues.push(`"${p.magic.word}" is not one of today's magic words`);
 let heroPages=0,dad=false;
 pages.forEach((p,i)=>{
  const say=sayOf(p);if(!say.length&&!p?.beat)issues.push(`page ${i+1} has no narration`);
  for(const l of say){if(!allowedWho.has(l.who))issues.push(`page ${i+1}: "${l.who}" cannot speak (use narrator, dad or a friend's id)`);
   if(!l.text.trim())issues.push(`page ${i+1} has an empty line`);if(WORDS(l.text).length>L.lineWords)issues.push(`page ${i+1} has a line over ${L.lineWords} words`);if(l.who==='dad')dad=true;}
  const n=WORDS(pageText(p)).length;if(n>L.pageWords)issues.push(`page ${i+1} has ${n} spoken words (max ${L.pageWords})`);
  const cap=String(p?.caption||'').trim();
  if(cap){const w=WORDS(cap);if(w.length>L.captionWords)issues.push(`page ${i+1} caption must be at most ${L.captionWords} word${L.captionWords>1?'s':''}`);
   const long=w.filter(x=>x.length>L.captionWordLength&&!castNames.concat([plan.name]).some(nm=>nm.toLowerCase().includes(x.toLowerCase())));if(long.length)issues.push(`page ${i+1} caption word too long for him to read: ${long[0]}`);}
  const acts=(Array.isArray(p?.actors)?p.actors:[]).map(a=>String(a).split(':')[0].toLowerCase());
  if(acts.includes(plan.actorIds?.hero||plan.player))heroPages++;if(acts.includes(dadId))dad=true;
  if(actors)for(const a of acts)if(!actors.includes(a))issues.push(`page ${i+1}: unknown actor "${a}"`);
 });
 if(actors?.includes(plan.actorIds?.hero||plan.player)&&heroPages<Math.ceil(pages.length/2))issues.push(`${plan.name} must be in the picture on at least half the pages (actor "${plan.actorIds?.hero||plan.player}")`);
 if(!dad)issues.push(`Dad must be in the adventure (actor "${dadId}" or a line spoken by dad) at least once`);
 // hints, never answers: a beat page must not give its answer away
 for(const b of plan.beats){const p=pages.find(x=>x?.beat===b.id);if(!p)continue;const t=tokens(sayOf(p).map(l=>l.text).join(' '));
  const ans=b.kind==='no'?b.right:['count','share','score'].includes(b.kind)?b.answer:null;if(!ans)continue;
  if(t.some(x=>x===String(ans)||(/^\d+$/.test(ans)&&x.toLowerCase()===NUMBER_WORDS[Number(ans)])))issues.push(`beat ${b.id} page gives away the answer ${ans}`);
  if(b.kind==='spell'&&norm(pageText(p)).includes(norm(b.sentence)))issues.push(`beat ${b.id} page writes out the spell; he must build it`);}
 const wrong=wrongEquations(all);if(wrong.length)issues.push(`arithmetic mistakes in the story (the only mistake is the planned NO! beat, which the game says itself): ${wrong.join('; ')}`);
 // level
 const story=pages.map(pageText).join(' '),words=WORDS(story),count=words.length;
 if(count<L.words[0]||count>L.words[1])issues.push(`narration has ${count} words, needs ${L.words[0]}-${L.words[1]}`);
 const sentences=SENTENCES(story);const avg=sentences.length?count/sentences.length:0;
 if(avg>L.avgSentence)issues.push(`sentences average ${avg.toFixed(1)} words (max ${L.avgSentence}); use shorter sentences`);
 const names=new Set([plan.name,plan.sibling,'Mom','Dad',...castNames.flatMap(n=>n.split(/\s+/))].filter(Boolean).map(s=>s.toLowerCase()));
 const long=[...new Set(words.filter(w=>w.length>L.maxWordLength&&!names.has(w.toLowerCase())))];
 if(long.length)issues.push(`words too long for this listener: ${long.slice(0,6).join(', ')}`);
 if(!new RegExp(`\\b${plan.name}\\b`).test(story))issues.push(`the hero ${plan.name} must be named in the story`);
 // A friend counts as named by the full name or its own first/last word ("Sparkle" for "Sparkle the snake").
 const GENERIC=new Set(['The','Big','Little','Captain','Mr','Mrs','Miss','Sir','Lady']);
 for(const n of castNames){const core=n.replace(/^the\s+/i,''),words=core.split(/\s+/);
  const forms=[core,...[words[0],words.at(-1)].filter(w=>/^[A-Z][a-z]{2,}$/.test(w)&&!GENERIC.has(w))];
  if(!forms.some(f=>new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(story)))issues.push(`the friend ${n} must be named in the story`);}
 const full=story.match(new RegExp(`\\b(${[plan.name,plan.sibling].filter(Boolean).join('|')})\\s+([A-Z][a-z]+)`,'g'))||[];
 const allowedNext=new Set(['and','Mom','Dad',plan.name,plan.sibling,...castNames.flatMap(n=>n.split(/\s+/))].filter(Boolean));
 for(const f of full){const next=f.split(/\s+/)[1];if(!allowedNext.has(next))issues.push(`looks like a full name: "${f}"`);}
 for(const k of ['summary','hook'])if(typeof ch[k]!=='string'||!ch[k].trim())issues.push(`${k} missing`);
 return [...new Set(issues)];
}
// Dad's free-text line is only used when it passes the same safety rules.
export function safeDadLine(text,opts){const t=String(text||'').trim().slice(0,160);return t&&!safetyIssues(t,opts).length?t:null;}
