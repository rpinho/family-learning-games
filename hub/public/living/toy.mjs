// 3D toys: the household's plush toys as small rigged models (GLB, made privately in Blender and served from
// /book-3d/). Each model keeps its own colours but is lit by the book's storybook shader (soft wrap light, lantern
// warmth, rim, fog), plays its actions (idle, walk, cheer, talk, fly, kick, reach) with soft cross-fades, walks
// facing where it goes, and offers the same small API as a 2.5D puppet, so a scene can use either.
import {THREE,paint,lerp,clamp} from './engine.mjs';
import {GLTFLoader} from '../vendor/three/gltf-loader.js';
let listing=null,looks={};
export async function toysAvailable(){if(!listing)listing=fetch('/book-3d/index.json').then(r=>r.ok?r.json():{toys:[]}).then(j=>{looks=j.looks||{};return new Set(j.toys||[]);}).catch(()=>new Set());return listing;}
// ---- fur: soft plush fur as shells (layers pushed out along the surface; each layer keeps fewer, thinner strands) ----
// A look (private, per toy): {fur:{coat:['#hex' material names that grow fur], hide:['#hex' parts the fur replaces,
// e.g. hard spikes], length:0.07 (world units), rainbow:true|false, color:'#hex', layers:14, density:90}}.
const FUR_VERT=`uniform float uLayer,uLen,uTime,uRainbow,uRadius;varying vec3 vW,vN,vO;varying float vLayer;
void main(){vO=position;vec4 w=modelMatrix*vec4(position,1.);vec3 n=normalize(mat3(modelMatrix)*normal);
 // Strands droop a little with gravity and sway softly at the tips; long on the back, short on the tummy.
 float back=uRainbow>.5?smoothstep(.06,-.1,position.z/max(uRadius,.001)):1.;float t=uLayer;w.xyz+=n*uLen*t*mix(.35,1.,back);w.y-=uLen*.35*t*t;w.x+=sin(uTime*1.7+w.y*9.)*uLen*.08*t*t;
 vW=w.xyz;vN=n;vLayer=t;gl_Position=projectionMatrix*viewMatrix*w;}`;
const FUR_FRAG=`uniform vec3 uColor,uSunDir,uSunColor,uSky,uGround,uFogColor,uLampColor;uniform float uSunPower,uAmbient,uFogNear,uFogFar,uLayer,uDensity,uRainbow,uFogAmt;uniform vec4 uLamps[6];
uniform vec3 uCenter;uniform float uRadius;varying vec3 vW,vN,vO;varying float vLayer;
float h3(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return v*mix(vec3(1.),k,s);}
void main(){
 // Strands: a cell grid on the model's own surface; each strand is a soft round tuft that thins toward its tip.
 vec3 q=vO*uDensity;vec3 c=floor(q),f=fract(q)-.5-(vec3(h3(c+1.),h3(c+2.),h3(c+3.))-.5)*.45;float r=h3(c);float len=.6+.4*h3(c+7.);
 float thin=1.-vLayer/len;float d=length(f);
 if(vLayer>0.&&(thin<=0.||d>.42*thin+.035))discard;
 // Colour: rainbow bands along the body (like the toy's spikes), deeper at the roots, soft pale tips.
 // Rainbow bands on the back like the toy (green low, then yellow, orange, red on top); a cream tummy.
 vec3 base=uColor;if(uRainbow>.5){float up=clamp(vO.y/uRadius*.5+.5,0.,1.);float hue=mix(.36,-.02,smoothstep(.2,.95,up));vec3 rb=hsv(fract(hue+1.),.7,.97);
  float back=smoothstep(.06,-.1,vO.z/uRadius);base=mix(uColor,rb,back);}
 base*=mix(.72,1.08,sqrt(vLayer))*(.93+.14*r);
 vec3 n=normalize(vN),v=normalize(cameraPosition-vW);float nd=dot(n,uSunDir),wrap=clamp((nd+.5)/1.5,0.,1.);
 vec3 amb=mix(uGround,uSky,n.y*.5+.5)*uAmbient;vec3 col=base*(amb+uSunColor*uSunPower*wrap);
 // Rim: fur glows at the silhouette, which is what makes it read as soft.
 float rim=pow(1.-max(dot(n,v),0.),2.2);col+=mix(base,uSunColor,.5)*rim*(.35+.5*vLayer)*uSunPower;
 for(int i=0;i<6;i++){vec4 L=uLamps[i];if(L.w<=0.)continue;float rr=length(L.xyz-vW);col+=base*uLampColor*min(L.w/(1.+rr*rr*.35),.9)*.3;}
 float fog=smoothstep(uFogNear,uFogFar,length(cameraPosition-vW));gl_FragColor=vec4(mix(col,uFogColor,fog*uFogAmt),1.);}`;
