// Storybook scenery, all made in code: a painted sky (sun, glow, stars, drifting clouds), layered hills that
// fade into the air, a painterly ground, grass that moves with the wind, fireflies and dust motes, glowing
// lamps, trees with soft round crowns, bunting, and a little steam train.
import {THREE,GLSL_NOISE,paint,withSway,rng,clamp} from './engine.mjs';

// ---------- sky ----------
const SKY_VERT=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const SKY_FRAG=`uniform vec3 uTop,uMid,uHorizon,uSunColor,uSunDir2,uCloudColor,uCloudShade;uniform float uStars,uClouds,uTime,uSunSize,uGlow,uMoon;
varying vec3 vDir;${GLSL_NOISE}
void main(){vec3 d=normalize(vDir);float h=d.y;
 vec3 c=mix(uHorizon,uMid,smoothstep(-.02,.22,h));c=mix(c,uTop,smoothstep(.2,.75,h));
 float s=max(dot(d,normalize(uSunDir2)),0.);
 c+=uSunColor*(pow(s,6.)*.35+pow(s,40.)*.6)*uGlow;
 c=mix(c,uSunColor*1.6,smoothstep(1.-uSunSize,1.-uSunSize*.6,s));
 // Moon: a soft disc with a halo.
 c+=vec3(.9,.95,1.)*uMoon*(smoothstep(1.-uSunSize*.9,1.-uSunSize*.6,s)*1.2+pow(s,60.)*.25);
 // Stars fade in above the horizon.
 vec2 sp=d.xz/(d.y+.3)*140.;float st=step(.997,hash12(floor(sp)))*smoothstep(.05,.3,h);st*=.6+.4*sin(uTime*2.+hash12(floor(sp))*40.);c+=vec3(st)*uStars;
 // Clouds: long painted bands, lit on the side of the sun.
 vec2 cp=d.xz/(d.y+.12)*1.6+vec2(uTime*.004,0.);float n=fbm(cp*1.3)*.65+fbm(cp*3.1)*.35;
 float cl=smoothstep(.52,.75,n)*smoothstep(.0,.18,h)*uClouds;vec3 cc=mix(uCloudShade,uCloudColor,smoothstep(.45,.8,fbm(cp*2.+.5))+pow(s,3.)*.5);
 c=mix(c,cc,cl);
 gl_FragColor=vec4(c,1.);}`;
