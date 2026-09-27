// Scenes for an older reader (the household's story file names who plays each role: hero, guide, small friend, grown-up): the Dinosaur-Train station at dusk, then the hedge maze at night.
// A grander, darker palette (still kind): long dusk light, lamps waking one by one, the night train arriving in a
// cloud of warm steam; then moonlight, fog between the hedges and fireflies. He reads the departures board to find
// the platform, and leads the way through a real maze (tap the path), where a friend's bad advice meets a sign.
import {THREE,at,paint,withSway,rng,clamp,lerp,smooth,easeInOut,easeOut,director,tween} from './engine.mjs';
import {sky,ridge,ground,grass,particles,glow,lampPost,tree,steamTrain,steam,board} from './world.mjs';
import {makePuppet} from './puppet.mjs';
import {makeToy,toysAvailable} from './toy.mjs';

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
 // The words on it are the story's (decodable words he can read); the flat, readable copy is the overlay's.
 const rows=(ctx.story.board?.options||['cat','can','cap']).map((w,i)=>`${i+1}   ${String(w).toUpperCase()}`);
 const dep=board(L,{lines:rows,w:2.6,h:1.5,font:'700 64px Georgia, serif',px:640});
 const depG=new THREE.Group();depG.add(dep);const post1=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.2,8),paint(L,{color:'#3a3330'}));post1.position.set(-1.1,-1.1,-.02);depG.add(post1);
 const post2=post1.clone();post2.position.x=1.1;depG.add(post2);depG.position.set(9.5,2.55,2.95);depG.scale.setScalar(.9);post1.visible=post2.visible=false;scene.add(depG);
 // The train, waiting far away in the valley.
 const train=steamTrain(L,{wagons:2});train.lit=0;train.idle=false;train.group.position.set(-70,0,-3.2);scene.add(train.group);const puff=steam({count:60});scene.add(puff.points);
 // The friends on the platform.
 const R=ctx.cast.roles,toys=await toysAvailable(),P=async(id,h,kind,poses)=>{
  // A 3D model of the toy when the household has one; otherwise its painted picture as a 2.5D puppet.
  if(id&&toys.has(id)&&!ctx.puppetsOnly){try{const t=await makeToy(L,{id,height:h*1.12,name:id});scene.add(t.root);return t;}catch(e){console.warn('toy',id,e);}}
  const a=art.actors[id];if(!a)return null;const pz={};for(const p of poses)if(a.poses[p])pz[p]=a.poses[p].url;const pu=await makePuppet(L,{poses:pz,height:h,kind,name:id});scene.add(pu.root);return pu;};
 const hero=await P(R.hero,1.55,'biped',['idle','cheer','kick']);
 const guide=await P(R.guide,1.45,'plush',['idle','happy']);
 const small=await P(R.small,.8,'plush',['idle','ball']);
 const dad=R.grownup?await P(R.grownup,1.95,'biped',['idle','cheer','kneel']):null;
 const mom=R.grownup2?await P(R.grownup2,1.85,'biped',['idle','cheer','kneel','read']):null;
 const people=[hero,guide,small,dad,mom].filter(Boolean);
 // Where everyone stands: in a line along the platform on a wide screen; on a tall one, the friends in front and
 // the grown-ups a step behind (a high camera sees both rows without anyone hiding anyone).
 const FORM={wide:{hero:[-.2,1.0],guide:[1.1,.7],small:[-1.3,1.5],dad:[2.5,1.3],mom:[3.7,1.7]},
  tall:{hero:[0,1.95],guide:[1.1,1.75],small:[-.95,2.1],dad:[-.55,-1.05],mom:[.6,-1.2]}};
 function arrange(tall){const f=FORM[tall?'tall':'wide'];for(const [k,p] of [['hero',hero],['guide',guide],['small',small],['dad',dad],['mom',mom]])if(p){p.stop?.();p.root.position.set(f[k][0],.6,f[k][1]);}}
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
 return {scene,update,people,hero,guide,small,dad,mom,dep,depG,train,lampsWake,trainArrives,trainLeaves,
  
  arrange,
  // keep: what must stay in frame; tall: the same shot composed for an upright phone.
  shots:{
   sky:{pos:[-2,8,16],look:[-40,26,-160],fov:44},
   crane:{pos:[1.5,2.3,9.5],look:[-.3,1.6,0],fov:40,keep:['people'],tall:{pos:[.3,5.2,10.5],look:[.1,.9,.6],fov:40}},
   two:{pos:[.6,1.75,5.8],look:[.2,1.4,.8],fov:38,keep:['hero','guide','small'],tall:{pos:[.1,2.7,7.2],look:[.05,1.05,1.9],fov:38}},
   board:{pos:[8.8,2.3,6.6],look:[9.4,2.45,2.95],fov:34,keep:['depG'],tall:{pos:[9.4,1.7,7.4],look:[9.45,2.2,2.95],fov:34}},
   low:{pos:[-1.6,1.05,-1.25],look:[-24,1.4,-3.6],fov:38},
   wide:{pos:[5,3.2,12],look:[1,1.4,-2],fov:42,keep:['people'],tall:{pos:[.3,5.6,10],look:[.05,.9,.4],fov:42}},
   aboard:{pos:[-2.5,2.4,8.5],look:[.5,1.3,-2.6],fov:40,keep:['train']},
   depart:{pos:[-6,2.2,7],look:[20,1.4,-3],fov:40}}};
}

