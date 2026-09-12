export const VERSION='family-games-2026-09-12-hub-1';
export const LEVELS=['Watch the feet','Find the space','Watch the touchline','Narrow escapes','Make a feint','Read the response','Two moves ahead','Dribble master'];
export const DIRS=['left','middle','right'];
export const VOICE_LINES=['Watch the feet. Find the space.','Make a pretend move.','That way crosses the touchline. Keep the ball on the field.','Feet together. The middle is closed. Go around.','The defender blocked your left. Look for another way.','The defender blocked your right. Look for another way.','Make a pretend move first. Then look again.','Find the space away from the blocking foot.','The defender stayed. Look at the feet.','The defender followed. Find the space.','One more move. The defender recovered. Look again.','Nutmeg! Through the gap. Goal!','Into the open space. Goal!','Make a pretend move. Try to draw the defender one way. Then read the response.','Watch the feet. Go around the blocking foot—or through an open gap.','Watch the feet. Stay inside the bright touchline. Find the space.','Look again. New opening. Go around the blocking foot—or through an open gap.','Look again. New opening. Stay inside the bright touchline. Find the space.'];
const error=(message,status=400)=>Object.assign(new Error(message),{status});
export function fresh(id,level=1){return {id,revision:0,level,serial:0,goals:0,attempts:0,blocks:0,streak:0,struggles:0,assisted:0,history:[],round:null};}
export function puzzle(serial,level,revision){
 const blocked=DIRS[(serial*7+Math.floor(serial/3))%3];
 const other=DIRS.filter(x=>x!==blocked),side=other.filter(x=>x!=='middle');
 const touchline=level>=3&&(serial%3!==1||level>=4)?side[serial%side.length]||null:null;
 return {id:`d-${revision}-${serial}`,blocked,touchline,level,theme:Math.floor(serial/4)%4,phase:level>=5?'feint':'choose',step:0,steps:level>=7?2:1,tries:0,mistakes:0,helped:false,done:false,feint:null};
}
export function openRoutes(r){return DIRS.filter(x=>x!==r.blocked&&x!==r.touchline);}
export function explain(r,move){if(move===r.touchline)return 'That way crosses the touchline. Keep the ball on the field.';if(move==='middle')return 'Feet together. The middle is closed. Go around.';return `The defender blocked your ${move}. Look for another way.`;}
export function act(p,a){
 if(!a||a.revision!==p.revision)throw error('Your game changed. Refresh to continue.',409);
 if(a.type==='start'){if(!p.round||p.round.done){p.revision++;p.round=puzzle(p.serial,p.level,p.revision);}return {kind:'ready'};}
 if(a.type==='level'){
  if(!Number.isInteger(a.level)||a.level<1||a.level>8)throw error('Choose level 1 to 8.');
  if(p.round&&!p.round.done)p.history.push({id:p.round.id,kind:'cancelled',level:p.round.level});
  p.level=a.level;p.streak=0;p.struggles=0;p.serial++;p.revision++;p.round=puzzle(p.serial,p.level,p.revision);p.history=p.history.slice(-100);return {kind:'ready'};
 }
 const r=p.round;if(!r||r.done||a.roundId!==r.id)throw error('This puzzle changed. Try Refresh.',409);
 if(a.type==='hint'){r.helped=true;p.assisted++;p.revision++;return {kind:'hint',routes:openRoutes(r),line:r.phase==='feint'?'Make a pretend move first. Then look again.':'Find the space away from the blocking foot.'};}
 if(a.type==='feint'){
  if(r.phase!=='feint'||!['left','right'].includes(a.move))throw error('Choose a pretend move left or right.');
  r.feint=a.move;
  // Reactions are committed before the real choice. Sometimes the defender holds
  // the middle instead of following: there is no guaranteed "fake left, go right".
  r.blocked=p.serial%3===1?'middle':a.move;
  if(r.touchline===r.blocked)r.touchline=null;
  r.phase='choose';p.revision++;return {kind:'feinted',line:r.blocked==='middle'?'The defender stayed. Look at the feet.':'The defender followed. Find the space.'};
 }
 if(a.type!=='move'||r.phase!=='choose'||!DIRS.includes(a.move))throw error('Choose left, through, or right.');
 p.attempts++;r.tries++;const correct=openRoutes(r).includes(a.move),result={kind:correct?'passed':'blocked',move:a.move,blocked:r.blocked,touchline:r.touchline,helped:r.helped||(r.mistakes||0)>0,level:r.level};
 if(!correct){r.mistakes=(r.mistakes||0)+1;p.blocks++;p.streak=0;p.struggles++;result.line=explain(r,a.move);if(p.struggles>=2&&p.level>1){p.level--;p.struggles=0;result.easierNext=true;}p.revision++;return result;}
 if(r.step+1<r.steps){r.step++;r.blocked=DIRS[(DIRS.indexOf(r.blocked)+1+(p.serial%2))%3];if(r.touchline===r.blocked)r.touchline=null;r.phase='choose';p.revision++;return {...result,kind:'recover',line:'One more move. The defender recovered. Look again.'};}
 r.done=true;p.goals++;p.serial++;p.struggles=0;
 if(!result.helped)p.streak++;else p.streak=0;
 if(p.streak>=6&&p.level<8){p.level++;p.streak=0;result.levelUp=true;}
 p.history.push({id:r.id,kind:'goal',level:r.level,tries:r.tries,helped:result.helped,feint:r.feint});p.history=p.history.slice(-100);p.revision++;
 return {...result,kind:'goal',line:a.move==='middle'?'Nutmeg! Through the gap. Goal!':'Into the open space. Goal!'};
}
