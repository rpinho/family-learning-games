// Responsive framing for the living book: the same shot composed for a wide screen (Chromebook, a phone held
// sideways) and for a tall one (a phone held upright). A shot names what must be in frame ("keep": characters,
// the balls, the board); the framer turns the camera's composed position into one that keeps all of it inside a
// safe margin: first sliding sideways (as little as it can), then stepping back. On a tall screen the lens
// also opens up, because an upright phone sees a narrow slice of the world through the same lens.
// It also measures, for the checks: how much of each character a child can actually see (an ID render: its own
// pixels on screen, not hidden by the screen edge, the letterbox, another character, scenery or a button).
import {THREE,clamp,lerp} from './engine.mjs';

export function viewMode(w,h){const aspect=w/Math.max(1,h);return {aspect,tall:aspect<.85,wide:aspect>=1.2};}
// How much wider the lens opens on a tall screen (1 on wide screens, ~1.35 on an upright phone).
export const tallFov=(fov,aspect)=>aspect>=1?fov:Math.min(64,fov*lerp(1,1.38,clamp((1-aspect)/.55)));

// Points that stand for an object in frame: a character's upright cylinder (feet to head, a hop included), an
// Object3D's bounding box, a Vector3, or a list of those.
const tmpBox=new THREE.Box3();
export function pointsOf(o,out=[]){
 if(!o)return out;
 if(Array.isArray(o)){for(const x of o)pointsOf(x,out);return out;}
 if(o.isVector3){out.push(o.clone());return out;}
 if(o.root&&o.height){if(!o.root.visible)return out;const p=o.root.position,r=Math.max(.15,(o.card?Math.abs(o.uniforms?.uW?.value||o.width):o.width)*.5),h=o.height*1.08,y=p.y;
  for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])for(const yy of [y,y+h])out.push(new THREE.Vector3(p.x+dx,yy,p.z+dz));return out;}
 if(o.isObject3D){if(!o.visible)return out;o.updateWorldMatrix(true,true);tmpBox.setFromObject(o);if(tmpBox.isEmpty())return out;const {min:a,max:b}=tmpBox;
  for(const x of [a.x,b.x])for(const y of [a.y,b.y])for(const z of [a.z,b.z])out.push(new THREE.Vector3(x,y,z));}
 return out;
}

// The framer. getKeep(shot) -> points; margins are fractions of the half-screen (1 = the very edge).
export function makeFramer(camera,{getKeep=()=>[],marginX=.84,marginY=.86,letterbox=()=>0}={}){
 const up=new THREE.Vector3(0,1,0),f=new THREE.Vector3(),r=new THREE.Vector3(),u=new THREE.Vector3(),d=new THREE.Vector3();
 return function frame(s){
  const P=new THREE.Vector3(...(s.pos.isVector3?s.pos.toArray():s.pos)),L=new THREE.Vector3(...(s.look.isVector3?s.look.toArray():s.look));
  if(s.raw)return {P,L,fov:s.fov||camera.fov};
  const aspect=camera.aspect,fov=s.tallFov===false?(s.fov||40):tallFov(s.fov||40,aspect);
  const pts=getKeep(s);if(!pts.length)return {P,L,fov};
  f.subVectors(L,P).normalize();r.crossVectors(f,up).normalize();u.crossVectors(r,f);
  const tanV=Math.tan(fov*Math.PI/360)*(1-2*letterbox())*marginY,tanH=Math.tan(fov*Math.PI/360)*aspect*marginX;
  const X=[],Y=[],Z=[];for(const p of pts){d.subVectors(p,P);X.push(d.dot(r));Y.push(d.dot(u));Z.push(d.dot(f));}
  // How far back the camera must step (along its own axis) so every point fits, after a sideways slide s.
  const need=s0=>{let m=-Infinity;for(let i=0;i<X.length;i++)m=Math.max(m,Math.abs(X[i]-s0)/tanH-Z[i],Math.abs(Y[i])/tanV-Z[i]);return m;};
  let lo=Math.min(...X),hi=Math.max(...X);
  // The slide that needs the least stepping back (the function is convex: ternary search).
  for(let k=0;k<40;k++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(need(a)<need(b))hi=b;else lo=a;}
  let best=(lo+hi)/2,slide=0;
  if(need(0)>0){
   // Slide only as far as needed: if the best slide fits without stepping back, find the smallest slide that does.
   if(need(best)<=0){let a=0,b=best;for(let k=0;k<30;k++){const m=(a+b)/2;if(need(m)<=0)b=m;else a=m;}slide=b;}else slide=best;
  }
  const back=Math.max(0,need(slide));
  P.addScaledVector(r,slide).addScaledVector(f,-back);L.addScaledVector(r,slide);
  // Focus on what the shot keeps (depth of field never blurs the characters that matter).
  let zs=0;for(const z of Z)zs+=z;const focus=zs/Z.length+back;
  return {P,L,fov,focus};
 };
}

