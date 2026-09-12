import {inkStats} from './doodle.mjs';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const segment=(p,a,b)=>{const d=dist(a,b)**2,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/d)):0;return dist(p,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);};
// Ignore tiny incidental taps only in shape missions, never in symbol recognition.
export function cleanMissionInk(ink){
 const stats=ink.map(s=>inkStats([s])),largest=Math.max(0,...stats.map(b=>b?.length||0));
 return ink.filter((s,i)=>stats[i]&&!(stats[i].length<largest*.025&&Math.max(stats[i].w,stats[i].h)<3));
}
function hull(points){
 const ps=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const half=xs=>{const out=[];for(const p of xs){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
 return [...half(ps).slice(0,-1),...half([...ps].reverse()).slice(0,-1)];
}
function samples(ink){const out=[];for(const s of ink){if(s.length)out.push(s[0]);for(let i=1;i<s.length;i++){const n=Math.ceil(dist(s[i-1],s[i])/2);for(let j=1;j<=n;j++){if(out.length>=6000)return out;out.push([s[i-1][0]+(s[i][0]-s[i-1][0])*j/n,s[i-1][1]+(s[i][1]-s[i-1][1])*j/n]);}}}return out;}
const area=ps=>Math.abs(ps.reduce((s,p,i)=>s+p[0]*ps[(i+1)%ps.length][1]-p[1]*ps[(i+1)%ps.length][0],0))/2;
function polygonFit(ps,n){let best=[],bestArea=0;const choose=(start,selected)=>{if(selected.length===n){const a=area(selected);if(a>bestArea){bestArea=a;best=selected;}return;}for(let i=start;i<=ps.length-(n-selected.length);i++)choose(i+1,[...selected,ps[i]]);};choose(0,[]);return {points:best,ratio:bestArea/area(ps)};}
export function checkPart(kind,input){
 const raw=inkStats(input),fail=message=>({ok:false,message});
 if(!['circle','rectangle','triangle','line'].includes(kind)||!raw||raw.points>5000||raw.length<12||Math.max(raw.w,raw.h)<8)return fail('Add a little more drawing first.');
 const ink=cleanMissionInk(input),b=inkStats(ink);
 if(!b)return fail('Add a little more drawing first.');
 if(kind==='line')return b.h>=12&&b.w/b.h<.65&&b.length/b.h<2.5?{ok:true,message:'There is your stem!'}:fail('Try a line from top to bottom. Wobbles are okay.');
 if(Math.min(b.w,b.h)<6||b.length/(b.w+b.h)>5)return fail('Try a clear outline. Wobbles are okay.');
 const normalized=ink.map(s=>s.map(([x,y])=>[15+(x-b.x)/b.w*70,15+(y-b.y)/b.h*70])),drawn=samples(normalized);
 const corners=hull(drawn);
 if(corners.length<3||area(corners)<100)return fail('Try a clear outline. Wobbles are okay.');
 // Simplify small hand wobbles without imposing axis-aligned corners.
 while(corners.length>3){const errors=corners.map((p,i)=>segment(p,corners[(i+corners.length-1)%corners.length],corners[(i+1)%corners.length]));const min=Math.min(...errors);if(min>5&&corners.length<=16)break;corners.splice(errors.indexOf(min),1);}
 const tri=polygonFit(corners,3),quad=polygonFit(corners,4),fit=kind==='triangle'?tri.points:kind==='rectangle'&&quad.points.length?quad.points:corners;
 const edges=fit.map((p,i)=>[p,fit[(i+1)%fit.length]]),outline=samples([[...fit,fit[0]]]);
 const coverage=outline.filter(p=>drawn.some(q=>dist(p,q)<10)).length/outline.length;
 const precision=drawn.filter(p=>edges.some(([a,b])=>segment(p,a,b)<10)).length/drawn.length;
 const endpoints=normalized.filter(s=>s.length>1).flatMap(s=>[s[0],s.at(-1)]);
 const closed=endpoints.every((p,i)=>endpoints.some((q,j)=>i!==j&&dist(p,q)<16));
 const distinctive=kind==='circle'?corners.length>=5&&quad.ratio<.85:kind==='rectangle'?quad.ratio>=.85&&tri.ratio<.72:tri.ratio>=.72;
 const ok=closed&&coverage>=.85&&precision>=.85&&distinctive;
 return {ok,message:ok?'Your shape is connected!':!closed?'Bring the ends together. Small gaps are okay.':kind==='triangle'?'Try three sides. Wobbles are okay.':kind==='rectangle'?'Try four sides, with a corner at each turn.':'Try going around in a round loop.',coverage,precision,corners:corners.length,triangleFit:tri.ratio,rectangleFit:quad.ratio,checker:'outline-2'};
}
