// The Book: the language-model brief. The model writes scenes and narration; the plan fixes what is
// learned (the beats) and the picture library fixes what can be drawn.
import {memoryBrief} from './memory.mjs';
import {LEVELS,PACE,beatSpeech} from './lint.mjs';
import {learnerBrief} from './learner-plan.mjs'; // learner model
import {FX} from '../hub/public/book-scene.mjs';
import {dayNotesSection} from './daynotes.mjs'; // day notes
export const SYSTEM=`You write one chapter of a child's own illustrated, narrated adventure book, in the spirit of the Young Lady's Illustrated Primer: the child is the hero, his own toys are his friends, and he learns because the adventure needs it.
It is a VISUAL story: every page is a full-screen picture you compose from a picture library, and a warm narrator (with the friends' voices) tells it aloud. Almost no text is on screen.
You are warm, funny, mischievous and concrete. You never frighten, never mention illness, doctors, hospitals, injury, death, grandparents, school reports, teachers, therapy, brands, real famous people, surnames, real places or any personal detail beyond first names.
Conflict is gentle: a puzzle, a mix-up, a locked door, a lost ball found again, a friend who is shy or cheeky. Real life appears only as gentle allegory.
You reply with ONE JSON object and nothing else.`;
const APPS={'number-park':'number games (sharing cookies, counting, patterns)','letter-quest':'letter and word adventures','maze-garden':'building and solving mazes','target-trail':'aiming and target games','three-in-a-row':'noughts and crosses','hub':'soccer dribbling','word-arcade':'word games'};
// When some beats must happen at today's place (b.at: counting the home gym's dumbbells in the home gym), a page plan
// that satisfies the order of the beats, the place rules and the time shares at once (the model alone kept failing
// the lint on it): runs of beats alternate between today's place and other places, each run followed by a story page.
// An honest word target (2026-10-01): the brief allowed up to L.words[1] words, but each game beat also takes ~beatSeconds
// plus its own speech, and every page ~1.5 s; with 5-6 beats a chapter at the word maximum ran 241-246 s of 230 and every
export function wordTarget(plan){const L=LEVELS[plan.level];if(!L)return null;const beats=plan.beats||[];
 const beatTime=beats.reduce((t,b)=>t+(L.beatSeconds??PACE.beat)+String(beatSpeech(b)).split(/\s+/).filter(Boolean).length/PACE.wps,0);
 const pages=L.pages[1],fixed=beatTime+pages*PACE.page+2*PACE.magic; // (chapters use the page maximum, and a couple of magic moments)
 const fit=Math.floor((L.seconds*0.95-fixed)*PACE.wps);return Math.max(L.words[0],Math.min(L.words[1],fit));}

export function placeShape(plan){const T=plan.scenario?.place,beats=plan.beats||[];if(!T||!beats.some(b=>b.at===T))return null;
 const runs=[];for(const b of beats){const here=b.at===T;if(runs.length&&runs.at(-1).here===here)runs.at(-1).ids.push(b.id);else runs.push({here,ids:[b.id]});}
 // four or more beats in a row somewhere else would fill more than half the chapter: they go to two places
 // (2026-10-01: a quest scenario's two puzzles come first, then signs, spell, fork and NO!)
 for(let i=0;i<runs.length;i++)if(!runs[i].here&&runs[i].ids.length>=4){const h=Math.ceil(runs[i].ids.length/2);runs.splice(i,1,{here:false,ids:runs[i].ids.slice(0,h)},{here:false,ids:runs[i].ids.slice(h)});i++;}
 let k=0;const names=['a second place','a third place'],q=ids=>ids.map(i=>`"${i}"`).join(' and ');
 return [`page 1 (story) at "${T}"`,...runs.map((r,i)=>{const where=r.here?`"${T}"`:names[(k++)%2];return `${q(r.ids)} at ${where}, then ${i===runs.length-1?'the last story page':'a story page'} there`;})].join('; ');}
// "Conductor" is not his nickname (2026-10-01): a sentence calling him that is left out of the brief (his season arc,
// details, life themes), and the story so far says "traveller" instead, so the model never picks it up.
export const NOT_NICKNAMES=/\bconductors?\b/i;
const dropNick=t=>String(t||'').split(/(?<=[.!?])\s+/).filter(x=>!NOT_NICKNAMES.test(x)).join(' ');
const swapNick=t=>String(t||'').replace(/\b(C|c)onductor(s?)\b/g,(m,c,s)=>(c==='C'?'Traveller':'traveller')+s);
// Scenario texts say "the younger/older brother"; the writer once gave the younger brother's scene to his brother
// (Oct 1 2026). Name the hero outright, and call the other boy "his brother".
export function whoIs(text,plan){const heroYounger=plan.level==='early';
 return String(text||'').replace(/\b([Tt])he (younger|older) brother\b/g,(m,t,w)=>(w==='younger')===heroYounger?plan.name:(t==='T'?'His':'his')+' brother');}
