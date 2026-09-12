const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
// Cut the ink, not a white overlay: saved/reloaded drawings and guesses see the
// same erased geometry. Swept hit-testing prevents gaps during fast finger moves.
export function eraseInk(ink,from,to=from,radius=3.5){
 const out=[];let changed=false;
 for(const stroke of ink){
  const points=[];
  for(let i=0;i<stroke.length;i++){const p=stroke[i],previous=stroke[i-1];if(!previous)points.push(p);else{const n=Math.max(1,Math.ceil(Math.hypot(p[0]-previous[0],p[1]-previous[1])/1.5));for(let j=1;j<=n;j++)points.push([previous[0]+(p[0]-previous[0])*j/n,previous[1]+(p[1]-previous[1])*j/n]);}}
  if(!points.some(p=>distance(p,from,to)<=radius)){out.push(stroke);continue;}
  changed=true;let part=[];
  const flush=()=>{if(part.length)out.push(part.length===1?[part[0],part[0]]:part);part=[];};
  for(const p of points){if(distance(p,from,to)<=radius)flush();else part.push(p);}flush();
 }
 if(!changed)return ink;
 // Match the strictest mission/save limits. Never silently discard other ink.
 if(out.length>100||out.some(s=>s.length>700)||out.reduce((n,s)=>n+s.length,0)>5000)return ink;
 return out;
}
