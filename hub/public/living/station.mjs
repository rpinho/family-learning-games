// Scenes for an older reader (the household's story file names who plays each role: hero, guide, small friend, grown-up): the Dinosaur-Train station at dusk, then the hedge maze at night.
// A grander, darker palette (still kind): long dusk light, lamps waking one by one, the night train arriving in a
// cloud of warm steam; then moonlight, fog between the hedges and fireflies. He reads the departures board to find
// the platform, and leads the way through a real maze (tap the path), where a friend's bad advice meets a sign.
import {THREE,at,paint,withSway,rng,clamp,lerp,smooth,easeInOut,easeOut,director,tween} from './engine.mjs';
import {sky,ridge,ground,grass,particles,glow,lampPost,tree,steamTrain,steam,board} from './world.mjs';
import {makePuppet} from './puppet.mjs';

export async function station(ctx){
 const {light,art,camera,post}=ctx;
 const scene=new THREE.Scene();
 // Dusk: the sun just behind the mountains, warm below, deep blue above.
 const L=light;L.uSunDir.value.set(-.45,.14,-1).normalize();L.uSunColor.value.set('#ff9d5c');L.uSunPower.value=.9;
 L.uSky.value.set('#5a5fa8');L.uGround.value.set('#3a2c30');L.uAmbient.value=.7;L.uFogColor.value.set('#a86a7e');L.uFogNear.value=30;L.uFogFar.value=240;L.uHazeHeight.value=.35;L.uLampColor.value.set('#ffa94d');
 const S=sky({top:'#0e1238',mid:'#43337a',horizon:'#ff8a4a',sunColor:'#ffab5e',sunDir:[-.45,.03,-1],stars:0,clouds:.85,sunSize:.024,glow:1.6,cloudColor:'#ffb48a',cloudShade:'#4a3a70'});scene.add(S);
 // Backlit mountains: dark, crisp silhouettes, paler with distance.
 scene.add(ridge(L,{z:-190,width:760,height:70,base:-6,seed:3,color:'#6a4a78',rough:.4,fog:.55}));
 scene.add(ridge(L,{z:-120,width:540,height:36,base:-4,seed:7,color:'#3e3060',rough:.6,trees:.25,fog:.4}));
 scene.add(ridge(L,{z:-72,width:380,height:15,base:-2,seed:11,color:'#231c38',rough:.8,trees:.55,fog:.25}));
 // Ferns and the valley floor; a far-off village's windows.
 scene.add(ground(L,{size:420,color:'#3f4f38',color2:'#6a6a44',noiseScale:.08,hills:2.2,seed:4}));
 const windows=particles({count:40,box:[[-120,60],[-1,3],[-110,-60]],color:'#ffcf7a',size:.9,swirl:0,additive:true,seed:21,opacity:0});scene.add(windows);
 // The track: rails and sleepers running off into the valley.
 const railM=paint(L,{color:'#6a6a70',color2:'#8a8a90',noise:.2,rim:.4,gloss:.5});
 for(const z of [-3.6,-2.8]){const r=new THREE.Mesh(new THREE.BoxGeometry(260,.08,.08),railM);r.position.set(-60,.12,z);scene.add(r);}
 const sl=new THREE.InstancedMesh(new THREE.BoxGeometry(.25,.1,1.6),paint(L,{color:'#4a3a2c',color2:'#6a543c',noise:.8,noiseScale:2}),220);
 for(let i=0;i<220;i++){sl.setMatrixAt(i,new THREE.Matrix4().makeTranslation(-190+i*1.2,.05,-3.2));}scene.add(sl);
 // The platform, the station house, the benches and the lamps.
 const stone=paint(L,{color:'#8a7f78',color2:'#a89a8a',noise:.8,noiseScale:1.4,rim:.2,top:.2});
 const plat=new THREE.Mesh(new THREE.BoxGeometry(30,.6,4.4),stone);plat.position.set(0,.3,.3);scene.add(plat);
 const edge=new THREE.Mesh(new THREE.BoxGeometry(30,.04,.25),paint(L,{color:'#d8c07a',noise:.3}));edge.position.set(0,.62,-1.75);scene.add(edge);
 const house=new THREE.Group();scene.add(house);house.position.set(9.5,.6,1.6);
 const wall=paint(L,{color:'#f4dcb4',color2:'#e0bf92',noise:.7,noiseScale:1.2,rim:.3});
 const hb=new THREE.Mesh(new THREE.BoxGeometry(5.5,2.8,2.6),wall);hb.position.y=1.4;house.add(hb);
 const roofM=paint(L,{color:'#a0452e',color2:'#7a3322',noise:.7,noiseScale:2,rim:.4});
 const roofG=new THREE.CylinderGeometry(.01,2.2,1.4,4,1);roofG.rotateY(Math.PI/4);const roof=new THREE.Mesh(roofG,roofM);roof.scale.set(1.8,1,.95);roof.position.y=3.5;house.add(roof);
 const glowWin=[];for(const x of [-1.95,1.95]){const w=new THREE.Mesh(new THREE.PlaneGeometry(.75,1.05),paint(L,{color:'#2a2020',emissive:'#000000',noise:0,rim:0}));w.position.set(x,1.35,1.31);house.add(w);glowWin.push(w);}
 
 const lamps=[];for(const x of [-10,-4.5,1.5,6.5]){const lp=lampPost(L,{h:2.8});lp.group.position.set(x,.6,-1.2);lp.group.rotation.y=-Math.PI/2;scene.add(lp.group);lamps.push(lp);}
 for(const x of [-9,-3]){const b=new THREE.Group();const wood=paint(L,{color:'#6a4a33',color2:'#8a6a4a',noise:.6,noiseScale:3});
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.8,.08,.45),wood);seat.position.y=.45;b.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(1.8,.4,.06),wood);back.position.set(0,.72,.22);b.add(back);
  for(const sx of [-.8,.8]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.45,.4),paint(L,{color:'#2a2a2a'}));leg.position.set(sx,.22,0);b.add(leg);}b.position.set(x,.6,2.2);scene.add(b);}
 // Trees beside the station; ferns in the foreground.
 for(const [x,z,s,h] of [[16,4,2.8,5],[-17,6,3.2,6],[22,-12,4,8],[-26,-10,4.5,9]])scene.add(at(tree(L,{h,crown:s,color:'#2f4a38',color2:'#5a6a3a',seed:x|0}),x,0,z));
 scene.add(grass(L,{count:2600,area:[[-40,40],[-12,-4.2]],h:.5,base:'#26361f',tip:'#6a7a3a',tip2:'#a0864a',seed:7}));
 scene.add(grass(L,{count:1400,area:[[-40,40],[3,16]],h:.55,base:'#26361f',tip:'#6a7a3a',tip2:'#a0864a',seed:8,avoid:(x,z)=>Math.abs(x)<16&&z<3.2}));
 const motes=particles({count:90,box:[[-14,14],[.8,4],[-3,4]],color:'#ffd9a0',size:.35,swirl:.5,additive:true,seed:3,opacity:.7});scene.add(motes);
 const flies=particles({count:50,box:[[-30,30],[.3,2.4],[-12,-4]],color:'#fff2a0',color2:'#c8ff9a',size:.55,swirl:1.2,additive:true,seed:17,opacity:0});scene.add(flies);
 // The departures board he reads.
 const dep=board(L,{lines:['1   FERN HOLLOW','2   MOONFERN MAZE','3   OLD QUARRY'],w:2.6,h:1.5,font:'700 54px Georgia, serif',px:640});
 const depG=new THREE.Group();depG.add(dep);const post1=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.2,8),paint(L,{color:'#3a3330'}));post1.position.set(-1.1,-1.1,-.02);depG.add(post1);
 const post2=post1.clone();post2.position.x=1.1;depG.add(post2);depG.position.set(9.5,2.55,2.95);depG.scale.setScalar(.9);post1.visible=post2.visible=false;scene.add(depG);
 // The train, waiting far away in the valley.
 const train=steamTrain(L,{wagons:2});train.lit=0;train.idle=false;train.group.position.set(-70,0,-3.2);scene.add(train.group);const puff=steam({count:60});scene.add(puff.points);
 // The friends on the platform.
 const R=ctx.cast.roles,P=async(id,h,kind,poses)=>{const a=art.actors[id];if(!a)return null;const pz={};for(const p of poses)if(a.poses[p])pz[p]=a.poses[p].url;const pu=await makePuppet(L,{poses:pz,height:h,kind,name:id});scene.add(pu.root);return pu;};
 const hero=await P(R.hero,1.55,'biped',['idle','cheer','kick']);hero.root.position.set(-.2,.6,1.0);
 const guide=await P(R.guide,1.45,'plush',['idle','happy']);guide&&guide.root.position.set(1.1,.6,.7);
 const small=await P(R.small,.8,'plush',['idle','ball']);small&&small.root.position.set(-1.3,.6,1.5);
 const dad=R.grownup?await P(R.grownup,1.95,'biped',['idle','cheer','kneel']):null;dad&&dad.root.position.set(2.5,.6,1.3);
 const people=[hero,guide,small,dad].filter(Boolean);
 let t=0,trainX=-70,trainV=0,lampsOn=0,dusk=0;
 const LAMPS=L.uLamps.value;
 function update(time,dt){
  t=time;S.userData.u.uTime.value=t;L.uTime.value=t;motes.userData.u.uTime.value=t;flies.userData.u.uTime.value=t;windows.userData.u.uTime.value=t;
  // Dusk deepens slowly: stars, village windows, fireflies.
  dusk=Math.min(1,dusk+dt/90);S.userData.u.uStars.value=.2+dusk*.8;windows.userData.u.uOpacity.value=.4+dusk*.6;flies.userData.u.uOpacity.value=.3+dusk*.7;
  lamps.forEach((lp,i)=>{LAMPS[i].copy(new THREE.Vector4(...lp.lampPos().toArray(),lp.on*2.2));});
  for(const w of glowWin)w.material.uniforms.uEmissive.value.set('#ffb35a').multiplyScalar(lampsOn*.9);
  trainX+=trainV*dt;train.group.position.x=trainX;train.roll(trainV*dt);
  if(trainV>.05||train.idle)puff.emit(train.chimneyTop(),trainV>.05?14:3,dt);puff.update(dt,[.6,0,.1]);
  LAMPS[5].set(...train.engine.localToWorld(new THREE.Vector3(2.2,1.6,0)).toArray(),train.lit*2.5);
  for(const p of people)p.update(t,dt,camera);
 }
 // Beats (the host plays narration and waits for his taps).
 async function lampsWake(host){for(let i=lamps.length-1;i>=0;i--){await host.wait(650);host.sfx('lamp');const lp=lamps[i];const t0=performance.now();await new Promise(r=>{const f=()=>{const k=clamp((performance.now()-t0)/700);lp.set(easeOut(k)*(1+.15*Math.sin(k*40)*(1-k)));k<1?requestAnimationFrame(f):r();};f();});lampsOn=(lamps.length-i)/lamps.length;}}
 async function trainArrives(host){train.lit=1;train.setLight(1);trainV=9;host.sfx('whistle');
  await new Promise(r=>{const f=()=>{const d=0-trainX;trainV=Math.max(.0,Math.min(9,d*.45));if(d<.05){trainV=0;train.idle=true;r();}else requestAnimationFrame(f);};f();});host.sfx('hiss');}
 async function trainLeaves(){trainV=.5;await new Promise(r=>{const f=()=>{trainV=Math.min(8,trainV+.08);trainX>30?r():requestAnimationFrame(f);};f();});}
 return {scene,update,people,hero,guide,small,dad,dep,depG,train,lampsWake,trainArrives,trainLeaves,
  
  boardAnswer:1,
  shots:{
   sky:{pos:[-2,8,16],look:[-40,26,-160],fov:44},
   crane:{pos:[1.5,2.3,9.5],look:[-.3,1.6,0],fov:40},
   two:{pos:[.6,1.75,5.8],look:[.2,1.4,.8],fov:38},
   board:{pos:[8.8,2.3,6.6],look:[9.4,2.45,2.95],fov:34},
   low:{pos:[-1.6,1.05,-1.25],look:[-24,1.4,-3.6],fov:38},
   wide:{pos:[5,3.2,12],look:[1,1.4,-2],fov:42},
   depart:{pos:[-6,2.2,7],look:[20,1.4,-3],fov:40}}};
}

