// The Book, layer 1: the learner model. One compact JSON per child, rebuilt nightly from every
// game's save (read-only), recent word-break log rows, the parent recap, dad's "Today" lines and the
// book's own chapter history. Pure functions only: all file access lives in build-learner.mjs.
// Schema: book/SCHEMA.md ("family-book-learner-1").
import {literacyFrom,WORD_GROUPS,SENTENCES} from '../hub/public/word-break.mjs';
import {FADE,STAGE_WINS,MASTERY_RUN,COOKIE_MAX_LEVEL} from '../games/number-park/lib/cookie-division.mjs';

export const LEARNER_SCHEMA='family-book-learner-1';
export const GAMES=['letter-quest','number-park','word-arcade','maze-garden','target-trail','three-in-a-row','hub'];
const DAY=864e5;
const list=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const uniq=a=>[...new Set(a)];
const recentAt=(at,now,days)=>{const t=typeof at==='number'?at:Date.parse(at);return Number.isFinite(t)&&now-t<=days*DAY&&t<=now+DAY;};

// ---------- words ----------
// Per-word tallies from every reading surface. A word is "mastered" after repeated clean reads and
// "stuck" when misses keep pace with hits.
export function wordTallies({lq,wa,wordBreaks=[],recapStuck=[]}){
 const t={};const add=(w,hits,errors)=>{w=String(w||'').toLowerCase();if(!/^[a-z]{2,10}$/.test(w))return;const x=t[w]??={hits:0,errors:0};x.hits+=hits;x.errors+=errors;};
 for(const src of [obj(lq?.foundation).skills,obj(wa?.foundation).skills,obj(wa?.builder).skills,...Object.values(obj(wa?.drills)).map(d=>obj(d).skills)])
  for(const [w,s] of Object.entries(obj(src)))add(w,num(s.hits),num(s.errors));
 const reading=obj(lq?.reading);
 for(const run of [...list(reading.history),{results:reading.results}])for(const r of list(run?.results)){const w=r?.question?.word;if(!w)continue;if(r.ok&&!num(r.mistakes))add(w,1,0);else add(w,r.ok?1:0,Math.max(1,num(r.mistakes)));}
 for(const h of list(lq?.history)){const m=String(h.key||'').match(/^(?:spell|gap):([a-z]+)$/i);if(m)add(m[1],h.ok?1:0,h.ok?0:1);}
 for(const b of wordBreaks)if(b.kind==='read-word')add(b.answer,b.misses?0:1,Math.min(3,num(b.misses)));
 for(const line of recapStuck){const m=String(line).match(/word ([a-z]+): (\d+) miss/i);if(m)add(m[1],0,num(m[2]));}
 return t;
}
export function wordStatus(tallies){
 const mastered=[],stuck=[];
 for(const [w,{hits,errors}] of Object.entries(tallies)){
  if(hits>=2&&errors*2<=hits)mastered.push(w);
  else if(errors>=2&&errors>=hits)stuck.push(w);
 }
 const score=w=>tallies[w].errors-tallies[w].hits;
 return {mastered:mastered.sort(),stuck:stuck.sort((a,b)=>score(b)-score(a)||a.localeCompare(b)).slice(0,12)};
}

