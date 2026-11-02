// Bounded rigid bodies and passive pegged gear trains. World coordinates survive resizing.
export const WIDTH=800, HEIGHT=800, FLOOR=746, PIECE_LIMIT=40, BALL_LIMIT=2;
export const TYPES=['block','bounce','gear','ball'];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function piece(type,x,y,id){
 if(!TYPES.includes(type))throw Error('Unknown piece');
 const round=type==='ball'||type==='gear',w=type==='block'?112:type==='bounce'?88:type==='gear'?104:90,h=type==='block'?48:type==='bounce'?54:w;
 return {id,type,x:clamp(x,w/2,WIDTH-w/2),y:clamp(y,h/2,FLOOR-h/2),w,h,a:0,vx:0,vy:0,av:0,m:type==='gear'?0:type==='ball'?2:1,round};
}
export function add(pieces,type,x,y,id){if(pieces.length>=PIECE_LIMIT||type==='ball'&&pieces.filter(p=>p.type==='ball').length>=BALL_LIMIT)return null;const p=piece(type,x,y,id);pieces.push(p);if(type==='gear')snapGear(pieces,p);return p;}
export function snapshot(pieces){return pieces.map(({id,type,x,y,a,av})=>({id,type,x,y,a,av}));}
export function restore(rows){
 if(!Array.isArray(rows)||rows.length>PIECE_LIMIT)throw Error('Invalid room');
 const ids=new Set(),out=[];
 for(const r of rows){if(!r||!TYPES.includes(r.type)||typeof r.id!=='string'||!/^[-\w]{1,60}$/.test(r.id)||ids.has(r.id)||![r.x,r.y,r.a,r.av].every(Number.isFinite))throw Error('Invalid piece');ids.add(r.id);if(r.type==='ball'&&out.filter(p=>p.type==='ball').length>=BALL_LIMIT)throw Error('Too many balls');const p=piece(r.type,r.x,r.y,r.id);p.a=r.a%(Math.PI*2);p.av=clamp(r.av,-16,16);p._decay=Math.max(.2,Math.abs(p.av)/5);out.push(p);if(p.type==='gear')snapGear(out,p);}
 return out;
}
function axes(p){
 if(p._angle!==p.a){const c=Math.cos(p.a),s=Math.sin(p.a);p._angle=p.a;p._c=c;p._s=s;p._ex=p.round?p.w/2:Math.abs(c)*p.w/2+Math.abs(s)*p.h/2;p._ey=p.round?p.h/2:Math.abs(s)*p.w/2+Math.abs(c)*p.h/2;}
}
export function contact(a,b){
 axes(a);axes(b);
 const dx=b.x-a.x,dy=b.y-a.y;
 if(Math.abs(dx)>=a._ex+b._ex||Math.abs(dy)>=a._ey+b._ey)return null;
 if(a.round&&b.round){const len=Math.hypot(dx,dy),depth=(a.w+b.w)/2-len;return depth>0?{nx:len?dx/len:1,ny:len?dy/len:0,depth}:null;}
 if(a.round||b.round){
  const p=a.round?a:b,q=a.round?b:a,x=(p.x-q.x)*q._c+(p.y-q.y)*q._s,y=-(p.x-q.x)*q._s+(p.y-q.y)*q._c;
  let lx=x-clamp(x,-q.w/2,q.w/2),ly=y-clamp(y,-q.h/2,q.h/2),len=Math.hypot(lx,ly),depth=p.w/2-len;
  if(!len){const ex=q.w/2-Math.abs(x),ey=q.h/2-Math.abs(y);if(ex<ey){lx=x<0?-1:1;ly=0;depth=p.w/2+ex;}else{lx=0;ly=y<0?-1:1;depth=p.w/2+ey;}len=1;}
  if(depth<=0)return null;const sign=a.round?-1:1;return {nx:(lx*q._c-ly*q._s)/len*sign,ny:(lx*q._s+ly*q._c)/len*sign,depth};
 }
 let depth=Infinity,nx=0,ny=0;
 for(let i=0;i<4;i++){
  const q=i<2?a:b,x=i%2?-q._s:q._c,y=i%2?q._c:q._s;
  const ra=Math.abs(a._c*x+a._s*y)*a.w/2+Math.abs(-a._s*x+a._c*y)*a.h/2,rb=Math.abs(b._c*x+b._s*y)*b.w/2+Math.abs(-b._s*x+b._c*y)*b.h/2,d=dx*x+dy*y,overlap=ra+rb-Math.abs(d);
  if(overlap<=0)return null;if(overlap<depth){depth=overlap;nx=d<0?-x:x;ny=d<0?-y:y;}
 }
 return {nx,ny,depth};
}
const inverse=p=>p.m&&!p.held?1/p.m:0;
const GEAR_I=5408;
const inertia=p=>p.held?0:p.type==='gear'?1/(GEAR_I*(p._train?.length||1)):inverse(p)*12/(p.w*p.w+p.h*p.h);
function turn(p,delta){if(p.type==='gear'&&p._train){for(const q of p._train)q.av+=delta*p._sign*q._sign;}else p.av+=delta;}
function support(p,nx,ny){
 if(p.round)return [p.x+nx*p.w/2,p.y+ny*p.w/2];
 const u=p._c*nx+p._s*ny,v=-p._s*nx+p._c*ny,x=Math.abs(u)<.0001?0:Math.sign(u)*p.w/2,y=Math.abs(v)<.0001?0:Math.sign(v)*p.h/2;
 return [p.x+p._c*x-p._s*y,p.y+p._s*x+p._c*y,Math.abs(u)<.0001?p.w/2:Math.abs(v)<.0001?p.h/2:0];
}
function resolve(a,b,c,dt,iter){
 const ia=inverse(a),ib=inverse(b),sum=ia+ib;if(!sum)return;
 const {nx,ny,depth}=c,correction=Math.min(8,Math.max(depth-.12,0)*.65)/sum;
 a.x-=nx*correction*ia;a.y-=ny*correction*ia;b.x+=nx*correction*ib;b.y+=ny*correction*ib;
 let px,py;
 if(a.round){px=a.x+nx*a.w/2;py=a.y+ny*a.w/2;}else if(b.round){px=b.x-nx*b.w/2;py=b.y-ny*b.w/2;}else{const sa=support(a,nx,ny),sb=support(b,-nx,-ny),ta=-ny*sa[0]+nx*sa[1],tb=-ny*sb[0]+nx*sb[1],lo=Math.max(ta-sa[2],tb-sb[2]),hi=Math.min(ta+sa[2],tb+sb[2]),t=(lo+hi)/2,n=(nx*(sa[0]+sb[0])+ny*(sa[1]+sb[1]))/2;px=nx*n-ny*t;py=ny*n+nx*t;}
 const ax=px-a.x,ay=py-a.y,bx=px-b.x,by=py-b.y,ii=inertia(a),ij=inertia(b),an=ax*ny-ay*nx,bn=bx*ny-by*nx;
 const rx=b.vx-b.av*by-a.vx+a.av*ay,ry=b.vy+b.av*bx-a.vy-a.av*ax,vn=rx*nx+ry*ny;
 const bounce=!iter&&depth<12&&Math.abs(vn)>65?(a.type==='bounce'||b.type==='bounce'?.78:a.type==='ball'||b.type==='ball'?.48:.08):0,j=Math.max(0,-(1+bounce)*vn/(sum+an*an*ii+bn*bn*ij));
 a.vx-=nx*j*ia;a.vy-=ny*j*ia;turn(a,-an*j*ii);b.vx+=nx*j*ib;b.vy+=ny*j*ib;turn(b,bn*j*ij);
 const tx=-ny,ty=nx,at=ax*ty-ay*tx,bt=bx*ty-by*tx,vt=(b.vx-b.av*by-a.vx+a.av*ay)*tx+(b.vy+b.av*bx-a.vy-a.av*ax)*ty;
 // Teeth grip even a resting contact. Friction always opposes relative surface motion;
 // the train's combined inertia receives the equal and opposite torque.
 const gear=a.type==='gear'||b.type==='gear',limit=(gear?1.25:.48)*(j+(gear?850*dt/6/sum:0)),jt=clamp(-vt/(sum+at*at*ii+bt*bt*ij),-limit,limit);
 a.vx-=tx*jt*ia;a.vy-=ty*jt*ia;turn(a,-at*jt*ii);b.vx+=tx*jt*ib;b.vy+=ty*jt*ib;turn(b,bt*jt*ij);
}
export function meshed(a,b){return a.type==='gear'&&b.type==='gear'&&Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-(a.w+b.w)/2)<9;}
function trains(pieces){
 const groups=[];
 for(const p of pieces){p._train=null;p._sign=1;}
 for(const p of pieces){if(p.type!=='gear'||p._train)continue;const group=[p];p._train=group;
  for(let i=0;i<group.length;i++){const a=group[i];for(const b of pieces)if(b.type==='gear'&&!b._train&&meshed(a,b)){b._sign=-a._sign;b._train=group;group.push(b);}}
  groups.push(group);
 }
 return groups;
}
export function spin(pieces,id,speed=7){
 const start=pieces.find(p=>p.id===id&&p.type==='gear');if(!start)return [];
 trains(pieces);for(const p of start._train){p.av=clamp(speed,-16,16)*start._sign*p._sign;p._decay=Math.max(.2,Math.abs(p.av)/5);}
 return start._train.map(p=>p.id);
}
export function tapSpin(pieces,id,side){
 const p=pieces.find(p=>p.id===id&&p.type==='gear');if(!p)return [];side=side<0?-1:1;
 return spin(pieces,id,side*Math.min(16,(p.av*side>0?Math.abs(p.av):0)+7));
}
export function snapGear(pieces,p){
 if(p.type!=='gear')return;
 const x=clamp(p.x,p.w/2,WIDTH-p.w/2),y=clamp(p.y,p.h/2,FLOOR-p.h/2);
 const clear=(cx,cy)=>cx>=p.w/2&&cx<=WIDTH-p.w/2&&cy>=p.h/2&&cy<=FLOOR-p.h/2&&pieces.every(q=>q===p||q.type!=='gear'||Math.hypot(cx-q.x,cy-q.y)>=(p.w+q.w)/2-.01);
 let best=null,dist=Infinity;
 for(const q of pieces)if(q!==p&&q.type==='gear'&&Math.hypot(x-q.x,y-q.y)<(p.w+q.w)/2+42){
  const a=Math.atan2(y-q.y,x-q.x),d=(p.w+q.w)/2;
  for(let i=0;i<72;i++){const angle=a+i*Math.PI*2/72,cx=q.x+Math.cos(angle)*d,cy=q.y+Math.sin(angle)*d,delta=(cx-x)**2+(cy-y)**2;if(delta<dist&&clear(cx,cy)){best=[cx,cy];dist=delta;}}
 }
 if(best){[p.x,p.y]=best;return;}if(clear(x,y)){p.x=x;p.y=y;return;}
 // At forty toys a bounded grid always has room; choose the nearest clear peg.
 for(let cy=52;cy<=FLOOR-52;cy+=12)for(let cx=52;cx<=WIDTH-52;cx+=12){const d=(cx-x)**2+(cy-y)**2;if(d<dist&&clear(cx,cy)){best=[cx,cy];dist=d;}}
 if(best)[p.x,p.y]=best;
}
export function clearSpot(pieces,p){
 let best=null,dist=Infinity;const ox=p.x,oy=p.y;
 for(let y=80;y<650;y+=80)for(let x=80;x<760;x+=80){p.x=x;p.y=y;if(pieces.every(q=>q===p||!contact(p,q))){const d=(x-ox)**2+(y-oy)**2;if(d<dist){dist=d;best=[x,y];}}}
 if(best)[p.x,p.y]=best;else{p.x=ox;p.y=oy;}
}
export function releasePiece(p){p.held=p.cranking=false;const fromY=p.y;axes(p);p.x=clamp(p.x,p._ex,WIDTH-p._ex);p.y=clamp(p.y,p._ey,FLOOR-p._ey);if(Math.abs(p.y-fromY)>1)p._returnY=fromY;p.vx=p.vy=0;}
export function bodyInRect(p,r){
 // Circle/OBB against the bin rectangle, in world coordinates.
 const box={x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,w:r.right-r.left,h:r.bottom-r.top,a:0,round:false};
 return !!contact(p,box);
}
export function starter(){
 const ps=[piece('gear',300,400,'starter-gear-a'),piece('gear',404,400,'starter-gear-b'),piece('ball',300,303.2,'starter-ball'),piece('block',570,722,'starter-block')];spin(ps,ps[0].id,.3);return ps;
}
function recoverFloor(pieces,p){
 const x=p.x,y=p.y,base=clamp(x,p._ex,WIDTH-p._ex);p.y=FLOOR-p._ey;let found=false;
 search:for(let d=0;d<WIDTH;d+=4)for(let sign=-1;sign<=1;sign+=2){const cx=base+sign*d;if(cx<p._ex||cx>WIDTH-p._ex)continue;p.x=cx;if(pieces.every(q=>q===p||q.held||!contact(p,q))){found=true;break search;}}
 if(!found){p.x=x;clearSpot(pieces,p);}p._returnX=x;p._returnY=y;p.vx=p.vy=p.av=0;p._floorJam=0;
}
const walls=[{x:400,y:-100,w:1000,h:200,a:0,m:0,round:false,vx:0,vy:0,av:0},{x:400,y:FLOOR+100,w:1000,h:200,a:0,m:0,round:false,vx:0,vy:0,av:0},{x:-100,y:300,w:200,h:1600,a:0,m:0,round:false,vx:0,vy:0,av:0},{x:900,y:300,w:200,h:1600,a:0,m:0,round:false,vx:0,vy:0,av:0}];
export function step(pieces,dt=1/120){
 dt=clamp(dt,0,1/60);let contacts=0;
 const groups=trains(pieces);
 for(const group of groups){let speed=0,decay=.2;for(const p of group){speed+=p.av*p._sign;decay=Math.max(decay,p._decay??.8);}speed=clamp(speed/group.length,-16,16);speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-decay*dt);if(Math.abs(speed)<.025)speed=0;for(const p of group){p.av=speed*p._sign;p.vx=p.vy=0;}}
 for(const p of pieces){if(p.held)continue;if(p._returnX!==undefined){p._returnX+=(p.x-p._returnX)*Math.min(1,dt*16);if(Math.abs(p._returnX-p.x)<.2)delete p._returnX;}if(p._returnY!==undefined){p._returnY+=(p.y-p._returnY)*Math.min(1,dt*16);if(Math.abs(p._returnY-p.y)<.2)delete p._returnY;}if(p.m){p.vy+=850*dt;p.vx=clamp(p.vx,-900,900)*.999;p.vy=clamp(p.vy,-1000,1000);p.av=clamp(p.av,-16,16)*.997;p.x+=p.vx*dt;p.y+=p.vy*dt;}if(!p.cranking)p.a=(p.a+p.av*dt)%(Math.PI*2);}
 // Reuse pair storage; conservative swept bounds avoid six all-pairs scans/step.
 const cache=pieces._bench||=( {pairs:[],touching:new Set(),next:new Set()} );cache.pairs.length=0;cache.next.clear();
 for(let i=0;i<pieces.length;i++){const a=pieces[i];axes(a);if(a.held)continue;
  for(let j=i+1;j<pieces.length;j++){const b=pieces[j];if(b.held||!a.m&&!b.m)continue;axes(b);if(Math.abs(a.x-b.x)<a._ex+b._ex+28&&Math.abs(a.y-b.y)<a._ey+b._ey+28)cache.pairs.push(i,j);}
 }
 for(let iter=0;iter<6;iter++){
  for(const a of pieces)if(a.m&&!a.held)for(const wall of walls){const c=contact(a,wall);if(c)resolve(a,wall,c,dt,iter);}
  for(let k=0;k<cache.pairs.length;k+=2){const a=pieces[cache.pairs[k]],b=pieces[cache.pairs[k+1]],c=contact(a,b);if(c){resolve(a,b,c,dt,iter);if(!iter&&(a.type==='gear'||b.type==='gear')){const key=a.id+'|'+b.id;cache.next.add(key);if(!cache.touching.has(key))contacts++;}}}
 }
 [cache.touching,cache.next]=[cache.next,cache.touching];
 for(const p of pieces)if(!p.held){
  // Remove subpixel corner rocking once a box has settled flat on the floor.
  axes(p);if(p.m&&!p.round&&Math.abs(p.y+p._ey-FLOOR)<1&&Math.abs(p.vx)<4&&Math.abs(p.vy)<20&&Math.abs(p.av)<.3&&Math.abs(Math.sin(2*p.a))<.02){p.a=Math.round(p.a/(Math.PI/2))*Math.PI/2;axes(p);p.y=FLOOR-p._ey;p.vx=p.vy=p.av=0;}
  if(p.m){p._floorJam=p.y+p._ey>FLOOR+2?(p._floorJam||0)+1:0;if(p._floorJam>=15)recoverFloor(pieces,p);}
  p.vx=clamp(p.vx,-900,900);p.vy=clamp(p.vy,-1000,1000);p.av=clamp(p.av,-16,16);if(p.m&&(p.y>FLOOR+100||!Number.isFinite(p.x+p.y+p.a))){p.x=400;p.y=100;p.vx=p.vy=p.av=p.a=0;}}
 return contacts;
}
