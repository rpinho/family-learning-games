import digits from './digits.json' with {type:'json'};
export const TRACE_MAX=1000;
export const traceNumber=n=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=TRACE_MAX&&String(Number(n))===String(n);
export function numberPaths(n){
 if(!traceNumber(n))throw Error(`Choose a number from 0 to ${TRACE_MAX}.`);
 const text=String(n);
 // Keep existing 1–3 digit rails identical for saves from already-open clients.
 return text.length===1?digits[text]:[...text].flatMap((d,i)=>digits[d].map(path=>path.map(([x,y])=>text.length===2?[x*.52+1+i*47,y]:text.length===3?[x*.32+i*33,y]:[x*.24+i*25,y])));
}
export const nextTraceNumber=n=>traceNumber(n)&&Number(n)<TRACE_MAX?String(Number(n)+1):null;
export const startingTraceNumber=n=>traceNumber(n)?String(n):'1';
export const validNumberTrace=(n,strokes)=>traceNumber(n)&&JSON.stringify(strokes)===JSON.stringify(numberPaths(n));