function addFur(model,light,fur,k){
 // coat: material names, or {mesh, material} to grow fur on one part only (e.g. the body, not the face).
 const coat=(fur.coat||[]).map(c=>typeof c==='string'?{material:c.toLowerCase()}:{mesh:String(c.mesh||'').toLowerCase(),material:String(c.material||'').toLowerCase()}),hide=new Set((fur.hide||[]).map(s=>s.toLowerCase()));
 const grows=o=>{const mat=String(o.userData.srcMaterial||'').toLowerCase();let nm='';for(let x=o;x&&!nm;x=x.parent)if(/-/.test(x.name||''))nm=x.name.toLowerCase();nm=nm||String(o.name).toLowerCase();return coat.some(c=>c.material===mat&&(!c.mesh||nm.endsWith(c.mesh)||String(o.name).toLowerCase().includes(c.mesh)));};
 const layers=Math.max(4,Math.min(24,fur.layers||14)),len=(fur.length||.07);const shells=[];
 const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const o of meshes){const name=String(o.userData.srcMaterial||'').toLowerCase();
  if(hide.has(name)){o.visible=false;continue;}
  if(!grows(o))continue;
  o.geometry.computeBoundingSphere();const rad=o.geometry.boundingSphere?.radius||1,base=new THREE.Color(fur.color||('#'+(o.material?.uniforms?.uColor?.value?.getHexString?.()||'c9a27a')));
  for(let i=0;i<=layers;i++){const m=new THREE.ShaderMaterial({vertexShader:FUR_VERT,fragmentShader:FUR_FRAG,side:THREE.FrontSide,
    uniforms:{...light,uLayer:{value:i/layers},uLen:{value:len},uDensity:{value:(fur.density||90)*k},uColor:{value:base},uRainbow:{value:fur.rainbow?1:0},uRadius:{value:rad},uCenter:{value:new THREE.Vector3()},uFogAmt:{value:1}}});
   if(i===0){o.material=m;shells.push(m);continue;}
   const s=new THREE.Mesh(o.geometry,m);s.frustumCulled=false;s.renderOrder=i;o.add(s);shells.push(m);}}
 return shells;
}
const loader=new GLTFLoader();const cache=new Map();
function loadGLB(id){if(!cache.has(id))cache.set(id,loader.loadAsync(`/book-3d/${id}.glb`));return cache.get(id);}
const SHADOW_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SHADOW_FRAG=`uniform float uOpacity;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(0.,0.,0.,uOpacity*(1.-smoothstep(.1,1.,d))*.7);}`;
// Pose names the scenes use -> the model's actions.
const POSE={idle:'idle',happy:'cheer',cheer:'cheer',fly:'fly',run:'walk',walk:'walk',kick:'kick',dive:'reach',reach:'reach',talk:'talk',ball:'cheer',kneel:'idle',throw:'kick'};
export async function makeToy(light,{id,height=1,name=id}){
 const gltf=await loadGLB(id);const model=gltf.scene.clone(true);
 // Storybook shading for every part (a finer, plush-like grain than scenery).
 const mats=new Map();
 model.traverse(o=>{if(!o.isMesh)return;const src=Array.isArray(o.material)?o.material:[o.material];
  o.userData.srcMaterial=(Array.isArray(o.material)?o.material[0]:o.material)?.name||'';
  const out=src.map(m=>{const key=m.uuid;if(mats.has(key))return mats.get(key);const c=m.color||new THREE.Color(1,1,1),e=m.emissive&&m.emissiveIntensity?m.emissive.clone().multiplyScalar(m.emissiveIntensity*.6):new THREE.Color(0,0,0);
   const pm=paint(light,{color:c,color2:c.clone().multiplyScalar(.82),noise:.45,noiseScale:9,rim:.55,top:.12,ao:.2,side:THREE.DoubleSide});pm.uniforms.uEmissive.value.copy(e);mats.set(key,pm);return pm;});
  o.material=Array.isArray(o.material)?out:out[0];o.frustumCulled=false;});
 // Normalise the size: the model's height becomes `height` world units, feet on the ground.
 const box=new THREE.Box3().setFromObject(model),h=Math.max(.01,box.max.y-box.min.y),k=height/h;
 model.scale.setScalar(k);model.position.y=-box.min.y*k;
 const look=looks[id]||{};const fur=look.fur?addFur(model,light,look.fur,k):[];
 const body=new THREE.Group();body.add(model);
 const root=new THREE.Group();root.add(body);root.name=name;
 const w=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)*k;
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({vertexShader:SHADOW_VERT,fragmentShader:SHADOW_FRAG,transparent:true,depthWrite:false,uniforms:{uOpacity:{value:1}}}));
 shadow.rotation.x=-Math.PI/2;shadow.scale.set(w*.95,w*.75,1);shadow.position.y=.015;shadow.renderOrder=-1;root.add(shadow);
 // Actions with cross-fades.
 const mixer=new THREE.AnimationMixer(model),clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));let current=null,currentName='';
 function play(nm,{fade=.3,once=false}={}){const clip=clips[nm]||clips.idle;if(!clip||nm===currentName)return;const a=mixer.clipAction(clip);a.reset();a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);a.clampWhenFinished=once;a.enabled=true;a.setEffectiveWeight(1);
  if(current)a.crossFadeFrom(current,fade,false);a.play();current=a;currentName=nm;}
 play('idle');
 let pose='idle',path=[],speed=1,moving=false,hopT=-1,hopH=0,talkUntil=0,flying=false,heading=0,wantHeading=null;
 const api={root,kind:'toy3d',name,height,width:w,poses:Object.keys(POSE).filter(p=>clips[POSE[p]]),
  get pose(){return pose;},
  setPose(p){pose=p;const nm=POSE[p]||p;if(nm==='fly')flying=true;else if(!moving)flying=false;play(flying&&nm!=='cheer'?'fly':nm);},
  flap(on){flying=!!on;play(on?'fly':'idle');},
  walkTo(points,v=1.4){path=(Array.isArray(points[0])||points[0]?.isVector3?points:[points]).map(p=>p.isVector3?p.clone():new THREE.Vector3(p[0],p[1]??0,p[2]));speed=v;moving=true;if(!flying)play('walk',{fade:.2});return new Promise(r=>{api._arrive=r;});},
  stop(){path=[];moving=false;play('idle');},
  hop(hh=.25){hopT=0;hopH=hh;},talk(ms=1500){talkUntil=performance.now()+ms;if(!moving&&!flying&&currentName==='idle')play('talk',{fade:.2});},
  lookAt(v){wantHeading=Math.atan2(v.x-root.position.x,v.z-root.position.z);},
  update(t,dt,camera){
   mixer.update(dt);
   if(path.length){const p=root.position,to=path[0],d=Math.hypot(to.x-p.x,to.z-p.z);
    if(d<.03){p.x=to.x;p.z=to.z;path.shift();if(!path.length){moving=false;if(!flying)play(pose==='cheer'||pose==='happy'?'cheer':'idle');api._arrive?.();api._arrive=null;}}
    else{const s=Math.min(d,speed*dt);p.x+=(to.x-p.x)/d*s;p.z+=(to.z-p.z)/d*s;wantHeading=Math.atan2(to.x-p.x,to.z-p.z);}}
   else if(camera&&wantHeading===null){heading=lerp(heading,Math.atan2(camera.position.x-root.position.x,camera.position.z-root.position.z)*.6,Math.min(1,dt*2));}
   if(wantHeading!==null){let dh=wantHeading-heading;dh=Math.atan2(Math.sin(dh),Math.cos(dh));heading+=dh*Math.min(1,dt*8);if(!path.length&&Math.abs(dh)<.02)wantHeading=null;}
   root.rotation.y=heading;
   if(performance.now()>talkUntil&&currentName==='talk')play('idle',{fade:.25});
   if(hopT>=0){hopT+=dt*2.6;const s=Math.sin(Math.min(1,hopT)*Math.PI);body.position.y=hopH*s;body.scale.set(1+(hopT<.12?.08:0),1-(hopT<.12?.08:0)+s*.04,1+(hopT<.12?.08:0));if(hopT>=1){hopT=-1;body.position.y=0;body.scale.set(1,1,1);}}
   shadow.material.uniforms.uOpacity.value=1-clamp((body.position.y+root.position.y)/(height*1.2))*.8;shadow.position.y=.015-root.position.y;
  }};
 // Puppet-compatible uniforms the scenes may touch (flapping wings on arrival).
 api.uniforms={uFlap:{get value(){return flying?1:0;},set value(v){api.flap(v>0);}}};
 return api;
}
