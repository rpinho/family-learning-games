export const PARTS=['window','roof','wheel'];
export function addPart(plan,id){return PARTS.includes(id)&&plan.length<2?[...plan,id]:plan;}
export function inspect(plan){if(plan.length<2)return 'incomplete';if(plan.includes('wheel'))return 'wheel';return plan[0]==='window'&&plan[1]==='roof'?'repaired':'order';}
export function fit(step,id){const target=['window','roof'][step],right=!!target&&target===id;return {right,next:right?Math.min(2,step+1):step};}
