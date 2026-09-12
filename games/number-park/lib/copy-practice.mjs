import {railPoints} from './guided-trace.mjs';
export const validInk=ink=>Array.isArray(ink)&&ink.length<=150&&ink.every(s=>Array.isArray(s)&&s.length<=700&&s.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=100)));
export const safeInk=ink=>validInk(ink)?ink:[];
// A broad-path practice check, NOT handwriting recognition or a mastery score.
// Both coverage and proximity matter: a tap, single side, or filled-in scribble
// cannot finish. Each model stroke is checked separately (including each digit).
export function checkCopy(paths,ink){
 if(!validInk(ink)||!ink.length)return {ok:false,coverage:0,precision:0};
 const marks=[];
 for(const stroke of ink){
  // Bound resampling before allocating a pathological zig-zag request.
  let length=0;for(let i=1;i<stroke.length;i++)length+=Math.ceil(Math.hypot(stroke[i][0]-stroke[i-1][0],stroke[i][1]-stroke[i-1][1]));
  if(marks.length+length+1>12000)return {ok:false,coverage:0,precision:0};
  if(stroke.length)marks.push(...railPoints(stroke));
 }
 if(!marks.length||marks.length>12000)return {ok:false,coverage:0,precision:0};
 const models=paths.map(railPoints),all=models.flat(),near=(p,points)=>points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<=7);
 const coverage=Math.min(...models.map(path=>path.filter(p=>near(p,marks)).length/path.length));
 const precision=marks.filter(p=>near(p,all)).length/marks.length;
 return {ok:coverage>=.84&&precision>=.72,coverage,precision};
}