// ---------- maths ----------
// Cookie division progress, same ladder as Number Park's advanced track (track-agnostic: any
// "*-math-1" track), so the model works for any install's player ids.
const mathTrack=h=>/-math-1$/.test(String(h?.question?.track||''));
export function cookieLevel(np){
 const history=list(np?.history),row=h=>mathTrack(h)&&h.question.skill==='cookies';
 const oldWins=history.filter(h=>row(h)&&h.question.plan!=='drag3'&&(!h.question.mode||h.question.mode==='share')&&h.ok&&!h.helped).length;
 let level=oldWins>=4?2:1,streak=0,struggles=0;
 for(const h of history){if(!row(h)||h.question.plan!=='drag3'||h.question.fade)continue;
  if(h.ok&&!h.helped){streak++;struggles=0;if(streak>=4){level=Math.min(5,level+1);streak=0;}}else{streak=0;struggles++;if(struggles>=2){level=Math.max(1,level-1);struggles=0;}}}
 let stage=0,clean=0,rough=0;
 for(const h of history){if(!row(h)||!h.question.fade)continue;
  if(h.ok&&!h.helped){clean++;rough=0;if(stage<2&&clean>=STAGE_WINS){stage++;clean=0;}else if(stage===2&&clean>=MASTERY_RUN){clean=0;if(level<COOKIE_MAX_LEVEL){level++;stage=0;}}}
  else{clean=0;rough++;if(rough>=2){rough=0;if(stage>0)stage--;else if(level>1){level--;stage=1;}}}}
 return {level,stage:FADE[stage]};
}
export function skillLevel(np,skill){
 let level=2,streak=0,struggles=0;
 for(const h of list(np?.history)){if(!mathTrack(h)||h.question.skill!==skill)continue;
  if(h.ok&&!h.helped){streak++;struggles=0;if(streak===6){level=Math.min(3,level+1);streak=0;}}else{streak=0;struggles++;if(struggles===2){level=Math.max(1,level-1);struggles=0;}}}
 return level;
}
// Multiplication facts seen anywhere (Number Park multiply/factor, Sling Shot maths shots).
export function factTallies(np){
 const t={};
 for(const h of list(np?.history)){const q=h.question||{};if(!['multiply','factor'].includes(q.kind)||!q.a||!q.b)continue;const [a,b]=[q.a,q.b].sort((x,y)=>x-y),k=`${a}x${b}`,x=t[k]??={a,b,hits:0,errors:0};if(h.ok&&!h.helped)x.hits++;else x.errors++;}
 return t;
}
export function mathModel({np,recapLevels,advanced}){
 if(!np)return {track:advanced?'facts':'early',source:'none'};
 if(advanced){
  const cookies=recapLevels?.cookies?{level:recapLevels.cookies.level,stage:recapLevels.cookies.stage}:cookieLevel(np);
  const levels=Object.fromEntries(['multiply','factor','sums','skip','place'].map(s=>[s,recapLevels?.[s]??skillLevel(np,s)]));
  const facts=Object.values(factTallies(np));
  const tables=levels.multiply<=1?[2,5,10]:levels.multiply===2?[2,3,4,5,6,7,8,9,10]:[2,3,4,5,6,7,8,9,10,11,12];
  // Cookie division misses from recent rounds: the exact sharings he found hard.
  const hardShares=list(np.history).filter(h=>h.question?.kind==='cookies'&&(h.helped||!h.ok||num(h.cookieChecks)>=2)).slice(-8).map(h=>({total:h.question.total,groups:h.question.mode==='bags'?h.question.bagSize:h.question.plates,mode:h.question.mode}));
  return {track:'facts',source:'number-park',cookies,levels,tables,
   factsMastered:facts.filter(f=>f.hits>=2&&!f.errors).map(f=>`${f.a}x${f.b}`),
   factsStuck:facts.filter(f=>f.errors>=1&&f.errors>=f.hits).map(f=>`${f.a}x${f.b}`),hardShares};
 }
 // Early maths (counting, patterns, taking away) from the preschool games.
 const byGame={};for(const h of list(np.history)){const g=byGame[h.game]??={tried:0,ok:0};g.tried++;g.ok+=Number(!!h.ok&&!h.helped);}
 const recent=list(np.history).slice(-30),missed=recent.filter(h=>!h.ok).map(h=>h.question||{});
 const countTo=Math.max(5,...list(np.history).filter(h=>h.ok&&['count','addobjects'].includes(h.game)).map(h=>num(h.question?.answer)).filter(n=>n<=20));
 return {track:'early',source:'number-park',countTo:Math.min(20,countTo),completed:obj(np.completed),byGame,
  takeAwayStuck:missed.filter(q=>q.kind==='subtract').slice(-4).map(q=>`${q.total}-${q.remove}`)};
}