// ---------------- the night ride: across the valley to a junction of three tracks ----------------
// The train crosses the sleeping valley under the stars; at a junction three tracks fan out, each with a sign. The
// words on the signs are the overlay's (flat and readable); the posts carry blank plates.
export async function ride(ctx){
 const {light,art,camera}=ctx;const L=light;const scene=new THREE.Scene();
 L.uSunDir.value.set(-.3,.55,-.8).normalize();L.uSunColor.value.set('#c8d4ff');L.uSunPower.value=.75;L.uSky.value.set('#3a4690');L.uGround.value.set('#161c2c');L.uAmbient.value=.6;
 L.uFogColor.value.set('#262d5c');L.uFogNear.value=35;L.uFogFar.value=200;L.uHazeHeight.value=.3;L.uLampColor.value.set('#ffae52');
 const S=sky({top:'#070a22',mid:'#1a2458',horizon:'#4a4f94',sunColor:'#e8eeff',sunDir:[-.3,.55,-.8],stars:1,clouds:.35,sunSize:.02,glow:.7,moon:1,cloudColor:'#9aa6d8',cloudShade:'#222a58'});scene.add(S);
 scene.add(ridge(L,{z:-170,width:760,height:60,base:-6,seed:3,color:'#2a2f66',rough:.4,fog:.5}));
 scene.add(ridge(L,{z:-95,width:520,height:24,base:-3,seed:8,color:'#1c2448',rough:.6,trees:.5,fog:.3}));
 scene.add(ground(L,{size:520,color:'#1f2c22',color2:'#34402c',noiseScale:.08,hills:1.2,seed:5}));
 // A silver lake far off, catching the moon.
 const lake=new THREE.Mesh(new THREE.CircleGeometry(1,48),paint(L,{color:'#34448a',color2:'#8f9fe0',noise:.6,noiseScale:.2,rim:0,top:0,ao:0,gloss:1.2,emissive:'#0c1230'}));lake.rotation.x=-Math.PI/2;lake.scale.set(40,18,1);lake.position.set(-30,.03,-48);scene.add(lake);
 for(const [x,z,h,c] of [[-60,-18,7,4],[-35,-22,6,3.4],[-12,-16,8,4.4],[18,-24,7,4],[34,14,6,3.6],[-48,16,7,4]])scene.add(at(tree(L,{h,crown:c,color:'#1f3a2a',color2:'#3a5a3a',seed:x&255}),x,0,z));
 scene.add(grass(L,{count:2200,area:[[-90,60],[-14,-2]],h:.45,base:'#1d2a1a',tip:'#3e5a34',tip2:'#6a6a44',seed:9}));
 const flies=particles({count:70,box:[[-60,40],[.3,2.4],[-12,12]],color:'#fff2a0',color2:'#c8ff9a',size:.5,swirl:1.2,additive:true,seed:23,opacity:.9});scene.add(flies);
 // Rails: the main line, then three tracks fanning out from the junction.
 const railM=paint(L,{color:'#6a6a70',color2:'#8a8a90',noise:.2,rim:.4,gloss:.5}),sleeperM=paint(L,{color:'#3a2e24',color2:'#5a4634',noise:.8,noiseScale:2});
 const JX=6,BR=[-9,0,9],LEN=40;
 function track(x0,z0,x1,z1){const g=new THREE.Group(),dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz),ang=-Math.atan2(dz,dx);
  for(const off of [-.4,.4]){const r=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.08),railM);r.position.set(len/2,.12,off);g.add(r);}
  const n=Math.floor(len/1.2),sl=new THREE.InstancedMesh(new THREE.BoxGeometry(.25,.1,1.6),sleeperM,n);for(let i=0;i<n;i++)sl.setMatrixAt(i,new THREE.Matrix4().makeTranslation(.6+i*1.2,.05,0));g.add(sl);
  g.position.set(x0,0,z0);g.rotation.y=ang;scene.add(g);return g;}
 track(-160,0,JX,0);const branches=BR.map(z=>({end:new THREE.Vector3(JX+LEN,0,z*3.2)}));for(const b of branches)track(JX,0,b.end.x,b.end.z);
 // The signs: one at the head of each track, a little to its left, facing the train.
 const postM=paint(L,{color:'#4a3322',color2:'#6a4a30',noise:.6}),plateM=paint(L,{color:'#f2e2bc',color2:'#e0cc9a',noise:.3,rim:.3,emissive:'#2a2418'});
 const signs=branches.map(b=>{const d=b.end.clone().sub(new THREE.Vector3(JX,0,0)).normalize(),p=new THREE.Vector3(JX,0,0).addScaledVector(d,8.5);p.z-=1.25;
  const g=new THREE.Group();const post=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,2.1,8),postM);post.position.y=1.05;g.add(post);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.12,.62,1.25),plateM);plate.position.y=2.05;g.add(plate);g.position.copy(p);scene.add(g);
  const lamp=lampPost(L,{h:2.4});lamp.group.position.set(p.x-.5,0,p.z-.9);lamp.set(1);scene.add(lamp.group);
  return {group:g,top:()=>g.localToWorld(new THREE.Vector3(0,2.45,0)),lamp};});
 // The train, with everyone aboard (friends in the wagons, the conductor at the front of the first one).
 const train=steamTrain(L,{wagons:2});train.setLight(1);scene.add(train.group);const puff=steam({count:70});scene.add(puff.points);
 const R=ctx.cast.roles,toys=await toysAvailable(),P=async(id,h,kind,poses)=>{
  if(id&&toys.has(id)&&!ctx.puppetsOnly){try{const t=await makeToy(L,{id,height:h*1.12,name:id});scene.add(t.root);return t;}catch(e){console.warn('toy',id,e);}}
  const a=art.actors[id];if(!a)return null;const pz={};for(const p of poses)if(a.poses[p])pz[p]=a.poses[p].url;const pu=await makePuppet(L,{poses:pz,height:h,kind,name:id});scene.add(pu.root);return pu;};
 const hero=await P(R.hero,1.0,'biped',['idle','cheer']),guide=await P(R.guide,.9,'plush',['idle','happy']),small=await P(R.small,.55,'plush',['idle','ball']);
 const riders=[[hero,0,.45],[small,0,-.3],[guide,1,0]];const people=[hero,guide,small].filter(Boolean);
 let x=-70,z=0,heading=0,v=0,target=-4.5,branch=null,t=0;
 function pose(){train.group.position.set(x,0,z);train.group.rotation.y=heading;
  for(const [p,car,off] of riders){if(!p)continue;const w=train.cars[car].localToWorld(new THREE.Vector3(off,.7,0));p.root.position.copy(w);}}
 function update(time,dt){t=time;S.userData.u.uTime.value=t;L.uTime.value=t;flies.userData.u.uTime.value=t;
  const LAMPS=L.uLamps.value;signs.forEach((s,i)=>LAMPS[i].set(...s.lamp.lampPos().toArray(),1.8));LAMPS[5].set(...train.engine.localToWorld(new THREE.Vector3(2.2,1.6,0)).toArray(),2.4);
  // Along the main line to the junction, then (once he has chosen) along the chosen branch.
  if(branch==null){const d=target-x;v=Math.min(v+dt*2.2,Math.max(0,Math.min(8,d*.55)));x+=v*dt;train.roll(v*dt);}
  else{const b=branches[branch],dx=b.end.x-JX,dz=b.end.z,len=Math.hypot(dx,dz);v=Math.min(9,v+dt*1.8);
   if(x<JX){x+=v*dt;}else{x+=v*dt*dx/len;z+=v*dt*dz/len;const want=-Math.atan2(dz,dx);heading+=(want-heading)*Math.min(1,dt*3);}train.roll(v*dt);}
  pose();if(v>.05)puff.emit(train.chimneyTop(),v>.5?14:4,dt);puff.update(dt,[-.6,0,0]);
  for(const p of people)p.update(t,dt,camera);}
 pose();
 return {scene,update,people,hero,guide,small,train:train.group,engine:train.engine,signs:signs.map(s=>s.group),signTops:signs.map(s=>s.top),
  arrived:()=>new Promise(r=>{const f=()=>Math.abs(target-x)<.05||v<.02&&x>target-.5?r():requestAnimationFrame(f);requestAnimationFrame(f);}),
  go(i){branch=i;v=Math.max(v,.5);},
  // The camera rides beside the train (a travelling shot) until the junction.
  trackCam(){const e=new THREE.Vector3(x,0,z);return {pos:[e.x-3.5,3.1,e.z+9.5],look:[e.x+3,1.3,e.z-.5],fov:40,raw:true};},
  shots:{valley:{pos:[-95,9,30],look:[-60,1,-10],fov:44},junction:{pos:[-7.5,3.4,5.2],look:[12,1.6,-1.2],fov:40,keep:['signs','engine'],tall:{pos:[-9,5.2,1.2],look:[12,1.4,-1.4],fov:40}},
   away:{pos:[-4,4.5,12],look:[24,1.4,0],fov:42}}};
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
 // The sign at the dead end: a plain plate here; its word (a decodable word he reads, e.g. NOT) is the overlay's.
 const sign=board(L,{lines:[String(ctx.story.maze?.sign||'not').toUpperCase()],w:.9,h:.55,bg:'#5a3a22',fg:'#f6e8c8',font:'700 150px Georgia, serif',px:360});
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
 const R=ctx.cast.roles,toys=await toysAvailable(),P=async(id,h,kind,poses)=>{
  // A 3D model of the toy when the household has one; otherwise its painted picture as a 2.5D puppet.
  if(id&&toys.has(id)&&!ctx.puppetsOnly){try{const t=await makeToy(L,{id,height:h*1.12,name:id});scene.add(t.root);return t;}catch(e){console.warn('toy',id,e);}}
  const a=art.actors[id];if(!a)return null;const pz={};for(const p of poses)if(a.poses[p])pz[p]=a.poses[p].url;const pu=await makePuppet(L,{poses:pz,height:h,kind,name:id});scene.add(pu.root);return pu;};
 const hero=await P(R.hero,1.35,'biped',['idle','cheer']);const guide=await P(R.guide,1.2,'plush',['idle','happy']);const small=await P(R.small,.7,'plush',['idle','ball']);
 // He starts just inside the entrance; his friends right behind him (in the entrance porch).
 const s0=W(...start);hero.root.position.set(s0.x,0,s0.z+.2);small&&small.root.position.set(s0.x-.25,0,s0.z+1.0);guide&&guide.root.position.set(s0.x+.25,0,s0.z+1.8);
 const people=[hero,guide,small].filter(Boolean);
 // ---- he walks where he is steered, and only while he is steered (no auto-run) ----
 // Movement keeps to the paths: in maze-cell units, he may move along a row or a column; a turn slides him onto the
 // middle of the path first (so a slightly-off drag still turns the corner); hedges stop him.
 const R0=.34/C,SPEED=2.1;let want=null,moving=false;
 const cellAt=(i,j)=>{if(i>=0&&j>=0&&i<N&&j<N)return m.at(i,j);
  // The entrance porch just outside the start cell.
  if(j===N&&i===start[0])return {n:0,s:1,e:1,w:1};return null;};
 const open=(i,j,dir)=>{const c=cellAt(i,j);if(!c)return false;if(dir==='s'&&j===N-1&&i===start[0])return true;return !c[dir];};
 const toCell=v=>({u:v.x/C+(N-1)/2,v:v.z/C+(N-1)/2});
 function stepAxis(pos,axis,sign,dist){
  // Move along x (axis 'u') or z ('v') by up to dist cells; stop short of a hedge.
  let {u,v}=toCell(pos);const i=Math.round(u),j=Math.round(v);
  if(axis==='u'){const dir=sign>0?'e':'w';const lim=open(i,j,dir)?(sign>0?i+1:i-1):(sign>0?i+.5-R0:i-.5+R0);
   // Past the cell centre toward an open side: may continue into the next cell (recomputed next frame).
   const nu=sign>0?Math.min(u+dist,Math.max(u,lim)):Math.max(u-dist,Math.min(u,lim));const moved=Math.abs(nu-u);u=nu;pos.x=(u-(N-1)/2)*C;return moved;}
  else{const dir=sign>0?'s':'n';const lim=open(i,j,dir)?(sign>0?j+1:j-1):(sign>0?j+.5-R0:j-.5+R0);
   const nv=sign>0?Math.min(v+dist,Math.max(v,lim)):Math.max(v-dist,Math.min(v,lim));const moved=Math.abs(nv-v);v=nv;pos.z=(v-(N-1)/2)*C;return moved;}
 }
 function drive(dt){
  const p=hero.root.position;if(!want){if(moving){moving=false;hero.stop();}return;}
  const next=p.clone();let dist=SPEED*dt/C;
  const axes=Math.abs(want.x)>=Math.abs(want.z)?[['u',Math.sign(want.x),Math.abs(want.x)],['v',Math.sign(want.z),Math.abs(want.z)]]:[['v',Math.sign(want.z),Math.abs(want.z)],['u',Math.sign(want.x),Math.abs(want.x)]];
  let went=0;
  for(const [axis,sign,mag] of axes){if(mag<.25||went>1e-4)continue;
   const c=toCell(next),off=axis==='u'?c.v-Math.round(c.v):c.u-Math.round(c.u);
   const i=Math.round(c.u),j=Math.round(c.v),dir=axis==='u'?(sign>0?'e':'w'):(sign>0?'s':'n');
   const along=axis==='u'?c.u-i:c.v-j,canGo=open(i,j,dir)||(sign>0?along<.5-R0-1e-3:along>-.5+R0+1e-3);
   if(!canGo)continue;
   // Off the middle of the path: slide onto it first (this is what makes corners easy).
   if(Math.abs(off)>.04){const slide=Math.min(Math.abs(off),dist);if(axis==='u'){next.z-=Math.sign(off)*slide*C;}else{next.x-=Math.sign(off)*slide*C;}went+=slide;dist-=slide;if(dist<=0)break;}
   went+=stepAxis(next,axis,sign,dist);}
  if(went>1e-4){moving=true;hero.walkTo([[next.x,0,next.z]],SPEED*1.05);}else if(moving){moving=false;hero.stop();}
 }
 // ---- follow the leader: each friend walks to a point on his trail a little behind him, faster when further ----
 const trail=[hero.root.position.clone()];
 function follow(){const p=hero.root.position;if(trail.at(-1).distanceTo(p)>.12)trail.push(p.clone());if(trail.length>200)trail.shift();
  [[small,.8],[guide,1.55]].forEach(([f,gap])=>{if(!f||f._lead)return;
   // The trail point `gap` metres behind him (walking back along what he walked).
   let need=gap,tgt=trail[0];for(let k=trail.length-1;k>0;k--){const d=trail[k].distanceTo(trail[k-1]);if(need<=d){tgt=trail[k].clone().lerp(trail[k-1],need/d);break;}need-=d;}
   if(trail.length===1)tgt=trail[0];
   const d=Math.hypot(f.root.position.x-tgt.x,f.root.position.z-tgt.z);
   if(d>.12){const v=Math.min(6.5,SPEED*(.9+Math.max(0,d-.2)*1.6));f.walkTo([[tgt.x,0,tgt.z]],v);}else f.stop?.();});}
 const cellOf=v=>[clamp(Math.round(v.x/C+(N-1)/2),0,N-1),clamp(Math.round(v.z/C+(N-1)/2),0,N-1)];
 let t=0;const camTarget=new THREE.Vector3(),camPos=new THREE.Vector3();let dt0=0;
 function update(time,dt){t=time;S.userData.u.uTime.value=t;L.uTime.value=t;for(const p of [flies,sparkle,mist])p.userData.u.uTime.value=t;
  const LAMPS=L.uLamps.value;lanterns.forEach((lp,i)=>LAMPS[i].set(...lp.lampPos().toArray(),1.6));LAMPS[5].set(gp.x,1.2,gp.z,found?3:1.4);
  piece.rotation.y=Math.atan2(camera.position.x-piece.position.x,camera.position.z-piece.position.z)+Math.sin(t*.8)*.25;piece.position.y=.95+Math.sin(t*1.6)*.05;pieceGlow.material.opacity=.6+.25*Math.sin(t*2.3);
  drive(dt);follow();for(const p of people)p.update(t,dt,camera);}
 let found=false;
 // Follow camera: above and behind the group (him and his friends), a little ahead of him. On a tall screen it
 // rises higher (more of the maze ahead is visible; the friends behind him stay in frame).
 let tall=false;
 function groupCentre(){const c=hero.root.position.clone().multiplyScalar(.6);let w=.6;for(const f of [small,guide])if(f){c.addScaledVector(f.root.position,.2);w+=.2;}return c.multiplyScalar(1/w);}
 function followCam(k=1){const p=groupCentre();const off=tall?[.3,8.4,5.6]:[.4,5.6,5.2];
  camTarget.lerp(new THREE.Vector3(p.x,.5,p.z-(tall?.4:.8)),.06*k);camPos.lerp(new THREE.Vector3(p.x+off[0],off[1],p.z+off[2]),.05*k);camera.position.copy(camPos);camera.lookAt(camTarget);}
 function snapCam(){const p=groupCentre();const off=tall?[.3,8.4,5.6]:[.4,5.6,5.2];camTarget.set(p.x,.5,p.z-(tall?.4:.8));camPos.set(p.x+off[0],off[1],p.z+off[2]);followCam(0);}
 const mazeBox=[W(0,0).add(new THREE.Vector3(-C/2,0,-C/2)),W(N-1,N-1).add(new THREE.Vector3(C/2,H,C/2)),W(0,N-1).add(new THREE.Vector3(-C/2,0,C/2)),W(N-1,0).add(new THREE.Vector3(C/2,H,-C/2))];
 return {scene,update,people,hero,guide,small,maze:m,N,C,W,start,goal,fork,dead,route,cellOf,signG,piece,followCam,snapCam,mazeBox,setFound(v){found=v;},
  setTall(v){tall=v;},steer(v){want=v&&(Math.abs(v.x)+Math.abs(v.z)>0)?v:null;},get moving(){return moving;},
  // For the checks: the direction (in the world) of the next step along the way to a cell.
  nextStep(cell){const r=mazePath(m,cellOf(hero.root.position),cell);const c=toCell(hero.root.position);if(r.length<2){const g=W(...cell);return {x:Math.sign(Math.round((g.x-hero.root.position.x)*10)),z:Math.sign(Math.round((g.z-hero.root.position.z)*10))};}
   const [i,j]=r[1],[a,b]=r[0];if(i!==a)return {x:Math.sign(i-a),z:0};return {x:0,z:Math.sign(j-b)};},
  shots:{over:{pos:[0,26,18],look:[0,0,-2],fov:42,keep:['mazeBox']},overEnd:{pos:[gp.x*.5,14,gp.z+12],look:[gp.x*.6,0,gp.z],fov:40,keep:['hero','guide','small']},goal:{pos:[gp.x+gIn.x*C*1.2+.2,2.3,gp.z+gIn.z*C*1.2+.2],look:[pp.x,.9,pp.z],fov:40,keep:['hero','piece']},rise:{pos:[gp.x+gIn.x*C*2.5,11,gp.z+gIn.z*C*2.5+6],look:[gp.x,0,gp.z],fov:44}}};
}
