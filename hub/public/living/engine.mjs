// The living book's engine: a real-time, storybook-lit 3D stage written as code (Three.js / WebGL).
// - One "paint" shader for all scenery: soft wrap lighting from a sun, sky/ground ambient, painterly colour
//   variation, warm lantern pools, rim light and atmospheric fog (far things melt into the sky's colour).
// - A small post chain: bloom, depth-based rack focus, a warm colour grade, vignette, film grain, and the
//   storybook transitions (iris and fade). Rendered at an adaptive resolution so a weak Chromebook GPU stays smooth.
// - A director for camera moves (eased push-ins, pans, cranes) with a breath of hand-held drift.
import * as THREE from '../vendor/three/three.module.js';
export {THREE};
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
// Place an object (Three's position is read-only, so no Object.assign).
export const at=(o,x,y,z)=>{o.position.set(x,y,z);return o;};
export const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
export const easeInOut=t=>{t=clamp(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
export const easeOut=t=>1-Math.pow(1-clamp(t),3);
// Deterministic randomness for scenery (the same world every time).
export function rng(seed=1){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

// ---------- shared GLSL ----------
export const GLSL_NOISE=`
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return v;}
`;
// The world's light, shared by every material through one uniform object.
export function makeLight(){
 return {
  uSunDir:{value:new THREE.Vector3(.4,.6,.3).normalize()},uSunColor:{value:new THREE.Color('#fff1d6')},uSunPower:{value:1},
  uSky:{value:new THREE.Color('#9cc4e8')},uGround:{value:new THREE.Color('#6b5a40')},uAmbient:{value:.55},
  uFogColor:{value:new THREE.Color('#bcd4e6')},uFogNear:{value:30},uFogFar:{value:140},uHazeHeight:{value:0},
  uLamps:{value:Array.from({length:6},()=>new THREE.Vector4(0,-999,0,0))},uLampColor:{value:new THREE.Color('#ffb46a')},
  uTime:{value:0},uWind:{value:1},
 };
}
const PAINT_VERT=`
uniform float uTime,uWind;attribute float aSway;
varying vec3 vW,vN;varying vec2 vUv;varying float vH;varying vec3 vColor;
#ifdef USE_INSTANCING_COLOR
#endif
void main(){
 vec4 p=vec4(position,1.);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 vec4 w=modelMatrix*p;
 // Wind: things with aSway bend with the breeze (leaves, bunting), more at the top.
 float s=aSway*uWind;w.x+=s*(sin(uTime*1.7+w.z*.35+w.x*.2)*.6+sin(uTime*3.1+w.x*.9)*.25);w.z+=s*sin(uTime*1.3+w.x*.3)*.35;
 vW=w.xyz;vUv=uv;vH=position.y;
 mat3 nm=mat3(modelMatrix);
 #ifdef USE_INSTANCING
 nm=nm*mat3(instanceMatrix);
 #endif
 vN=normalize(nm*normal);
 #ifdef USE_INSTANCING_COLOR
 vColor=instanceColor;
 #else
 vColor=vec3(1.);
 #endif
 gl_Position=projectionMatrix*viewMatrix*w;
}`;
const PAINT_FRAG=`
uniform vec3 uColor,uColor2,uSunDir,uSunColor,uSky,uGround,uFogColor,uLampColor,uEmissive;
uniform float uSunPower,uAmbient,uFogNear,uFogFar,uNoise,uNoiseScale,uRim,uTime,uHazeHeight,uGloss,uTop,uAO,uFogAmt;
uniform vec4 uLamps[6];
varying vec3 vW,vN;varying vec2 vUv;varying float vH;varying vec3 vColor;
${GLSL_NOISE}
void main(){
 vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
 // Painterly colour: two tones broken up by soft noise, like brush strokes on paper.
 float k=fbm(vW.xz*uNoiseScale+vW.y*uNoiseScale*.7);
 vec3 base=mix(uColor,uColor2,smoothstep(.3,.75,k)*uNoise)*vColor;
 base=mix(base,base*1.18,uTop*smoothstep(.55,.95,n.y));
 // Soft wrap light (no hard terminator), hemisphere ambient from sky and ground.
 float nd=dot(n,uSunDir),wrap=clamp((nd+.35)/1.35,0.,1.);
 vec3 amb=mix(uGround,uSky,n.y*.5+.5)*uAmbient;
 vec3 lit=base*(amb+uSunColor*uSunPower*wrap*wrap);
 // Rim: the side facing away from the viewer glows a little in the sun's colour.
 vec3 v=normalize(cameraPosition-vW);float rim=pow(1.-max(dot(n,v),0.),3.)*uRim;
 lit+=uSunColor*rim*(.4+.6*max(nd,0.))*uSunPower;
 // Contact shade near the ground (cheap ambient occlusion).
 lit*=mix(1.,smoothstep(0.,.9,vW.y+.05),uAO);
 // Lantern pools: warm light that falls off softly.
 for(int i=0;i<6;i++){vec4 L=uLamps[i];if(L.w<=0.)continue;vec3 d=L.xyz-vW;float r=length(d);
  float f=L.w/(1.+r*r*.35);f*=clamp(dot(n,d/r)*.7+.45,0.,1.);lit+=base*uLampColor*f;}
 lit+=uEmissive;
 lit+=uSunColor*uGloss*pow(max(dot(reflect(-uSunDir,n),v),0.),24.)*uSunPower;
 // Atmospheric perspective: far things melt into the air; low haze in the valleys.
 float dist=length(cameraPosition-vW);float fog=smoothstep(uFogNear,uFogFar,dist);
 fog=max(fog,uHazeHeight*smoothstep(1.2,-2.,vW.y)*smoothstep(8.,40.,dist));
 gl_FragColor=vec4(mix(lit,uFogColor,fog*uFogAmt),1.);
}`;
// A storybook material for scenery. opts: color, color2, noise (0..1), noiseScale, rim, emissive, top, ao, gloss.
export function paint(light,o={}){
 const m=new THREE.ShaderMaterial({vertexShader:PAINT_VERT,fragmentShader:PAINT_FRAG,side:o.side||THREE.FrontSide,
  uniforms:{...light,uColor:{value:new THREE.Color(o.color||'#cccccc')},uColor2:{value:new THREE.Color(o.color2||o.color||'#cccccc')},
   uNoise:{value:o.noise??.6},uNoiseScale:{value:o.noiseScale??.35},uRim:{value:o.rim??.25},uEmissive:{value:new THREE.Color(o.emissive||'#000000')},
   uTop:{value:o.top??.25},uAO:{value:o.ao??.35},uGloss:{value:o.gloss??0},uFogAmt:{value:o.fog??1}}});
 m.userData.paint=true;return m;
}
// Geometry helper: every vertex sways with the wind by `sway` (scaled by height if `byHeight`).
export function withSway(geo,sway=0,byHeight=true){const n=geo.attributes.position.count,a=new Float32Array(n);
 geo.computeBoundingBox();const {min,max}=geo.boundingBox,h=Math.max(1e-6,max.y-min.y);
 for(let i=0;i<n;i++){const y=geo.attributes.position.getY(i);a[i]=sway*(byHeight?Math.pow((y-min.y)/h,1.5):1);}
 geo.setAttribute('aSway',new THREE.BufferAttribute(a,1));return geo;}
export function noSway(geo){if(!geo.attributes.aSway)withSway(geo,0,false);return geo;}

// ---------- the stage: renderer, post chain, adaptive resolution, frame stats ----------
const POST_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const DOWN_FRAG=`uniform sampler2D tSrc;uniform vec2 uTexel;varying vec2 vUv;
void main(){vec3 c=texture2D(tSrc,vUv+uTexel*vec2(-1,-1)).rgb+texture2D(tSrc,vUv+uTexel*vec2(1,-1)).rgb+texture2D(tSrc,vUv+uTexel*vec2(-1,1)).rgb+texture2D(tSrc,vUv+uTexel*vec2(1,1)).rgb;gl_FragColor=vec4(c*.25,1.);}`;
const BLUR_FRAG=`uniform sampler2D tSrc;uniform vec2 uDir;varying vec2 vUv;
void main(){vec3 c=texture2D(tSrc,vUv).rgb*.227;
 c+=(texture2D(tSrc,vUv+uDir*1.385).rgb+texture2D(tSrc,vUv-uDir*1.385).rgb)*.316;
 c+=(texture2D(tSrc,vUv+uDir*3.231).rgb+texture2D(tSrc,vUv-uDir*3.231).rgb)*.070;gl_FragColor=vec4(c,1.);}`;
const COMP_FRAG=`uniform sampler2D tColor,tBlur,tDepth;uniform float uNear,uFar,uFocus,uAperture,uBloom,uBloomT,uTime,uGrain,uVignette,uIris,uFade,uAspect,uSat,uWarm,uExposure,uLetterbox;
uniform vec3 uFadeColor,uLift,uGain;uniform vec2 uIrisCenter;varying vec2 vUv;
${GLSL_NOISE}
float lin(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec3 sharp=texture2D(tColor,vUv).rgb,soft=texture2D(tBlur,vUv).rgb;
 // Rack focus: out-of-focus depths take the blurred image.
 float z=lin(texture2D(tDepth,vUv).r);float coc=clamp(abs(z-uFocus)/max(z,.001)*uAperture*1.6,0.,1.);
 vec3 c=mix(sharp,soft,smoothstep(.05,.9,coc));
 // Bloom from the soft image: lamps, the sun and sparkles glow.
 float lum=dot(soft,vec3(.299,.587,.114));vec3 b=soft*smoothstep(uBloomT,uBloomT+.6,lum);c+=b*uBloom;
 c*=uExposure;
 // Grade: gentle lift/gain, warm or cool, saturation.
 c=c*uGain+uLift*(1.-c);c=aces(c);
 float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);c+=vec3(.02,.005,-.02)*uWarm;
 c=pow(max(c,0.),vec3(1./2.2));
 // Vignette and paper-like grain.
 vec2 q=vUv-.5;q.x*=uAspect;c*=1.-uVignette*smoothstep(.35,1.05,length(q)*1.2);
 c+=(hash12(vUv*vec2(1917.,1123.)+fract(uTime*7.1)*93.)-.5)*uGrain;
 // Storybook transitions: an iris that closes on a point, and a fade to a colour.
 vec2 ic=vUv-uIrisCenter;ic.x*=uAspect;float ir=smoothstep(uIris,uIris+.012,length(ic));
 c=mix(c,vec3(.02,.015,.03),uIris<1.5?ir:0.);
 c=mix(c,uFadeColor,uFade);
 float lb=step(abs(vUv.y-.5),.5-uLetterbox);c*=lb;
 gl_FragColor=vec4(c,1.);
}`;
export function createStage(canvas,{maxScale=1,onStats=()=>{}}={}){
 let gl=null;
 try{gl=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',stencil:false,depth:true});}catch(e){return null;}
 const renderer=gl;renderer.setClearColor(0x000000,1);renderer.autoClear=true;
 const caps=renderer.capabilities;const half=caps.isWebGL2&&(renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float'));
 const type=half?THREE.HalfFloatType:THREE.UnsignedByteType;
 // Start by the device: small memory or a phone-class GPU begins at a lower resolution; the governor adapts.
 const mem=navigator.deviceMemory||8,dpr=Math.min(globalThis.devicePixelRatio||1,2);
 let scale=Math.min(maxScale,mem<=4?0.62:0.85),budget=1000/45;
 const mkRT=(w,h,depth)=>{const rt=new THREE.WebGLRenderTarget(w,h,{type,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:!!depth});if(depth){rt.depthTexture=new THREE.DepthTexture(w,h);rt.depthTexture.type=THREE.UnsignedIntType;}return rt;};
 let main=null,down=null,blurA=null,blurB=null,W=0,H=0;
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));const postScene=new THREE.Scene();postScene.add(quad);const postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const downMat=new THREE.ShaderMaterial({vertexShader:POST_VERT,fragmentShader:DOWN_FRAG,uniforms:{tSrc:{value:null},uTexel:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false});
 const blurMat=new THREE.ShaderMaterial({vertexShader:POST_VERT,fragmentShader:BLUR_FRAG,uniforms:{tSrc:{value:null},uDir:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false});
 const post={uFocus:8,uAperture:0,uBloom:.4,uBloomT:.9,uGrain:.025,uVignette:.45,uIris:2,uFade:0,uSat:1.05,uWarm:0,uExposure:1,uLetterbox:0,
  uFadeColor:new THREE.Color('#0b0a12'),uLift:new THREE.Color(0,0,0),uGain:new THREE.Color(1,1,1),uIrisCenter:new THREE.Vector2(.5,.5)};
 const compMat=new THREE.ShaderMaterial({vertexShader:POST_VERT,fragmentShader:COMP_FRAG,depthTest:false,depthWrite:false,
  uniforms:{tColor:{value:null},tBlur:{value:null},tDepth:{value:null},uNear:{value:.1},uFar:{value:500},uTime:{value:0},uAspect:{value:1},
   ...Object.fromEntries(Object.entries(post).map(([k,v])=>[k,{value:v}]))}});
 function size(){
  const cw=canvas.clientWidth||innerWidth,ch=canvas.clientHeight||innerHeight;
  const w=Math.max(2,Math.round(cw*dpr*scale)),h=Math.max(2,Math.round(ch*dpr*scale));
  if(w===W&&h===H)return;W=w;H=h;renderer.setPixelRatio(1);renderer.setSize(w,h,false);
  for(const rt of [main,down,blurA,blurB])rt?.dispose();
  main=mkRT(w,h,true);const qw=Math.max(2,w>>2),qh=Math.max(2,h>>2);down=mkRT(qw,qh);blurA=mkRT(qw,qh);blurB=mkRT(qw,qh);
  compMat.uniforms.uAspect.value=w/h;
 }
 // Frame stats and the resolution governor (never changes more than once a second).
 const times=[];let last=performance.now(),lastAdapt=last,frames=0;
 function govern(dt){times.push(dt);if(times.length>240)times.shift();frames++;
  const now=performance.now();if(now-lastAdapt<1200||times.length<30)return;lastAdapt=now;
  const recent=times.slice(-40).sort((a,b)=>a-b),p70=recent[Math.floor(recent.length*.7)];
  if(p70>budget*1.15&&scale>0.45){scale=Math.max(0.45,scale-0.08);size();}
  else if(p70<budget*0.6&&scale<maxScale){scale=Math.min(maxScale,scale+0.05);size();}
 }
 function stats(){const s=[...times].sort((a,b)=>a-b),q=p=>s.length?+s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(1):null;return {frames,scale:+scale.toFixed(2),p50:q(.5),p95:q(.95),max:s.length?+s.at(-1).toFixed(1):null,w:W,h:H,halfFloat:half};}
 function render(scene,camera,t){
  size();const now=performance.now(),dt=now-last;last=now;if(dt<500)govern(dt);
  renderer.setRenderTarget(main);renderer.render(scene,camera);
  quad.material=downMat;downMat.uniforms.tSrc.value=main.texture;downMat.uniforms.uTexel.value.set(1.5/W,1.5/H);renderer.setRenderTarget(down);renderer.render(postScene,postCam);
  quad.material=blurMat;blurMat.uniforms.tSrc.value=down.texture;blurMat.uniforms.uDir.value.set(1/down.width,0);renderer.setRenderTarget(blurA);renderer.render(postScene,postCam);
  blurMat.uniforms.tSrc.value=blurA.texture;blurMat.uniforms.uDir.value.set(0,1/down.height);renderer.setRenderTarget(blurB);renderer.render(postScene,postCam);
  blurMat.uniforms.tSrc.value=blurB.texture;blurMat.uniforms.uDir.value.set(2/down.width,0);renderer.setRenderTarget(blurA);renderer.render(postScene,postCam);
  blurMat.uniforms.tSrc.value=blurA.texture;blurMat.uniforms.uDir.value.set(0,2/down.height);renderer.setRenderTarget(blurB);renderer.render(postScene,postCam);
  const u=compMat.uniforms;u.tColor.value=main.texture;u.tBlur.value=blurB.texture;u.tDepth.value=main.depthTexture;u.uNear.value=camera.near;u.uFar.value=camera.far;u.uTime.value=t;
  for(const [k,v] of Object.entries(post))if(u[k]&&typeof v==='number')u[k].value=v;
  quad.material=compMat;renderer.setRenderTarget(null);renderer.render(postScene,postCam);
  onStats(stats);
 }
 return {renderer,render,post,stats,resize:size,get size(){return {w:W,h:H};},setBudget:ms=>{budget=ms;},dispose(){for(const rt of [main,down,blurA,blurB])rt?.dispose();renderer.dispose();}};
}

// ---------- camera director ----------
// A shot: {dur, from:{pos,look,fov,keep?}, to:{...}, ease, focusFrom, focusTo, aperture}. Hand-held drift is tiny.
// frame(end) -> {P,L,fov}: the responsive framer (frame.mjs) composes each end of the shot for this screen; both
// ends are re-framed every frame, so a character who moves (a bird landing) stays in frame all the way.
export function director(camera,post,{frame=null}={}){
 let shot=null,t0=0,resolve=null,settled=true;const P=new THREE.Vector3(),L=new THREE.Vector3(),drift=new THREE.Vector3();let follow=null;
 const raw=e=>({P:v3(e.pos),L:v3(e.look),fov:e.fov||40});
 function play(s,now){shot=s;t0=now;settled=false;return new Promise(r=>{resolve=r;});}
 function update(now,dt){
  if(follow){follow(now,dt);}
  else if(shot){const k=(shot.ease||easeInOut)(clamp((now-t0)/(shot.dur*1000)));
   const A=(frame||raw)(shot.from),B=(frame||raw)(shot.to);
   P.lerpVectors(A.P,B.P,k);L.lerpVectors(A.L,B.L,k);
   camera.fov=lerp(A.fov,B.fov,k);camera.updateProjectionMatrix();
   if(A.focus!=null&&B.focus!=null)post.uFocus=lerp(A.focus,B.focus,shot.focusEase?shot.focusEase(k):k);
   else if(shot.focusFrom!=null)post.uFocus=lerp(A.focus??shot.focusFrom,B.focus??(shot.focusTo??shot.focusFrom),shot.focusEase?shot.focusEase(k):k);
   if(shot.aperture!=null)post.uAperture=shot.aperture;
   const h=shot.handheld??.03;drift.set(Math.sin(now*.00071)*h,Math.sin(now*.00093+1)*h*.6,Math.sin(now*.00053+2)*h*.4);
   camera.position.copy(P).add(drift);camera.lookAt(L);
   if(k>=1){settled=true;if(resolve){const r=resolve;resolve=null;r();}}}
 }
 return {play,update,setFollow:f=>{follow=f;},get shot(){return shot;},get settled(){return settled&&!follow;},get following(){return !!follow;}};
}
const v3=a=>a.isVector3?a:new THREE.Vector3(a[0],a[1],a[2]);
// Animate a value over time (for the post chain, light, etc.). Returns a promise.
export function tween(obj,key,to,ms,ease=easeInOut,clock=performance){const from=obj[key],t0=clock.now();
 return new Promise(res=>{const step=()=>{const k=clamp((clock.now()-t0)/ms);obj[key]=typeof from==='number'?lerp(from,to,ease(k)):to;if(k<1)requestAnimationFrame(step);else res();};step();});}