// ---------- tricks ----------
// Heuristics the child uses instead of the skill. Dad's notes (profile.tricks) plus evidence from logs:
// sentence breaks answered with many fast misses = tapping tiles in order/position, not reading.
export function detectTricks({profile,wordBreaks=[]}){
 const out=list(profile?.tricks).map(t=>({id:t.id,text:t.text,source:t.source||'parent',evidence:null}));
 const sentences=wordBreaks.filter(b=>b.kind==='sentence');
 const guessy=sentences.filter(b=>{const words=String(b.answer||'').split(/\s+/).length;return num(b.misses)>=words&&num(b.ms)/(words+num(b.misses))<1600;});
 if(sentences.length>=3&&guessy.length/sentences.length>=.4){
  const ev={sentenceBreaks:sentences.length,tapThrough:guessy.length};
  const known=out.find(t=>t.id==='sentence-position');
  if(known)known.evidence=ev;else out.push({id:'sentence-position',text:'taps sentence tiles quickly in order instead of reading them',source:'logs',evidence:ev});
 }
 const letters=wordBreaks.filter(b=>['find-letter','first-letter'].includes(b.kind)),fastWrong=letters.filter(b=>num(b.misses)>=2&&num(b.ms)<4000);
 if(letters.length>=4&&fastWrong.length/letters.length>=.4)out.push({id:'letter-tap-through',text:'taps letters quickly until one is right',source:'logs',evidence:{letterBreaks:letters.length,tapThrough:fastWrong.length}});
 return out;
}

// ---------- activity & story ----------
function activity(saves,now){
 const rows={
  'letter-quest':[...list(saves['letter-quest']?.history).map(h=>h.at),...list(saves['letter-quest']?.maze?.history).map(h=>h.at),...list(saves['letter-quest']?.rescue?.history).map(h=>h.completedAt)],
  'number-park':[...list(saves['number-park']?.history).map(h=>h.at),...list(saves['number-park']?.planning?.history).map(h=>h.at)],
  'maze-garden':list(saves['maze-garden']?.history).map(h=>h.at),
  'target-trail':[...list(saves['target-trail']?.history).map(h=>h.at),...list(saves['target-trail']?.sling?.history).map(h=>h.at)],
  'three-in-a-row':list(saves['three-in-a-row']?.history).map(h=>h.at),
  'hub':list(saves.hub?.history).map(h=>h.at),
  'chess':list(saves.chess?.history).map(h=>h.at)
 };
 const week={};for(const [g,ats] of Object.entries(rows))week[g]=ats.filter(at=>recentAt(at,now,7)).length;
 return week;
}
const FAVOURITE_THEMES={'three-in-a-row':'games of noughts and crosses','maze-garden':'mazes','target-trail':'slingshots and targets','hub':'soccer','chess':'chess'};
export function storyState({saves,chapters=[]}){
 const np=saves['number-park'],lq=saves['letter-quest'];
 return {
  running:[...list(np?.story?.beats).slice(-4).map(b=>b.line),...list(lq?.boStory?.beats).slice(-4).flatMap(b=>list(b.lines))].filter(Boolean).slice(-6),
  letterQuestChapter:num(lq?.story?.chapter),
  labyrinthLevel:num(lq?.maze?.level),
  mazesBuilt:num(saves['maze-garden']?.maker?.completed),
  book:chapters.slice(-5).map(c=>({date:c.date,title:c.title,summary:c.summary,hook:c.hook||null}))
 };
}

