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
// A standing plane belongs to the image, so its screen height changes with the crop.
// Leave space for a second row rather than putting its feet above the painted ground.
export function standingGround(entry,{width,height,ground=.93,backLift=.05}={}){
 if(!(entry?.groundStart>0&&entry.groundStart<1))return ground;
 const r=backgroundRect(entry,{width,height});
 return Math.min(.97,Math.max(ground,(r.y+entry.groundStart*r.h)/height+backLift+.02));
}
// Optional release metadata corrects existing art without changing a library or a written chapter.
export function applyBackgroundLayouts(library,layouts={}){
 return {...library,backgrounds:Object.fromEntries(Object.entries(library.backgrounds||{}).map(([id,b])=>[id,layouts[id]?{...b,...layouts[id]}:b]))};
}
