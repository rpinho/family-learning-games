// Actual geometry: wide rectangles, an equilateral triangle, and a square.
// Closed loops start at a corner and must travel around, not tap the same endpoint.
const oval=(rx,ry)=>Array.from({length:49},(_,i)=>[50+rx*Math.cos(-Math.PI/2+i*Math.PI/24),50+ry*Math.sin(-Math.PI/2+i*Math.PI/24)]);
const polygon=n=>Array.from({length:n+1},(_,i)=>[50+35*Math.cos(-Math.PI/2+i*2*Math.PI/n),50+35*Math.sin(-Math.PI/2+i*2*Math.PI/n)]);
export const SHAPES={
 rectangle:{name:'rectangle',sides:4,paths:[[[15,28],[85,28],[85,72],[15,72],[15,28]]]},
 triangle:{name:'triangle',sides:3,paths:[[[50,17],[87,81],[13,81],[50,17]]]},
 square:{name:'square',sides:4,paths:[[[23,23],[77,23],[77,77],[23,77],[23,23]]]},
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
