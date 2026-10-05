// Shared by the browser integration test and the full affordance audit. Measure
// rendered images too: an actor's button alone can hide image/animation overflow.
export function measureWorldGeometry(){
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const scene=rect(document.querySelector('#scene'));
 const boxes=[...document.querySelectorAll('.actor,[data-object]')].filter(e=>!e.hidden).map(e=>{
  const rs=[rect(e),...[...e.querySelectorAll('img,svg')].filter(i=>!i.closest('.little-token')).map(rect)];
  const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y)),right=Math.max(...rs.map(r=>r.right)),bottom=Math.max(...rs.map(r=>r.bottom));
  return {id:e.classList.contains('hero')?'hero':e.dataset.object||e.dataset.id,x,y,right,bottom,w:right-x,h:bottom-y};
 });return {scene,boxes};
}
export function worldGeometryIssues({scene,boxes},{maxOverlap=.05}={}){
 const issues=[];
 for(const b of boxes)if(b.x<scene.x-.5||b.y<scene.y-.5||b.right>scene.right+.5||b.bottom>scene.bottom+.5)issues.push(`${b.id} outside scene: ${JSON.stringify(b)}`);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j],area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)),ratio=area/Math.min(a.w*a.h,b.w*b.h);
  if(ratio>maxOverlap+1e-6)issues.push(`${a.id} / ${b.id} overlap ${(ratio*100).toFixed(1)}% of smaller box`);
 }return issues;
}