export function buildPrompt(plan,{dadLines=[],library,actors=[],speakers=[]}={}){
 plan={...plan,arc:plan.arc?dropNick(plan.arc):plan.arc,compass:(plan.compass||[]).filter(c=>!NOT_NICKNAMES.test(c)),themes:(plan.themes||[]).filter(t=>!NOT_NICKNAMES.test(t.seed)),details:(plan.details||[]).filter(d=>!NOT_NICKNAMES.test(d.seed)),
  previous:(plan.previous||[]).map(p=>({...p,title:swapNick(p.title),summary:swapNick(p.summary),hook:swapNick(p.hook)})),running:(plan.running||[]).map(swapNick)};
 const L=LEVELS[plan.level],early=plan.level==='early',y=plan.yesterday;
 const events=[...dadLines.map(t=>`Dad says: "${t}"`),...(plan.play||[]).map(l=>`He played: ${l}.`),
  ...(y?.played?y.highlights.map(h=>`He played ${APPS[h.app]||h.app} for about ${h.minutes} minutes.`):[]),...plan.running.map(l=>`From his game story: ${l}`)];
 // (a place from his last three chapters is not offered at all: every chapter somewhere new)
 const avoid=new Set(plan.avoidBgs||[]),bgs=Object.entries(library.backgrounds).filter(([id])=>!avoid.has(id)).map(([id,b])=>`${id} (${b.about||id})`).join('; ');
 const acts=actors.map(id=>{const a=library.actors[id];return `${id} [poses: ${Object.keys(a.poses).join(', ')}]`;}).join('; ');
 // (a game's own pieces, such as the painted chess pieces of a board puzzle, are not scene props)
 const props=Object.entries(library.props).filter(([,p])=>!p.beatOnly).map(([id,p])=>`${id} (${p.about||id})`).join('; ');
 const beatLines=plan.beats.map(b=>`- "${b.id}" (${b.kind}): ${b.what}.${b.at?` Its page is at "${b.at}".`:''}${b.away?` Its page is NOT at "${b.away}" (another place).`:''}`).join('\n');
 const noBeat=plan.beats.find(b=>b.kind==='no');
 return `Write today's chapter of ${plan.name}'s book.

THE CHILD
- ${plan.name}, age ${early?5:8}. ${early?'He is learning his letters and cannot read yet: the book is told TO him. Narration uses very short, simple sentences (5-8 words), everyday words, repetition, sound words and funny voices.':'He reads short words and is growing into longer sentences. Narration is a lively read-aloud for an 8-year-old: clear sentences, some playful words, no long descriptions.'}
- Loves: ${plan.interests.join(', ')||'playing'}.${plan.compass.length?`\n- His favourite kinds of stories (a style compass only; never copy their characters, names or words):\n${plan.compass.map(c=>'  - '+c).join('\n')}`:''}
- His friends in this chapter (his own toys come to life; keep each personality exactly; name each at least once; no other animal or toy friends). A friend who repeats words (a parrot) does that joke ONCE in the whole chapter, never on a game page; every other line of his says each thing once:
${plan.cast.map(c=>`  - ${c.name} (id "${c.id}"): ${c.kind}.${c.quiet?` A QUIET friend: at most ONE short line in the whole chapter (or none); he shows things by doing, and the narrator tells it. He is in the picture often.`:''}${c.recordedLines?.length?` This guest has recorded speech only: use exactly one of ${JSON.stringify(c.recordedLines)} if he speaks. The narrator describes any other action or meaning; never invent extra dialogue for this guest.`:''}`).join('\n')}
- ${(plan.lead||{name:'Dad'}).name} (id "${(plan.lead||{id:'dad'}).id}") goes on the adventure with him today: warm, playful, proud of him.${(plan.grownups||[]).filter(g=>g.id!==(plan.lead||{id:'dad'}).id).map(g=>` ${g.name} (id "${g.id}") comes along too for part of the adventure (a hug, a cheer, a snack, a helping hand): in the picture on at least three pages.`).join('')}${(plan.grownups||[]).filter(g=>g.alsoCalled?.length||g.note).map(g=>` The narration calls her or him "${g.name}"${g.alsoCalled?.length?`; when the narrator quotes a child calling out, he may say "${g.alsoCalled.join('" or "')}"`:''}.${g.note?' '+g.note:''}`).join('')}${plan.sibling?` His brother ${plan.sibling} may appear as a friendly helper.`:''}
- NEVER compare him with his brother (or anyone): no "better than", "faster than", "beat his brother", "the best of the two", "smarter than everyone", no ranking, no racing each other; everyone cheers. Praise HIS OWN effort, thinking and kindness ("you thought it through", "you kept trying"), never being better than someone.
${plan.tricks.length?`- He sometimes ${plan.tricks.join('; ')}. One friend models the better habit once, gently, inside the story, never as a lecture.\n`:''}${plan.themes.length?`
FROM HIS LIFE (use ONE or TWO as gentle allegory, the Primer's way: never literal, never naming real people or places; always empowering, never labelling him)
Use each optional theme at most ONCE in the chapter.
${plan.themes.map(t=>`- ${t.seed}`).join('\n')}
`:''}${(plan.details||[]).length?`
SMALL THINGS HE LOVES (weave each in as ONE short story touch, once; never a lecture, never a list)
Use each optional detail at most ONCE in the chapter; no repeated food stops.
${plan.details.map(d=>`- ${d.seed}`).join('\n')}
`:''}${plan.style==='quest'?`
HIS BOOK IS A QUEST (he is 8 and finds baby books boring: this one plays like a game)
- Tone: a young wizard's adventure, not a baby book. Short, punchy lines; real stakes (a lock, a route, a choice); humour; no baby talk, no "yay", no cooing.
- His book is his spellbook: the magic words he reads are SPELLS he casts. The narration may call him a young wizard (a boy wizard).
- The fork beat: he chooses one of two ways. The pages after the fork must work for EITHER way (write the next place so both ways lead there; never say which way he took). The game gives him the treasure of the way he chose.
- End the chapter with the treasure going into his spellbook and a cliffhanger.
`:''}${plan.keyStyle==='golden'?`
- His letter keys are GOLDEN keys (his favourite colour is gold): always say "golden key".
`:''}${plan.keyArc?(k=>`
THE KEYS (the thread he follows across chapters)
- He is collecting ${k.goal} golden keys; he has ${k.have.length} so far${k.have.length?` (${k.have.join(', ')})`:''}. Today he wins key number ${k.number} of ${k.goal}${k.letter?`, the ${k.letter} key`:''}.
${k.finale?`- THIS IS THE LAST KEY: the finale. It opens the last hiding place, and then it is Dad's birthday party: everyone (Mom, Dad, all his friends) unwraps together the presents Beginner wrapped and hid for Dad. A joyful, proud ending to the whole book.`:`- Today's key opens one hiding place${k.place?`: ${k.place}`:''}, where some of the presents Beginner secretly wrapped for Dad's birthday are hidden. He peeks at the wrapped presents and keeps them secret (they are for Dad's birthday, when all ${k.goal} keys are found). Never say what is inside.`}
`)(plan.keyArc):''}${(plan.recent||[]).length?`
${plan.scenario?`TODAY'S PLACE AND REAL-LIFE SCENARIO (the spine of the chapter; new for him)
- ${whoIs(plan.scenario.what,plan)}
- The doing: ${whoIs(plan.scenario.doing,plan)}. Let him DO things; keep the narrator short.
- Page 1 and about a third of the pages (never more than half) use the background "${plan.scenario.place}"; the rest of the chapter goes to 1-3 other places.${placeShape(plan)?`\n- A shape that fits every rule: ${placeShape(plan)}.`:''} Never name a real school, place or other child: say "his school", "the coach", "a big kid".
`:''}VARY IT (recent chapters used these; choose OTHER places, foods and set pieces today)
- ${plan.recent.join('\n- ')}
`:''}${plan.arc?`
HIS SEASON-LONG QUEST (the continuing adventure; each chapter moves it one small step and ends with a gentle cliffhanger)
- ${plan.arc}${plan.collection.keys.length?`\n- Letter keys he has collected so far: ${plan.collection.keys.join(', ')}.`:''}
`:''}
${dayNotesSection(plan)/* day notes: the parent's note about his real day */}WHAT HAPPENED YESTERDAY (turn it into a small adventure; never copy personal details)
${events.length?events.map(e=>'- '+e).join('\n'):'- A quiet day.'}

STORY SO FAR (continue it; keep names and places consistent)
${plan.previous.length?plan.previous.map(p=>`- ${p.date} "${p.title}": ${p.summary}${p.hook?` Next time: ${p.hook}`:''}`).join('\n'):'- This is the first chapter of the new book. Begin the quest.'}
${memoryBrief(plan.memory)}
THE BEATS (the adventure NEEDS these; the game draws and speaks each one itself, you set it up)
${beatLines}
For each beat add ONE page {"beat": "<id>", ...} whose narration (1-3 short lines) makes the story need it right now (a river to cross, a gate to open, a spell to fix). Do NOT say the answer, the number or the right letter on a beat page. Do NOT write the beat's own instructions: the game says them.
${learnerBrief(plan)}${noBeat?`The "${noBeat.id}" page is the NO! beat: ${noBeat.whoName} is cheeky and begs to do the wrong thing (the game speaks the wrong claim and the begging); your narration just sets it up. The child shouts NO! and fixes it. After it, ${noBeat.whoName} laughs about it.`:''}
${plan.magic.length?`
MAGIC WORDS (he reads these himself; the narrator goes quiet on them)
- Put each of these words on its own story page, written on something in the picture (a sign, a door, a chest, a map, a spell book): ${plan.magic.map(w=>`"${w}"`).join(', ')}.
- On that page add "magic": {"word": "<word>", "object": "<what it is written on, e.g. the station sign>", "after": [["narrator","what happens when he reads it: the world responds"]]}.
- The narration BEFORE he reads it must never say the word. Build up to it ("The sign has a word on it."), but NEVER ask "can you read it?" or tell him to read (no "Read it!", "What does it say?"): the word card invites him by itself. The "after" lines may use the word.
`:''}
HE PLAYS, NOT WATCHES (this is his own adventure)
- At least ${plan.minActions} ACTION page${plan.minActions>1?'s':''}: a story page with "action" set to one of: ${Object.entries(plan.actions).map(([k,v])=>`"${k}" (${v})`).join('; ')}.
- An action page's "say" sets it up and hands it to him ("Your turn, ${plan.name}! Kick it!"); it NEVER tells what happens. Its "after" lines ([["narrator","..."]]) react to what he did ("You scored!"). The game itself says "Goal!" after every kick: an "after" line NEVER says goal (no word said twice). Use "kick" on a soccer-pitch page when he loves soccer. For "throw", say which friend fetches ("fetcher": "<friend id>"). For "drive", put "train" in the props.
- Nothing he does is ever narrated before he does it: no "Great shot!" until he has shot.
- First chapter or new friends: page 1 says who is who (one short line each, e.g. "This is Pip, your robot friend!").

EACH PAGE IS A PICTURE (compose it only from this library)
- "scene": one background id: ${bgs}.
- "actors": up to 4 of: ${acts}. Write "id" or "id:pose". ${plan.name} (id "${plan.player}") is in the picture on most pages. Pick poses that match the action (kick for soccer, cheer for joy, fly for flying).
- "props": up to 3 of: ${props}. "train" with "ride": true puts the actors in the train's carriages; use the train only when today's place truly calls for it (rarely, never as the default way to travel, and almost never for an older reader), and Dad rides along on every train page ("dad" in its actors).
- "fx": one of ${FX.join(', ')}.
- "caption": ${early?'usually empty; at most ONE word or letter on screen (e.g. the letter he is learning, or a short word like "GO")':plan.reading==='decodable'?'usually empty; at most 3 words, and ONLY three-letter word-family words he can sound out (cat, big, hop, sun, bug, pin), or none. Never a name or a longer word':'optional; at most 6 short, easy words on screen'}.${plan.reading==='decodable'?`
- He is a BEGINNING reader: anything he must read himself is a three-letter word-family word (cat, big, hop). Station, place and friends' names are said aloud by the narrator, never something he is asked to read.`:''}
- "say": the narration as [["narrator","..."],["<friend id or dad>","..."]]. Every line is real words: never a bare hum or sound ("Mmm.", "Hmm", "Zzz"); a sleepy or thinking friend says so in words, and a friend with a catchphrase uses it (see the cast). Never say a word twice in a row (no "go, go, go", no "wag, wag"); each thing is said once. Anyone a page names or lets speak is in that page's actors; the friends are ONLY the cast above. ${(plan.grownups||[]).length>1?`${plan.grownups.map(g=>g.name).join(' and ')} are both in today's chapter: each is in the picture (as an actor) on at least three pages, not every page.`:`${(plan.lead||{name:'Dad'}).name} is the grown-up today (the others stay home): in the picture on at least three pages.`}${plan.crowd?` He loves a full picture: most pages show three or four of the family and his friends together${plan.sibling?` (his brother ${plan.sibling} too)`:''}.`:''} Friends and Dad speak in their own voices; ${plan.name} never speaks (he acts, taps and shouts). Put spoken words in the line itself, no quotation marks needed.
- The narrator NEVER says "I", "me" or "my": she tells the story to him. His own words (e.g. a sentence of his quoted in the style compass, "I am brave...") are said to him in the second person ("You are brave and smart. You never give up, and you have lots of friends."), never as a line of his.
- Nobody speaks two lines in a row (one line each, merged), and no line is said twice in the chapter.${(plan.cast||[]).filter(c=>/reactions/i.test(String(c.voice||''))).map(c=>`
- ${c.name}'s voice starts every line he speaks with his cry: he speaks at most ONE line in the whole chapter and that line is ONLY his cry (just "[[cry]]!", no other words) (the game already gives him his NO! claim); the narrator tells what he DOES, never what he says: no translating his cry ("Pip says...", "he means..."), and names him on one page at a time, never two pages in a row.`).join('')}${early&&plan.familyWords?.[plan.letter]?`
- Today's letter ${plan.letter} is for ${plan.familyWords[plan.letter]} (the family's own name for it): if a line says what starts with ${plan.letter}, it is ${plan.familyWords[plan.letter]}.`:''}

SHAPE
- ${L.pages[0]}-${L.pages[1]} pages. Page 1 is a story page that starts the adventure; the last page is a story page with a warm ending and a small cliffhanger for tomorrow.
- SHORT narration, more doing (HARD limits, checked): ${L.words[0]}-${L.words[1]} spoken words in total across all "say" and "after" lines; at most ${L.pageWords} per page and at most 2 narrator lines per page; at most ${L.lineWords-4} words per line. The games say their own questions and answers: a game page needs only one short line to set it up. The whole chapter must play in about ${Math.round(L.seconds/60*2)/2} minutes${wordTarget(plan)<L.words[1]?`: with today's ${(plan.beats||[]).length} games, aim for about ${wordTarget(plan)} spoken words in total (the games take the rest of the time)`:''}.
- Use 2-4 different backgrounds (places), today's place first; only the backgrounds listed above. Every place used gets at least two pages, and no place has more than half the pages: the chapter MOVES (e.g. 4 pages at today's place, 3 somewhere else, 3 back or at a third place). ${(plan.lead||{name:'Dad'}).name} is in at least two pages.
- ${plan.name} is the hero: he solves things, his friends help. Call him by his name; never call him a conductor. Do not use em dashes.

