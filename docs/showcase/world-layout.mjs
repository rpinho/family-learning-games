import {backgroundRect} from './book-painted-layout.mjs';
const ZONE_PAD=.012;
export const relHeight=(id)=>({'grown-up':1,hero:.74,bo:.8,pip:.46}[id]||.6);
export function zonesOnScreen(entry,{width,height,top=false,still=false,nw=1536,nh=1024}={}){
 const zs=Array.isArray(entry?.keepOut)?entry.keepOut:[];const out=[];if(!zs.length||!(width>0&&height>0))return out;
 const {x:ox,y:oy,w:dw,h:dh}=backgroundRect(entry,{width,height,nw,nh,top});
 for(const z of zs){const [x,y,w,h]=(z?.r||z||[]).map(Number);if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const sc of top||still?[1]:[1.02,1.08])for(const t of top||still?[0]:[-0.006,0.006]){
   const X=v=>((ox+v*dw-width/2)*sc+width/2)/width+t,Y=v=>((oy+v*dh-height/2)*sc+height/2)/height;
   x0=Math.min(x0,X(x));x1=Math.max(x1,X(x+w));y0=Math.min(y0,Y(y));y1=Math.max(y1,Y(y+h));}
  const pad=ZONE_PAD+12/width;if(x1<0||x0>1)continue;out.push({name:String(z?.name||'painted object'),x0:x0-pad,x1:x1+pad,y0:y0-6/height,y1:y1+6/height});}
 return out;}
