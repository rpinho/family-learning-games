// Projection of a still painted panorama and an optional extension of its empty foreground.
export function backgroundRect(entry,{width,height,nw=1536,nh=1024,top=false}={}){
 if(entry?.size?.every(n=>Number.isFinite(n)&&n>0)){[nw,nh]=entry.size;}
 const portrait=width<height&&entry?.portraitHeight>0&&entry.portraitHeight<=1,frameH=portrait?height*entry.portraitHeight:height;
 const contain=entry?.fit==='contain'&&!portrait,k=(contain?Math.min:Math.max)(width/nw,frameH/nh),w=nw*k,h=nh*k;
 const [fx,fy]=entry?.focal||[.5,.5];
 return {x:(width-w)*fx,y:portrait||entry?.fit==='contain'||top?0:(height-h)*fy,w,h};
}
// Extend only the empty painted terrace, keeping the panorama and its hit areas at their original scale.
// Landscape has no extension. The extra image is clipped below foreground; its lava can never show.
export function portraitTerrace(entry,{width,height}={}){
 if(!(width<height&&entry?.portraitGround>0&&entry.portraitGround<1&&entry.foreground>0&&entry.foreground<1&&entry.portraitHeight))return null;
 const r=backgroundRect(entry,{width,height}),top=r.y+entry.foreground*r.h,h=height-top;
 return {top,height:h,left:r.x,width:r.w,imageHeight:h/(1-entry.foreground),ground:entry.portraitGround};
}
