import {backgroundRect} from './book-painted-layout.mjs';

// The complete master painting has one uniform camera transform.
// Aspect variants supply actual painted ground, never a magnified sampled band.
export const STORY_MIN_HEIGHT=.35;
export function foregroundTop(size,entry={}){
 const r=backgroundRect(entry,size);
 return (r.y+(entry.groundStart??entry.foreground??.72)*r.h)/size.height;
}
export function foregroundRect(entry,[x,y,w,h],size){
 const r=backgroundRect(entry,size);
 return {x:r.x+x*r.w,y:r.y+y*r.h,w:w*r.w,h:h*r.h};
}
export function paintedStanding(entry,{width,height,beat=false,uiBottom=0}={}){
 const ground=.97,floor=foregroundTop({width,height},entry);
 let maxHeight=(ground-floor-12/height)/1.15;
 if(!beat)maxHeight=Math.max(width>=height?STORY_MIN_HEIGHT:STORY_MIN_HEIGHT/.92,maxHeight);
 if(uiBottom)maxHeight=Math.min(maxHeight,Math.max(.03,(ground-uiBottom-12/height)/1.15));
 return {ground,maxHeight,minHeight:beat?0:width>=height?STORY_MIN_HEIGHT:STORY_MIN_HEIGHT/.92,
  backLift:beat||width>=height?.05:Math.max(.05,Math.min(.29,ground-floor-STORY_MIN_HEIGHT*1.15-20/height))};
}
// Retained module exports let an already-open older player finish its page.
// Even that player receives the whole painting with one uniform draw, no strips.
export function drawForeground(canvas,img,entry,size){
 const r=backgroundRect(entry,{...size,nw:img.naturalWidth,nh:img.naturalHeight});
 canvas.width=size.width;canvas.height=size.height;
 if(canvas.style)Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
 const c=canvas.getContext('2d');c.clearRect(0,0,size.width,size.height);c.drawImage(img,r.x,r.y,r.w,r.h);
}
export function foregroundZones(entry,size){
 return [...(entry.keepOut||[]),...(entry.goal?[{name:'painted goal',r:entry.goal}]:[])].map(z=>{
  const r=foregroundRect(entry,z.r||z,size),pad=.012+12/size.width;
  return {name:z.name||'painted object',x0:r.x/size.width-pad,x1:(r.x+r.w)/size.width+pad,y0:r.y/size.height-6/size.height,y1:(r.y+r.h)/size.height+6/size.height};
 }).filter(z=>z.x1>=0&&z.x0<=1);
}
export function foregroundProjection(entry,size){
 const top=backgroundRect(entry,size),row=sourceY=>({x:top.x,w:top.w,y:top.y+sourceY*top.h,sourceY});
 return {top,row,at:row,cut:1,end:1,floor:foregroundTop(size,entry)};
}
