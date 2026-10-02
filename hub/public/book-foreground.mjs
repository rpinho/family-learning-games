import {backgroundRect} from './book-painted-layout.mjs';

// A still camera projection: enlarge the scene's ground toward the viewer,
// retaining continuous painted texture rather than adding a flat filler floor.
export const STORY_MIN_HEIGHT=.35;
const protectedObjects=entry=>[...(entry.keepOut||[]),...(entry.goal?[{name:'painted goal',r:entry.goal}]:[])];
export const foregroundTop=({width,height})=>width>=height?.52:.265;
const cache=new WeakMap();
export function foregroundProjection(entry,{width,height,nw=1536,nh=1024}={}){
 const key=`${width}:${height}:${nw}:${nh}`,cached=cache.get(entry);if(cached?.key===key)return cached.value;
 const floor=foregroundTop({width,height}),r=backgroundRect(entry,{width,height,nw,nh}),sourceH=entry.size?.[1]||nh;
 const band=entry.standBand||[0,1],sampleWidth=(band[1]-band[0])*.65,centre=Math.max(band[0]+sampleWidth/2,Math.min(band[1]-sampleWidth/2,.5));
 const ends=protectedObjects(entry).map(z=>z.r||z).filter(([x,,w])=>x<centre+sampleWidth/2&&x+w>centre-sampleWidth/2).map(([,y,,h])=>y+h);
 const cut=Math.max(.1,Math.min(.95,Math.max(entry.groundStart||entry.foreground||.72,...ends)));
 const sy=floor*height/Math.max(1,r.y+cut*r.h),topW=width>=height?r.w:Math.max(width,r.w*sy);
 const top={x:(width-topW)*(entry.focal?.[0]??.5),y:r.y*sy,w:topW,h:r.h*sy};
 const sourceW=entry.size?.[0]||nw,a0=top.w/sourceW,groundH=(1-floor)*height;
 let a1=Math.max(a0*1.5,groundH/((1-cut)*sourceH*.9)*1.6,entry.standBand?width/(sampleWidth*sourceW):0),nodes;
 const N=256,scale=t=>a0+(a1-a0)*(-Math.expm1(-80*t));
 for(let attempt=0;attempt<8;attempt++){
  nodes=[cut];for(let i=1;i<=N;i++)nodes.push(nodes[i-1]+groundH/sourceH/N*(1/scale((i-1)/N)+1/scale(i/N))/2);
  if(nodes[N]<=.995)break;a1*=1.5;
 }
 const at=t=>{t=Math.max(0,Math.min(1,t));const n=t*N,i=Math.min(N-1,Math.floor(n)),y=nodes[i]+(nodes[i+1]-nodes[i])*(n-i),w=scale(t)*sourceW,q=-Math.expm1(-80*t);
  const cx=top.x+centre*top.w+(width/2-(top.x+centre*top.w))*q;
  return {sourceY:y,x:cx-centre*w,w,y:height*(floor+(1-floor)*t)};
 };
 const row=y=>{
  if(y<=cut)return {x:top.x,w:top.w,y:(r.y+y*r.h)*sy};
  let a=0,b=N;while(b-a>1){const m=(a+b)>>1;if(nodes[m]<y)a=m;else b=m;}
  const t=(a+(y-nodes[a])/(nodes[b]-nodes[a]))/N,projected=at(t);return {...projected,y:height*(floor+(1-floor)*t)};
 };
 const value={cut,row,at,floor,top,end:nodes[N]};cache.set(entry,{key,value});return value;
}
export function foregroundRect(entry,rect,size){
 const p=foregroundProjection(entry,size),[x,y,w,h]=rect,a=p.row(y),b=p.row(y+h);
 const x0=Math.min(a.x+x*a.w,b.x+x*b.w),x1=Math.max(a.x+(x+w)*a.w,b.x+(x+w)*b.w);
 return {x:x0,y:a.y,w:x1-x0,h:b.y-a.y};
}
export function foregroundZones(entry,size){
 const out=[],p=foregroundProjection(entry,size);
 for(const zone of protectedObjects(entry)){const [x,y,w,h]=zone.r||zone,portions=[];
  if(y<p.cut)portions.push([x,y,w,Math.min(y+h,p.cut)-y]);
  if(y+h>p.cut){const a=Math.max(y,p.cut),b=Math.min(y+h,p.end);if(b>a)for(let i=0;i<96;i++)portions.push([x,a+(b-a)*i/96+1e-10,w,(b-a)/96-1e-10]);}
  for(const box of portions){const r=foregroundRect(entry,box,size);if(r.x+r.w<0||r.x>size.width)continue;
   out.push({name:zone.name||'painted object',x0:r.x/size.width-.008,x1:(r.x+r.w)/size.width+.008,y0:r.y/size.height-.002,y1:(r.y+r.h)/size.height+.002});
  }
 }
 return out;
}
export function drawForeground(canvas,img,entry,{width,height}){
 const p=foregroundProjection(entry,{width,height,nw:img.naturalWidth,nh:img.naturalHeight}),floor=p.floor;
 canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
 c.save();c.beginPath();c.rect(0,0,width,floor*height);c.clip();c.drawImage(img,p.top.x,p.top.y,p.top.w,p.top.h);c.restore();
 for(let y=floor*height;y<height;y+=2){const a=p.at((y-floor*height)/((1-floor)*height)),b=p.at((Math.min(height,y+2)-floor*height)/((1-floor)*height)),r=p.at((y+1-floor*height)/((1-floor)*height));
  c.drawImage(img,0,a.sourceY*img.naturalHeight,img.naturalWidth,(b.sourceY-a.sourceY)*img.naturalHeight,r.x,y,r.w,Math.min(2.1,height-y));
 }
}
