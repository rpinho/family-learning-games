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
// A broad painted object may fill a portrait crop. Keep heads and hops below it
// instead of letting the layout discard its keep-out zone to preserve larger figures.
export function standingClearance(zones,{ground,maxHeight,height,backLift=.05}={}){
 for(const z of zones||[]){const visible=Math.min(1,z.x1)-Math.max(0,z.x0);
  if(visible>.5&&z.y1<ground-backLift-.03)maxHeight=Math.min(maxHeight,(ground-z.y1-backLift-12/height)/1.15);
 }
 return Math.max(.03,maxHeight);
}
// When answers fill a painted path, keep the row below them. Blocking the whole
// path horizontally would make the compositor fall back to the screen edges.
export function standingWithUI(entry,{width,height,ground,maxHeight,avoid=null,ui=null}={}){
 const cols=Array.isArray(avoid?.[0])?[...avoid]:avoid?[avoid]:[];
 if(!entry?.standBand)return {maxHeight,avoid:ui?cols.length?[Math.min(ui.x0,...cols.map(c=>c[0])),Math.max(ui.x1,...cols.map(c=>c[1]))]:[ui.x0,ui.x1]:avoid};
 const r=backgroundRect(entry,{width,height}),[a,b]=entry.standBand;
 const lo=Math.max(.03,(r.x+a*r.w)/width),hi=Math.min(.97,(r.x+b*r.w)/width);
 if(ui){
  const room=Math.max(Math.min(hi,ui.x0)-lo,hi-Math.max(lo,ui.x1));
  if(room<=.08)maxHeight=Math.min(maxHeight,Math.max(.03,(ground-ui.y1-12/height)/1.15));
  else cols.push([ui.x0,ui.x1]);
 }
 return {maxHeight,avoid:[...cols,[-1,lo],[hi,2]]};
}
// Optional release metadata corrects existing art without changing a library or a written chapter.
export function applyBackgroundLayouts(library,layouts={}){
 return {...library,backgrounds:Object.fromEntries(Object.entries(library.backgrounds||{}).map(([id,b])=>[id,layouts[id]?{...b,...layouts[id]}:b]))};
}
