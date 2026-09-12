import {LIVE_RULES,LIVE_LEVELS,replay,metrics} from './public/dribble-live.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function actLive(p,a,initialLevel=1){
 if(a.liveRules!==LIVE_RULES)throw Object.assign(fail('Soccer has updated. Tap Refresh.',409),{code:'CLIENT_UPDATE'});
 // Idempotent finish retries, including a lost HTTP response after persistence.
 if(a.type==='live-finish'&&p.live?.round?.id===a.roundId&&p.live.round.done)return {kind:'finished',...p.live.round.result};
 if(a.revision!==p.revision)throw fail('Your game changed. Try again.',409);
 p.live??={rules:LIVE_RULES,level:Math.max(1,Math.min(8,initialLevel)),wins:0,losses:0,serial:0,streak:0,struggles:0,history:[],round:null};
 const g=p.live;
 const start=()=>{g.round={id:`live-${p.revision+1}-${g.serial}`,seed:g.serial,level:g.level,inputs:'',done:false};};
 if(a.type==='live-start'){if(!g.round||g.round.done)start();p.revision++;return {kind:'ready'};}
 if(a.type==='live-level'||a.type==='live-restart'){
  if(a.type==='live-level'&&(!Number.isInteger(a.level)||a.level<1||a.level>LIVE_LEVELS.length))throw fail('Choose level 1 to 8.');
  if(g.round&&!g.round.done)g.history.push({id:g.round.id,level:g.round.level,kind:'cancelled',...metrics(replay(g.round.level,g.round.seed,g.round.inputs))});
  if(a.type==='live-level'){g.level=a.level;g.streak=0;g.struggles=0;}
  g.serial++;start();g.history=g.history.slice(-100);p.revision++;return {kind:'ready'};
 }
 const r=g.round;if(!r||r.done||a.roundId!==r.id)throw fail('This duel changed. Start a new try.',409);
 if(!['live-checkpoint','live-finish'].includes(a.type))throw fail('Unknown soccer action.');
 if(typeof a.inputs!=='string'||!a.inputs.startsWith(r.inputs))throw fail('This replay does not match the saved duel.',409);
 let s;try{s=replay(r.level,r.seed,a.inputs);}catch(e){throw fail(e.message);}
 if(a.type==='live-finish'&&!s.outcome)throw fail('Keep dribbling: this duel has not ended.');
 r.inputs=a.inputs;p.revision++;
 if(a.type==='live-checkpoint')return {kind:'saved'};
 const result=metrics(s);r.done=true;g.serial++;
 if(s.outcome==='escaped'){g.wins++;g.streak++;g.struggles=0;if(g.streak>=3&&g.level<8){g.level++;g.streak=0;result.levelUp=true;}}
 else if(s.outcome==='tackled'){g.losses++;g.streak=0;g.struggles++;if(g.struggles>=3&&g.level>1){g.level--;g.struggles=0;result.easierNext=true;}}
 else{g.streak=0;}
 r.result=result;g.history.push({id:r.id,kind:'live-duel',level:r.level,...result});g.history=g.history.slice(-100);
 return {kind:'finished',...result};
}
