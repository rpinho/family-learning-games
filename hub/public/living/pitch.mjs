// A cosy scene for a young listener (roles from the household's story file: hero, flyer, friend, pet): the treehouse soccer pitch on a sunny morning. Soft, warm light through
// the leaves (dappled on the grass), bunting in the breeze, treehouses in big round trees, floating seeds in the
// sunbeams. The flyer lands on the crossbar; a friend waves; he kicks the ball with the story's letter.
import {THREE,at,GLSL_NOISE,paint,withSway,rng,clamp,lerp,easeInOut,easeOut} from './engine.mjs';
import {sky,ridge,ground,grass,particles,glow,tree,bunting,board} from './world.mjs';
import {makePuppet} from './puppet.mjs';
import {makeToy,toysAvailable} from './toy.mjs';

// Grass with sunlight dappled through the leaves (moving slowly with the wind).
function dappledGround(L,{size=160}={}){
 const g=new THREE.PlaneGeometry(size,size,80,80);g.rotateX(-Math.PI/2);
 const m=new THREE.ShaderMaterial({uniforms:{...L,uA:{value:new THREE.Color('#4f8a30')},uB:{value:new THREE.Color('#8fb84a')},uLine:{value:new THREE.Color('#f4f1e2')}},
  vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uA,uB,uLine,uSunColor,uSky,uFogColor;uniform float uSunPower,uAmbient,uFogNear,uFogFar,uTime;varying vec3 vW;${GLSL_NOISE}
  void main(){vec2 p=vW.xz;float n=fbm(p*.18);vec3 c=mix(uA,uB,smoothstep(.3,.8,n));
   // Mown stripes on the pitch, and its white lines.
   float inPitch=step(abs(p.x),9.)*step(abs(p.y+1.),6.5);c*=1.+.11*inPitch*sign(sin(p.x*.9));
   float line=inPitch*(1.-smoothstep(.04,.09,abs(abs(p.x)-9.)))+inPitch*(1.-smoothstep(.04,.09,abs(p.x)))+(1.-smoothstep(.04,.09,abs(length(p-vec2(0.,-1.))-2.2)))*step(length(p-vec2(0.,-1.)),2.5);
   c=mix(c,uLine,clamp(line,0.,1.)*.85);
   // Dapples: light through leaves near the trees, drifting in the breeze.
   float d=fbm(p*.9+vec2(uTime*.05,uTime*.03))*fbm(p*.37-uTime*.02);float shade=smoothstep(.12,.3,d);
   float nearTrees=smoothstep(10.,4.,min(length(p-vec2(-11.,-16.)),min(length(p-vec2(8.,-15.)),length(p-vec2(-18.,0.)))));
   float light=mix(1.,.55+.6*shade,nearTrees);
   vec3 col=c*(uSky*uAmbient*.8+uSunColor*uSunPower*.85*light);
   float fog=smoothstep(uFogNear,uFogFar,length(cameraPosition-vW));gl_FragColor=vec4(mix(col,uFogColor,fog),1.);}`});
 return new THREE.Mesh(g,m);
}
function soccerTexture(letter){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#fbfbf6';g.fillRect(0,0,256,256);g.fillStyle='#222';
 for(const [x,y] of [[40,40],[170,30],[100,130],[30,200],[210,190]]){g.beginPath();for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;g.lineTo(x+Math.cos(a)*26,y+Math.sin(a)*26);}g.fill();}
 if(letter){g.fillStyle='#ffe07a';g.beginPath();g.arc(128,128,64,0,Math.PI*2);g.fill();g.fillStyle='#3a2200';g.font='900 100px Nunito, Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(letter,128,134);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
export async function pitch(ctx){
 const {light,art,camera}=ctx;const L=light;
 const scene=new THREE.Scene();
 L.uSunDir.value.set(.55,.55,.35).normalize();L.uSunColor.value.set('#fff0cf');L.uSunPower.value=1.05;L.uSky.value.set('#a9cdf0');L.uGround.value.set('#7a8a4a');L.uAmbient.value=.6;
 L.uFogColor.value.set('#b9d4ea');L.uFogNear.value=55;L.uFogFar.value=280;L.uHazeHeight.value=0;
 const S=sky({top:'#2f6fc8',mid:'#79b0e8',horizon:'#e6efe4',sunColor:'#fff2d0',sunDir:[.55,.55,.35],clouds:1,sunSize:.012,glow:.7,cloudColor:'#ffffff',cloudShade:'#a9bcd8'});scene.add(S);
 scene.add(ridge(L,{z:-150,width:600,height:30,base:-3,seed:9,color:'#86a8c4',rough:.4,fog:.6}));
 scene.add(ridge(L,{z:-95,width:420,height:14,base:-2,seed:12,color:'#4f8a5a',rough:.7,trees:.6,fog:.4}));
 scene.add(dappledGround(L));
 scene.add(grass(L,{count:3200,area:[[-40,40],[-30,20]],h:.35,base:'#3f7a2a',tip:'#9cc255',tip2:'#e2d27a',seed:3,avoid:(x,z)=>Math.abs(x)<9.5&&Math.abs(z+1)<7}));
 // Big round trees with treehouses, ladders and a rope bridge.
 const wood=paint(L,{color:'#8a5a36',color2:'#a8744a',noise:.7,noiseScale:2,rim:.35});const roofM=paint(L,{color:'#d0553a',color2:'#b8442e',noise:.6,noiseScale:2.5,rim:.45});
 const treehouse=(x,z,h,seed,rot=0)=>{const g=new THREE.Group();g.add(tree(L,{h,crown:4.6,color:'#4f8a3a',color2:'#9cc255',trunk:'#6b4a33',seed,blobs:11}));
  const hut=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.8,2),wood);body.position.y=.9;hut.add(body);
  const rg=new THREE.ConeGeometry(2.1,1.3,4);rg.rotateY(Math.PI/4);const rf=new THREE.Mesh(rg,roofM);rf.position.y=2.4;rf.scale.set(1.15,1,1);hut.add(rf);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(.6,.6),paint(L,{color:'#3a2a20',emissive:'#1a1208'}));win.position.set(0,1.1,1.01);hut.add(win);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(3.2,.15,2.8),wood);hut.add(deck);hut.position.set(0,h*.5,2.3);hut.rotation.y=rot;g.add(hut);
  const lad=new THREE.Group();for(const sx of [-.3,.3]){const rail=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,h*.5,6),wood);rail.position.set(sx,h*.25,0);lad.add(rail);}
  for(let i=0;i<Math.floor(h*.5/.45);i++){const rung=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.6,6),wood);rung.rotation.z=Math.PI/2;rung.position.y=.3+i*.45;lad.add(rung);}lad.position.set(.9,0,3.8);lad.rotation.x=-.12;g.add(lad);
  g.position.set(x,0,z);return g;};
 const t1=treehouse(-9,-15,9,4,.25),t2=treehouse(10.5,-14,8,7,-.35),t3=treehouse(-16,1,7.5,9,.8);scene.add(t1,t2,t3);
 // Soft shade under each crown (the sun is high and to the right).
 const shadeM=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(.05,.12,.04,(1.-smoothstep(.3,1.,d))*.42);}`});
 for(const [x,z,s] of [[-9,-15,11],[10.5,-14,10],[-16,1,10],[20,6,8],[-24,-24,9]]){const sh=new THREE.Mesh(new THREE.PlaneGeometry(s,s*.8),shadeM);sh.rotation.x=-Math.PI/2;sh.position.set(x-2.2,.02,z-1.4);scene.add(sh);}
 scene.add(at(tree(L,{h:6,crown:3.4,color:'#5a9a44',color2:'#a8c860',seed:12}),20,0,6));
 scene.add(at(tree(L,{h:7,crown:3.8,color:'#4f8a3a',color2:'#9cc255',seed:15}),-24,0,-24));
 scene.add(bunting(L,{from:[-8.5,5.8,-12.5],to:[10,5.6,-11.5],sag:1.2,count:22,seed:3}));
 scene.add(bunting(L,{from:[-15,4.8,0.5],to:[-9,5.8,-12.5],sag:.9,count:14,seed:5}));
 // The goal: white posts and a net that billows when the ball hits it.
 const goalG=new THREE.Group();const postM=paint(L,{color:'#f6f4ee',color2:'#e8e4da',noise:.2,rim:.4,gloss:.4});
 const GW=4.4,GH=1.9,GD=1.4;for(const x of [-GW/2,GW/2]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,GH,10),postM);p.position.set(x,GH/2,0);goalG.add(p);}
 const bar=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,GW+.14,10),postM);bar.rotation.z=Math.PI/2;bar.position.y=GH;goalG.add(bar);
 const netU={uHit:{value:0},uHitAt:{value:new THREE.Vector2(0,1)},uTime:{value:0}};
 const netM=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:netU,
  vertexShader:`uniform float uHit,uTime;uniform vec2 uHitAt;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;float d=length(uv*vec2(${GW.toFixed(1)},${GH.toFixed(1)})-uHitAt);p.z-=uHit*exp(-d*1.2)*.7*(1.+.2*sin(uTime*18.));p.z+=sin(uTime*1.3+uv.x*6.)*.02;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:`varying vec2 vUv;void main(){vec2 g=abs(fract(vUv*vec2(26.,12.))-.5);float l=1.-smoothstep(.0,.09,min(g.x,g.y));gl_FragColor=vec4(vec3(.97),l*.8);}`});
 const net=new THREE.Mesh(new THREE.PlaneGeometry(GW,GH,24,10),netM);net.position.set(0,GH/2,-GD);goalG.add(net);
 for(const x of [-GW/2,GW/2]){const side=new THREE.Mesh(new THREE.PlaneGeometry(GD,GH,6,6),netM);side.rotation.y=Math.PI/2;side.position.set(x,GH/2,-GD/2);goalG.add(side);}
 goalG.position.set(0,0,-6.4);scene.add(goalG);
 // Seeds and pollen floating in the sunbeams; butterflies.
 const seeds=particles({count:80,box:[[-14,14],[.5,5],[-10,6]],color:'#fffbe8',size:.35,swirl:.9,rise:.08,seed:5,opacity:.9});scene.add(seeds);
 const flies=particles({count:14,box:[[-10,10],[.4,1.6],[-8,4]],color:'#ffd05a',color2:'#9ad0ff',size:.7,swirl:2.2,seed:8,additive:false});scene.add(flies);
 // Near leaves that frame the opening shot (they drift past the camera, soft and out of focus).
 const leafTex=(()=>{const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,128,0);gr.addColorStop(0,'#2f6a24');gr.addColorStop(.5,'#5a9a38');gr.addColorStop(1,'#3a7a2a');g.fillStyle=gr;
  g.beginPath();g.moveTo(64,6);g.bezierCurveTo(128,70,120,190,64,250);g.bezierCurveTo(8,190,0,70,64,6);g.fill();g.strokeStyle='rgba(220,240,180,.55)';g.lineWidth=3;g.beginPath();g.moveTo(64,14);g.lineTo(64,244);g.stroke();
  g.lineWidth=1.6;for(let i=0;i<7;i++){const y=40+i*28;g.beginPath();g.moveTo(64,y);g.quadraticCurveTo(90,y-8,108,y-20);g.moveTo(64,y);g.quadraticCurveTo(38,y-8,20,y-20);g.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
 const leafM=new THREE.MeshLambertMaterial({map:leafTex,transparent:true,alphaTest:.3,side:THREE.DoubleSide});const leaves=new THREE.Group();const r=rng(6);
 for(let i=0;i<22;i++){const lf=new THREE.Mesh(new THREE.PlaneGeometry(.45,.9),leafM);const a=r()*Math.PI*2;lf.position.set(Math.cos(a)*(1.3+r()*1.6),5.2+Math.sin(a)*(1+r()*.9),11+(r()-.5)*1.2);lf.rotation.set(r()*1.2,r()*1.2,a+Math.PI/2);leaves.add(lf);}scene.add(leaves);
 // The friends.
 const R=ctx.cast.roles,toys=await toysAvailable(),P=async(id,h,kind,poses)=>{
  // A 3D model of the toy when the household has one; otherwise its painted picture as a 2.5D puppet.
  if(id&&toys.has(id)&&!ctx.puppetsOnly){try{const t=await makeToy(L,{id,height:h*1.12,name:id});scene.add(t.root);return t;}catch(e){console.warn('toy',id,e);}}
  const a=art.actors[id];if(!a)return null;const pz={};for(const p of poses)if(a.poses[p])pz[p]=a.poses[p].url;const pu=await makePuppet(L,{poses:pz,height:h,kind,name:id});scene.add(pu.root);return pu;};
 const hero=await P(R.hero,1.3,'biped',['idle','kick','cheer','run']);hero.root.position.set(-2.5,0,2.4);
 const flyer=await P(R.flyer,.95,'bird',['idle','fly']);flyer&&flyer.root.position.set(-30,9,-20);
 const friend=await P(R.friend,.95,'plush',['idle','happy']);friend&&friend.root.position.set(-3.8,0,0.6);
 const pet=await P(R.pet,.7,'quad',['idle','happy','run']);pet&&pet.root.position.set(2.8,0,1.8);
 const mom=R.grownup?await P(R.grownup,1.75,'biped',['idle','cheer','kneel']):null;mom&&mom.root.position.set(4.6,0,0.2);
 const people=[hero,flyer,friend,pet,mom].filter(Boolean);
 // Balls with letters (he kicks the one that starts like the flyer).
 const balls=(ctx.story.balls||['D','B','P']).map((l,i)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(.22,24,16),new THREE.MeshLambertMaterial({map:soccerTexture(l)}));b.position.set(-1.1+i*1.1,.22,3.4);b.rotation.y=-Math.PI/2;b.userData.letter=l;b.visible=false;scene.add(b);return b;});
 const sun=new THREE.DirectionalLight('#fff0d0',2.2);sun.position.set(10,12,6);scene.add(sun);scene.add(new THREE.HemisphereLight('#bfe0ff','#6a8a3a',1.2));
 let t=0;
 function update(time,dt){t=time;S.userData.u.uTime.value=t;L.uTime.value=t;netU.uTime.value=t;for(const p of [seeds,flies])p.userData.u.uTime.value=t;
  netU.uHit.value=Math.max(0,netU.uHit.value-dt*1.2);for(let i=0;i<6;i++)L.uLamps.value[i].w=0;
  leaves.children.forEach((lf,i)=>{lf.rotation.x=Math.sin(t*.9+i)*.35;lf.rotation.y=Math.sin(t*.7+i*2)*.3;});
  for(const p of people)p.update(t,dt,camera);}
 // the flyer flies in along an arc and lands on the crossbar.
 async function flyerArrives(host){if(!flyer)return;flyer.setPose('fly');flyer.uniforms.uFlap.value=1;host.sfx('flap');
  const a=new THREE.Vector3(-26,9,-16),c=new THREE.Vector3(-6,6,-4),b=new THREE.Vector3(0,1.95,-6.4);flyer.lookAt?.(b);const t0=performance.now(),ms=4200;
  await new Promise(res=>{const f=()=>{const k=easeInOut(clamp((performance.now()-t0)/ms));const p=a.clone().multiplyScalar((1-k)*(1-k)).add(c.clone().multiplyScalar(2*k*(1-k))).add(b.clone().multiplyScalar(k*k));flyer.root.position.copy(p);k<1?requestAnimationFrame(f):res();};f();});
  flyer.uniforms.uFlap.value=0;flyer.setPose('idle');flyer.hop(.12);host.sfx('squawk');}
 // The kick: the ball flies in an arc into the net (the net billows, confetti, everyone cheers).
 async function kick(ball,host){hero.setPose('run');await hero.walkTo([[ball.position.x-.55,0,ball.position.z+.25]],3.2);hero.setPose('kick');host.sfx('kick');const a=ball.position.clone(),b=new THREE.Vector3((Math.random()-.5)*2.6,.9,-7.3),t0=performance.now(),ms=900;
  await new Promise(res=>{const f=()=>{const k=clamp((performance.now()-t0)/ms);ball.position.lerpVectors(a,b,easeOut(k));ball.position.y=lerp(a.y,b.y,k)+Math.sin(k*Math.PI)*1.6;ball.rotation.x-=.35;k<1?requestAnimationFrame(f):res();};f();});
  netU.uHitAt.value.set(b.x+GW/2,b.y);netU.uHit.value=1;host.sfx('net');host.confetti?.();
  for(const p of people){if(p.poses.includes('cheer'))p.setPose('cheer');else if(p.poses.includes('happy'))p.setPose('happy');p.hop(.25);}
  if(flyer){flyer.uniforms.uFlap.value=1;setTimeout(()=>{flyer.uniforms.uFlap.value=0;},1400);}}
 return {scene,update,people,hero,flyer,friend,pet,mom,balls,kick,flyerArrives,goal:goalG,
  shots:{leaves:{pos:[0,5.2,13],look:[0,2.6,-2],fov:38},reveal:{pos:[0,3.4,11.5],look:[0,1.2,-3],fov:40},
   crossbar:{pos:[1.8,2.2,-2.4],look:[0,1.95,-6.4],fov:36},friends:{pos:[-.9,1.5,7.2],look:[-1.5,.85,1.4],fov:40},
   kick:{pos:[.2,2,8.2],look:[-.2,.7,-2],fov:44},crane:{pos:[-2,9,14],look:[-6,5,-8],fov:44}}};
}
