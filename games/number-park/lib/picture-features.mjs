import {inkStats} from './doodle.mjs';
import {checkPart} from './shape-check.mjs';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// Corroborate a flower candidate with a narrow stem, a central ink ring and
// repeated petal lobes. Work on sampled geometry so shading/drawing speed do
// not overwhelm the outline. This is bounded evidence, never a quality grade.
export function flowerFeatures(ink){
 const b=inkStats(ink);if(!b||b.points>5000||b.h<24||b.w<18)return null;
 const points=[];
 for(const s of ink)for(let i=1;i<s.length;i++){
  const a=s[i-1],z=s[i],n=Math.max(1,Math.ceil(distance(a,z)/1.2));
  if(points.length+n>16000)return null;
  for(let j=0;j<n;j++)points.push([a[0]+(z[0]-a[0])*j/n,a[1]+(z[1]-a[1])*j/n]);
 }
 for(const fraction of [.5,.56,.62,.68]){
  const cut=b.y+b.h*fraction,stem=points.filter(p=>p[1]>cut),head=points.filter(p=>p[1]<=cut);
  if(stem.length<8||head.length<30)continue;
  const bounds=pts=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
  const sb=bounds(stem),hb=bounds(head);
  if(sb.w>hb.w*.22||sb.h<hb.h*.4||hb.w/hb.h<.65||hb.w/hb.h>1.8)continue;
  const cx=hb.x+hb.w/2,cy=hb.y+hb.h/2,rx=hb.w/2,ry=hb.h/2;
  if(Math.abs(sb.x+sb.w/2-cx)>hb.w*.2)continue;
  const bins=Array(72).fill(0),inner=new Set();
  for(const [x,y]of head){const nx=(x-cx)/rx,ny=(y-cy)/ry,r=Math.hypot(nx,ny),angle=(Math.atan2(ny,nx)+Math.PI)/(2*Math.PI),i=Math.min(71,Math.floor(angle*72));bins[i]=Math.max(bins[i],r);if(r>=.22&&r<=.6)inner.add(Math.floor(angle*12));}
  if(inner.size<10||bins.filter(v=>v>.5).length<60)continue;
  const smooth=bins.map((_,i)=>(bins[(i+71)%72]+bins[i]+bins[(i+1)%72])/3),peaks=[];
  for(let i=0;i<72;i++){
   const v=smooth[i],left=Math.min(...Array.from({length:6},(_,j)=>smooth[(i-j-1+72)%72])),right=Math.min(...Array.from({length:6},(_,j)=>smooth[(i+j+1)%72]));
   if(v>=smooth[(i+71)%72]&&v>smooth[(i+1)%72]&&v-Math.max(left,right)>.12)peaks.push(i);
  }
  const distinct=[];for(const i of peaks)if(distinct.every(j=>Math.min(Math.abs(i-j),72-Math.abs(i-j))>=6))distinct.push(i);
  if(distinct.length>=4&&distinct.length<=12)return {feature:'petal-lobes-centre-stem-1',petals:distinct.length,centreSectors:inner.size};
 }
 return null;
}
// Corroborate the image model, not a general picture/intent classifier.
// A sun has a closed round centre and many short, outward rays all around it.
// Petals, interior clock hands, stars and overlapping pictures must not qualify.
export function sunFeatures(ink){
 const total=inkStats(ink);if(!total||total.points>5000||ink.length<7)return null;
 const ordered=ink.map((s,i)=>({s,i,b:inkStats([s])})).filter(x=>x.b).sort((a,b)=>b.b.length-a.b.length).slice(0,3);
 let checks=0;
 for(const {s,i} of ordered){
  // A child may finish the circle and continue straight into the first ray.
  for(let end=s.length-1;end>=8;end-=1){
   const loop=s.slice(0,end+1),b=inkStats([loop]),size=Math.max(b.w,b.h);
   if(Math.min(b.w,b.h)<12||distance(loop[0],loop.at(-1))>size*.16||b.length<size*2.4||b.length>size*4.5)continue;
   if(++checks>32)return null;
   if(!checkPart('circle',[loop]).ok)continue;
   const cx=b.x+b.w/2,cy=b.y+b.h/2,rx=b.w/2,ry=b.h/2;
   const polar=p=>[(p[0]-cx)/rx,(p[1]-cy)/ry];
   const sectors=new Set();let rays=0,rayLength=0,otherLength=0;
   for(const stroke of [...ink.filter((_,j)=>j!==i),s.slice(end)]){
    const stats=inkStats([stroke]);if(!stats||stats.length<2)continue;otherLength+=stats.length;
    const a=polar(stroke[0]),z=polar(stroke.at(-1));
    const near=Math.hypot(...a)<Math.hypot(...z)?a:z,far=near===a?z:a;
    const nr=Math.hypot(...near),fr=Math.hypot(...far),straight=distance(stroke[0],stroke.at(-1))/stats.length;
    const radial=(near[0]*far[0]+near[1]*far[1])/(nr*fr);
    if(nr>=.72&&nr<=1.4&&fr>=nr+.22&&straight>=.78&&radial>=.86&&stroke.every(p=>Math.hypot(...polar(p))>=.68)){
     rays++;rayLength+=stats.length;sectors.add(Math.floor((Math.atan2(far[1],far[0])+Math.PI)*8/(Math.PI*2))%8);
    }
   }
   if(rays>=6&&sectors.size>=5&&rayLength/otherLength>=.8)return {rays,sectors:sectors.size,feature:'round-centre-outward-rays-1'};
  }
 }
 return null;
}