export function sky({top='#3a5b9a',mid='#7fa6d6',horizon='#f3c9a0',sunColor='#ffd9a0',sunDir=[.5,.12,-1],stars=0,clouds=.8,sunSize=.012,glow=1,moon=0,cloudColor='#fff4e6',cloudShade='#9aa8c8'}={}){
 const u={uTop:{value:new THREE.Color(top)},uMid:{value:new THREE.Color(mid)},uHorizon:{value:new THREE.Color(horizon)},uSunColor:{value:new THREE.Color(sunColor)},
  uSunDir2:{value:new THREE.Vector3(...sunDir).normalize()},uStars:{value:stars},uClouds:{value:clouds},uTime:{value:0},uSunSize:{value:sunSize},uGlow:{value:glow},uMoon:{value:moon},
  uCloudColor:{value:new THREE.Color(cloudColor)},uCloudShade:{value:new THREE.Color(cloudShade)}};
 const m=new THREE.Mesh(new THREE.SphereGeometry(400,32,16),new THREE.ShaderMaterial({vertexShader:SKY_VERT,fragmentShader:SKY_FRAG,uniforms:u,side:THREE.BackSide,depthWrite:false}));
 m.frustumCulled=false;m.renderOrder=-10;m.userData.u=u;return m;
}
// ---------- layered hills / mountains / tree lines (atmospheric perspective by fog) ----------
export function ridge(light,{z=-80,width=400,height=18,base=0,rough=.5,seed=1,color='#4a5f7a',color2,points=90,trees=0,x=0,fog=.5}={}){
 const r=rng(seed),pts=[];let y=0;
 for(let i=0;i<=points;i++){const t=i/points;const n=Math.sin(t*6.3+seed)*.35+Math.sin(t*13.1+seed*2)*.2*rough+(r()-.5)*.25*rough;y=height*(.55+n*.8);
  if(trees&&r()<trees){pts.push([t,y],[t+.002,y+height*.25*(0.5+r())],[t+.004,y]);}else pts.push([t,y]);}
 const shape=new THREE.Shape();shape.moveTo(-width/2+x,base-40);for(const [t,yy] of pts)shape.lineTo(-width/2+x+t*width,base+yy);shape.lineTo(width/2+x,base-40);shape.closePath();
 const g=new THREE.ShapeGeometry(shape,1);const m=new THREE.Mesh(g,paint(light,{color,color2:color2||color,noise:.35,noiseScale:.05,rim:0,top:0,ao:0,fog}));
 m.position.z=z;return m;
}
// ---------- ground ----------
export function ground(light,{size=200,color='#6f9a4a',color2='#a8bd62',noiseScale=.12,y=0,segments=64,hills=0,seed=3}={}){
 const g=new THREE.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);
 if(hills){const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),d=Math.hypot(x,z);p.setY(i,(Math.sin(x*.04+seed)*Math.cos(z*.05)+Math.sin(x*.013-z*.02)*1.6)*hills*clamp((d-18)/40));}g.computeVertexNormals();}
 const m=new THREE.Mesh(g,paint(light,{color,color2,noise:.9,noiseScale,rim:0,top:0,ao:0}));m.position.y=y;return m;
}
// ---------- grass that moves with the wind (instanced blades) ----------
const GRASS_VERT=`uniform float uTime,uWind;attribute vec3 aOff;attribute float aScale,aHue;varying float vT,vHue;varying vec3 vW;
void main(){vec3 p=position;float t=p.y;p*=aScale;vec3 w=p+aOff;
 float sway=(sin(uTime*1.8+aOff.x*.4+aOff.z*.3)*.5+sin(uTime*3.3+aOff.x*1.3)*.2)*uWind*t*t;w.x+=sway*.35*aScale;w.z+=sway*.15*aScale;
 vT=t;vHue=aHue;vW=w;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`;
const GRASS_FRAG=`uniform vec3 uBase,uTip,uTip2,uSunColor,uSky,uFogColor;uniform float uSunPower,uAmbient,uFogNear,uFogFar;varying float vT,vHue;varying vec3 vW;
void main(){vec3 c=mix(uBase,mix(uTip,uTip2,vHue),vT);c*=uSky*uAmbient*.8+uSunColor*uSunPower*(.45+.55*vT);
 float fog=smoothstep(uFogNear,uFogFar,length(cameraPosition-vW));gl_FragColor=vec4(mix(c,uFogColor,fog),1.);}`;
