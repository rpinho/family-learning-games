// On-rails practice, not handwriting recognition. All ink comes from the model.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function railPoints(path){
 const points=[path[0]];
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],steps=Math.max(1,Math.ceil(distance(a,b)));
  for(let j=1;j<=steps;j++)points.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
 }
 return points;
}
export class GuidedTrace {
 constructor(paths){this.paths=paths;this.rails=paths.map(railPoints);this.stroke=0;this.cursor=0;this.held=false;this.previous=null;}
 get done(){return this.stroke===this.paths.length;}
 get handle(){return this.done?null:this.rails[this.stroke][this.cursor];}
 get ink(){return this.done?[]:this.rails[this.stroke].slice(0,this.cursor+1);}
 get completed(){return this.paths.slice(0,this.stroke);}
 begin(point){
  if(this.done||distance(point,this.handle)>17)return false;
  this.held=true;this.previous=point;
  // Dots need a tap, not a precision two-pixel movement.
  if(this.rails[this.stroke].length<=4)this.advance(4);
  return true;
 }
 move(point){
  if(!this.held||this.done)return false;
  const rail=this.rails[this.stroke],travel=distance(point,this.previous);
  this.previous=point;
  // A short forward window prevents jumping across a loop or to a crossing.
  const end=Math.min(rail.length-1,this.cursor+Math.max(14,Math.min(35,Math.ceil(travel*1.7))));
  let closest=this.cursor,best=distance(point,rail[closest]);
  for(let i=this.cursor+1;i<=end;i++){
   const score=distance(point,rail[i])+(i-this.cursor)*.015;
   if(score<best){best=score;closest=i;}
  }
  // Wandering outside the rail pauses ink; it never produces an error or bad ink.
  if(best<=18&&closest>this.cursor){this.cursor=closest;this.finishStroke();return true;}
  return false;
 }
 advance(amount=10){if(this.done)return;this.cursor=Math.min(this.rails[this.stroke].length-1,this.cursor+amount);this.finishStroke();}
 finishStroke(){
  if(this.cursor>=this.rails[this.stroke].length-3){this.stroke++;this.cursor=0;this.held=false;this.previous=null;}
 }
 release(){this.held=false;this.previous=null;}
}
