// 2.5D puppets: a character's painted picture on a finely divided card that the vertex shader bends like a
// puppet: breathing, a head that sways, a waddling walk with swinging legs, wings that flap, arms that cheer,
// squash and stretch on a hop. The card turns to face the camera (around its upright axis), is lit by the scene
// (sun-side rim light, lantern warmth, fog) and sits on a soft contact shadow.
import {THREE,GLSL_NOISE,clamp,lerp} from './engine.mjs';
const VERT=`
uniform float uTime,uWalk,uPhase,uBreath,uSway,uFlap,uCheer,uLean,uSquash,uH,uW,uSeed,uLegs,uTalk;
varying vec2 vUv;varying vec3 vW;
void main(){
 vec3 p=position;float t=clamp(p.y/uH,0.,1.),u=p.x/uW;
 // Breathing: the chest widens a touch.
 p.x*=1.+uBreath*.018*sin(uTime*2.1+uSeed)*smoothstep(.15,.6,t)*(1.-smoothstep(.6,.95,t));
 // Head sway (and a nod while talking) around the neck.
 float head=smoothstep(.55,.8,t),ang=head*(uSway*.045*sin(uTime*1.25+uSeed)+uTalk*.05*sin(uTime*11.))+uLean*t*.12;
 vec2 pv=vec2(0.,uH*.6);vec2 q=p.xy-pv;p.xy=pv+vec2(q.x*cos(ang)-q.y*sin(ang),q.x*sin(ang)+q.y*cos(ang));
 // Walk: a plush waddle (rock side to side), a bob, and the legs swing in turn.
 float st=sin(uPhase);
 p.x+=uWalk*uLegs*st*uH*.07*(1.-smoothstep(0.,.3,t))*sign(u+.0001);
 float rock=uWalk*.07*st;vec2 f=p.xy;p.xy=vec2(f.x*cos(rock)-f.y*sin(rock),f.x*sin(rock)+f.y*cos(rock));
 p.y+=uWalk*abs(cos(uPhase))*uH*.035;
 // Wings: the outer thirds beat up and down.
 float wing=smoothstep(.22,.48,abs(u))*smoothstep(.2,.45,t)*(1.-smoothstep(.8,1.,t));
 p.y+=uFlap*wing*sin(uTime*13.+uSeed)*uH*.16*(abs(u)*2.);
 // Cheer: arms (outer upper sides) lift.
 p.y+=uCheer*smoothstep(.2,.45,abs(u))*smoothstep(.35,.7,t)*uH*.07*(.7+.3*sin(uTime*9.));
 // Squash and stretch about the feet.
 p.y*=1.+uSquash;p.x*=1.-uSquash*.6;
 vUv=uv;vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;
}`;
const FRAG=`
uniform sampler2D map;uniform vec3 uSunColor,uSky,uFogColor,uLampColor,uTint;uniform float uSunPower,uAmbient,uFogNear,uFogFar,uRim,uOpacity,uLit;
uniform vec2 uRimDir;uniform vec4 uLamps[6];varying vec2 vUv;varying vec3 vW;
void main(){
 vec4 c=texture2D(map,vUv);if(c.a<.04)discard;
 // Lit by the scene: ambient sky plus sun, never darker than a storybook page.
 vec3 col=c.rgb*uTint*mix(vec3(1.),(uSky*uAmbient*.9+uSunColor*uSunPower*.75),uLit);
 // Rim light on the edge that faces the sun (the picture's own silhouette).
 float a2=texture2D(map,vUv-uRimDir*.01).a;float rim=smoothstep(.5,0.,a2)*smoothstep(.6,1.,c.a)*uRim;col+=uSunColor*rim*uSunPower*.55;
 for(int i=0;i<6;i++){vec4 L=uLamps[i];if(L.w<=0.)continue;float r=length(L.xyz-vW);col+=c.rgb*uLampColor*min(L.w/(1.+r*r*.5),.9)*.25;}
 float fog=smoothstep(uFogNear,uFogFar,length(cameraPosition-vW));
 gl_FragColor=vec4(mix(col,uFogColor,fog),c.a*uOpacity);
}`;
const SHADOW_FRAG=`uniform float uOpacity;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(0.,0.,0.,uOpacity*(1.-smoothstep(.1,1.,d))*.72);}`;
const SHADOW_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const cache=new Map();
// Load a character picture as a texture (SVG pictures are drawn at a good resolution first).
export function loadPicture(url,{maxH=1024}={}){
 if(cache.has(url))return cache.get(url);
 const p=new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.decoding='async';
  im.onload=()=>{let tex;
   if(/\.svg(\?|$)/.test(url)){const ar=(im.naturalWidth||1)/(im.naturalHeight||1),h=maxH,w=Math.round(h*ar);const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(im,0,0,w,h);tex=new THREE.CanvasTexture(cv);}
   else tex=new THREE.Texture(im);
   tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.needsUpdate=true;
   res({tex,ar:(im.naturalWidth||1)/(im.naturalHeight||1)});};
  im.onerror=()=>rej(Error('picture failed: '+url));im.src=url;});
 cache.set(url,p);return p;
}
// A puppet. opts: poses {name: url}, height (world units), kind ('biped'|'bird'|'plush'|'quad'), light (shared).
export async function makePuppet(light,{poses,height=1.2,kind='biped',seed=Math.random()*10,name=''}){
 const loaded={};for(const [k,u] of Object.entries(poses))loaded[k]=await loadPicture(u).catch(()=>null);
 const first=loaded.idle||Object.values(loaded).find(Boolean);if(!first)throw Error('no picture for '+name);
 const H=height,Wd=H*first.ar;
 const geo=new THREE.PlaneGeometry(Wd,H,10,16);geo.translate(0,H/2,0);
 const uni={...light,map:{value:first.tex},uWalk:{value:0},uPhase:{value:0},uBreath:{value:1},uSway:{value:1},uFlap:{value:0},uCheer:{value:0},uLean:{value:0},uSquash:{value:0},
  uH:{value:H},uW:{value:Wd},uSeed:{value:seed},uLegs:{value:kind==='biped'?1:kind==='bird'?0.5:0.7},uTalk:{value:0},uRim:{value:.35},uOpacity:{value:1},uTint:{value:new THREE.Color(1,1,1)},uLit:{value:1},uRimDir:{value:new THREE.Vector2(-.7,.7)}};
 const mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms:uni,transparent:true,depthWrite:true,side:THREE.DoubleSide,alphaToCoverage:false});
 const card=new THREE.Mesh(geo,mat);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({vertexShader:SHADOW_VERT,fragmentShader:SHADOW_FRAG,transparent:true,depthWrite:false,uniforms:{uOpacity:{value:1}}}));
 shadow.rotation.x=-Math.PI/2;shadow.scale.set(Wd*.9,Wd*.45,1);shadow.position.y=.015;shadow.renderOrder=-1;
 const root=new THREE.Group();root.add(shadow);root.add(card);root.name=name;
 let pose='idle',facing=1,phase=0,hop=0,hopT=-1,talkUntil=0;const target=new THREE.Vector3();let speed=0,moving=false,path=[];
 const api={root,card,uniforms:uni,height:H,width:Wd,kind,name,
  setPose(p){const L=loaded[p];if(!L)return;pose=p;uni.map.value=L.tex;const w=H*L.ar;card.geometry.dispose();const g=new THREE.PlaneGeometry(w,H,10,16);g.translate(0,H/2,0);card.geometry=g;uni.uW.value=w;},
  poses:Object.keys(loaded).filter(k=>loaded[k]),get pose(){return pose;},
  // Walk along a list of points at a speed (world units/second). Resolves when he arrives.
  walkTo(points,v=1.4){path=(Array.isArray(points[0])||points[0]?.isVector3?points:[points]).map(p=>p.isVector3?p.clone():new THREE.Vector3(p[0],p[1]??0,p[2]));speed=v;moving=true;return new Promise(r=>{api._arrive=r;});},
  stop(){path=[];moving=false;},
  hop(h=.25){hopT=0;hop=h;},talk(ms=1500){talkUntil=performance.now()+ms;},
  update(t,dt,camera){
   uni.uTime.value=t;
   if(path.length){const p=root.position,to=path[0];const d=Math.hypot(to.x-p.x,to.z-p.z);
    if(d<.03){p.x=to.x;p.z=to.z;path.shift();if(!path.length){moving=false;api._arrive?.();api._arrive=null;}}
    else{const s=Math.min(d,speed*dt);p.x+=(to.x-p.x)/d*s;p.z+=(to.z-p.z)/d*s;const sx=(to.x-p.x);
     // Face the way he walks (as the camera sees it).
     if(camera){const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);const dot=(to.x-p.x)*right.x+(to.z-p.z)*right.z;if(Math.abs(dot)>.01)facing=dot<0?-1:1;}}}
   const w=moving?1:0;uni.uWalk.value=lerp(uni.uWalk.value,w,Math.min(1,dt*6));phase+=dt*speed*5.2*(moving?1:.2);uni.uPhase.value=phase;
   uni.uTalk.value=performance.now()<talkUntil?1:lerp(uni.uTalk.value,0,dt*5);
   if(hopT>=0){hopT+=dt*2.6;const k=Math.sin(Math.min(1,hopT)*Math.PI);card.position.y=hop*k;uni.uSquash.value=hopT<.15?-.08:hopT>.9?-.06:.05*k;if(hopT>=1){hopT=-1;card.position.y=0;uni.uSquash.value=0;}}
   // Face the camera around the upright axis; mirror when walking the other way.
   if(camera){root.rotation.y=Math.atan2(camera.position.x-root.position.x,camera.position.z-root.position.z);}
   card.scale.x=lerp(card.scale.x,facing,Math.min(1,dt*10));
   uni.uRimDir.value.set(-.7*Math.sign(card.scale.x||1),.7);
   shadow.material.uniforms.uOpacity.value=1-clamp(card.position.y/(H*.6))*.6;
  }};
 return api;
}