export function grass(light,{count=3000,area=[[-20,20],[-20,20]],h=.5,base='#3f6b2c',tip='#a9c75a',tip2='#d4c06a',seed=5,avoid=null,y=0}={}){
 const blade=new THREE.BufferGeometry();const w=.05;
 blade.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,0, w,0,0, -w*.6,.5,0, w*.6,.5,0, 0,1,0],3));blade.setIndex([0,1,2,2,1,3,2,3,4]);
 const ig=new THREE.InstancedBufferGeometry();ig.index=blade.index;ig.attributes.position=blade.attributes.position;
 const r=rng(seed),off=[],sc=[],hue=[];let n=0;
 for(let i=0;i<count*3&&n<count;i++){const x=area[0][0]+r()*(area[0][1]-area[0][0]),z=area[1][0]+r()*(area[1][1]-area[1][0]);if(avoid&&avoid(x,z))continue;off.push(x,y,z);sc.push(h*(.55+r()*.9));hue.push(r());n++;}
 ig.setAttribute('aOff',new THREE.InstancedBufferAttribute(new Float32Array(off),3));ig.setAttribute('aScale',new THREE.InstancedBufferAttribute(new Float32Array(sc),1));ig.setAttribute('aHue',new THREE.InstancedBufferAttribute(new Float32Array(hue),1));
 ig.instanceCount=n;
 const m=new THREE.Mesh(ig,new THREE.ShaderMaterial({vertexShader:GRASS_VERT,fragmentShader:GRASS_FRAG,side:THREE.DoubleSide,uniforms:{...light,uBase:{value:new THREE.Color(base)},uTip:{value:new THREE.Color(tip)},uTip2:{value:new THREE.Color(tip2)}}}));
 m.frustumCulled=false;m.userData.noOcclude=true;return m;
}
// ---------- particles: fireflies, dust motes in the light, drifting seeds, falling leaves ----------
const PART_VERT=`uniform float uTime,uSize,uRise,uSwirl;attribute vec3 aSeed;varying float vA;varying float vK;
void main(){vec3 p=position;float t=uTime*(.25+aSeed.x*.5)+aSeed.y*20.;
 p.x+=sin(t*.9+aSeed.z*6.)*uSwirl;p.z+=cos(t*.7+aSeed.x*5.)*uSwirl;p.y+=sin(t*1.3)*uSwirl*.5+mod(uTime*uRise*(.5+aSeed.z),6.);
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uSize*(.6+aSeed.y*.8)*(300./-mv.z);
 vA=.5+.5*sin(uTime*(1.5+aSeed.z*3.)+aSeed.x*30.);vK=aSeed.x;}`;
