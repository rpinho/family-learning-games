import {FLIGHT_MS,challengeFor,movingTargets,aimAt,learningDefaults} from './challenges.mjs';
export {FLIGHT_MS,challengeFor,movingTargets,aimAt,learningDefaults,READING_NAMES,voiceLines,cueLine,nameLine} from './challenges.mjs';
export const VERSION='target-trail-2026-09-12-instant-controls';
export const PLAYERS={beginner:'Beginner',explorer:'Explorer',admin:'Admin · Admin'};
export const WORDS={start:'Drag to aim. Lift your finger to shoot.',ready:'Ready for five arrows?',bull:'Bullseye!',done:'Five arrows! Ready for another round?',higher:'Try a little higher.',lower:'Try a little lower.',left:'Try a little left.',right:'Try a little right.',hit:'Nice shot!',move:'This target moves. Take your time.'};
export const THEMES=[{name:'Golden hour',sky:'#fff0c6',floor:'#f4bb63',ink:'#17455b',accent:'#e76836'},{name:'Blue lagoon',sky:'#d2f7ff',floor:'#67d2d1',ink:'#123f69',accent:'#e75e5e'},{name:'Night lights',sky:'#17254c',floor:'#334b85',ink:'#fff2ca',accent:'#ffd36d'},{name:'Berry bright',sky:'#f9d9f3',floor:'#bb94d9',ink:'#49346d',accent:'#e55683'}];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const freshProfile=id=>({id,name:PLAYERS[id],revision:0,level:id==='explorer'?3:1,rounds:0,shots:0,bullseyes:0,best:0,bestByLevel:{},stars:0,streak:0,struggles:0,round:null,history:[]});
export const targetsFor=(r,index,time)=>r.rules===2?movingTargets(r,index,time):[targetAt(targetFor(r,index),time)];
export function scoreShot(r,index,input){
 if(r.rules!==2){const target=targetAt(targetFor(r,index),input.elapsed);return {x:input.x,y:input.y,target,...scoreAim(input.x,input.y,target)};}
 const impact=aimAt(r,input.x,input.y,input.elapsed),scene=targetsFor(r,index,input.elapsed+FLIGHT_MS),challenge=challengeFor(r,index);
 const hit=scene.find(t=>scoreAim(impact.x,impact.y,t).points>0),correct=!challenge||hit?.id===challenge.answerIndex,target=hit||scene[challenge?.answerIndex||0],geometric=scoreAim(impact.x,impact.y,target);
 return {...impact,rawAim:{x:input.x,y:input.y},scene,target,...geometric,aimPoints:hit?geometric.points:0,points:correct&&hit?geometric.points:0,outcome:!hit?'miss':correct?'correct':'wrong-target',cue:challenge?.cue,answer:challenge?.answer,hitLabel:hit?.label||null,readingLevel:r.readingLevel,releaseScene:targetsFor(r,index,input.elapsed)};
}
function random(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export function targetFor(round,index){
 const rng=random(round.seed+index*173),radius=[0,125,110,96,84,72,62,52,44,37,32][round.level];
 const amplitude=round.level<5?0:Math.min(68,20+(round.level-5)*10);
 const margin=radius+amplitude+30;
 return {x:margin+rng()*(800-2*margin),y:radius+30+rng()*(360-radius-30),radius,amplitude,speed:.00055+round.level*.00006,phase:rng()*Math.PI*2};
}
export function targetAt(t,elapsed=0){return {...t,x:t.x+Math.sin(t.phase+elapsed*t.speed)*t.amplitude};}
export function scoreAim(x,y,t){const distance=Math.hypot(x-t.x,y-t.y),ratio=distance/t.radius;return {distance,ratio,points:ratio<=.16?10:ratio<=.36?8:ratio<=.6?6:ratio<=.8?4:ratio<=1?2:0};}
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function startRound(p,reason){
 if(reason&&p.round&&!p.round.done){p.cancelledRounds??=[];p.cancelledRounds.push({id:p.round.id,reason,level:p.round.level,mode:p.round.mode||'aim',shots:p.round.shots.length,score:p.round.score,at:new Date().toISOString()});p.cancelledRounds=p.cancelledRounds.slice(-20);}
 p.learning??=learningDefaults(p.id);
 p.round={id:`r-${p.revision}`,rules:2,motion:3,mode:p.mode||'learn',readingLevel:p.learning.level,sequence:p.rounds,seed:(p.rounds+1)*9013+(p.id==='explorer'?79:31),level:p.level,theme:p.rounds%THEMES.length,shots:[],score:0,done:false};
}
export function action(p,input){
 if(!input||input.revision!==p.revision)fail('Your game changed. Tap Refresh.',409);
 if(input.type==='level'){if(!Number.isInteger(input.level)||input.level<1||input.level>20)fail('Choose a level from 1 to 20.');p.level=input.level;p.streak=0;p.struggles=0;startRound(p,'level');}
 else if(input.type==='mode'){if(!['learn','aim'].includes(input.mode))fail('Choose letters or aim only.');p.mode=input.mode;p.streak=0;p.struggles=0;startRound(p,'mode');}
 else if(input.type==='reading'){if(!Number.isInteger(input.level)||input.level<1||input.level>5)fail('Choose a practice stage.');p.learning??=learningDefaults(p.id);p.learning.level=input.level;p.learning.streak=0;p.learning.struggles=0;p.mode='learn';startRound(p,'reading');}
 else if(input.type==='start'){
  if(p.round&&!p.round.done)return p;
  startRound(p);
 }else if(input.type==='shot'){
  const r=p.round;if(!r||r.done||input.shot!==r.shots.length)fail('That arrow has already been used.',409);
  if(input.roundId!==undefined&&input.roundId!==r.id)fail('The round changed. Aim at the new targets.',409);
  if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||input.x<0||input.x>800||input.y<0||input.y>600||!Number.isFinite(input.elapsed)||input.elapsed<0||input.elapsed>3600000)fail('Invalid aim. Try again.');
  if(r.rules===2&&input.rules!==2)fail('New targets are ready. Tap Refresh before firing.',409);
  if(r.motion===3&&input.motion!==3)fail('Gentler targets are ready. Tap Refresh before firing.',409);
  const score=scoreShot(r,r.shots.length,input);
  const shot={...score,elapsed:input.elapsed,input:['touch','mouse','pen','keyboard','button'].includes(input.pointer)?input.pointer:'unknown',at:new Date().toISOString()};
  r.shots.push(shot);r.score+=shot.points;p.shots++;if(shot.points===10)p.bullseyes++;
  if(r.rules===2&&r.mode==='learn'){
   p.learning??=learningDefaults(p.id);const l=p.learning;if(shot.outcome==='miss')l.misses++;else if(shot.outcome==='correct')l.correct++;else l.wrong++;
   if(l.level===r.readingLevel){if(shot.outcome==='correct'){l.streak++;l.struggles=0;}else if(shot.outcome==='wrong-target'){l.streak=0;l.struggles++;}}
  }
  if(r.shots.length===5){
   r.done=true;p.rounds++;p.best=Math.max(p.best,r.score);const key=r.rules===2?`v2-${r.mode}-${r.readingLevel}-${r.level}`:r.level;p.bestByLevel[key]=Math.max(p.bestByLevel[key]||0,r.score);p.stars+=r.score>=35?3:r.score>=20?2:1;
   // A manual next-round choice made mid-round must not be overwritten.
   const motorScore=r.rules===2?r.shots.reduce((n,s)=>n+s.aimPoints,0):r.score;
   if(p.level===r.level){if(motorScore>=35){p.streak++;p.struggles=0;if(p.streak>=2){p.level=Math.min(r.rules===2?20:10,p.level+1);p.streak=0;}}else if(motorScore<=12){p.struggles++;p.streak=0;if(p.struggles>=2){p.level=Math.max(1,p.level-1);p.struggles=0;}}else{p.streak=0;p.struggles=0;}}
   if(r.rules===2&&r.mode==='learn'&&p.learning.level===r.readingLevel){if(p.learning.streak>=8){p.learning.level=Math.min(5,p.learning.level+1);p.learning.streak=0;}else if(p.learning.struggles>=2){p.learning.level=Math.max(1,p.learning.level-1);p.learning.struggles=0;}}
   p.history.push({id:r.id,rules:r.rules||1,mode:r.mode||'aim',readingLevel:r.readingLevel,level:r.level,score:r.score,motorScore,nextLevel:p.level,at:shot.at});p.history=p.history.slice(-200);
  }
 }else fail('Unknown action.');
 p.revision++;return p;
}
export const publicState=p=>({...p,history:p.history.slice(-10)});
