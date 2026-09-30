export const POINTS={harbor:[211,343],lighthouse:[624,98],forest:[351,82]};export const TARGETS=['land','water','shore'];
export function identify(index,target){return {right:TARGETS[index]===target,next:TARGETS[index]===target?Math.min(3,index+1):index};}
export function plan(path,target){if(!POINTS[target]||path.length>=2)return path;return [...path,target];}
export const isCoastRoute=path=>path.length===2&&path[0]==='harbor'&&path[1]==='lighthouse';
export const COAST_WALK=[[211,343],[235,360],[286,280],[389,245],[455,160],[524,150],[600,84],[624,98]];
