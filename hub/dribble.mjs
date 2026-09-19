export const VERSION='family-games-2026-09-19-predictive-nutmeg-1';
export const RULES=3;
export const LEVELS=['Draw a step','Did the fake work?','Change your fake','Use the space','Beat the recovery','Patient defender','Change direction twice','Complete the duel'];
export const DIRS=['left','middle','right'];
export const VOICE_LINES=['Draw a step. Fake one way, then watch.','They did not follow that fake. Try the other way.','The defender stepped. Now read the space.','The defender stayed compact. Try the open side.','That side is covered by the defender.','That way leaves the field. Keep the ball inside.','The defender recovered. Keep the ball close. Fool them again.','You dribbled past! Ball still at your feet.','Through the gap, and you kept the ball!','You guessed the recovery! The legs opened. Nutmeg!','Watch the lean. The open side is safe, or predict the recovery with a nutmeg.','New duel. Draw a step, then dribble past.','The defender did not commit. Try a different fake first.'];
const error=(message,status=400)=>Object.assign(new Error(message),{status});
export function fresh(id,level=1){return {id,rulesVersion:RULES,revision:0,level,serial:0,goals:0,dribbles:0,attempts:0,blocks:0,streak:0,struggles:0,assisted:0,history:[],round:null};}
export function puzzle(serial,level,revision){
 const touchline=level>=4&&serial%3!==0?['left','right'][serial%2]:null;
 return {id:`v3-${revision}-${serial}`,rulesVersion:RULES,blocked:'middle',balanced:true,gap:false,recoveryGap:false,touchline,level,theme:Math.floor(serial/4)%4,phase:'create',step:0,steps:level>=7?3:level>=5?2:1,tries:0,mistakes:0,helped:false,done:false,feint:null,fakes:0,lastFake:null,setup:0};
}
export function openRoutes(r){if(r.balanced)return [];return DIRS.filter(x=>x!==r.blocked&&x!==r.touchline&&(x!=='middle'||r.gap||r.recoveryGap));}
export function explain(r,move){if(r.balanced)return 'The defender did not commit. Try a different fake first.';if(move===r.touchline)return 'That way leaves the field. Keep the ball inside.';if(move==='middle')return 'The defender stayed compact. Try the open side.';return 'That side is covered by the defender.';}
export function act(p,a){
 if(!a||a.revision!==p.revision)throw error('Your game changed. Refresh to continue.',409);
 if(a.rulesVersion!==RULES)throw Object.assign(error('Dribble Duel has changed. Tap Refresh for the new duel.',409),{code:'CLIENT_UPDATE'});
 if(p.rulesVersion!==RULES){
  const previous=Number(p.rulesVersion)||1;
  // Preserve all legacy totals and evidence; new dribbles have a separate score.
  if(p.round)p.history.push({kind:'legacy-round',round:structuredClone(p.round)});
  p.rulesVersion=RULES;p.dribbles??=0;p.streak=0;p.struggles=0;
  if(previous<2){p.dribbles=0;p.level=Math.max(3,p.level);}
  p.round=null;
 }
 if(a.type==='start'){if(!p.round||p.round.done){p.revision++;p.round=puzzle(p.serial,p.level,p.revision);}return {kind:'ready'};}
 if(a.type==='level'){
  if(!Number.isInteger(a.level)||a.level<1||a.level>8)throw error('Choose level 1 to 8.');
  if(p.round&&!p.round.done)p.history.push({id:p.round.id,kind:'cancelled',level:p.round.level});
  p.level=a.level;p.streak=0;p.struggles=0;p.serial++;p.revision++;p.round=puzzle(p.serial,p.level,p.revision);p.history=p.history.slice(-100);return {kind:'ready'};
 }
 const r=p.round;if(!r||r.done||a.roundId!==r.id)throw error('This puzzle changed. Try Refresh.',409);
 if(a.type==='hint'){r.helped=true;p.assisted++;p.revision++;return {kind:'hint',routes:[],line:r.balanced?'They did not follow that fake. Try the other way.':'Watch the lean. The open side is safe, or predict the recovery with a nutmeg.'};}
 if(a.type==='feint'){
  if(!['left','right'].includes(a.move))throw error('Choose a pretend move left or right.');
  const changed=r.lastFake!==a.move;
  r.fakes++;r.setup+=changed?1:0;r.lastFake=a.move;r.feint=a.move;
  const patience=r.level>=6?2+(p.serial+r.step)%2:r.level>=3?2:r.level===2?1+p.serial%2:1;
  // Repeating the same fake cannot wear down a patient defender. Reactions are
  // visible before a dribble and stay committed until the next chosen action.
  r.balanced=r.setup<patience;r.blocked=r.balanced?'middle':a.move;
  r.gap=!r.balanced&&(p.serial+r.step+r.fakes)%4===0;
  // A defender who has shifted may step across to recover. The child may
  // predict that movement and try the nutmeg before the legs visibly open.
  // It is a real choice, not a guaranteed answer: the outside route remains
  // the safer read whenever the defender has committed.
  r.recoveryGap=!r.balanced&&!r.gap&&(p.serial+r.step+r.fakes+r.setup)%2===0;
  r.phase=r.balanced?'create':'read';p.revision++;
  return {kind:'feinted',line:r.balanced?'They did not follow that fake. Try the other way.':'The defender stepped. Now read the space.'};
 }
 if(a.type!=='move'||!DIRS.includes(a.move))throw error('Choose left, through, or right.');
 p.attempts++;r.tries++;const predictedNutmeg=a.move==='middle'&&!r.gap&&r.recoveryGap,visibleNutmeg=a.move==='middle'&&r.gap,correct=openRoutes(r).includes(a.move),result={kind:correct?'passed':'blocked',move:a.move,blocked:r.blocked,touchline:r.touchline,helped:r.helped||(r.mistakes||0)>0,level:r.level,predictedNutmeg};
 if(!correct){r.mistakes=(r.mistakes||0)+1;p.blocks++;p.streak=0;p.struggles++;result.line=explain(r,a.move);if(p.struggles>=2&&p.level>1){p.level--;p.struggles=0;result.easierNext=true;}p.revision++;return result;}
 if(a.move!=='middle'&&r.step+1<r.steps){r.step++;r.blocked='middle';r.balanced=true;r.gap=false;r.recoveryGap=false;r.setup=0;r.lastFake=null;r.phase='create';p.revision++;return {...result,kind:'recover',line:'The defender recovered. Keep the ball close. Fool them again.'};}
 if(predictedNutmeg)r.gap=true;
 r.done=true;p.dribbles++;p.serial++;p.struggles=0;
 if(!result.helped)p.streak++;else p.streak=0;
 if(p.streak>=3&&p.level<8){p.level++;p.streak=0;result.levelUp=true;}
 p.history.push({id:r.id,kind:'dribble',rulesVersion:RULES,level:r.level,tries:r.tries,helped:result.helped,fakes:r.fakes,feint:r.feint,nutmeg:predictedNutmeg?'predicted':visibleNutmeg?'visible':false});p.history=p.history.slice(-100);p.revision++;
 return {...result,kind:'escaped',line:predictedNutmeg?'You guessed the recovery! The legs opened. Nutmeg!':a.move==='middle'?'Through the gap, and you kept the ball!':'You dribbled past! Ball still at your feet.'};
}
