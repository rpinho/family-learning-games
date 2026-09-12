// Aim uses the rendered target centers, not idealized equal-width lanes.
export function nearestTarget(x,centers){
 if(!centers.length)return null;
 return centers.reduce((best,center,index)=>Math.abs(center-x)<Math.abs(centers[best]-x)?index:best,0);
}
export function aimFromClient(clientX,left,width){return Math.max(0,Math.min(100,(clientX-left)/Math.max(1,width)*100));}
export function releaseAim(gesture,x,centers,canceled=false){
 const index=nearestTarget(x,centers);
 return {index,x:index===null?x:centers[index],fire:!canceled&&gesture.shipTap&&!gesture.moved};
}
export function movedPointer(start,x,y){return Math.hypot(x-start.x,y-start.y)>8;}
