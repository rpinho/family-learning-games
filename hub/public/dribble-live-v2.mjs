// Shared deterministic simulation: the server replays exactly the same inputs.
// World coordinates are independent of screen size. One input = six 60 Hz ticks.
import {createMatch as legacyMatch,advance as legacyAdvance,replay as legacyReplay} from './dribble-live-v1.mjs';
export const LIVE_RULES=2;
export const LIVE_LEVELS=['Practice','Watch the defender','Quick feet','Cut back','Close control','Fast defender','Pressure','Match pace','Expert','Elite','Champion','Final boss'];
export const INTRO='Dribble past the defender and into the goal. Lift to stop with the ball.';
export const GOAL_VOICE='Goal!';
export const GOAL={left:300,right:500,line:90,back:30};
export const MAX_INPUTS=900;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function tuning(level){
 const n=clamp(level,1,12)-1;
 return {speed:200+n*25,reaction:Math.max(.09,.26-n*.014),acceleration:600+n*80,
  windup:Math.max(.12,.24-n*.011),lunge:370+n*25,recovery:Math.max(.25,.68-n*.03),
  anticipation:.04+n*.012,left:70+(n>=6?30:0),right:730-(n>=6?30:0)};
}
export function createMatch(level=1,seed=0,rules=LIVE_RULES){
 if(rules===1)return legacyMatch(level,seed);
 const cfg=tuning(level),offset=[0,-85,85,-40,40][seed%5];
 return {rules:LIVE_RULES,level,seed,cfg,time:0,ticks:0,outcome:null,phase:'ready',
  player:{x:400+offset*.4,y:535,vx:0,vy:0},ball:{x:400+offset*.4,y:505},
  defender:{x:400+offset,y:305,vx:0,vy:0,mode:'track',timer:0,cooldown:.8,aimX:400,aimY:500},
  memory:[],trail:[],changes:0,lastDirection:0,lunges:0,nearMisses:0,distance:0};
}
export function encodeInput(x,y){return Math.round(clamp(x,0,800)).toString(36).padStart(2,'0')+Math.round(clamp(y,0,620)).toString(36).padStart(2,'0');}
export function decodeInput(s){if(!/^[0-9a-z]{4}$/.test(s))throw Error('Invalid steering data.');const x=parseInt(s.slice(0,2),36),y=parseInt(s.slice(2),36);if(x>800||y>620)throw Error('Steering outside the pitch.');return {x,y};}
function towards(v,target,max){return v+clamp(target-v,-max,max);}
function tick(s,target){
 if(s.outcome)return;const dt=1/60,p=s.player,d=s.defender,c=s.cfg;
 s.phase='playing';s.time+=dt;s.ticks++;
 const dx=clamp(target.x,c.left+23,c.right-23)-p.x,dy=clamp(target.y,105,570)-p.y,dist=Math.hypot(dx,dy),speed=Math.min(225,dist*9);
 p.vx=towards(p.vx,dist?dx/dist*speed:0,1100*dt);p.vy=towards(p.vy,dist?dy/dist*speed:0,1100*dt);
 const ox=p.x,oy=p.y;p.x=clamp(p.x+p.vx*dt,c.left+23,c.right-23);p.y=clamp(p.y+p.vy*dt,105,570);s.distance+=Math.hypot(p.x-ox,p.y-oy);
 if(Math.abs(p.vx)>65){const dir=Math.sign(p.vx);if(s.lastDirection&&dir!==s.lastDirection)s.changes++;s.lastDirection=dir;}
 // Ball remains within one short touch. Releasing never launches it.
 const motion=Math.hypot(p.vx,p.vy),lead=motion>15?{x:p.vx/motion*25,y:p.vy/motion*25}:{x:0,y:-24};
 s.ball.x=clamp(p.x+lead.x,c.left+12,c.right-12);s.ball.y=clamp(p.y+lead.y,60,583);
 s.memory.push({x:p.x,y:p.y});if(s.memory.length>60)s.memory.shift();
 const seenIndex=Math.max(0,s.memory.length-1-Math.round(c.reaction*60)),seen=s.memory[seenIndex],prior=s.memory[Math.max(0,seenIndex-6)];
 d.cooldown=Math.max(0,d.cooldown-dt);d.timer-=dt;
 if(d.mode==='windup'&&d.timer<=0){d.mode='lunge';d.timer=.26;const x=d.aimX-d.x,y=d.aimY-d.y,len=Math.hypot(x,y)||1;d.vx=x/len*c.lunge;d.vy=y/len*c.lunge;s.lunges++;}
 else if(d.mode==='lunge'&&d.timer<=0){d.mode='recover';d.timer=c.recovery;d.cooldown=c.recovery+.5;}
 else if(d.mode==='recover'&&d.timer<=0){d.mode='track';}
 if(d.mode==='track'){
  // React to OLD positions, with bounded acceleration. Never read the finger.
  // Recover toward the goal-side opening and pursue after being beaten.
  // Prediction uses delayed observed movement, never the touch target.
  const chasing=seen.y<d.y+25,leadX=clamp((seen.x-prior.x)*10*c.anticipation,-55,55);
  const tx=clamp(seen.x+leadX+(400-seen.x)*(chasing?0:.15),c.left+26,c.right-26),ty=clamp(seen.y-(chasing?14:78),116,525),x=tx-d.x,y=ty-d.y,len=Math.hypot(x,y)||1;
  d.vx=towards(d.vx,x/len*Math.min(c.speed,len*4),c.acceleration*dt);d.vy=towards(d.vy,y/len*Math.min(c.speed,len*4),c.acceleration*dt);
  if(d.cooldown<=0&&Math.hypot(seen.x-d.x,seen.y-d.y)<145){d.mode='windup';d.timer=c.windup;d.aimX=seen.x;d.aimY=seen.y;}
 }else if(d.mode!=='lunge'){d.vx=towards(d.vx,0,600*dt);d.vy=towards(d.vy,0,600*dt);}
 d.x=clamp(d.x+d.vx*dt,c.left+26,c.right-26);d.y=clamp(d.y+d.vy*dt,112,548);
 const bodyDistance=Math.hypot(p.x-d.x,p.y-d.y),ballDistance=Math.hypot(s.ball.x-d.x,s.ball.y-d.y);
 if(bodyDistance<42||ballDistance<(d.mode==='lunge'?43:33))s.outcome='tackled';
 else if(s.ball.x>=GOAL.left+12&&s.ball.x<=GOAL.right-12&&s.ball.y<=GOAL.line&&p.y<=115)s.outcome='goal';
 else if(s.ticks>=MAX_INPUTS*6)s.outcome='practice';
 if(s.ticks%6===0){s.trail.push({x:p.x,y:p.y});if(s.trail.length>22)s.trail.shift();if(bodyDistance>42&&bodyDistance<85)s.nearMisses++;}
}
export function advance(s,input){if(s.rules!==LIVE_RULES)return legacyAdvance(s,input);for(let i=0;i<6&&!s.outcome;i++)tick(s,input);return s;}
export function replay(level,seed,inputs='',rules=LIVE_RULES){
 if(rules===1)return legacyReplay(level,seed,inputs);
 if(typeof inputs!=='string'||inputs.length%4||inputs.length>MAX_INPUTS*4)throw Error('Invalid replay length.');
 const s=createMatch(level,seed);
 for(let i=0;i<inputs.length;i+=4){if(s.outcome)throw Error('Replay continued after the duel ended.');advance(s,decodeInput(inputs.slice(i,i+4)));}
 return s;
}
export function metrics(s){return {rules:s.rules||1,seconds:Math.round(s.time*10)/10,directionChanges:s.changes,lunges:s.lunges,nearMisses:s.nearMisses,distance:Math.round(s.distance),outcome:s.outcome};}
