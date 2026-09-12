import {LIVE_RULES,LIVE_LEVELS,replay,metrics} from './public/dribble-live.mjs';
import {freshReading,makeReward,finishReward} from './public/reading-reward.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function actLive(p,a,initialLevel=1){
 if(![1,LIVE_RULES].includes(a.liveRules)||a.liveRules===1&&p.live?.rules===LIVE_RULES)throw Object.assign(fail('Soccer has updated. Tap Refresh.',409),{code:'CLIENT_UPDATE'});
 // Idempotent finish retries, including a lost HTTP response after persistence.
 if(a.type==='live-finish'&&p.live?.round?.id===a.roundId&&p.live.round.done)return {kind:'finished',...p.live.round.result};
 if(a.actionId&&p.live?.reading?.lastAction?.id===a.actionId)return p.live.reading.lastAction.result;
 if(a.revision!==p.revision)throw fail('Your game changed. Try again.',409);
 p.live??={rules:a.liveRules,level:Math.max(1,Math.min(8,initialLevel)),wins:0,losses:0,serial:0,streak:0,struggles:0,history:[],round:null};
 const g=p.live;
 const replayRound=r=>replay(r.level,r.seed,r.inputs,r.rules||1);
 if(a.liveRules===LIVE_RULES&&g.rules!==LIVE_RULES&&['live-start','live-level','live-restart'].includes(a.type)){
  if(g.round&&!g.round.done){g.previousRound=structuredClone(g.round);g.history.push({id:g.round.id,level:g.round.level,kind:'rules-upgrade',...metrics(replayRound(g.round))});g.round=null;g.serial++;}
  g.rules=LIVE_RULES;g.streak=0;g.struggles=0;g.goals??=0;
 }
 if(a.type.startsWith('live-reading-')){
  const reading=g.reading,q=reading?.pending;
  if(!q||q.done||q.id!==a.questionId)throw fail('This letter challenge changed. Try again.',409);
  if(typeof a.actionId!=='string'||a.actionId.length>100)throw fail('Missing reading action.');
  let result;
  if(a.type==='live-reading-help'){q.helped=true;result={kind:'reading-help',target:q.answer};}
  else if(a.type==='live-reading-skip'){result={kind:'reading-done',...finishReward(reading,q,true)};}
  else if(a.type==='live-reading-answer'){
   if(!q.options.includes(a.answer))throw fail('Choose one of the letters or words.');
   if(a.answer===q.answer)result={kind:'reading-done',...finishReward(reading,q)};
   else{q.errors++;if(q.errors>=2)q.helped=true;result={kind:'reading-again',target:q.answer,errors:q.errors,helped:q.helped};}
  }else throw fail('Unknown reading action.');
  reading.lastAction={id:a.actionId,result};p.revision++;return result;
 }
 const start=()=>{g.round={id:`live-${p.revision+1}-${g.serial}`,rules:a.liveRules,seed:g.serial,level:g.level,inputs:'',done:false};};
 if(a.type==='live-start'){if(!g.reading?.pending||g.reading.pending.done){if(!g.round||g.round.done)start();}p.revision++;return {kind:'ready'};}
 if(a.type==='live-level'||a.type==='live-restart'){
  if(a.type==='live-level'&&(!Number.isInteger(a.level)||a.level<1||a.level>(a.liveRules===1?8:LIVE_LEVELS.length)))throw fail('Choose level 1 to '+(a.liveRules===1?8:LIVE_LEVELS.length)+'.');
  if(g.round&&!g.round.done)g.history.push({id:g.round.id,level:g.round.level,kind:'cancelled',...metrics(replayRound(g.round))});
  if(a.type==='live-level'){g.level=a.level;g.streak=0;g.struggles=0;}
  if(g.reading?.pending&&!g.reading.pending.done)finishReward(g.reading,g.reading.pending,true);
  g.serial++;start();g.history=g.history.slice(-100);p.revision++;return {kind:'ready'};
 }
 const r=g.round;if(!r||r.done||a.roundId!==r.id)throw fail('This duel changed. Start a new try.',409);
 if((r.rules||1)!==a.liveRules)throw Object.assign(fail('Soccer has updated. Tap Refresh.',409),{code:'CLIENT_UPDATE'});
 if(!['live-checkpoint','live-finish'].includes(a.type))throw fail('Unknown soccer action.');
 if(typeof a.inputs!=='string'||!a.inputs.startsWith(r.inputs))throw fail('This replay does not match the saved duel.',409);
 let s;try{s=replay(r.level,r.seed,a.inputs,r.rules||1);}catch(e){throw fail(e.message);}
 if(a.type==='live-finish'&&!s.outcome)throw fail('Keep dribbling: this duel has not ended.');
 r.inputs=a.inputs;p.revision++;
 if(a.type==='live-checkpoint')return {kind:'saved'};
 const result=metrics(s);r.done=true;g.serial++;
 if(['escaped','goal'].includes(s.outcome)){g.wins++;if(s.outcome==='goal')g.goals=(g.goals||0)+1;g.streak++;g.struggles=0;if(g.streak>=3&&g.level<(a.liveRules===1?8:LIVE_LEVELS.length)){g.level++;g.streak=0;result.levelUp=true;}}
 else if(s.outcome==='tackled'){g.losses++;g.streak=0;g.struggles++;if(g.struggles>=3&&g.level>1){g.level--;g.struggles=0;result.easierNext=true;}}
 else{g.streak=0;}
 if(['escaped','goal'].includes(s.outcome)&&a.reading===true){g.reading??=freshReading(initialLevel);g.reading.pending=makeReward(g.reading.serial++,g.reading.level);}
 r.result=result;g.history.push({id:r.id,kind:'live-duel',level:r.level,...result});g.history=g.history.slice(-100);
 return {kind:'finished',...result};
}
