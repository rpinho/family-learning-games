// Interpret legacy itinerary metadata without changing authored content or save identity.
export const explorationRequires=g=>(g.requires||[]).filter(k=>k!==g.forwardPrevious);
export function explorationExits(ep,r){
 const at=Array.isArray(ep.forwardRoute)?ep.forwardRoute.indexOf(r.id):-1;
 const last=(ep.forwardSteps||[]).map(id=>[...ep.puzzles,...ep.locks].find(g=>g.id===id)).filter(g=>g?.room===r.id).at(-1);
 return Object.fromEntries(Object.entries(r.exitRequires||{}).filter(([side,k])=>
  !(at>=0&&side==='right'&&r.exits?.[side]===ep.forwardRoute[at+1]&&k===last?.id)&&(!ep.puzzles.some(g=>g.id===k)||ep.puzzles.some(g=>g.id===k&&(g.kind==='riddle'||g.instruction)))));
}
export const pictogram=(value,fallback='⭐')=>typeof value==='string'&&!/[\p{L}\p{N}]/u.test(value)?value:fallback;
export const goalPictures=(goal,rooms)=>[pictogram(goal.icon),'👣',pictogram(rooms[goal.room]?.icon,'📍')].join(' ');
// New certification checks the authored graph; already-published files are only interpreted.
export function explorationIssues(ep){
 const issues=[];
 if([...(ep.puzzles||[]),...(ep.locks||[])].some(g=>g.forwardPrevious))issues.push('Open quests cannot chain exercises with forwardPrevious');
 for(const r of ep.rooms||[]){const open=explorationExits(ep,r);for(const side of Object.keys(r.exitRequires||{}))if(!(side in open))issues.push('Open quests cannot gate a room on an exercise or itinerary step');}
 return [...new Set(issues)];
}

export function explorationEpisode(ep){return {...ep,
 rooms:ep.rooms.map(r=>({...r,exitRequires:explorationExits(ep,r)})),
 puzzles:ep.puzzles.map(g=>({...g,requires:explorationRequires(g)})),
 locks:ep.locks.map(l=>({...l,requires:explorationRequires(l)}))};}
