import {backgroundRect} from './book-painted-layout.mjs';

// Bring the existing painted ground toward the viewer. This is a camera/layout
// operation: the original painting supplies every pixel, including the foreground.
export const STORY_MIN_HEIGHT=.35;
const protectedObjects=entry=>[...(entry.keepOut||[]),...(entry.goal?[{name:'painted goal',r:entry.goal}]:[])];
export const foregroundTop=({width,height})=>width>=height?.52:.265;
export function foregroundProjection(entry,{width,height,nw=1536,nh=1024}={}){
 const floor=foregroundTop({width,height}),r=backgroundRect(entry,{width,height,nw,nh});
 const band=entry.standBand||[0,1],sampleWidth=Math.min(.10,(band[1]-band[0])*.35),centre=Math.max(band[0]+sampleWidth/2,Math.min(band[1]-sampleWidth/2,.5));
 const ends=protectedObjects(entry).map(z=>z.r||z).filter(([x,,w])=>x<centre+sampleWidth/2&&x+w>centre-sampleWidth/2).map(([,y,,h])=>y+h);
 const cut=Math.max(.1,Math.min(.95,Math.max(entry.groundStart||entry.foreground||.72,...ends)));
 const horizon=r.y+cut*r.h,sy=floor*height/Math.max(1,horizon);
 const topW=width>=height?r.w:Math.max(width,r.w*sy);
 const top={x:(width-topW)*(entry.focal?.[0]??.5),y:r.y*sy,w:topW,h:r.h*sy};
 // A close foreground patch keeps the ground's own texture proportions. The
 // protected objects determine the patch's start, rather than shrinking people.
 const ar=(entry.size?.[0]||nw)/(entry.size?.[1]||nh);
 const sampleY=cut+(1-cut)*.22;
 const sw=Math.min(sampleWidth,(1-sampleY)*.9*width/((1-floor)*height*ar));
 const sh=sw*(1-floor)*height/width*ar;
 const sample={x:centre-sw/2,y:sampleY,w:sw,h:sh};
 const row=y=>y<=cut?{x:top.x,w:top.w,y:(r.y+y*r.h)*sy}:
  {x:-sample.x/sample.w*width,w:width/sample.w,y:floor*height+(y-sample.y)/sample.h*(1-floor)*height};
 return {cut,row,floor,top,sample};
}
export function foregroundRect(entry,rect,size){
 const p=foregroundProjection(entry,size),[x,y,w,h]=rect,a=p.row(y),b=p.row(y+h);
 const x0=Math.min(a.x+x*a.w,b.x+x*b.w),x1=Math.max(a.x+(x+w)*a.w,b.x+(x+w)*b.w);
 return {x:x0,y:a.y,w:x1-x0,h:b.y-a.y};
}
export function foregroundZones(entry,size){
 const out=[],p=foregroundProjection(entry,size);
 for(const zone of protectedObjects(entry)){const [x,y,w,h]=zone.r||zone;
  const portions=[];
  if(y<p.cut)portions.push([x,y,w,Math.min(y+h,p.cut)-y]);
  if(y+h>p.sample.y&&x<p.sample.x+p.sample.w&&x+w>p.sample.x){const a=Math.max(y,p.sample.y),b=Math.min(y+h,p.sample.y+p.sample.h);if(b>a)portions.push([x,a+1e-9,w,b-a-1e-9]);}
  for(const box of portions){const r=foregroundRect(entry,box,size);if(r.x+r.w<0||r.x>size.width)continue;
   out.push({name:zone.name||'painted object',x0:r.x/size.width-.008,x1:(r.x+r.w)/size.width+.008,y0:r.y/size.height-.002,y1:(r.y+r.h)/size.height+.002});
  }
 }
 return out;
}
export function drawForeground(canvas,img,entry,{width,height}){
 const p=foregroundProjection(entry,{width,height,nw:img.naturalWidth,nh:img.naturalHeight}),floor=p.floor;
 canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
 c.save();c.beginPath();c.rect(0,0,width,floor*height);c.clip();
 c.drawImage(img,p.top.x,p.top.y,p.top.w,p.top.h);c.restore();
 const q=p.sample;
 c.drawImage(img,q.x*img.naturalWidth,q.y*img.naturalHeight,q.w*img.naturalWidth,q.h*img.naturalHeight,0,floor*height,width,(1-floor)*height);
}