// ---------------- the hedge maze at night ----------------
// A perfect maze (one path between any two cells) from a seeded depth-first carve, like Maze Garden's.
export function carveMaze(n,seed=7){
 const r=rng(seed),cells=Array.from({length:n*n},()=>({n:1,s:1,e:1,w:1,seen:0}));const at=(x,y)=>cells[y*n+x];
 const stack=[[0,n-1]];at(0,n-1).seen=1;
 while(stack.length){const [x,y]=stack.at(-1);const opts=[[0,-1,'n','s'],[0,1,'s','n'],[1,0,'e','w'],[-1,0,'w','e']].filter(([dx,dy])=>x+dx>=0&&y+dy>=0&&x+dx<n&&y+dy<n&&!at(x+dx,y+dy).seen);
  if(!opts.length){stack.pop();continue;}const [dx,dy,a,b]=opts[Math.floor(r()*opts.length)];at(x,y)[a]=0;at(x+dx,y+dy)[b]=0;at(x+dx,y+dy).seen=1;stack.push([x+dx,y+dy]);}
 return {n,cells,at};
}
export function mazePath(m,from,to){const {n,at}=m,key=([x,y])=>y*n+x,prev=new Map([[key(from),null]]),q=[from];
 while(q.length){const c=q.shift();if(c[0]===to[0]&&c[1]===to[1])break;const [x,y]=c,cell=at(x,y);
  for(const [dx,dy,wall] of [[0,-1,'n'],[0,1,'s'],[1,0,'e'],[-1,0,'w']]){if(cell[wall])continue;const nx=[x+dx,y+dy];if(!prev.has(key(nx))){prev.set(key(nx),c);q.push(nx);}}}
 const out=[];let c=to;if(!prev.has(key(to)))return [];while(c){out.unshift(c);c=prev.get(key(c));}return out;}
