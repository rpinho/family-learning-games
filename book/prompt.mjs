// The Book: the language-model brief. The model writes the story; the plan fixes what is practised.
import {LEVELS,SCENE_EMOJI} from './lint.mjs';
export const SYSTEM=`You write one short picture-book chapter for a young child who is the hero of his own continuing book.
You are warm, funny and concrete. You never frighten, never mention illness, doctors, hospitals, injury, death, grandparents, brands, real famous people, surnames, places or any personal detail beyond first names.
Conflict is gentle: a puzzle, a mix-up, a stuck gate, a lost ball found again. Mischief is cartoon-soft.
You reply with ONE JSON object and nothing else.`;
const APPS={'number-park':'number games (sharing cookies, counting, patterns)','letter-quest':'letter and word adventures (a labyrinth, rescue missions)','maze-garden':'building and solving mazes','target-trail':'slingshot and target games','three-in-a-row':'noughts and crosses','hub':'soccer dribbling','word-arcade':'word games'};
export function buildPrompt(plan,{dadLines=[]}={}){
 const L=LEVELS[plan.level];
 const early=plan.level==='early';
 const y=plan.yesterday;
 const events=[
  ...dadLines.map(t=>`Dad says: "${t}"`),
  ...(plan.play||[]).map(l=>`He played: ${l}.`),
  ...(y?.played?y.highlights.map(h=>`He played ${APPS[h.app]||h.app} for about ${h.minutes} minutes${h.questions?` and got ${h.correct} of ${h.questions} right`:''}.`):[]),
  ...plan.running.map(l=>`From his game story: ${l}`)
 ];
 const challengeLines=plan.challenges.map(c=>`- "${c.id}": practises ${c.practises}. The game will then ask aloud: "${c.item.spoken}"`).join('\n');
 const m=plan.mistake;
 return `Write tomorrow's chapter of ${plan.name}'s book.

THE CHILD
- ${plan.name}, age ${early?5:8}. ${early?'He is learning his letters and cannot read yet: the book is read TO him. Use very short, simple sentences (about 5-8 words), everyday words, lots of repetition and sound words.':'He reads short words and is growing into longer sentences. Write at a read-aloud level for an 8-year-old: clear sentences, some playful words, no long descriptions.'}
- Loves: ${plan.interests.join(', ')||'playing'}.
- Friends in this chapter (his own toys come to life; keep each personality exactly, use each name at least once, no other animal or toy friends):
${(plan.cast||[plan.companion]).map(c=>`  - ${c.name}: ${c.kind}.`).join('\n')}
  They are loyal, kind and funny, and sometimes get things wrong so ${plan.name} can help.
${plan.props?.length?`- Things he has that may appear: ${plan.props.map(p=>`${p.name} (${p.kind})`).join('; ')}.\n`:''}- Friends from his games who may appear: Bo (a big friendly bear) and Max (a boy who loves soccer). Keep them as they are.
${plan.sibling?`- His brother ${plan.sibling} may appear briefly as a friendly helper.\n`:''}${plan.tricks.length?`- He sometimes ${plan.tricks.join('; ')}. Let ${plan.companion.name} model the better habit once, gently, inside the story (e.g. reading each word, checking), never as a lecture.\n`:''}
WHAT HAPPENED YESTERDAY (turn it into gentle allegory: the real event becomes a small adventure; never copy personal details)
${events.length?events.map(e=>'- '+e).join('\n'):'- A quiet day. Invent a small, cosy adventure.'}

STORY SO FAR (continue it; keep names and places consistent)
${plan.previous.length?plan.previous.map(p=>`- ${p.date} "${p.title}": ${p.summary}${p.hook?` Next time: ${p.hook}`:''}`).join('\n'):'- This is the very first chapter. Introduce the book, the hero and his companion.'}

CHALLENGES TO WEAVE IN (the story pauses and the child answers on screen)
${challengeLines}
For each challenge, add a page {"challenge": "<id>", "text": "..."} with 1-2 sentences that make the story NEED the answer (a gate that opens with the right letter, a robot that needs the right number). Never write the answer itself on a challenge page (for the sentence challenge, do not write the sentence): the child must find it.
${plan.teach?`
TEACH FIRST (he is 5: teach, then let him outwit the narrator)
- Before challenge "${plan.challenges[0].id}", include one page with "teach": true that clearly teaches: "${plan.teach.word}" starts with the letter ${plan.teach.letter}. Say the word and name the letter ${plan.teach.letter} (for example: "${plan.teach.word[0].toUpperCase()+plan.teach.word.slice(1)} starts with ${plan.teach.letter}. ${plan.teach.letter}, ${plan.teach.letter}, ${plan.teach.word}!").
`:''}
CATCH THE MISTAKE (the child wins by spotting the narrator's error)
- Later in the chapter, add a page {"mistake": "${m.id}", "text": "..."} where the narrator (or one of the friends) confidently says something wrong. The page text MUST contain exactly this wrong statement: "${m.claim}"
- Say it as if it were true. Do not correct it and do not hint that it is wrong on that page; the game asks the child to catch it${m.kind==='math'?`, and the number ${m.wrong} must appear only once on that page`:''}.
- Everything else in the chapter must be correct (no other wrong sums or letters).

SHAPE
- ${early?'6-9':'7-11'} pages in total, including the challenge and mistake pages. Page 1 is a story page; the last page is a story page with a warm ending and a small hint of tomorrow.
- ${L.words[0]+20}-${L.words[1]-20} words in total across all pages; at most ${L.pageWords-5} words on any page.
- Do not use em dashes. Put spoken words in double quotes ("like this").
- ${plan.name} is the hero: he solves things, his friends help.
- Each story page may have "scene": 1-4 emoji from this set only: ${[...SCENE_EMOJI].slice(0,90).join('')}

REPLY WITH ONLY THIS JSON
{"title":"short chapter title","pages":[{"text":"...","scene":"🐻⚽"},${plan.teach?'{"teach":true,"text":"...","scene":"..."},':''}{"challenge":"c1","text":"..."},{"mistake":"${m.id}","text":"..."},{"text":"..."}],"summary":"one sentence: what happened in this chapter (for continuity)","hook":"one short sentence: what might happen next time","bedtimeQuestion":"one warm question Dad can ask ${plan.name} at bedtime about the story"}`;
}
export function repairPrompt(previous,issues){
 return `Your chapter JSON has these problems:\n${issues.map(i=>'- '+i).join('\n')}\n\nFix ONLY these problems and keep everything else. Reply with ONLY the corrected JSON object.\n\n${JSON.stringify(previous)}`;
}
export function parseChapter(text){
 const s=String(text||'');const start=s.indexOf('{'),end=s.lastIndexOf('}');if(start<0||end<start)return null;
 try{return JSON.parse(s.slice(start,end+1));}catch{return null;}
}
