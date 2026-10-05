// Story progress depends on a physical outcome, never on a guessed answer or score.
export const INTRO={count:'Our friend needs a raft. Touch five leaves to build it.',flow:'The map is across the pond. Turn the two wooden gates, then launch the boat.'};
export const LINES=[...Object.values(INTRO),'One.','Two.','Three.','Four.','Five.','Five leaves make a raft. Our friend can cross!','The raft reached the key. Let us see what it opens.','The boat stopped at the stones. Turn the first gate toward the pond.','The boat reached the reeds. Turn the second gate toward the map.','The boat reached the map! Now we can find the bridge.','Watch where the water goes when you turn a gate.','A small key. A new door. Our journey continues.','The map shows a bridge beyond the trees. That is where we go next.'];
export function createPond(mode='count'){return {mode:mode==='flow'?'flow':'count',counted:[],gates:[false,false],phase:'build',trials:[],helped:false};}
export const destination=s=>!s.gates[0]?'stones':!s.gates[1]?'reeds':'map';
export function pondAction(state,action){
 const s=structuredClone(state);
 if(action.type==='help')s.helped=true;
 if(s.phase==='done'||s.phase==='crossing'){
  if(action.type==='arrive'&&s.phase==='crossing'){
   if(s.mode==='count')s.phase='done';
   else {const bank=destination(s);s.trials.push({gates:[...s.gates],bank});s.phase=bank==='map'?'done':'build';}
  }
  return s;
 }
 if(action.type==='count'&&s.mode==='count'&&Number.isInteger(action.id)&&action.id>=0&&action.id<5&&!s.counted.includes(action.id)){s.counted.push(action.id);if(s.counted.length===5)s.phase='crossing';}
 if(s.mode==='flow'){
  if(action.type==='gate'&&[0,1].includes(action.id))s.gates[action.id]=!s.gates[action.id];
  if(action.type==='launch')s.phase='crossing';
 }
 return s;
}
export function pondResult(s){return {kind:'pond',mode:s.mode,completed:s.phase==='done',counted:s.counted.length,trials:s.trials,helped:s.helped,misses:s.trials.filter(t=>t.bank!=='map').length};}
