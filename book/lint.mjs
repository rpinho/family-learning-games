import {detailIssues} from './detail-rotation.mjs';
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
 ['brand',/\b(lego|minecraft|roblox|fortnite|pok[eé]mon|\x70\x69\x6b\x61\x63\x68\x75|disney|marvel|pixar|nintendo|mario|sonic|youtube|tiktok|netflix|ipad|iphone|google|nike|adidas|coca[- ]?cola|pepsi|mcdonald\w*|oreos?|nutella|\x63\x6f\x6f\x6b\x69\x65\x20\x6d\x6f\x6e\x73\x74\x65\x72|sesame street|elmo|barbie|hot wheels|paw patrol|\x62\x6c\x75\x65\x79|peppa|batman|superman|spider-?man|star wars|jedi|harry potter|duolingo|messi|ronaldo|neymar|mbapp[eé]|tesla|spacex|chatgpt|openai|mbot\w*|makeblock|playstation|xbox|fifa|premier league)\b/i],
 // personal data
 ['personal data',/(https?:\/\/|www\.|@[a-z0-9-]+\.[a-z]{2,}|\b\d{5,}\b|\b\d{3}[-. ]\d{3,4}[-. ]?\d{0,4}\b|\b\d+\s+[a-z]+(?:\s+[a-z]+)?\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd)\b|\b(?:apartment|zip code|phone number|password)\b)/i],
 // an address-shaped name ("Tampa Road", "Elm Street"); a plain "forest road" or "mossy lane" in a story is fine (2026-10-02: "road" collapsed a whole adventure)
 ['personal data',/\b[A-Z][a-z]+\s+(?:Street|Avenue|Road|Lane|Drive|Boulevard)\b/]
];
const NUMBER_WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const WORDS=s=>String(s).match(/[A-Za-zÀ-ÿ']+/g)||[];
const SENTENCES=s=>String(s).split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
export const splitLines=SENTENCES;
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9×÷+=\- ]+/g,' ').replace(/\s+/g,' ').trim();
export const tokens=s=>String(s).split(/\s+/).map(t=>t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(Boolean);
// allow: names a family has chosen for its own toys (e.g. a plush named after a character). They pass
// the brand rule only; every other rule still applies.
export function safetyIssues(text,{extra=[],allow=[],travel=[]}={}){
 const out=[],ok=new Set(allow.map(a=>a.toLowerCase()));
 for(const [label,re] of SAFETY){
  const checked=label==='personal data'?travel.reduce((t,line)=>t.split(line).join('mapped path'),String(text)):String(text);
  const all=[...checked.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))].map(m=>m[0]);
  const hit=label==='brand'?all.find(m=>!ok.has(m.toLowerCase())):all[0];
  if(hit)out.push(`${label}: "${hit}"`);
 }
 for(const w of extra){if(!w)continue;const re=new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');if(re.test(text))out.push(`private word: "${w}"`);}
 return out;
}
// of his little brother; he likes to say he does things better than him, and the book must never feed that). No line
// compares or ranks the brothers, says one beats, outdoes or is ahead of the other, or crowns him the best over
// everyone: praise his own effort and thinking instead. names: the brother's first name (and the hero's, if wanted).
const reEsc=w=>String(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function comparisonIssues(text,{names=[]}={}){
 const t=String(text),n=names.filter(Boolean).map(reEsc);
 const SIB=`(?:(?:his|your|my|their|her)\\s+(?:(?:little|big|older|younger|baby|kid)\\s+)?(?:brother|bro|sibling)${n.length?'|'+n.join('|'):''})`;
 const OTHERS='(?:everyone|everybody|anyone|anybody|all the others|the others|all of them|the grown-?ups|the whole class|the other kids|any other kid)';
 const rules=[
  [`\\b(?:better|worse|more\\s+\\w+|less\\s+\\w+|\\w+er)\\s+(?:\\w+\\s+){0,3}?than\\s+${SIB}\\b`],
  [`\\bas\\s+\\w+\\s+as\\s+${SIB}\\b`],
  [`\\b(?:beat|beats|beating|beaten|defeat\\w*|outd(?:o|id|oes|one)|outsmart\\w*|outplay\\w*|outr[ua]n\\w*|outscor\\w*|outshin\\w*|won\\s+against|wins?\\s+against|lost\\s+to|loses\\s+to|ahead\\s+of)\\s+${SIB}\\b`],
  [`\\b${SIB}\\s+(?:can't|cannot|couldn't|could\\s+not|never\\s+could)\\s+(?:do|solve|read|win|beat|keep\\s+up|figure|find|count)\\b`],
  [`\\b(?:unlike|not\\s+like|even)\\s+${SIB}\\b`],
  // ranking the two of them
  [`\\b(?:the\\s+)?(?:best|better|smartest|cleverest|fastest|strongest|winner|champion|number\\s+one)\\s+(?:of\\s+(?:the\\s+)?(?:two|both|brothers|boys)|brother)\\b`],
  [`\\b(?:the\\s+)?better\\s+one\\b`],
  // superiority over everyone ("smarter than everyone", "the best in the class", "nobody can beat him")
  [`\\b(?:better|smarter|faster|cleverer|quicker|stronger)\\s+(?:\\w+\\s+){0,3}?than\\s+${OTHERS}\\b`],
  [`\\bthe\\s+(?:best|smartest|cleverest|fastest|strongest)(?:\\s+\\w+){0,2}\\s+(?:in\\s+(?:the|his|your)\\s+(?:class|school|family|house|world)|of\\s+(?:them\\s+)?all|ever)\\b`],
  [`\\b(?:no\\s*one|nobody)\\s+(?:is\\s+(?:as|better|smarter|faster)|(?:can|could)\\s+(?:beat|match|keep\\s+up))\\b`],
 ];
 const out=[];for(const [src] of rules){const m=t.match(new RegExp(src,'i'));if(m)out.push(`sibling comparison: "${m[0]}"`);}
 return [...new Set(out)];
}
// Arithmetic statements in the text ("3 × 4 = 12", "12 ÷ 3 = 4", "2 + 2 = 4"). Returns the wrong ones.
export function wrongEquations(text){
 const out=[];const re=/(\d+)\s*([×x*÷\/+\-−])\s*(\d+)\s*=\s*(\d+)/g;let m;
 while((m=re.exec(text))){const [a,op,b,c]=[Number(m[1]),m[2],Number(m[3]),Number(m[4])];
  const v=op==='÷'||op==='/'?a/b:op==='+'?a+b:op==='-'||op==='−'?a-b:a*b;if(v!==c)out.push(m[0].replace(/\s+/g,' '));}
 return out;
}
// Spoken narration per level (the child reads only captions and magic words).
// HARD caps (2026-09-29: a trial chapter ran 8 minutes; the narration is now about 60% of what it was): story words,
// everything said (story + the games' own lines), and the expected running time (PACE, calibrated on recordings).
export const LEVELS={
 early:{pages:[8,11],words:[90,190],totalWords:310,seconds:230,beatSeconds:18,avgSentence:10,maxWordLength:10,pageWords:30,lineWords:16,captionWords:1,captionWordLength:10},
 reader:{pages:[8,11],words:[100,200],totalWords:380,seconds:240,beatSeconds:10,avgSentence:14,maxWordLength:12,pageWords:36,lineWords:22,captionWords:6,captionWordLength:8}
};
// Seconds: speech at about 2.5 words a second, a game about 10 s of playing (18 s for a letters book: he counts and
// sounds out loud), a magic word or an action about 6 s, and a page turn 1.5 s. Calibrated on the 29 Sep recordings.
export const PACE={wps:2.5,beat:10,magic:6,action:6,page:1.5};
const SPOKEN_KEYS=new Set(['spoken','ask','done','claim','ifYes','caught','fixSpoken','notIt','text']);
// What a game says itself (its question, its "yes!"): one option's reply for a fork (only one is played).
export function beatSpeech(b){const out=[];const walk=(v,k)=>{if(v==null)return;if(typeof v==='string'){if(SPOKEN_KEYS.has(k))out.push(v);return;}
  if(Array.isArray(v))return void (k==='options'&&v[0]&&typeof v[0]==='object'?walk(v[0],''):null);if(typeof v==='object'){if(v.text&&typeof v.text==='string'&&k)return void out.push(v.text);for(const [kk,x] of Object.entries(v))if(kk!=='what')walk(x,kk);}};
 walk(b,'');if(b?.kind==='fork'&&b.options?.[0])out.push(b.options[0].reply||'',b.options[0].got||'');return out.join(' ');}
export const choiceSpeech=c=>{const text=v=>typeof v==='string'?v:v?.shown||v?.text||'';return c?[text(c.prompt),text(c.options?.[0]?.reply)].join(' '):'';};
export function pageSeconds(p,plan){const b=p?.beat?(plan.beats||[]).find(x=>x.id===p.beat):null;
 return WORDS(pageText(p)).length/PACE.wps+(b?((LEVELS[plan.level]||{}).beatSeconds??PACE.beat)+WORDS(beatSpeech(b)).length/PACE.wps:0)+(p?.magic?PACE.magic:0)+(p?.action?PACE.action:0)+(p?.choice?PACE.action+WORDS(choiceSpeech(p.choice)).length/PACE.wps:0)+PACE.page;}
export const expectedSeconds=(ch,plan)=>Math.round((ch?.pages||[]).reduce((s,p)=>s+pageSeconds(p,plan),0));
const bgOf=p=>typeof p?.scene==='string'?p.scene:p?.scene?.bg;
import {checkBeats} from './puzzle-check.mjs';
import {dayNoteIssues} from './daynotes.mjs';
import {missingBeatProps} from '../hub/public/book-scene.mjs';
import {isFamilyWord,isLookAlike,readable,DECODABLE_NAMES} from '../hub/public/word-families.mjs';
import {learnerFocusIssues} from './learner-plan.mjs'; // learner model
// A line that is only a hum or a string of letters ("Mmm.", "Hmm!", "Zzz", "B B B"): the voice either says letter
// names or a meaningless hum. Every character line must say real words (Pip says "Pip!", not "Mmm").
const HUM=/^(?:m+|mm+h*m*|hm+|h+m+|zz+|uh+|um+|er+|ah+|oh+|ooh+|shh+|psst|[b-hj-z])$/i;
export function bareSound(text){const w=String(text).replace(/\[\[[^\]]*\]\]/g,' ').match(/[A-Za-z']+/g)||[];return w.length>0&&w.every(x=>HUM.test(x));}
// The words a beginning reader must read (decodable-only chapters): signs, spell tiles, magic words, captions.
// Each must be a CVC word-family word (or a mastered sight word); look-alikes share the first letter and differ in
// the vowel or the end, so a first-letter guess cannot pass. Names and other words are read to him, never tested.
export function readingIssues(ch,plan){
 if(plan?.level!=='reader'||plan.reading!=='decodable')return [];
 const sight=plan.sight||[],ok=w=>readable(w,{sight})||DECODABLE_NAMES.includes(String(w).toLowerCase()),out=[];
 for(const b of plan.beats||[]){
  if(b.kind==='signs'){if(!isFamilyWord(b.target))out.push(`beat ${b.id}: "${b.target}" is not a decodable family word (cat, big, hop)`);
   for(const o of b.options||[])if(o!==b.target&&!(isFamilyWord(o)&&isLookAlike(b.target,o)))out.push(`beat ${b.id}: look-alike "${o}" must be a family word with the same first letter as "${b.target}", one letter different in the vowel or the end`);}
  if(b.kind==='spell')for(const t of b.tiles||[]){const w=String(t).replace(/[^A-Za-z']/g,'');if(w&&!ok(w))out.push(`beat ${b.id}: the spell word "${w}" is not decodable for him`);}
 }
 for(const w of plan.magic||[])if(!isFamilyWord(w))out.push(`magic word "${w}" is not a decodable family word`);
 (ch?.pages||[]).forEach((p,i)=>{for(const w of String(p?.caption||'').match(/[A-Za-z']+/g)||[])if(!ok(w))out.push(`page ${i+1}: caption word "${w}" is not decodable for him (captions: family words only, or none)`);
  if(p?.magic?.word&&!isFamilyWord(p.magic.word))out.push(`page ${i+1}: magic word "${p.magic.word}" is not a decodable family word`);});
 return out;
}
// Runs like "Sss", "Lll", "Grrr", "Zzzz" are spelled out letter by letter by the narrator's voice.
export const spelledSound=t=>(String(t).replace(/\[\[[^\]]*\]\]/g,'').match(/\b\w*([b-df-hj-np-tv-z])\1\1\w*\b/i)||[])[0]||null;
export const sayOf=p=>(Array.isArray(p?.say)?p.say:[]).map(l=>Array.isArray(l)?{who:String(l[0]||'').toLowerCase(),text:String(l[1]||'')}:{who:String(l?.who||'').toLowerCase(),text:String(l?.text||''),...(l?.if?{if:l.if}:{})});
const pageText=p=>[...sayOf(p).map(l=>l.text),...(p?.magic?.after?sayOf({say:p.magic.after}).map(l=>l.text):[]),...(p?.after?sayOf({say:p.after}).map(l=>l.text):[])].join(' ');
// A word said twice in a row ("try to say it, try to say it", "[[bə]], [[bə]]", "go, go, go") sounds like a glitch or
// like worry to a child: every word and every sound once. Letter sounds count as words.
export function repeatedWords(text){const w=(String(text).match(/\[\[[^\]]*\]\]|[A-Za-z']+|\d+/g)||[]).map(x=>x.toLowerCase());const out=[];
 for(let i=1;i<w.length;i++)if(w[i]===w[i-1])out.push(w[i]);
 // A phrase of two or more words said again straight away ("try again, try again").
 for(let n=2;n<=4;n++)for(let i=0;i+2*n<=w.length;i++)if(w.slice(i,i+n).join(' ')===w.slice(i+n,i+2*n).join(' '))out.push(w.slice(i,i+n).join(' '));
 return [...new Set(out)];}
// An echo: a line that says the same thing twice in a new order ("Learn my sound, matey! My sound learn, matey!").
export function isEcho(text){const parts=String(text).split(/[.!?]+/).map(x=>(x.toLowerCase().match(/\[\[[^\]]*\]\]|[a-z']+/g)||[]).sort().join(' ')).filter(x=>x.split(' ').length>=3);
 return parts.some((x,i)=>parts.indexOf(x)!==i);}
// Friends from the household's cast who are NOT in this child's cast must not appear (by name) in his book.
export function otherFriends(text,others=[]){const t=String(text);return others.filter(n=>n&&new RegExp(`\\b${String(n).replace(/^the\s+/i,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(t));}
export function lintChapter(ch,plan,{extra=[],allow=[],speakers=null,actors=null,dadId='dad',dadName='Dad',others=[],library=null,travel=[]}={}){
 const readAsk=/can you read (?:it|this|the word)[^.!?]*\?|what does it say\?|read it!/i;
 const issues=[];const L=LEVELS[plan.level]||LEVELS.reader;
 if(!ch||typeof ch!=='object'||!Array.isArray(ch.pages))return ['not a chapter object with pages'];
 if(typeof ch.title!=='string'||!ch.title.trim()||ch.title.length>60)issues.push('title missing or longer than 60 characters');
 const pages=ch.pages;issues.push(...detailIssues(ch,plan));
 for(const [i,pg] of pages.entries())for(const l of [...(pg.say||[]),...(pg.after||[]),...(pg.magic?.after||[])]){const t=Array.isArray(l)?l[1]:l?.text;if(readAsk.test(String(t||'')))issues.push(`page ${i+1}: never ask him to read ("can you read it?"); the word card invites him`);}
 // every chapter somewhere new: no background from his last three chapters; today's place on page 1
 {const avoid=new Set(plan.avoidBgs||[]);const used=[...new Set(pages.map(p=>typeof p.scene==='string'?p.scene:p.scene?.bg).filter(Boolean))].filter(b=>avoid.has(b));if(used.length)issues.push(`uses a place from his last three chapters: ${used.join(', ')} (choose another listed place)`);
  if(plan.scenario&&(plan.avoidScenarios||[]).includes(plan.scenario.id))issues.push('uses a scenario from his last six chapters');
  const first=pages[0]&&(typeof pages[0].scene==='string'?pages[0].scene:pages[0].scene?.bg);if(plan.scenario&&first&&first!==plan.scenario.place)issues.push(`page 1 must be at today's place "${plan.scenario.place}"`);}
 if(pages.length<L.pages[0]||pages.length>L.pages[1])issues.push(`needs ${L.pages[0]}-${L.pages[1]} pages, has ${pages.length}`);
 if(plan.scenario?.paintedScene)for(const p of pages){
  const beat=plan.beats.find(b=>b.id===p.beat),observe=plan.scenario.sceneObserve&&beat?.at===plan.scenario.place&&beat.variant==='observe'&&beat.display==null;
  if(bgOf(p)===plan.scenario.place&&(p.action||p.magic||p.props?.length||p.beat&&!beat?.painted&&!observe))issues.push(`${plan.scenario.title}: painted objects stay clear; other play belongs elsewhere`);
  for(const line of sayOf(p))if(line.who==='narrator'&&/\bI\b/.test(line.text))issues.push(`${plan.scenario.title}: the narrator never says I`);
 }
 if(plan.scenario?.sceneQuestion)for(const p of pages)if(bgOf(p)===plan.scenario.place&&(p.action||p.magic||p.props?.length||p.beat&&plan.beats.find(b=>b.id===p.beat)?.variant!=='observe'))issues.push(`the painted scene at "${plan.scenario.place}" must stay clear: move props, literacy boards and actions to another place`);
 // 2-4 places, each with a real share of the time (none under 15%, none over 55%)
 {const t=new Map();for(const p of pages){const b=bgOf(p);if(b)t.set(b,(t.get(b)||0)+pageSeconds(p,plan));}const all=[...t.values()].reduce((a,b)=>a+b,0)||1;
  if(t.size<2||t.size>4)issues.push(`uses ${t.size} place${t.size===1?'':'s'}; use 2-4 different backgrounds`);
  else for(const [b,v] of t){const sh=v/all;if(sh>0.55)issues.push(`"${b}" fills ${Math.round(sh*100)}% of the chapter (max 55%): move some pages to another place`);
   else if(sh<0.15)issues.push(`"${b}" gets only ${Math.round(sh*100)}% of the chapter (min 15%): give it at least two pages or drop it`);}}
 // a game draws only library pictures (its plates, basket, and what he counts or deals)
 if(library)for(const b of plan.beats||[]){const m=missingBeatProps(b,library);if(m.length)issues.push(`beat ${b.id} (${b.kind}) has no drawing for ${m.join(', ')}`);}
 const castNames=(plan.cast||[plan.companion]).filter(Boolean).map(c=>c.name);
 const allowedWho=new Set(speakers||['narrator',...(plan.grownups||[{id:'dad'}]).map(g=>g.id),...(plan.cast||[]).map(c=>c.id)]);
 const all=[ch.title,...pages.flatMap(p=>[pageText(p),p?.caption||'',p?.magic?.object||'']),ch.summary||'',ch.hook||''].join('\n');
 issues.push(...safetyIssues(all,{extra,allow,travel}));
 {const m=all.match(/\bconductors?\b/i);if(m)issues.push(`"${m[0]}": never call him a conductor (not his nickname); use his name`);}
 // never compare or rank the brothers; praise his own effort and thinking (2026-10-01)
 for(const c of comparisonIssues(all,{names:[plan.sibling]}))issues.push(`${c}: never compare or rank him against his brother or anyone; praise his own effort and thinking`);
 // beats: each exactly once, in the planned order, never the first or last page
 const at=b=>pages.findIndex(p=>p?.beat===b.id);
 let last=-1;
 for(const b of plan.beats){const n=pages.filter(p=>p?.beat===b.id).length;if(n!==1){issues.push(`beat ${b.id} (${b.kind}) must appear exactly once (found ${n})`);continue;}
  const i=at(b);if(i<last)issues.push(`beat ${b.id} must come after the beats before it`);last=Math.max(last,i);
  // a scenario's own doing happens at today's place (counting the gym's dumbbells in the gym), and a game that needs
  // another place (a soccer goal) is played there, never in the home gym
  const bg=bgOf(pages[i]);if(b.at&&bg!==b.at)issues.push(`beat ${b.id} (${b.kind}) must be on a page at "${b.at}"`);if(b.away&&bg===b.away)issues.push(`beat ${b.id} (${b.kind}) must not be at "${b.away}": put it on a page at another place`);}
 if(pages[0]?.beat)issues.push('the first page must be a story page');
 if(pages.at(-1)?.beat)issues.push('the last page must be a story page that ends the chapter');
 // magic words: each on one story page, never said by the narrator before he reads it
 for(const w of plan.magic||[]){if(plan.masteredWords&&!plan.masteredWords.includes(w))issues.push(`magic word "${w}" has no independent mastery evidence`);const on=pages.filter(p=>String(p?.magic?.word||'').toLowerCase()===w);
  if(on.length!==1){issues.push(`magic word "${w}" must be on exactly one page (found ${on.length})`);continue;}
  const p=on[0];if(p.beat)issues.push(`magic word "${w}" must be on a story page, not a beat page`);
  if(new RegExp(`\\b${w}\\b`,'i').test(sayOf(p).map(l=>l.text).join(' ')))issues.push(`the narrator must not say the magic word "${w}" before he reads it (page ${pages.indexOf(p)+1})`);
  if(!sayOf({say:p.magic.after||[]}).length)issues.push(`magic word "${w}" needs "after" lines: what happens when he reads it`);}
 for(const p of pages)if(p?.magic&&!(plan.magic||[]).includes(String(p.magic.word||'').toLowerCase()))issues.push(`"${p.magic.word}" is not one of today's magic words`);
 let heroPages=0,dad=false;
 pages.forEach((p,i)=>{
  const say=sayOf(p);
  for(const l of say)if(bareSound(l.text))issues.push(`page ${i+1}: "${l.text}" is only a hum or letters; give ${l.who} real words (a friend who says its name, e.g. "Pip!")`);
  for(const l of say)if(spelledSound(l.text))issues.push(`page ${i+1}: "${spelledSound(l.text)}" is read aloud as letter names; write a real word (hiss, roar, hum) instead of a letter sound`);if(!say.length&&!p?.beat)issues.push(`page ${i+1} has no narration`);
  for(const l of say){if(!allowedWho.has(l.who))issues.push(`page ${i+1}: "${l.who}" cannot speak (use narrator, dad or a friend's id)`);
   if(!l.text.trim())issues.push(`page ${i+1} has an empty line`);if(WORDS(l.text).length>L.lineWords)issues.push(`page ${i+1} has a line over ${L.lineWords} words`);if(l.who===(plan.lead?.id||'dad'))dad=true;}
  const n=WORDS(pageText(p)).length;if(n>L.pageWords)issues.push(`page ${i+1} has ${n} spoken words (max ${L.pageWords})`);
  const cap=String(p?.caption||'').trim();
  if(cap){const w=WORDS(cap);if(w.length>L.captionWords)issues.push(`page ${i+1} caption must be at most ${L.captionWords} word${L.captionWords>1?'s':''}`);
   const long=w.filter(x=>x.length>L.captionWordLength&&!castNames.concat([plan.name]).some(nm=>nm.toLowerCase().includes(x.toLowerCase())));if(long.length)issues.push(`page ${i+1} caption word too long for him to read: ${long[0]}`);}
  const acts=(Array.isArray(p?.actors)?p.actors:[]).map(a=>String(a).split(':')[0].toLowerCase());
  if(acts.includes(plan.actorIds?.hero||plan.player))heroPages++;if(acts.includes(dadId))dad=true;
  if(actors)for(const a of acts)if(!actors.includes(a))issues.push(`page ${i+1}: unknown actor "${a}"`);
 });
 if(actors?.includes(plan.actorIds?.hero||plan.player)&&heroPages<Math.ceil(pages.length/2))issues.push(`${plan.name} must be in the picture on at least half the pages (actor "${plan.actorIds?.hero||plan.player}")`);
 // he plays: action pages, each with what happens after he acts
 const acts2=pages.filter(p=>p?.action);
 if(plan.actions&&acts2.length<(plan.minActions||0))issues.push(`needs at least ${plan.minActions} action pages ("action": ${Object.keys(plan.actions).map(a=>`"${a}"`).join(', ')}) where ${plan.name} plays`);
 acts2.forEach(p=>{const i=pages.indexOf(p);if(plan.actions&&!plan.actions[p.action])issues.push(`page ${i+1}: unknown action "${p.action}"`);if(p.beat)issues.push(`page ${i+1}: an action page cannot also be a beat`);
  if(!sayOf({say:p.after||[]}).length)issues.push(`page ${i+1}: action "${p.action}" needs "after" lines reacting to what he did`);
  if(p.action==='drive'&&!(p.props||[]).some(x=>String(x).startsWith('train')))issues.push(`page ${i+1}: the drive action needs "train" in props`);});
 if(!dad)issues.push(`${dadName} must be in the adventure (actor "${dadId}" or a line spoken by ${plan.lead?.id||'dad'}) at least once`);
 // Every grown-up with a picture (Dad and Mom) is in the book at least once, in the picture.
 for(const g of plan.grownups||[]){if(!actors||!actors.includes(g.id)||g.id===dadId)continue;
  const n=pages.filter(p=>(Array.isArray(p?.actors)?p.actors:[]).some(a=>String(a).split(':')[0].toLowerCase()===g.id)).length;
  if(n<2)issues.push(`${g.name} must be in the picture (actor "${g.id}") on at least two pages (a regular in his book; found ${n})`);}
 // Only this child's own friends.
 const castWords=(plan.cast||[]).flatMap(c=>String(c.name).toLowerCase().split(/\s+/));
 for(const n of otherFriends(all,others.filter(o=>!castWords.some(w=>w.startsWith(String(o).toLowerCase())))))issues.push(`"${n}" is not one of ${plan.name}'s friends; use only his cast`);
 pages.forEach((p,i)=>{for(const l of [...sayOf(p),...sayOf({say:p?.after||[]}),...sayOf({say:p?.magic?.after||[]})]){const r=repeatedWords(l.text);if(r.length)issues.push(`page ${i+1}: "${r[0]}" is said twice in a row; say every word once`);}});
 // A quiet friend (cast "quiet": Picos, 2026-10-01) says at most one line in the whole chapter.
 for(const c of (plan.cast||[]).filter(c=>c.quiet)){const n=pages.flatMap(p=>[...sayOf(p),...sayOf({say:p?.after||[]}),...sayOf({say:p?.magic?.after||[]})]).filter(l=>l.who===c.id).length;
  if(n>1)issues.push(`${c.name} is a quiet friend: at most one line in the whole chapter (found ${n}); let the narrator tell what he does`);}
 // A word-repeating friend (a parrot) may do its echo joke once per chapter, and never on a page with a game.
 {let echoes=0;pages.forEach((p,i)=>{for(const l of [...sayOf(p),...sayOf({say:p?.after||[]})])if(isEcho(l.text)){echoes++;if(p?.beat)issues.push(`page ${i+1}: an echo line on a game page ("${String(l.text).slice(0,40)}"); say it once`);}});
  if(echoes>1)issues.push(`${echoes} echo lines (the same words said twice in a new order); at most one echo joke per chapter`);}
 // Number games: well-formed, at his level, and said in full (book/puzzle-check.mjs).
 if(plan.level==='reader'&&plan.allowRemainders!==true&&plan.beats.some(b=>b.kind==='remainder'))issues.push('number game: remainder questions are disabled until a parent opts in');
 for(const i of checkBeats(plan.beats))issues.push(`number game: ${i}`);
 // Today's practice from the learner model (learner-plan.mjs): the chapter contains the planned focus items.
 try{issues.push(...learnerFocusIssues(ch,plan));}catch{}
 // hints, never answers: a beat page must not give its answer away
 for(const b of plan.beats){const p=pages.find(x=>x?.beat===b.id);if(!p)continue;const t=tokens(sayOf(p).map(l=>l.text).join(' '));
  // (a board puzzle's answer is a word: the piece that captures, the colour of the right door or dot)
  const ans=b.kind==='no'?b.right:['count','share','score','remainder'].includes(b.kind)||(b.kind==='puzzle'&&(/^\d+$/.test(b.answer)||['chess','maze'].includes(b.variant)))?b.answer:null;if(!ans)continue;
  if(t.some(x=>x.toLowerCase()===String(ans).toLowerCase()||(/^\d+$/.test(ans)&&x.toLowerCase()===NUMBER_WORDS[Number(ans)])))issues.push(`beat ${b.id} page gives away the answer ${ans}`);
  if(b.kind==='spell'&&norm(pageText(p)).includes(norm(b.sentence)))issues.push(`beat ${b.id} page writes out the spell; he must build it`);}
 // a game says its own question: the page's story lines never say it again (2026-09-29 recording: "the Dragon Cave or
 // the Crystal Lake" twice in a row, once by the page and once by the game)
 for(const b of plan.beats){const p=pages.find(x=>x?.beat===b.id);if(!p)continue;const g=k=>{const w=WORDS(k).map(x=>x.toLowerCase()),out=new Set();for(let i=0;i+5<=w.length;i++)out.add(w.slice(i,i+5).join(' '));return out;};
  const mine=g(sayOf(p).map(l=>l.text).join(' ')),game=g(beatSpeech(b));const same=[...mine].find(x=>game.has(x));if(same)issues.push(`beat ${b.id} page says "${same}", which the game says itself right after; set it up in other words`);}
 const wrong=wrongEquations(all);if(wrong.length)issues.push(`arithmetic mistakes in the story (the only mistake is the planned NO! beat, which the game says itself): ${wrong.join('; ')}`);
 // level
 const story=pages.map(pageText).join(' '),words=WORDS(story),count=words.length;
 if(count<L.words[0]||count>L.words[1])issues.push(`narration has ${count} words, needs ${L.words[0]}-${L.words[1]}`);
 {const total=count+WORDS((plan.beats||[]).map(beatSpeech).join(' ')).length+WORDS(pages.map(p=>choiceSpeech(p.choice)).join(' ')).length,secs=expectedSeconds(ch,plan);
  if(total>L.totalWords)issues.push(`everything said adds up to ${total} words with the games' own lines (max ${L.totalWords}); cut story lines`);
  if(secs>L.seconds)issues.push(`the chapter would run about ${secs} s (max ${L.seconds} s); cut story lines or pages`);}
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
 issues.push(...feedbackIssues(ch,plan));
 issues.push(...readingIssues(ch,plan));
 issues.push(...dayNoteIssues(ch,plan)); // day notes: never compare the brothers in their shared day
 for(const k of ['summary','hook'])if(typeof ch[k]!=='string'||!ch[k].trim())issues.push(`${k} missing`);
 return [...new Set(issues)];
}
// "Who said that? Was it me?"). A child's words are told to him ("You are smart and brave.") or attributed
const FIRST_PERSON=/\b(I|I'm|I've|I'll|I'd|me|my|mine|myself)\b/;
export function narratorFirstPerson(text){
 const t=String(text).replace(/\[\[[^\]]*\]\]/g,' ').replace(/["\u201c][^"\u201d]*["\u201d]/g,' ').replace(/\b(says|said|shouts|calls|whispers|sings|tells \w+)\s*[:,].*$/i,' ');
 return (t.match(FIRST_PERSON)||[])[0]||null;}
// The children's feedback, 2026-10-01: say "goal" once, the NO! beat and the letter's word match today's letter, the
// nobody speaks twice in a row, and no line is said twice.
export function feedbackIssues(ch,plan){
 const out=[],pages=ch?.pages||[],lines=p=>[...sayOf(p),...sayOf({say:p?.after||[]}),...sayOf({say:p?.magic?.after||[]})];
 const kids=new Set([plan.player,String(plan.name||'').toLowerCase(),String(plan.sibling||'').toLowerCase()].filter(Boolean));
 pages.forEach((p,i)=>{
  // the Book says "Goal!" itself after every score: an after line never says it again
  if(p?.action==='kick')for(const l of sayOf({say:p.after||[]}))if(/\bgoals?\b/i.test(l.text))out.push(`page ${i+1}: the game says "Goal!" itself; the "after" line must not say goal again ("You scored!")`);
  for(const l of lines(p)){
   if(kids.has(l.who))out.push(`page ${i+1}: ${plan.name} never speaks; tell him his own words ("You are brave.") in the narrator's line`);
   if(l.who==='narrator'||kids.has(l.who)){const w=narratorFirstPerson(l.text);if(w)out.push(`page ${i+1}: the narrator says "${w}" ("${l.text.slice(0,50)}"); the narrator never speaks as I: say "you" to him, or give the words to a friend`);}}
  // nobody says two lines in a row (merge them into one line)
  const say=sayOf(p);for(let k=1;k<say.length;k++)if(say[k].who!=='narrator'&&say[k].who===say[k-1].who)out.push(`page ${i+1}: ${say[k].who} speaks twice in a row; merge it into one line`);
 });
 // no line said twice in the chapter
 {const seen=new Map();pages.forEach((p,i)=>{for(const l of lines(p)){const k=norm(l.text);if(!k)continue;if(seen.has(k))out.push(`page ${i+1}: "${l.text.slice(0,40)}" was already said on page ${seen.get(k)+1}; say something new`);else seen.set(k,i);}});}
 // a friend with a reaction voice: at most two lines in the chapter, never SPEAKING on two pages in a row (his cry
 // twice in a row; 2026-10-01: the rule is about his lines, not the narrator naming him, which made good chapters fail)
 for(const c of (plan.cast||[]).filter(c=>/reactions/i.test(String(c?.voice||'')))){
  const n=pages.reduce((s,p)=>s+lines(p).filter(l=>l.who===c.id).length,0);
  if(n>1)out.push(`${c.name} speaks ${n} lines (each one starts with his cry): at most 1 in the chapter; let the narrator tell what he does`);
  // (and that one line is his cry, nothing else: "Pip! One try, then pause beside these flowers" is how he must NOT speak)
  for(const p of pages)for(const l of lines(p))if(l.who===c.id&&onlyCry(l.text)!==l.text)out.push(`${c.name} only says his cry ("${onlyCry(l.text)}"): let the narrator tell the rest`);
  for(const p of pages)for(const l of lines(p))if(l.who!==c.id&&new RegExp(`\\b${String(c.name).split(' ')[0]}\\b[^.!?]{0,12}\\b(says|said|means|meant)\\b`,'i').test(l.text))out.push(`"${l.text.slice(0,40)}": do not translate ${c.name}'s cry; tell what he does`);
  const speaks=pages.map(p=>lines(p).some(l=>l.who===c.id));
  for(let i=1;i<speaks.length;i++)if(speaks[i]&&speaks[i-1])out.push(`pages ${i} and ${i+1}: ${c.name} speaks on two pages in a row; let the narrator tell one`);
 }
 if(plan.level==='early'){
  const teach=(plan.beats||[]).find(b=>b.kind==='teach-letter'),no=(plan.beats||[]).find(b=>b.kind==='no');
  if(teach&&no&&no.right!==teach.letter)out.push(`the NO! beat must be about today's letter ${teach.letter}, not ${no.right}`);
  const fw=teach&&plan.familyWords?.[teach.letter];
  if(fw&&teach.word!==fw)out.push(`${teach.letter} is for ${fw} in this family: the letter's word must be ${fw}, not ${teach.word}`);
  if(teach)pages.forEach((p,i)=>{for(const l of lines(p))for(const m of String(l.text).matchAll(/\b([A-Za-z]+) starts with ([A-Z])\b/g))if(m[2]===teach.letter&&m[1].toLowerCase()!==String(teach.word).toLowerCase())out.push(`page ${i+1}: "${m[0]}": today's word for ${teach.letter} is ${teach.word}`);});
 }
 return out;
}
// Soft style rules are repaired here, in code, rather than throwing away a good chapter (2026-10-01): a reaction-voice
// friend's extra lines and back-to-back lines are dropped (or told by the narrator when it was the page's only line), a
// line already said earlier in the chapter is dropped, two lines in a row by one speaker are merged, and a kick's "after"
// line never says goal (the game says it). Returns a new story; the caller lints it again. Safety, reading, maths and
// structure are never "repaired" here.
export function softFix(story,plan){
 if(!story||!Array.isArray(story.pages))return story;
 const s=JSON.parse(JSON.stringify(story)),who=l=>Array.isArray(l)?String(l[0]||'').toLowerCase():String(l?.who||'').toLowerCase(),txt=l=>Array.isArray(l)?String(l[1]||''):String(l?.text||'');
 const setWho=(l,w)=>{if(Array.isArray(l))l[0]=w;else l.who=w;},setTxt=(l,t)=>{if(Array.isArray(l))l[1]=t;else l.text=t;};
 const lists=p=>[['say',p.say],['after',p.after],['magic',p.magic?.after]].filter(([,a])=>Array.isArray(a));
 // the asking sentence is dropped, the rest of the line kept
 const READ_ASK=/\s*(?:can you read (?:it|this|the word)[^.!?]*\?|what does it say\?|read it!)/gi;
 for(const p of s.pages)for(const [,a] of lists(p))for(const l of a){const t=txt(l),u=t.replace(READ_ASK,'').trim();if(u&&u!==t)setTxt(l,u);}
 const drop=(p,arr,l)=>{const total=lists(p).reduce((n,[,a])=>n+a.length,0);if(total>1||arr!==p.say)arr.splice(arr.indexOf(l),1);else setWho(l,'narrator');};
 // kick "after": the game says Goal itself
 for(const p of s.pages)if(p.action==='kick'&&Array.isArray(p.after))for(const l of p.after){const t=txt(l).replace(/\bGoal(s)?!?\s*/g,'').replace(/\bgoals?\b/gi,'score').trim();setTxt(l,t||'You scored!');}
 // one speaker twice in a row: one line
 for(const p of s.pages)for(const [,a] of lists(p))for(let k=a.length-1;k>0;k--)if(a[k]?.if===a[k-1]?.if&&who(a[k])!=='narrator'&&who(a[k])===who(a[k-1])){setTxt(a[k-1],txt(a[k-1]).replace(/\s*$/,' ')+txt(a[k]));a.splice(k,1);}
 // a line said again later
 {const seen=new Set(),norm=t=>t.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();for(const p of s.pages)for(const [,a] of lists(p))for(const l of [...a]){const k=norm(txt(l));if(!k)continue;if(seen.has(k))drop(p,a,l);else seen.add(k);}}
 // a reaction-voice friend: at most ONE line (2026-10-02), never on two pages in a row
 for(const c of (plan.cast||[]).filter(c=>/reactions/i.test(String(c?.voice||'')))){let n=0,prev=false;
  for(const p of s.pages){let here=false;for(const [,a] of lists(p))for(const l of [...a])if(who(l)===c.id){if(n>=1||prev||here)drop(p,a,l);else{n++;here=true;const cry=onlyCry(txt(l));if(cry!==txt(l))setTxt(l,cry);}}prev=here;}}
 return s;
}
// A reaction-voice friend's line is his cry alone: the first [[...]] cry (or the first word) plus "!".
export function onlyCry(text){const t=String(text||'').trim(),m=t.match(/^\s*(\[\[[^\]]+\]\](?:[\s-]*\[\[[^\]]+\]\])*)/)||t.match(/^\s*([A-Za-z]+(?:-[A-Za-z]+)*)/);return m?m[1].trim()+'!':t;}
// Dad's free-text line is only used when it passes the same safety rules.
export function safeDadLine(text,opts){const t=String(text||'').trim().slice(0,160);return t&&!safetyIssues(t,opts).length&&!comparisonIssues(t,{names:opts?.names||[]}).length?t:null;}