// ---------- measurement (checks only) ----------
// targets: [{id, obj}] (puppets or 3D toys); hide: CSS rects that cover the canvas (buttons, cards, panels).
const ID_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export function measureVisibility(renderer,scene,camera,targets,{letterbox=0,hide=[],css={w:innerWidth,h:innerHeight},res=.34}={}){
 const w=Math.max(32,Math.round(css.w*res)),h=Math.max(32,Math.round(css.h*res));
 const rtA=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true}),rtS=new THREE.WebGLRenderTarget(w*3,h*3,{depthBuffer:true});
 const saved=[],black=new THREE.MeshBasicMaterial({color:0x000000}),mats=[];
 const owner=new Map();targets.forEach((t,i)=>{t.obj.root.traverse(o=>owner.set(o,i));});
 const idColor=i=>new THREE.Color((i+1)*28/255,0,1);
 const idMat=(o,i)=>{const m=o.material,c=idColor(i);
  // A painted puppet: its picture's own outline (transparent parts are not him).
  if(m?.uniforms?.map&&m.uniforms.uH){const x=new THREE.ShaderMaterial({vertexShader:m.vertexShader,fragmentShader:`uniform sampler2D map;uniform vec3 uId;varying vec2 vUv;void main(){if(texture2D(map,vUv).a<.4)discard;gl_FragColor=vec4(uId,1.);}`,uniforms:{...m.uniforms,uId:{value:c}},side:THREE.DoubleSide});mats.push(x);return x;}
  const x=new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide});mats.push(x);return x;};
 scene.traverse(o=>{if(!(o.isMesh||o.isPoints||o.isSprite||o.isLine))return;saved.push([o,o.material,o.visible]);
  const i=owner.get(o);
  if(i!=null){if(o.material?.transparent&&!o.material.depthWrite){o.visible=false;return;}o.material=idMat(o,i);return;}
  if(o.isPoints||o.isSprite||o.isLine||o.userData.noOcclude||o.material?.transparent||o.renderOrder<=-10){o.visible=false;return;}
  o.material=black;});
 const bg=scene.background;scene.background=null;const prevRT=renderer.getRenderTarget(),prevClear=renderer.getClearColor(new THREE.Color()),prevAlpha=renderer.getClearAlpha();renderer.setClearColor(0x000000,1);
 const read=rt=>{const px=new Uint8Array(rt.width*rt.height*4);renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,px);return px;};
 const idOf=(px,k)=>{if(px[k+2]<200)return -1;const i=Math.round(px[k]/28)-1;return i>=0&&i<targets.length&&Math.abs(px[k]-(i+1)*28)<=4?i:-1;};
 // Pass A: everyone and everything, as the child sees it.
 renderer.setRenderTarget(rtA);renderer.clear();renderer.render(scene,camera);const A=read(rtA);
 const seen=new Array(targets.length).fill(0),byUI=new Array(targets.length).fill(0),byBox=new Array(targets.length).fill(0);
 const lbRows=Math.round(h*letterbox);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4,i=idOf(A,k);if(i<0)continue;
  // Pixel rows run bottom-up; CSS runs top-down.
  const cx=(x+.5)/w*css.w,cy=(1-(y+.5)/h)*css.h;
  if(y<lbRows||y>=h-lbRows){byBox[i]++;continue;}
  if(hide.some(r=>cx>=r.left&&cx<r.right&&cy>=r.top&&cy<r.bottom)){byUI[i]++;continue;}
  seen[i]++;}
 // Pass S (per character, alone, through a lens three times wider): all of him, on screen or not.
 const wide=camera.clone();wide.projectionMatrix.copy(camera.projectionMatrix).premultiply(new THREE.Matrix4().makeScale(1/3,1/3,1));wide.projectionMatrixInverse.copy(wide.projectionMatrix).invert();
 const out=[];
 targets.forEach((t,i)=>{
  const vis=[];scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isSprite||o.isLine){vis.push([o,o.visible]);if(owner.get(o)!==i)o.visible=false;}});
  renderer.setRenderTarget(rtS);renderer.clear();renderer.render(scene,wide);const S=read(rtS);
  for(const [o,v] of vis)o.visible=v;
  let total=0,on=0;for(let y=0;y<3*h;y++)for(let x=0;x<3*w;x++){if(idOf(S,(y*3*w+x)*4)!==i)continue;total++;if(x>=w&&x<2*w&&y>=h&&y<2*h)on++;}
  out.push({id:t.id,share:total?+(seen[i]/total).toFixed(3):0,onScreen:total?+(on/total).toFixed(3):0,px:total,hiddenByUI:total?+(byUI[i]/total).toFixed(3):0,letterbox:total?+(byBox[i]/total).toFixed(3):0});
 });
 for(const [o,m,v] of saved){o.material=m;o.visible=v;}
 for(const m of mats)m.dispose();black.dispose();rtA.dispose();rtS.dispose();
 scene.background=bg;renderer.setRenderTarget(prevRT);renderer.setClearColor(prevClear,prevAlpha);
 return out;
}
