// Normalized world coordinates make touch, mouse and keyboard share one simulation.
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function flightWorld(values,{level=1,mode='practice'}={}){
 return {time:0,ship:50,shots:[],serial:0,wraps:0,targets:values.map((value,i)=>({id:i,value,base:14+i*72/Math.max(1,values.length-1),x:14+i*72/Math.max(1,values.length-1),y:12+(i%3)*14,speed:(mode==='arcade'?10:5)+level*1.3,phase:i*1.9}))};
}
export function nearestFlyingTarget(world,x){return [...world.targets].sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null;}
export function flightAim(clientX,left,width,offset=0){return clamp((clientX-left-offset)/Math.max(1,width)*100,0,100);}
export function snapFlightAim(world,x){const t=nearestFlyingTarget(world,x);return t&&Math.abs(t.x-x)<=9?t.x:clamp(x,0,100);}
export function launchShot(world,id){
 const target=world.targets.find(t=>t.id===id);if(!target||world.shots.length)return false;
 world.shots.push({id:++world.serial,target:id,x:world.ship,y:85});return true;
}
export function stepFlight(world,seconds,{paused=false}={}){
 if(paused)return {hit:null,escaped:[]};
 const dt=clamp(seconds,0,.05),escaped=[];world.time+=dt;
 for(const t of world.targets){t.x=clamp(t.base+Math.sin(world.time*.65+t.phase)*7,7,93);if(!world.shots.some(s=>s.target===t.id))t.y+=t.speed*dt;if(t.y>92){escaped.push(t.value);t.y=-12;world.wraps++;}}
 let hit=null;
 for(const shot of world.shots){const target=world.targets.find(t=>t.id===shot.target);if(!target)continue;
  const before=shot.y;shot.x+=(target.x-shot.x)*Math.min(1,dt*14);shot.y+=(target.y>=shot.y?1:-1)*105*dt;
  if(Math.max(before,shot.y)>=target.y-6&&Math.min(before,shot.y)<=target.y+6&&Math.abs(shot.x-target.x)<10){hit={id:target.id,value:target.value,x:target.x,y:target.y};shot.y=-100;}
 }
 world.shots=world.shots.filter(s=>s.y>-20);return {hit,escaped};
}
export function orbitPosition(i,count,time){const angle=(i/count)*Math.PI*2+time*.045;return {x:50+Math.cos(angle)*34,y:49+Math.sin(angle)*30};}
export function dockAt(x,count){return clamp(Math.floor(clamp(x,0,99.999)/100*count),0,count-1);}
export function raceDistance(results){return Math.min(100,results.length/8*100);}
export function raceRival(elapsed,pace=90){return Math.min(100,elapsed/pace*100);}
