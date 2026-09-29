export const PARTS=['axle','wheel','water'];
export function assemble(state,part){if(!PARTS.includes(part)||state.running)return state;const placed=new Set(state.placed);placed.has(part)?placed.delete(part):placed.add(part);return {...state,placed:[...placed],finished:false};}
export function canRun(state){return PARTS.every(p=>state.placed.includes(p));}
export function missingPart(state){return PARTS.find(p=>!state.placed.includes(p))||null;}
export function nextMotion(part){return {water:'wheel',wheel:'axle',axle:'bucket'}[part]||null;}
