import {useHint} from './hints.mjs';
import {WORDS,taskPrompt} from './engine.mjs';
export const SOCCER_LINES={
 intro:'Welcome to the penalty shootout! Pick a corner. Solve the puzzle. Score a goal.',
 whistle:'The referee says go! Solve the puzzle to take your shot.',
 hint:'Here is the answer. This is a practice shot. Try the next one yourself.',
 practice:'Good practice. Score the next goal without a hint.',
 finish:'Full time! Five shots, one brave player. My mustache wants an autograph.',
 goals:['Goal! Right into the net! The goalkeeper is checking his gloves.','What a goal! My mustache just did a victory dance.','In the net! That ball had somewhere important to be.','Goal! I taught you everything I know. Which is mostly cheering.'],
 saves:['Saved! Good hands, goalkeeper. Learn the answer, then take your next shot.','The keeper got that one. Even champions have another go.','Saved! That goalkeeper has very grabby gloves. Next shot, new chance.']
};
export function soccerVoiceLines(){return [...Object.values(SOCCER_LINES).flat(),...WORDS.filter(w=>w.tier<=2).map(w=>`Choose the word ${w.word}.`)];}
export function soccerState(p){return p.soccer||{number:0,phase:'lobby',level:p.id==='beginner'?1:2,streak:0,shots:[],aim:'left',question:null,helped:false,history:[],stats:{played:0,goals:0,independent:0}};}
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function mix(items,r){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function soccerQuestion(p){
 const s=soccerState(p);if(s.question)return s.question;
 const round=s.shots.length,r=rng(s.number*7919+round*3571+(p.id==='beginner'?91:37)),level=s.level,count=level===1?2:4;
 const type=['find','gap','sequence','word'][(round+s.number-1)%4],alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ',id=`soccer1:${s.number}:${round}`,base={id,type,level};
 if(type==='gap'||type==='word'){
  const pool=WORDS.filter(w=>w.tier===(level===3?2:1)),w=pool[Math.floor(r()*pool.length)],blank=Math.floor(r()*w.word.length),answer=type==='word'?w.word:w.word[blank];
  return {...base,...w,blank,answer,prompt:type==='word'?`Choose the word ${w.word}.`:taskPrompt({type:'gap',word:w.word}),options:mix([answer,...mix(type==='word'?pool.filter(t=>t.word!==answer).map(t=>t.word):[...alphabet.toLowerCase()].filter(c=>c!==answer),r).slice(0,count-1)],r)};
 }
 const start=Math.floor(r()*24),letters=[...alphabet.slice(start,start+3)],blank=Math.floor(r()*3),answer=type==='find'?(level===3?letters[0].toLowerCase():letters[0]):letters[blank];
 return {...base,answer,char:answer,letters,blank,prompt:taskPrompt({type,char:answer}),options:mix([answer,...mix([...(type==='find'&&level===3?alphabet.toLowerCase():alphabet)].filter(c=>c!==answer),r).slice(0,count-1)],r)};
}
export function soccerAction(p,input){
 const old=soccerState(p);
 if(input.kind==='start'){
  if(!['lobby','complete'].includes(old.phase))throw Error('Finish or resume this shootout first');
  const level=input.level??old.level;if(![1,2,3].includes(level))throw Error('Choose a challenge level');
  p.soccer={...structuredClone(old),number:old.number+1,level,streak:0,phase:'ready',shots:[],aim:'left',question:null,helped:false};p.revision++;
  return {kind:'start',line:SOCCER_LINES.intro};
 }
 if(!p.soccer)throw Error('Start a shootout first');const s=p.soccer;
 if(input.kind==='aim'){
  if(s.phase!=='ready'||!['left','center','right'].includes(input.aim))throw Error('Pick your aim before the whistle');
  s.aim=input.aim;p.revision++;return {kind:'aim'};
 }
 if(input.kind==='ready'){
  if(s.phase!=='ready')throw Error('This penalty has already started');
  s.question=soccerQuestion(p);s.phase='question';p.revision++;return {kind:'ready',line:SOCCER_LINES.whistle};
 }
 if(input.kind==='next'){
  if(s.phase!=='result')throw Error('Take this shot first');
  s.phase=s.shots.length===5?'complete':'ready';s.question=null;s.helped=false;p.revision++;
  return {kind:s.phase==='complete'?'complete':'next',line:s.phase==='complete'?SOCCER_LINES.finish:undefined};
 }
 if(!['hint','answer'].includes(input.kind))throw Error('Unknown soccer action');
 if(s.phase!=='question'||input.questionId!==s.question.id)throw Error('This penalty changed. Reload to continue.');
 if(input.kind==='hint'){if(!s.helped){useHint(p,`soccer:${s.question.id}`);s.helped=true;p.revision++;}return {kind:'hint',line:SOCCER_LINES.hint};}
 const q=s.question;if(typeof input.answer!=='string'||!q.options.includes(input.answer))throw Error('Choose one of the puzzle answers');
 const correct=input.answer===q.answer,helped=s.helped,practice=helped,goal=correct&&!helped,xp=goal?10:0;
 const shot={question:structuredClone(q),answer:input.answer,correct,goal,practice,helped,aim:s.aim,xp,durationMs:input.durationMs};
 s.shots.push(shot);s.phase='result';s.streak=goal&&!helped?s.streak+1:0;
 if(!correct)s.level=Math.max(1,s.level-1);else if(s.streak>=3){s.level=Math.min(3,s.level+1);s.streak=0;}
 p.xp+=xp;p.revision++;
 if(goal){p.questBook??={moves:0,words:0,matches:0,claimed:[]};p.questBook.moves++;if(['gap','word'].includes(q.type))p.questBook.words++;}
 let bonus=null;
 if(s.shots.length===5){
  const earned=s.shots.some(t=>t.goal&&!t.helped);bonus={xp:earned?10:0,gems:earned?5:0};p.xp+=bonus.xp;p.gems+=bonus.gems;
  const goals=s.shots.filter(t=>t.goal).length,independent=s.shots.filter(t=>t.goal&&!t.helped).length;
  s.history.push({number:s.number,goals,independent,shots:structuredClone(s.shots),at:new Date().toISOString()});s.history=s.history.slice(-30);
  s.stats.played++;s.stats.goals+=goals;s.stats.independent+=independent;
 }
 const lines=goal?SOCCER_LINES.goals:SOCCER_LINES.saves;
 return {kind:practice?'practice':goal?'goal':'save',goal,helped,xp,bonus,shot,line:practice?SOCCER_LINES.practice:lines[(s.number+s.shots.length-2)%lines.length]};
}
