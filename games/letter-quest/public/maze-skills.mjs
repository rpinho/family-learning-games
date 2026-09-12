// Small local practice heuristics, not a reading assessment. One observation
// per gate: repeated retries cannot inflate the window or keep lowering it.
export const mazeSkill=type=>({find:'letters',sequence:'letters',gap:'gaps',word:'reading',read:'reading'})[type]||null;
export function mazeSkillState(s,key){
 return s.practiceSkills?.[key]||{level:Math.max(1,Math.min(3,s.ability||1)),recent:[],sinceChange:0};
}
export function recordMazeSkill(s,q,ok,helped){
 const key=mazeSkill(q.type);if(!key)return null;
 s.skillGates??=[];if(s.skillGates.includes(q.id))return null;
 s.skillGates=[...s.skillGates,q.id].slice(-100);
 s.practiceSkills??={};const skill=s.practiceSkills[key]??=structuredClone(mazeSkillState(s,key));
 const before=skill.level;
 skill.recent=[...skill.recent,{ok:!!ok,helped:!!helped}].slice(-8);skill.sinceChange++;
 if(skill.recent.length===8&&skill.sinceChange>=8){
  const independent=skill.recent.filter(x=>x.ok&&!x.helped).length;
  if(independent>=7)skill.level=Math.min(3,skill.level+1);
  else if(independent<=3)skill.level=Math.max(1,skill.level-1);
  if(skill.level!==before)skill.sinceChange=0;
 }
 return {skill:key,before,after:skill.level,observations:skill.recent.length};
}
