import {checkCopy} from './copy-practice.mjs';
import {railPoints} from './guided-trace.mjs';
// Closed-shape copying remains practice, not a test of naming or memory.
// Closed loops start at a corner and must travel around, not tap the same endpoint.
const oval=(rx,ry)=>Array.from({length:49},(_,i)=>[50+rx*Math.cos(-Math.PI/2+i*Math.PI/24),50+ry*Math.sin(-Math.PI/2+i*Math.PI/24)]);
const polygon=n=>Array.from({length:n+1},(_,i)=>[50+35*Math.cos(-Math.PI/2+i*2*Math.PI/n),50+35*Math.sin(-Math.PI/2+i*2*Math.PI/n)]);
export const SHAPES={
 rectangle:{name:'rectangle',sides:4,paths:[[[15,28],[85,28],[85,72],[15,72],[15,28]]]},
 triangle:{name:'triangle',sides:3,paths:[[[50,17],[87,81],[13,81],[50,17]]]},
 square:{name:'square',sides:4,paths:[[[23,23],[77,23],[77,77],[23,77],[23,23]]]},
 trapezoid:{name:'trapezoid',sides:4,paths:[[[32,25],[68,25],[85,75],[15,75],[32,25]]]},
 circle:{name:'circle',sides:0,paths:[oval(33,33)]},
 oval:{name:'oval',sides:0,paths:[oval(38,25)]},
 diamond:{name:'diamond',sides:4,paths:[[[50,12],[78,50],[50,88],[22,50],[50,12]]]},
 pentagon:{name:'pentagon',sides:5,paths:[polygon(5)]},
 hexagon:{name:'hexagon',sides:6,paths:[polygon(6)]},
 star:{name:'star',sides:10,paths:[Array.from({length:11},(_,i)=>[50+(i%2?17:38)*Math.cos(-Math.PI/2+i*Math.PI/5),50+(i%2?17:38)*Math.sin(-Math.PI/2+i*Math.PI/5)])]},
};
export const nextShape=shape=>{const ids=Object.keys(SHAPES);return ids[(Math.max(0,ids.indexOf(shape))+1)%ids.length];};
export const startingShape=shape=>Object.hasOwn(SHAPES,shape)?shape:'rectangle';
export function validGuidedShape(shape,strokes){return Object.hasOwn(SHAPES,shape)&&JSON.stringify(strokes)===JSON.stringify(SHAPES[shape].paths);}

// Global coverage can accept an obvious opening in an otherwise accurate loop.
// Look for the longest missing section around the model (including its seam).
// The existing seven-unit finger tolerance plus eight uncovered rail units
// still permits small gaps, offsets and separate strokes that meet each other.
export function checkShapeCopy(shape,ink){
 if(!Object.hasOwn(SHAPES,shape))return {ok:false,coverage:0,precision:0,gap:[]};
 const paths=SHAPES[shape].paths,base=checkCopy(paths,ink);
 if(base.precision<.72)return {...base,gap:[]};
 const marks=ink.filter(s=>s.length).flatMap(railPoints),loop=railPoints(paths[0]).slice(0,-1);
 const missing=loop.map(p=>!marks.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<=7));
 let length=0,best=0,end=0;
 for(let i=0;i<loop.length*2;i++){
  length=missing[i%loop.length]?Math.min(length+1,loop.length):0;
  if(length>best){best=length;end=i;}
 }
 const gap=best>8?Array.from({length:best},(_,i)=>loop[(end-best+1+i)%loop.length]):[];
 return {...base,ok:base.ok&&!gap.length,gap};
}
export const shapeVoiceLines=()=>[...Object.keys(SHAPES).map(id=>'Trace a '+id+'.'),'Bring the ends together. Small gaps are okay.'];
