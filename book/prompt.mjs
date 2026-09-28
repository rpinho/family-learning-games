// The Book: the language-model brief. The model writes scenes and narration; the plan fixes what is
// learned (the beats) and the picture library fixes what can be drawn.
import {LEVELS} from './lint.mjs';
import {FX} from '../hub/public/book-scene.mjs';
export const SYSTEM=`You write one chapter of a child's own illustrated, narrated adventure book, in the spirit of the Young Lady's Illustrated Primer: the child is the hero, his own toys are his friends, and he learns because the adventure needs it.
It is a VISUAL story: every page is a full-screen picture you compose from a picture library, and a warm narrator (with the friends' voices) tells it aloud. Almost no text is on screen.
You are warm, funny, mischievous and concrete. You never frighten, never mention illness, doctors, hospitals, injury, death, grandparents, school reports, teachers, therapy, brands, real famous people, surnames, real places or any personal detail beyond first names.
Conflict is gentle: a puzzle, a mix-up, a locked door, a lost ball found again, a friend who is shy or cheeky. Real life appears only as gentle allegory.
You reply with ONE JSON object and nothing else.`;
const APPS={'number-park':'number games (sharing cookies, counting, patterns)','letter-quest':'letter and word adventures','maze-garden':'building and solving mazes','target-trail':'aiming and target games','three-in-a-row':'noughts and crosses','hub':'soccer dribbling','word-arcade':'word games'};
export function buildPrompt(plan,{dadLines=[],library,actors=[],speakers=[]}={}){
 const L=LEVELS[plan.level],early=plan.level==='early',y=plan.yesterday;
 const events=[...dadLines.map(t=>`Dad says: "${t}"`),...(plan.play||[]).map(l=>`He played: ${l}.`),
  ...(y?.played?y.highlights.map(h=>`He played ${APPS[h.app]||h.app} for about ${h.minutes} minutes.`):[]),...plan.running.map(l=>`From his game story: ${l}`)];
 const bgs=Object.entries(library.backgrounds).map(([id,b])=>`${id} (${b.about||id})`).join('; ');
 const acts=actors.map(id=>{const a=library.actors[id];return `${id} [poses: ${Object.keys(a.poses).join(', ')}]`;}).join('; ');
 const props=Object.entries(library.props).map(([id,p])=>`${id} (${p.about||id})`).join('; ');
 const beatLines=plan.beats.map(b=>`- "${b.id}" (${b.kind}): ${b.what}.`).join('\n');
 const noBeat=plan.beats.find(b=>b.kind==='no');
 return `Write today's chapter of ${plan.name}'s book.

THE CHILD
- ${plan.name}, age ${early?5:8}. ${early?'He is learning his letters and cannot read yet: the book is told TO him. Narration uses very short, simple sentences (5-8 words), everyday words, repetition, sound words and funny voices.':'He reads short words and is growing into longer sentences. Narration is a lively read-aloud for an 8-year-old: clear sentences, some playful words, no long descriptions.'}
- Loves: ${plan.interests.join(', ')||'playing'}.${plan.compass.length?`\n- His favourite kinds of stories (a style compass only; never copy their characters, names or words):\n${plan.compass.map(c=>'  - '+c).join('\n')}`:''}
- His friends in this chapter (his own toys come to life; keep each personality exactly; name each at least once; no other animal or toy friends). A friend who repeats words (a parrot) does that joke ONCE in the whole chapter, never on a game page; every other line of his says each thing once:
${plan.cast.map(c=>`  - ${c.name} (id "${c.id}"): ${c.kind}.`).join('\n')}
- ${(plan.lead||{name:'Dad'}).name} (id "${(plan.lead||{id:'dad'}).id}") goes on the adventure with him today: warm, playful, proud of him.${(plan.grownups||[]).filter(g=>g.id!==(plan.lead||{id:'dad'}).id).map(g=>` ${g.name} (id "${g.id}") comes along too for part of the adventure (a hug, a cheer, a snack, a helping hand): in the picture on at least three pages.`).join('')}${(plan.grownups||[]).filter(g=>g.alsoCalled?.length||g.note).map(g=>` The narration calls her or him "${g.name}"${g.alsoCalled?.length?`; when the narrator quotes a child calling out, he may say "${g.alsoCalled.join('" or "')}"`:''}.${g.note?' '+g.note:''}`).join('')}${plan.sibling?` His brother ${plan.sibling} may appear as a friendly helper.`:''}
${plan.tricks.length?`- He sometimes ${plan.tricks.join('; ')}. One friend models the better habit once, gently, inside the story, never as a lecture.\n`:''}${plan.themes.length?`
FROM HIS LIFE (use ONE or TWO as gentle allegory, the Primer's way: never literal, never naming real people or places; always empowering, never labelling him)
${plan.themes.map(t=>`- ${t.seed}`).join('\n')}
`:''}${(plan.details||[]).length?`
SMALL THINGS HE LOVES (weave each in as ONE short story touch, once; never a lecture, never a list)
${plan.details.map(d=>`- ${d.seed}`).join('\n')}
`:''}${plan.style==='quest'?`
HIS BOOK IS A QUEST (he is 8 and finds baby books boring: this one plays like a game)
- Tone: a young wizard's adventure, not a baby book. Short, punchy lines; real stakes (a lock, a route, a choice); humour; no baby talk, no "yay", no cooing.
- His book is his spellbook: the magic words he reads are SPELLS he casts. The narration may call him a young wizard (a boy wizard).
- The fork beat: he chooses one of two ways. The pages after the fork must work for EITHER way (write the next place so both ways lead there; never say which way he took). The game gives him the treasure of the way he chose.
- End the chapter with the treasure going into his spellbook and a cliffhanger.
`:''}${plan.keyStyle==='golden'?`
- His letter keys are GOLDEN keys (his favourite colour is gold): always say "golden key".
`:''}${plan.arc?`
HIS SEASON-LONG QUEST (the continuing adventure; each chapter moves it one small step and ends with a gentle cliffhanger)
- ${plan.arc}${plan.collection.keys.length?`\n- Letter keys he has collected so far: ${plan.collection.keys.join(', ')}.`:''}
`:''}
WHAT HAPPENED YESTERDAY (turn it into a small adventure; never copy personal details)
${events.length?events.map(e=>'- '+e).join('\n'):'- A quiet day.'}

STORY SO FAR (continue it; keep names and places consistent)
${plan.previous.length?plan.previous.map(p=>`- ${p.date} "${p.title}": ${p.summary}${p.hook?` Next time: ${p.hook}`:''}`).join('\n'):'- This is the first chapter of the new book. Begin the quest.'}

THE BEATS (the adventure NEEDS these; the game draws and speaks each one itself, you set it up)
${beatLines}
For each beat add ONE page {"beat": "<id>", ...} whose narration (1-3 short lines) makes the story need it right now (a river to cross, a train to load, a spell to fix). Do NOT say the answer, the number or the right letter on a beat page. Do NOT write the beat's own instructions: the game says them.
${noBeat?`The "${noBeat.id}" page is the NO! beat: ${noBeat.whoName} is cheeky and begs to do the wrong thing (the game speaks the wrong claim and the begging); your narration just sets it up. The child shouts NO! and fixes it. After it, ${noBeat.whoName} laughs about it.`:''}
${plan.magic.length?`
MAGIC WORDS (he reads these himself; the narrator goes quiet on them)
- Put each of these words on its own story page, written on something in the picture (a sign, a door, a chest, a station, a train, a spell book): ${plan.magic.map(w=>`"${w}"`).join(', ')}.
- On that page add "magic": {"word": "<word>", "object": "<what it is written on, e.g. the station sign>", "after": [["narrator","what happens when he reads it: the world responds"]]}.
- The narration BEFORE he reads it must never say the word. Build up to it ("The sign says... can you read it?"); the "after" lines may use it.
`:''}
HE PLAYS, NOT WATCHES (this is his own adventure)
- At least ${plan.minActions} ACTION page${plan.minActions>1?'s':''}: a story page with "action" set to one of: ${Object.entries(plan.actions).map(([k,v])=>`"${k}" (${v})`).join('; ')}.
- An action page's "say" sets it up and hands it to him ("Your turn, ${plan.name}! Kick it!"); it NEVER tells what happens. Its "after" lines ([["narrator","..."]]) react to what he did ("Goal! You scored!"). Use "kick" on a soccer-pitch page when he loves soccer. For "throw", say which friend fetches ("fetcher": "<friend id>"). For "drive", put "train" in the props.
- Nothing he does is ever narrated before he does it: no "Great shot!" until he has shot.
- First chapter or new friends: page 1 says who is who (one short line each, e.g. "This is Pip, your robot friend!").

EACH PAGE IS A PICTURE (compose it only from this library)
- "scene": one background id: ${bgs}.
- "actors": up to 4 of: ${acts}. Write "id" or "id:pose". ${plan.name} (id "${plan.player}") is in the picture on most pages. Pick poses that match the action (kick for soccer, cheer for joy, fly for flying).
- "props": up to 3 of: ${props}. "train" with "ride": true puts the actors in the train's carriages.
- "fx": one of ${FX.join(', ')}.
- "caption": ${early?'usually empty; at most ONE word or letter on screen (e.g. the letter he is learning, or a short word like "GO")':plan.reading==='decodable'?'usually empty; at most 3 words, and ONLY three-letter word-family words he can sound out (cat, big, hop, sun, bug, pin), or none. Never a name or a longer word':'optional; at most 6 short, easy words on screen'}.${plan.reading==='decodable'?`
- He is a BEGINNING reader: anything he must read himself is a three-letter word-family word (cat, big, hop). Station, place and friends' names are said aloud by the narrator, never something he is asked to read.`:''}
- "say": the narration as [["narrator","..."],["<friend id or dad>","..."]]. Every line is real words: never a bare hum or sound ("Mmm.", "Hmm", "Zzz"); a sleepy or thinking friend says so in words, and a friend with a catchphrase uses it (see the cast). Never say a word twice in a row (no "go, go, go", no "wag, wag"); each thing is said once. Anyone a page names or lets speak is in that page's actors; the friends are ONLY the cast above. Mom and Dad are regulars in his book: each is in the picture (as an actor) on at least three pages, not every page. Friends and Dad speak in their own voices; ${plan.name} never speaks (he acts, taps and shouts). Put spoken words in the line itself, no quotation marks needed.

SHAPE
- ${L.pages[0]}-${L.pages[1]} pages. Page 1 is a story page that starts the adventure; the last page is a story page with a warm ending and a small cliffhanger for tomorrow.
- ${L.words[0]+20}-${L.words[1]-30} spoken words in total; at most ${L.pageWords-5} per page; at most ${L.lineWords-2} words per line.
- Change the picture often: at least 4 different backgrounds. ${(plan.lead||{name:'Dad'}).name} is in at least two pages.
- ${plan.name} is the hero: he solves things, his friends help. Do not use em dashes.

REPLY WITH ONLY THIS JSON
{"title":"short chapter title","pages":[{"scene":"...","actors":["${plan.player}","dad:cheer"],"props":[],"fx":"sparkles","caption":"","say":[["narrator","..."],["dad","..."]]},{"action":"kick","scene":"soccer-pitch","actors":["${plan.player}","..."],"say":[["dad","Your turn! Kick it!"]],"after":[["narrator","Goal! ..."]]},{"beat":"b1","scene":"...","actors":["..."],"say":[["narrator","..."]]}${plan.magic.length?`,{"scene":"...","actors":["..."],"say":[["narrator","..."]],"magic":{"word":"${plan.magic[0]}","object":"...","after":[["narrator","..."]]}}`:''}],"summary":"one sentence: what happened (for continuity)","hook":"one short sentence: what might happen next time"}`;
}
export function repairPrompt(previous,issues){
 return `Your chapter JSON has these problems:\n${issues.map(i=>'- '+i).join('\n')}\n\nFix ONLY these problems and keep everything else. Reply with ONLY the corrected JSON object.\n\n${JSON.stringify(previous)}`;
}
export function parseChapter(text){
 const s=String(text||'');const start=s.indexOf('{'),end=s.lastIndexOf('}');if(start<0||end<start)return null;
 try{return JSON.parse(s.slice(start,end+1));}catch{return null;}
}