// ---------- one day's play across every game (for allegory and the bedtime page) ----------
const DEST={'maze-garden':'Maze Garden','maze-garden/maker':'Make-a-Maze','maze-garden/trace':'maze tracing','maze-garden/letters':'letter mazes','maze-garden/rescue':'maze rescue','number-park':'Number Park','letter-quest':'Letter Quest','word-arcade':'Word Arcade','target-trail':'Target Trail','sling':'Sling Shot','three-in-a-row':'Three in a Row','chess':'chess','soccer':'soccer','drawing-studio':'the drawing studio'};
export function playOn({saves={},opens=[],date,timeZone}){
 const day=at=>{const t=typeof at==='number'?at:Date.parse(at);return Number.isFinite(t)&&new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t))===date;};
 const lines=[];
 const opened={};for(const o of opens){const k=DEST[o]||DEST[o.split('/')[0]]||o;opened[k]=(opened[k]||0)+1;}
 const sling=list(saves['target-trail']?.sling?.history).filter(h=>day(h.at));
 if(sling.length)lines.push(`Sling Shot: ${sling.length} round${sling.length>1?'s':''}, ${sling.reduce((n,h)=>n+num(h.correct),0)} right (${uniq(sling.map(h=>h.mode)).join(', ')})`);
 const chess=list(saves.chess?.history).filter(h=>day(h.at));
 if(chess.length)lines.push(`Chess: ${chess.length} lesson${chess.length>1?'s':''}`);
 const ttt=list(saves['three-in-a-row']?.history).filter(h=>day(h.at));
 if(ttt.length)lines.push(`Three in a Row: ${ttt.length} game${ttt.length>1?'s':''}`);
 const maze=list(saves['maze-garden']?.history).filter(h=>day(h.at)&&h.type!=='requested-harder');
 if(maze.length)lines.push(`Maze Garden: ${maze.length} maze${maze.length>1?'s':''}`);
 const shown=new Set(['Sling Shot','chess','Three in a Row']);
 const rest=Object.entries(opened).filter(([k])=>!shown.has(k)).sort((a,b)=>b[1]-a[1]);
 if(rest.length)lines.push('Opened '+rest.map(([k,n])=>`${k}${n>1?` (${n}×)`:''}`).join(', '));
 return lines;
}
// Rapid repeated "harder" taps in Maze Garden: he skips ahead instead of solving.
function harderBursts(mg,now){
 const t=list(mg?.history).filter(h=>h.type==='requested-harder'&&recentAt(h.at,now,7)).map(h=>Date.parse(h.at)).sort((a,b)=>a-b);
 let bursts=0,run=1;for(let i=1;i<t.length;i++){if(t[i]-t[i-1]<3000){run++;if(run===5)bursts++;}else run=1;}
 return bursts;
}