const PART_FRAG=`uniform vec3 uColor,uColor2;uniform float uOpacity;varying float vA;varying float vK;
void main(){vec2 q=gl_PointCoord-.5;float d=length(q)*2.;float a=(1.-smoothstep(.0,1.,d));a*=a;gl_FragColor=vec4(mix(uColor,uColor2,vK)*(1.+a),a*vA*uOpacity);}`;
export function particles({count=120,box=[[-10,10],[0,3],[-10,10]],color='#ffe28a',color2,size=1.2,rise=0,swirl=.6,additive=true,seed=9,opacity=1}={}){
 const r=rng(seed),pos=[],sd=[];for(let i=0;i<count;i++){pos.push(box[0][0]+r()*(box[0][1]-box[0][0]),box[1][0]+r()*(box[1][1]-box[1][0]),box[2][0]+r()*(box[2][1]-box[2][0]));sd.push(r(),r(),r());}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aSeed',new THREE.Float32BufferAttribute(sd,3));
 const u={uTime:{value:0},uSize:{value:size},uRise:{value:rise},uSwirl:{value:swirl},uColor:{value:new THREE.Color(color)},uColor2:{value:new THREE.Color(color2||color)},uOpacity:{value:opacity}};
 const m=new THREE.Points(g,new THREE.ShaderMaterial({vertexShader:PART_VERT,fragmentShader:PART_FRAG,uniforms:u,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
 m.frustumCulled=false;m.userData.u=u;return m;
}
// ---------- a soft glow (lamps, the headlight, sparkles) ----------
let glowTex=null;
function glowTexture(){if(glowTex)return glowTex;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);
 gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.18,'rgba(255,255,255,.55)');gr.addColorStop(.5,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 glowTex=new THREE.CanvasTexture(c);return glowTex;}
export function glow({color='#ffc070',size=1.5,opacity=1}={}){
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:new THREE.Color(color).multiplyScalar(2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity}));
 s.scale.set(size,size,1);return s;
}
// ---------- a lamp post: a lantern that can light up, with its warm pool on the ground ----------
export function lampPost(light,{h=2.6,color='#3a3330',glowColor='#ffc27a'}={}){
 const g=new THREE.Group();const m=paint(light,{color,color2:'#5a4a40',noise:.3,rim:.2});
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,h,8),m);pole.position.y=h/2;g.add(pole);
 const arm=new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.05),m);arm.position.set(.22,h-.05,0);g.add(arm);
 const cage=new THREE.Mesh(new THREE.CylinderGeometry(.13,.1,.32,6),paint(light,{color:'#2e2a28',emissive:'#000000',rim:.3}));cage.position.set(.42,h-.28,0);g.add(cage);
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:new THREE.Color(glowColor).multiplyScalar(.2)}));bulb.position.copy(cage.position);g.add(bulb);
 const gl=glow({color:glowColor,size:1.6,opacity:0});gl.position.copy(cage.position);g.add(gl);
 let on=0;return {group:g,lampPos:()=>g.localToWorld(cage.position.clone()),set(v){on=v;gl.material.opacity=v;bulb.material.color.set(glowColor).multiplyScalar(.2+v*2.4);},get on(){return on;}};
}
// ---------- trees with soft round crowns (they breathe in the wind) ----------
export function tree(light,{h=6,crown=3,color='#4f7a3a',color2='#8fb356',trunk='#6b4a33',seed=2,blobs=9,lean=0}={}){
 const r=rng(seed),g=new THREE.Group();
 const tr=new THREE.Mesh(withSway(new THREE.CylinderGeometry(crown*.09,crown*.16,h,8),0),paint(light,{color:trunk,color2:'#8a6a4a',noise:.7,noiseScale:1.2,rim:.3}));tr.position.y=h/2;tr.rotation.z=lean;g.add(tr);
 const cm=paint(light,{color,color2,noise:.85,noiseScale:.5,rim:.45,top:.35,ao:0});
 for(let i=0;i<blobs;i++){const s=crown*(.45+r()*.45);const geo=withSway(new THREE.IcosahedronGeometry(s,4),.12);
  // Lumpy crowns: push each vertex a little.
  const p=geo.attributes.position;for(let k=0;k<p.count;k++){const v=new THREE.Vector3().fromBufferAttribute(p,k);v.multiplyScalar(1+(Math.sin(v.x*3+seed)+Math.cos(v.y*4)+Math.sin(v.z*5))*.04);p.setXYZ(k,v.x,v.y,v.z);}geo.computeVertexNormals();
  const b=new THREE.Mesh(geo,cm);const a=r()*Math.PI*2,rr=crown*(.2+r()*.55);b.position.set(Math.cos(a)*rr+lean*h*.5,h+(r()-.3)*crown*.8,Math.sin(a)*rr);g.add(b);}
 return g;
}
// ---------- bunting (little flags on a string that flutter) ----------
export function bunting(light,{from=[-4,4,0],to=[4,4,0],sag=.6,count=14,colors=['#e5533d','#f2b63c','#4a90d9','#6cbf5a','#f4f0e6'],seed=4}={}){
 const g=new THREE.Group(),A=new THREE.Vector3(...from),B=new THREE.Vector3(...to);const pt=t=>A.clone().lerp(B,t).add(new THREE.Vector3(0,-Math.sin(t*Math.PI)*sag,0));
 const curve=new THREE.CatmullRomCurve3(Array.from({length:12},(_,i)=>pt(i/11)));
 g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,40,.015,4),paint(light,{color:'#e9e1d0',rim:0})));
 for(let i=0;i<count;i++){const t=(i+.5)/count,p=pt(t);const tri=new THREE.BufferGeometry();tri.setAttribute('position',new THREE.Float32BufferAttribute([-.16,0,0,.16,0,0,0,-.38,0],3));tri.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,.5,0],2));tri.computeVertexNormals();
  withSway(tri,.12,false);const a=tri.attributes.aSway;a.setX(0,0);a.setX(1,0);a.setX(2,.18);
  const f=new THREE.Mesh(tri,paint(light,{color:colors[i%colors.length],noise:.3,rim:.3,side:THREE.DoubleSide}));f.position.copy(p);g.add(f);}
 return g;
}
// ---------- the little steam train (engine + open wagons), built from simple shapes ----------
export function steamTrain(light,{wagons=2,colors={body:'#c8352c',trim:'#2f7a4a',gold:'#e0b04a',dark:'#2a2522',wagon:['#f2c14e','#4a86c8']}}={}){
 const g=new THREE.Group(),M=(c,o={})=>paint(light,{color:c,color2:o.c2||c,noise:.35,noiseScale:1.5,rim:.35,gloss:o.gloss??.25,...o});
 const body=M(colors.body,{c2:'#a82a24'}),trim=M(colors.trim,{c2:'#256240'}),gold=M(colors.gold,{gloss:.6}),dark=M(colors.dark,{gloss:.1});
 const eng=new THREE.Group();g.add(eng);
 const boiler=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,2.2,20),body);boiler.rotation.z=Math.PI/2;boiler.position.set(.6,1.15,0);eng.add(boiler);
 const front=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.12,20),trim);front.rotation.z=Math.PI/2;front.position.set(1.72,1.15,0);eng.add(front);
 for(const x of [0,.9]){const band=new THREE.Mesh(new THREE.CylinderGeometry(.57,.57,.08,20),gold);band.rotation.z=Math.PI/2;band.position.set(x,1.15,0);eng.add(band);}
 const cab=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.35,1.25),body);cab.position.set(-.95,1.45,0);eng.add(cab);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(1.35,.12,1.45),trim);roof.position.set(-.95,2.18,0);eng.add(roof);
 const win=new THREE.Mesh(new THREE.BoxGeometry(.5,.45,1.27),M('#ffd89a',{emissive:'#6a4010',gloss:0}));win.position.set(-.95,1.7,0);eng.add(win);
 const chim=new THREE.Mesh(new THREE.CylinderGeometry(.2,.14,.7,14),trim);chim.position.set(1.35,1.95,0);eng.add(chim);
 const top=new THREE.Mesh(new THREE.CylinderGeometry(.3,.2,.2,14),gold);top.position.set(1.35,2.35,0);eng.add(top);
 const dome=new THREE.Mesh(new THREE.SphereGeometry(.25,14,10,0,Math.PI*2,0,Math.PI/2),gold);dome.position.set(.4,1.68,0);eng.add(dome);
 const base=new THREE.Mesh(new THREE.BoxGeometry(3.3,.25,1.1),dark);base.position.set(.3,.55,0);eng.add(base);
 const catcher=new THREE.Mesh(new THREE.ConeGeometry(.5,.6,4,1),body);catcher.rotation.set(0,Math.PI/4,-Math.PI/2);catcher.scale.set(1,1,.6);catcher.position.set(2.05,.45,0);eng.add(catcher);
 const lampM=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.2,12),gold);lampM.rotation.z=Math.PI/2;lampM.position.set(1.82,1.75,0);eng.add(lampM);
 const head=glow({color:'#fff0c0',size:3,opacity:0});head.position.set(1.98,1.75,0);eng.add(head);
 // A soft beam of light in front of the engine.
 const beam=new THREE.Mesh(new THREE.ConeGeometry(1.4,7,24,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color('#fff2c8'),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
 beam.rotation.z=Math.PI/2;beam.position.set(5.4,1.4,0);eng.add(beam);
 const wheels=[];const wm=M(colors.body,{c2:'#7a1a15'});
 const wheel=(x,r,parent,z)=>{const w=new THREE.Group();const rim=new THREE.Mesh(new THREE.TorusGeometry(r,.06,6,20),dark);w.add(rim);const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.25,r*.25,.1,10),gold);hub.rotation.x=Math.PI/2;w.add(hub);
  for(let k=0;k<6;k++){const s=new THREE.Mesh(new THREE.BoxGeometry(.04,r*1.9,.04),wm);s.rotation.z=k*Math.PI/6;w.add(s);}w.position.set(x,r,z);parent.add(w);wheels.push({w,r});};
 for(const z of [-.58,.58]){wheel(1.3,.42,eng,z);wheel(.3,.5,eng,z);wheel(-.7,.5,eng,z);}
 const rod=new THREE.Mesh(new THREE.BoxGeometry(2.1,.06,.05),gold);rod.position.set(-.2,.5,.66);eng.add(rod);
 const cars=[];for(let i=0;i<wagons;i++){const c=new THREE.Group();const col=M(colors.wagon[i%colors.wagon.length],{gloss:.1});
  const floor=new THREE.Mesh(new THREE.BoxGeometry(2.2,.18,1.2),dark);floor.position.y=.62;c.add(floor);
  for(const [sx,sz,px,pz] of [[2.2,.1,0,.58],[2.2,.1,0,-.58],[.1,1.2,1.08,0],[.1,1.2,-1.08,0]]){const wall=new THREE.Mesh(new THREE.BoxGeometry(sx,.65,sz),col);wall.position.set(px,1.02,pz);c.add(wall);}
  for(const z of [-.58,.58]){wheel(.6,.36,c,z);wheel(-.6,.36,c,z);}
  c.position.x=-2.9-i*2.55;g.add(c);cars.push(c);}
 let lit=0,dist=0;
 return {group:g,engine:eng,cars,seatsWorld:()=>cars.map(c=>c.localToWorld(new THREE.Vector3(0,.72,0))),
  setLight(v){lit=v;head.material.opacity=v;beam.material.opacity=v*.16;},
  roll(dx){dist+=dx;for(const {w,r} of wheels)w.rotation.z=-dist/r;rod.position.y=.5+Math.sin(dist/.5)*.12;rod.position.x=-.2+Math.cos(dist/.5)*.12;},
  chimneyTop:()=>eng.localToWorld(new THREE.Vector3(1.35,2.5,0))};
}
// ---------- steam puffs (soft, growing, rising; lit by the scene) ----------
export function steam({count=40,color='#f4efe8'}={}){
 const g=new THREE.BufferGeometry();const pos=new Float32Array(count*3),age=new Float32Array(count).fill(99),seed=new Float32Array(count);for(let i=0;i<count;i++)seed[i]=Math.random();
 g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aAge',new THREE.BufferAttribute(age,1));g.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uColor:{value:new THREE.Color(color)},uLife:{value:3.5}},
  vertexShader:`attribute float aAge,aSeed;uniform float uLife;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float k=clamp(aAge/uLife,0.,1.);gl_PointSize=(60.+aSeed*40.)*(.35+k*1.8)*(300./-mv.z)*.05;vA=(1.-k)*smoothstep(0.,.08,k);}`,
  fragmentShader:`uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.2,1.,d))*vA*.55;gl_FragColor=vec4(uColor,a);}`});
 const pts=new THREE.Points(g,mat);pts.frustumCulled=false;let next=0,acc=0;
 return {points:pts,emit(at,rate,dt){acc+=rate*dt;while(acc>=1){acc--;const i=next++%count;pos[i*3]=at.x+(Math.random()-.5)*.1;pos[i*3+1]=at.y;pos[i*3+2]=at.z+(Math.random()-.5)*.1;age[i]=0;}},
  update(dt,wind=[.4,0,0]){for(let i=0;i<count;i++){if(age[i]>50)continue;age[i]+=dt;pos[i*3]+=wind[0]*dt*(.5+seed[i]);pos[i*3+1]+=dt*(.9+seed[i]*.6);pos[i*3+2]+=wind[2]*dt;}g.attributes.position.needsUpdate=true;g.attributes.aAge.needsUpdate=true;}};
}
// ---------- a painted sign / board (canvas text) ----------
export function board(light,{lines=['HELLO'],w=2,h=1,bg='#2e3b2a',fg='#f6ecd2',border='#8a5a2b',font='700 64px Georgia, serif',px=512}={}){
 const c=document.createElement('canvas');c.width=px;c.height=Math.round(px*h/w);const g=c.getContext('2d');
 g.fillStyle=border;g.fillRect(0,0,c.width,c.height);g.fillStyle=bg;const b=c.width*.035;g.fillRect(b,b,c.width-2*b,c.height-2*b);
 g.fillStyle=fg;g.font=font;g.textAlign='center';g.textBaseline='middle';lines.forEach((l,i)=>{g.fillText(l,c.width/2,c.height*(i+.5)/lines.length);});
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));m.userData.canvas=c;m.userData.tex=tex;return m;
}