export async function maze(ctx){
 const {light,art,camera}=ctx;const L=light;
 const scene=new THREE.Scene();
 L.uSunDir.value.set(-.35,.6,-.7).normalize();L.uSunColor.value.set('#c4d2ff');L.uSunPower.value=.8;L.uSky.value.set('#35428a');L.uGround.value.set('#141a28');L.uAmbient.value=.5;
 L.uFogColor.value.set('#1c2350');L.uFogNear.value=14;L.uFogFar.value=64;L.uHazeHeight.value=.25;L.uLampColor.value.set('#ffae52');
 const S=sky({top:'#070a22',mid:'#1a2458',horizon:'#39468a',sunColor:'#e8eeff',sunDir:[-.35,.6,-.7],stars:1,clouds:.4,sunSize:.02,glow:.7,moon:1,cloudColor:'#9aa6d8',cloudShade:'#222a58'});scene.add(S);
 scene.add(ridge(L,{z:-90,width:400,height:22,base:-3,seed:5,color:'#1c2448',rough:.6,trees:.5}));
 const N=7,C=2.4,m=carveMaze(N,20260927);
 // Goal at the far corner; a junction on the way whose side branch is a dead end (for the NO! moment).
 const start=[0,N-1],goal=[N-1,0],route=mazePath(m,start,goal);
 const deg=([x,y])=>['n','s','e','w'].filter(w=>!m.at(x,y)[w]).length;
 let fork=null,dead=null;for(let i=2;i<route.length-2&&!fork;i++){const c=route[i];if(deg(c)>=3){const [x,y]=c,nextOnRoute=route[i+1],prevOnRoute=route[i-1];
  for(const [dx,dy,w] of [[0,-1,'n'],[0,1,'s'],[1,0,'e'],[-1,0,'w']]){if(m.at(x,y)[w])continue;const nb=[x+dx,y+dy];if((nb[0]===nextOnRoute[0]&&nb[1]===nextOnRoute[1])||(nb[0]===prevOnRoute[0]&&nb[1]===prevOnRoute[1]))continue;fork=c;dead=nb;break;}}}
 const W=(x,y)=>new THREE.Vector3((x-(N-1)/2)*C,0,(y-(N-1)/2)*C);
 scene.add(ground(L,{size:160,color:'#243226',color2:'#3a4a30',noiseScale:.15,seed:9}));
 const pathM=paint(L,{color:'#7c7f86',color2:'#9a9ca2',noise:.9,noiseScale:2.2,rim:0,top:0,ao:0});const pathG=new THREE.Mesh(new THREE.PlaneGeometry(N*C,N*C),pathM);pathG.rotation.x=-Math.PI/2;pathG.position.y=.01;scene.add(pathG);
 // Hedges: instanced blocks with leafy colour, lighter tops and a soft dark foot.
 const hedgeM=paint(L,{color:'#17331d',color2:'#56883f',noise:1,noiseScale:3.4,rim:.7,top:.9,ao:.65});
 const walls=[];const H=1.9,T=.55;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const c=m.at(x,y),p=W(x,y);
  if(c.n)walls.push([p.x,p.z-C/2,C+T,T]);if(c.w)walls.push([p.x-C/2,p.z,T,C+T]);
  if(y===N-1&&c.s&&!(x===start[0]))walls.push([p.x,p.z+C/2,C+T,T]);if(x===N-1&&c.e)walls.push([p.x+C/2,p.z,T,C+T]);}
 const hg=withSway(new THREE.BoxGeometry(1,1,1,2,3,2),.02);const hedges=new THREE.InstancedMesh(hg,hedgeM,walls.length);
 walls.forEach(([x,z,w,d],i)=>hedges.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(x,H/2,z),new THREE.Quaternion(),new THREE.Vector3(w,H,d))));scene.add(hedges);
 // Leafy hedges: many small clumps along the top edge and bumps on the sides, so they read as clipped hedges.
 const tops=[],bumps=[];const r=rng(4);
 for(const [x,z,w,d] of walls){const len=Math.max(w,d),along=w>d,k=Math.max(2,Math.round(len/.32));
  for(let i=0;i<k;i++){const f=(i+.5)/k-.5;const px=x+(along?f*w:0),pz=z+(along?0:f*d);tops.push([px+(r()-.5)*.08,pz+(r()-.5)*.08]);
   if(i%2===0)for(const sgn of [-1,1])bumps.push([px+(along?0:sgn*T*.5),.35+r()*(H-.6),pz+(along?sgn*T*.5:0)]);}}
 const blob=new THREE.InstancedMesh(withSway(new THREE.IcosahedronGeometry(.24,1),.04),hedgeM,tops.length);
 tops.forEach(([x,z],i)=>blob.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(x,H-.04+r()*.1,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(r()*3,r()*3,0)),new THREE.Vector3(1+r()*.35,.8+r()*.4,1+r()*.35))));scene.add(blob);
 // Lanterns: at the entrance, at the fork, at the goal.
 const lanterns=[[start,-.9],[route[Math.floor(route.length*.3)],.9],[fork,.9],[route[Math.floor(route.length*.75)],-.9],[goal,.9]].map(([c,off],i)=>{const lp=lampPost(L,{h:2.2});const p=W(...c);lp.group.position.set(p.x+off*.75,0,p.z+.75);lp.set(1);scene.add(lp.group);return lp;});
 // The sign at the dead end ("DEAD END" in small letters: he has to read it).
 const sign=board(L,{lines:['DEAD','END'],w:.9,h:.7,bg:'#5a3a22',fg:'#f6e8c8',font:'700 110px Georgia, serif',px:360});
 const fp=W(...fork),dp=W(...dead),dir=new THREE.Vector3().subVectors(dp,fp).normalize();
 const signG=new THREE.Group();signG.add(sign);const sp=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.1,6),paint(L,{color:'#4a3322'}));sp.position.y=-.6;signG.add(sp);
 signG.position.copy(fp).addScaledVector(dir,C*.45).add(new THREE.Vector3(dir.z*.7,1.25,-dir.x*.7));scene.add(signG);
 // The goal: the torn map piece glowing on a stone.
 const gp=W(...goal);const gOpen=[[0,-1,'n'],[0,1,'s'],[1,0,'e'],[-1,0,'w']].find(([,,w])=>!m.at(...goal)[w])||[0,1];const gIn=new THREE.Vector3(gOpen[0],0,gOpen[1]);const stoneM=paint(L,{color:'#7a7a86',color2:'#9a98a8',noise:.8,noiseScale:2,rim:.4});
 const pp=gp.clone().addScaledVector(gIn,-.75);const ped=new THREE.Mesh(new THREE.CylinderGeometry(.35,.45,.7,10),stoneM);ped.position.set(pp.x,.35,pp.z);scene.add(ped);
 const mapTex=(()=>{const c=document.createElement('canvas');c.width=256;c.height=192;const g=c.getContext('2d');g.fillStyle='#e9d6a8';g.beginPath();g.moveTo(10,20);g.lineTo(240,8);g.lineTo(246,110);g.lineTo(200,130);g.lineTo(230,180);g.lineTo(18,184);g.lineTo(30,100);g.closePath();g.fill();
  g.strokeStyle='#7a4a22';g.lineWidth=5;g.setLineDash([12,10]);g.beginPath();g.moveTo(40,160);g.bezierCurveTo(90,60,150,170,215,40);g.stroke();g.setLineDash([]);g.fillStyle='#a8322a';g.font='bold 40px Georgia';g.fillText('✕',196,56);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
 const piece=new THREE.Mesh(new THREE.PlaneGeometry(.7,.52),new THREE.MeshBasicMaterial({map:mapTex,transparent:true,side:THREE.DoubleSide}));piece.position.set(pp.x,.95,pp.z);scene.add(piece);
 const pieceGlow=glow({color:'#fff0b0',size:2.2,opacity:.8});pieceGlow.position.copy(piece.position);scene.add(pieceGlow);
 const sparkle=particles({count:40,box:[[pp.x-.6,pp.x+.6],[.6,2],[pp.z-.6,pp.z+.6]],color:'#fff6c0',size:.3,swirl:.3,rise:.25,seed:3,opacity:.9});scene.add(sparkle);
 const flies=particles({count:90,box:[[-10,10],[.3,2.6],[-10,10]],color:'#e8ff9a',color2:'#fff0a0',size:.5,swirl:1.1,seed:31});scene.add(flies);
 const mist=particles({count:70,box:[[-9,9],[.1,.6],[-9,9]],color:'#6a78b8',size:5,swirl:.4,additive:false,seed:41,opacity:.12});scene.add(mist);
 // Friends.
 const R=ctx.cast.roles,P=async(id,h,kind,poses)=>{const a=art.actors[id];if(!a)return null;const pz={};for(const p of poses)if(a.poses[p])pz[p]=a.poses[p].url;const pu=await makePuppet(L,{poses:pz,height:h,kind,name:id});scene.add(pu.root);return pu;};
 const hero=await P(R.hero,1.35,'biped',['idle','cheer']);const guide=await P(R.guide,1.2,'plush',['idle','happy']);const small=await P(R.small,.7,'plush',['idle','ball']);
 const s0=W(...start);hero.root.position.set(s0.x,0,s0.z+C*.9);guide&&guide.root.position.set(s0.x+.7,0,s0.z+C*1.4);small&&small.root.position.set(s0.x-.6,0,s0.z+C*1.2);
 const people=[hero,guide,small].filter(Boolean);
 // Followers walk where he walked (a little behind).
 const trail=[];function follow(dt){const p=hero.root.position;if(!trail.length||trail.at(-1).distanceTo(p)>.35)trail.push(p.clone());if(trail.length>60)trail.shift();
  [[small,5],[guide,10]].forEach(([f,lag])=>{if(!f)return;const tgt=trail[Math.max(0,trail.length-1-lag)];if(!tgt)return;const d=f.root.position.distanceTo(tgt);if(d>.4&&!f._busy){f._busy=true;f.walkTo([tgt],1.5).then(()=>{f._busy=false;});}});}
 const cellOf=v=>[clamp(Math.round(v.x/C+(N-1)/2),0,N-1),clamp(Math.round(v.z/C+(N-1)/2),0,N-1)];
 let t=0;const camTarget=new THREE.Vector3(),camPos=new THREE.Vector3();
 function update(time,dt){t=time;S.userData.u.uTime.value=t;L.uTime.value=t;for(const p of [flies,sparkle,mist])p.userData.u.uTime.value=t;
  const LAMPS=L.uLamps.value;lanterns.forEach((lp,i)=>LAMPS[i].set(...lp.lampPos().toArray(),1.6));LAMPS[5].set(gp.x,1.2,gp.z,found?3:1.4);
  piece.rotation.y=Math.atan2(camera.position.x-piece.position.x,camera.position.z-piece.position.z)+Math.sin(t*.8)*.25;piece.position.y=.95+Math.sin(t*1.6)*.05;pieceGlow.material.opacity=.6+.25*Math.sin(t*2.3);
  follow(dt);for(const p of people)p.update(t,dt,camera);}
 let found=false;
 // Follow camera: above and behind, a little ahead of where he walks.
 function followCam(k=1){const p=hero.root.position;camTarget.lerp(new THREE.Vector3(p.x,.6,p.z-.8),.06*k);camPos.lerp(new THREE.Vector3(p.x+.4,5.6,p.z+5.2),.05*k);camera.position.copy(camPos);camera.lookAt(camTarget);}
 function snapCam(){const p=hero.root.position;camTarget.set(p.x,.6,p.z-.8);camPos.set(p.x+.4,5.6,p.z+5.2);followCam(0);}
 return {scene,update,people,hero,guide,small,maze:m,N,C,W,start,goal,fork,dead,route,cellOf,signG,piece,followCam,snapCam,setFound(v){found=v;},
  pathTo(cell){return mazePath(m,cellOf(hero.root.position),cell).map(c=>W(...c));},
  shots:{over:{pos:[0,26,18],look:[0,0,-2],fov:42},overEnd:{pos:[gp.x*.5,14,gp.z+12],look:[gp.x*.6,0,gp.z],fov:40},goal:{pos:[gp.x+gIn.x*C*1.2+.2,2.3,gp.z+gIn.z*C*1.2+.2],look:[pp.x,.9,pp.z],fov:40},rise:{pos:[gp.x+gIn.x*C*2.5,11,gp.z+gIn.z*C*2.5+6],look:[gp.x,0,gp.z],fov:44}}};
}