// ---------- the model ----------
export function buildLearner({player,name,profile={},now=Date.now(),saves={},wordBreaks=[],recap=null,notes=[],chapters=[],opens=[],playDate=null,timeZone='UTC'}){
 const lq=saves['letter-quest'],np=saves['number-park'],wa=saves['word-arcade'];
 const advanced=profile.mathTrack?profile.mathTrack==='facts':num(profile.age)>=7;
 const recapKid=list(recap?.kids).find(k=>k.player===player)||null;
 const recapStuck=recapKid?Object.values(obj(recapKid.apps)).flatMap(a=>list(a?.stuck)):[];
 const lit=literacyFrom(lq||null,profile.track||(advanced?'words':'letters'));
 const skills=obj(lq?.skills);
 const lettersMastered=uniq(Object.entries(skills).filter(([k,s])=>/^find:[A-Za-z]$/.test(k)&&num(s.level)>=3).map(([k])=>k.slice(5)));
 const tallies=wordTallies({lq,wa,wordBreaks,recapStuck}),words=wordStatus(tallies);
 const sentenceBreaks=wordBreaks.filter(b=>b.kind==='sentence');
 const week=activity(saves,now);
 const favourites=Object.entries(week).filter(([,n])=>n>=5).sort((a,b)=>b[1]-a[1]).map(([g])=>FAVOURITE_THEMES[g]).filter(Boolean);
 const stuck=[
  ...lit.learning.slice(0,6).map(c=>({area:'letters',item:c,detail:`still learning ${/[a-z]/.test(c)?'little':'big'} ${c.toUpperCase()}`})),
  ...words.stuck.slice(0,6).map(w=>({area:'words',item:w,detail:`${tallies[w].errors} misses, ${tallies[w].hits} clean reads`})),
  ...recapStuck.slice(0,6).map(line=>({area:'recap',item:null,detail:line}))
 ];
 const yesterday=recapKid?{date:recap.date,played:!!recapKid.played,minutes:num(recapKid.minutes),
  highlights:Object.entries(obj(recapKid.apps)).filter(([,a])=>a?.played).map(([app,a])=>({app,minutes:num(a.minutes),correct:num(a.correct??a.labyrinth?.gatesCorrect),questions:num(a.questions??a.labyrinth?.gatesAnswered),story:list(a.story)}))}:null;
 const hub=saves.hub,mg=saves['maze-garden'],tt=saves['target-trail'],ttt=saves['three-in-a-row'];
 return {
  schema:LEARNER_SCHEMA,player,name,age:num(profile.age)||null,builtAt:new Date(now).toISOString(),
  sources:Object.fromEntries(GAMES.map(g=>[g,!!saves[g]])),
  interests:uniq([...list(profile.interests),...favourites]),
  companions:list(profile.companions),
  literacy:{track:lit.track,letters:lit.letters,lower:lit.lower,learning:lit.learning,lettersMastered,
   wordLevel:lit.wordLevel,sentenceLevel:lit.sentenceLevel,wordsMastered:words.mastered.slice(0,40),wordsStuck:words.stuck,
   sentenceBreaks:{tried:sentenceBreaks.length,clean:sentenceBreaks.filter(b=>!num(b.misses)).length}},
  math:mathModel({np,recapLevels:recapKid?.apps?.['number-park']?.levels&&Object.keys(recapKid.apps['number-park'].levels).length?recapKid.apps['number-park'].levels:null,advanced}),
  games:{
   letterQuest:lq?{lessons:num(lq.completed),labyrinthLevel:num(lq.maze?.level),rescueMissions:num(lq.rescue?.mission)}:null,
   wordArcade:wa?Object.fromEntries(Object.entries(obj(wa.games)).map(([g,v])=>[g,num(v.level)])):null,
   mazeGarden:mg?{level:num(mg.level),mazesBuilt:num(mg.maker?.completed)}:null,
   targetTrail:tt?{level:num(tt.level),bullseyes:num(tt.bullseyes),sling:tt.sling?{rounds:num(tt.sling.rounds),stages:obj(tt.sling.stages)}:null}:null,
   threeInARow:ttt?{games:num(ttt.games),wins:num(ttt.wins),draws:num(ttt.draws)}:null,
   soccer:hub?{goals:num(hub.goals),dribbles:num(hub.dribbles),liveWins:num(hub.live?.wins)}:null,
   chess:saves.chess?{lessons:Object.keys(obj(saves.chess.completed)).length,recent:list(saves.chess.history).slice(-3).map(h=>h.lesson)}:null
  },
  activity7d:week,
  stuck,
  tricks:[...detectTricks({profile,wordBreaks}),...(harderBursts(mg,now)?[{id:'harder-tapping',text:'taps "harder" many times in a row in Maze Garden to skip ahead',source:'logs',evidence:{bursts:harderBursts(mg,now)}}]:[])],
  story:storyState({saves,chapters}),
  recent:{yesterday,playDate,play:playDate?playOn({saves,opens,date:playDate,timeZone}):[],dadLines:notes.filter(n=>(playDate?n.date>=playDate:recentAt(n.at,now,3))&&(!n.player||n.player===player)).map(n=>({date:n.date,text:n.text})).slice(-6)}
 };
}
// The sentence bank levels are part of the shared word-break module; exported for the planner.
export {WORD_GROUPS,SENTENCES};