REPLY WITH ONLY THIS JSON
{"title":"short chapter title","pages":[{"scene":"...","actors":["${plan.player}","dad:cheer"],"props":[],"fx":"sparkles","caption":"","say":[["narrator","..."],["dad","..."]]},{"action":"kick","scene":"soccer-pitch","actors":["${plan.player}","..."],"say":[["dad","Your turn! Kick it!"]],"after":[["narrator","You scored! ..."]]},{"beat":"b1","scene":"...","actors":["..."],"say":[["narrator","..."]]}${plan.magic.length?`,{"scene":"...","actors":["..."],"say":[["narrator","..."]],"magic":{"word":"${plan.magic[0]}","object":"...","after":[["narrator","..."]]}}`:''}],"summary":"one sentence: what happened (for continuity)","hook":"one short sentence: what might happen next time"}`;
}
export function repairPrompt(previous,issues){
 return `Your chapter JSON has these problems:\n${issues.map(i=>'- '+i).join('\n')}\n\nFix ONLY these problems and keep everything else. Keep every beat: the same beat ids, in the same order, each exactly once, on its own page; do not remove or merge pages that hold a beat. Reply with ONLY the corrected JSON object.\n\n${JSON.stringify(previous)}`;
}
export function parseChapter(text){
 const s=String(text||'');const start=s.indexOf('{'),end=s.lastIndexOf('}');if(start<0||end<start)return null;
 try{return JSON.parse(s.slice(start,end+1));}catch{return null;}
}
