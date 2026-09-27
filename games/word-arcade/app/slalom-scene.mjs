// Letter Slalom 3D scene (three.js). Loaded on demand when a run starts, so the rest of Word Arcade never pays for it.
// Everything is procedural: snowy valley, low-poly pines, layered alpine ridges, a friendly skier in a bobble hat,
// letter gates, ski tracks and snow spray. Quality scales itself from measured frame times (cheap Chromebooks, phones).
// The course is described in (u, d): d = metres down the hill, u = metres left/right of the winding centre line.
import {Sprite,SpriteMaterial,AnimationMixer,Box3,BackSide,BoxGeometry,BufferAttribute,BufferGeometry,CanvasTexture,CapsuleGeometry,CircleGeometry,Color,ConeGeometry,CylinderGeometry,DirectionalLight,DoubleSide,DynamicDrawUsage,Euler,Float32BufferAttribute,FogExp2,Group,HemisphereLight,IcosahedronGeometry,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshLambertMaterial,NeutralToneMapping,PCFShadowMap,PerspectiveCamera,PlaneGeometry,Points,Quaternion,Raycaster,RepeatWrapping,SRGBColorSpace,Scene,ShaderMaterial,SphereGeometry,TorusGeometry,Vector2,Vector3,WebGLRenderer} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

import {COURSE,targetSpeed as speedFor,nextSpeed} from '../lib/slalom-timing.mjs';
export {COURSE};
export const laneOffsets=n=>n===3?[-6.6,0,6.6]:n===2?[-4.3,4.3]:[0];
const SLOPE=0.2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(rate,dt)=>1-Math.exp(-rate*dt);
// Centre line of the run and its slope.
export const cx=d=>6.5*Math.sin(d/96)+3*Math.sin(d/43+1.3);
const dcx=d=>6.5/96*Math.cos(d/96)+3/43*Math.cos(d/43+1.3);
function bank(a,d){if(a<14)return 0;const t=a-14;return t*t*0.0024+t*0.03+Math.sin(d/57+a/23)*Math.min(7,t*0.09)+Math.sin(a/9.5+d/31)*Math.min(2.5,t*0.04);}
export const groundY=(u,d)=>-d*SLOPE+0.55*Math.sin(d/27)+0.35*Math.sin(d/61+0.7)+0.18*Math.sin(u/7+d/19)*clamp((Math.abs(u)-3)/10,0,1)+bank(Math.abs(u),d);
const world=(u,d,out=new Vector3())=>out.set(cx(d)+u,groundY(u,d),-d);
const forward=(d,out=new Vector3())=>out.set(dcx(d),0,-1).normalize();

const TIERS=[
 {name:'low',maxDpr:1,scale:0.72,minScale:0.5,shadows:false,shadowMap:0,trees:0.4,spray:110,clouds:5,rocks:0.4},
 {name:'medium',maxDpr:1.3,scale:0.9,minScale:0.6,shadows:true,shadowMap:1024,trees:0.7,spray:220,clouds:9,rocks:0.7},
 {name:'high',maxDpr:1.75,scale:1,minScale:0.7,shadows:true,shadowMap:2048,trees:1,spray:340,clouds:14,rocks:1}
];
export function guessTier(nav=globalThis.navigator,force){
 const named={low:0,medium:1,high:2};if(force in named)return named[force];
 const mem=nav?.deviceMemory||4,cores=nav?.hardwareConcurrency||4,coarse=globalThis.matchMedia?.('(pointer:coarse)').matches;
 // Touch devices and small-memory machines (the kids' Chromebooks, phones) start on the lightest tier and step up only
 // if the frames measured on the device are fast; desktops start high and step down if needed.
 if(mem<=4||cores<=4||coarse)return 0;
 return 2;
}
function seeded(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
function canvasTexture(w,h,draw,{repeat=false}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;if(repeat){t.wrapS=t.wrapT=RepeatWrapping;}t.anisotropy=2;return t;
}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
const FONT='"Andika","Nunito","Avenir Next Rounded","Arial Rounded MT Bold",ui-rounded,system-ui,sans-serif';
function drawBanner(g,text,border,res,y0){
 const w=512*res,h=224*res;g.save();g.translate(0,y0);
 g.fillStyle='rgba(20,40,70,.18)';roundRect(g,10*res,16*res,w-16*res,h-20*res,34*res);g.fill();
 g.fillStyle='#fffdf8';roundRect(g,6*res,6*res,w-16*res,h-18*res,34*res);g.fill();
 g.lineWidth=16*res;g.strokeStyle=border;roundRect(g,14*res,14*res,w-32*res,h-34*res,28*res);g.stroke();
 let size=(text.length<=1?170:text.length<=4?128:text.length<=6?104:84)*res;
 g.fillStyle='#15304d';g.textAlign='center';g.textBaseline='middle';
 do{g.font=`800 ${size}px ${FONT}`;size-=6*res;}while(g.measureText(text).width>w-90*res&&size>30);
 g.fillText(text,w/2-5*res,h/2-2*res);g.restore();
}
// ---------- geometry builders ----------
function colored(geo,color){geo=geo.index?geo.toNonIndexed():geo;const c=new Color(color),n=geo.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)c.toArray(a,i*3);geo.setAttribute('color',new BufferAttribute(a,3));geo.deleteAttribute('uv');return geo;}
function pineGeometry(){
 const parts=[],snow=new Color('#eef4fb'),dark=new Color('#1d3b3d'),mid=new Color('#2c5150');
 parts.push(colored(new CylinderGeometry(0.16,0.24,1.3,5).translate(0,0.65,0),'#5b4034'));
 const tiers=[[1.8,2.6,0.9],[1.3,2.3,2.3],[0.78,2.0,3.6]];
 for(const [r,h,y] of tiers){
  let g=new ConeGeometry(r,h,7,2,true).toNonIndexed();g.translate(0,y+h/2,0);g.deleteAttribute('uv');
  const p=g.attributes.position,col=new Float32Array(p.count*3),tmp=new Color();
  for(let i=0;i<p.count;i++){const t=(p.getY(i)-y)/h,x=p.getX(i),z=p.getZ(i),ang=Math.atan2(z,x),n=0.5+0.5*Math.sin(ang*3.7+y*5);
   if(t>0.2){tmp.copy(mid).lerp(snow,clamp((t-0.2)*1.8+n*0.35,0,1));}else tmp.copy(dark).lerp(mid,t*2);
   // a jagged snowy droop on the lower rim
   if(t<0.02){p.setY(i,p.getY(i)-0.12*n);}
   tmp.toArray(col,i*3);}
  g.setAttribute('color',new BufferAttribute(col,3));parts.push(g);
 }
 const out=mergeGeometries(parts);out.computeVertexNormals();return out;
}
function farPineGeometry(){const parts=[colored(new CylinderGeometry(0.2,0.25,1.2,4,1,true).translate(0,0.6,0),'#4a3a33')];
 for(const [r,h,y,top] of [[1.8,3.2,0.9,'#dfe8f1'],[1.15,2.6,2.9,'#f2f6fb']]){let g=new ConeGeometry(r,h,6,1,true).toNonIndexed();g.translate(0,y+h/2,0);g.deleteAttribute('uv');const p=g.attributes.position,col=new Float32Array(p.count*3),a=new Color('#1f3c3f'),b=new Color(top),c=new Color();for(let i=0;i<p.count;i++){c.copy(a).lerp(b,clamp((p.getY(i)-y)/h*1.3-0.25,0,1));c.toArray(col,i*3);}g.setAttribute('color',new BufferAttribute(col,3));parts.push(g);}
 const out=mergeGeometries(parts);out.computeVertexNormals();return out;}
function rockGeometry(){const g=new IcosahedronGeometry(1,0).toNonIndexed();const p=g.attributes.position,r=seeded(9),col=new Float32Array(p.count*3),c=new Color();
 for(let i=0;i<p.count;i++){p.setXYZ(i,p.getX(i)*(1+r()*0.25),p.getY(i)*0.62,p.getZ(i)*(1+r()*0.25));(p.getY(i)>0.35?c.set('#f1f5fa'):c.set('#6f7c8c').lerp(new Color('#4d5866'),r())).toArray(col,i*3);}
 g.setAttribute('color',new BufferAttribute(col,3));g.deleteAttribute('uv');g.computeVertexNormals();return g;}
function terrainGeometry(){
 const us=[],N=34;for(let k=-N;k<=N;k++){const s=Math.sign(k),t=Math.abs(k)/N;us.push(s*(t**1.8)*260);}
 const ds=[];for(let d=-90;d<=720;d+=4)ds.push(d);for(let d=735;d<=1500;d+=15)ds.push(d);
 const W=us.length,H=ds.length,pos=new Float32Array(W*H*3),col=new Float32Array(W*H*3),uv=new Float32Array(W*H*2),idx=[];
 const piste=new Color('#f7f9fc'),soft=new Color('#e9f0f8'),blue=new Color('#dbe6f2'),c=new Color();
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=us[i],d=ds[j],k=j*W+i,a=Math.abs(u);
  pos[k*3]=cx(d)+u;pos[k*3+1]=groundY(u,d);pos[k*3+2]=-d;
  const n=0.5+0.5*Math.sin(u*0.21+d*0.13)*Math.sin(d*0.047-u*0.09);
  c.copy(piste).lerp(soft,clamp((a-10)/8,0,1)).lerp(blue,clamp((a-40)/120,0,0.7)*n);c.toArray(col,k*3);
  uv[k*2]=u/5;uv[k*2+1]=d/5;}
 for(let j=0;j<H-1;j++)for(let i=0;i<W-1;i++){const a=j*W+i,b=a+1,c2=a+W,d2=c2+1;idx.push(a,b,c2,b,d2,c2);}
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(pos,3));g.setAttribute('color',new BufferAttribute(col,3));g.setAttribute('uv',new BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
// Layered alpine skyline: sloped, fractal ridges (ridged value noise) with baked light, rock on steep faces and
// snowfields on gentle ones, hazed per layer. Unlit, no fog cost, one draw call per layer.
function ridgeGeometry({radius,height,base,seed,haze,rock,span,depth,mist=0.25,peaks:np=7,center=new Vector3(0,0,-420)}){
 const r=seeded(seed),lat=[];for(let i=0;i<512;i++)lat.push(r());
 const vn=x=>{const i=Math.floor(x),f=x-i,t=f*f*(3-2*f);return lat[i&511]*(1-t)+lat[(i+1)&511]*t;};
 const ridged=x=>{let v=0,a=0.5,f=1;for(let o=0;o<5;o++){const n=1-Math.abs(vn(x*f+o*17)*2-1);v+=a*n*n;a*=0.5;f*=2.1;}return v;};
 const peaks=Array.from({length:np},()=>[span[0]+r()*(span[1]-span[0]),0.6+r()*0.4,0.2+r()*0.22]);
 const env=a=>{let e=0.34;for(const [p,amp,w] of peaks){const t=(a-p)/w;e=Math.max(e,amp*Math.exp(-t*t*2.2));}return e;};
 const n=300,R=7,pos=[],col=[],idx=[],L=new Vector3(0.75,0.55,0.35).normalize();
 const hOf=a=>height*env(a)*(0.45+0.85*ridged(a*7+seed));
 const P=(i,k)=>{const a=span[0]+(span[1]-span[0])*i/n,f=k/R,h=hOf(a),y=base+h*Math.pow(f,0.9)*(1+0.06*Math.sin(a*70+k)),rad=radius+depth*f*(0.6+0.8*env(a));return new Vector3(center.x+Math.sin(a)*rad,y,center.z-Math.cos(a)*rad);};
 const grid=[];for(let i=0;i<=n;i++){grid.push([]);for(let k=0;k<=R;k++)grid[i].push(P(i,k));}
 const snow=new Color('#fffdf8'),shade=new Color('#8ba4c8'),rk=new Color(rock),hz=new Color(haze),c=new Color(),e1=new Vector3(),e2=new Vector3(),nm=new Vector3();
 for(let i=0;i<=n;i++)for(let k=0;k<=R;k++){const p=grid[i][k];pos.push(p.x,p.y,p.z);
  e1.subVectors(grid[Math.min(n,i+1)][k],grid[Math.max(0,i-1)][k]);e2.subVectors(grid[i][Math.min(R,k+1)],grid[i][Math.max(0,k-1)]);nm.crossVectors(e1,e2).normalize();if(nm.dot(p.clone().sub(center))>0)nm.negate();
  const lit=clamp(nm.dot(L)*1.3+0.15,0,1),f=k/R,steep=1-Math.abs(nm.y),noise=vn(i*0.45+k*3.1+seed*9);
  c.copy(shade).lerp(snow,lit);
  if(steep>0.42+noise*0.3&&f>0.12)c.lerp(rk,clamp((steep-0.38)*1.8,0,0.9)*(0.6+0.4*lit));
  c.lerp(hz,clamp(1-f*1.9,0,1)*0.85);c.lerp(hz,mist*(1-f*0.35));c.toArray(col,col.length);}
 for(let i=0;i<n;i++)for(let k=0;k<R;k++){const a=i*(R+1)+k,b=a+R+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(col,3));g.setIndex(idx);return g;
}
function skyMaterial(sunDir){
 return new ShaderMaterial({side:BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new Color('#1f63bf')},mid:{value:new Color('#6fa6e3')},horizon:{value:new Color('#dbe7f3')},sun:{value:sunDir.clone()}},
  vertexShader:'varying vec3 vDir;void main(){vDir=normalize((modelMatrix*vec4(position,1.0)).xyz-cameraPosition);gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
  fragmentShader:'uniform vec3 top;uniform vec3 mid;uniform vec3 horizon;uniform vec3 sun;varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.0);vec3 c=mix(horizon,mid,smoothstep(0.0,0.14,h));c=mix(c,top,smoothstep(0.1,0.6,h));float s=max(dot(d,sun),0.0);c+=vec3(1.0,0.93,0.8)*(pow(s,6.0)*0.22+pow(s,60.0)*0.35)+vec3(1.0)*smoothstep(0.9993,0.9997,s)*1.2;gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
}
function softSprite(){return canvasTexture(64,64,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.45,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});}
function cloudTexture(seed){const r=seeded(seed);return canvasTexture(256,128,(g,w,h)=>{for(let i=0;i<26;i++){const x=w*(0.12+r()*0.76),y=h*(0.45+r()*0.3),rad=h*(0.18+r()*0.3),gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);}});}
function snowGrain(){const r=seeded(4);return canvasTexture(256,256,(g,w,h)=>{g.fillStyle='#ffffff';g.fillRect(0,0,w,h);for(let i=0;i<3600;i++){const v=238+Math.floor(r()*18);g.fillStyle=`rgb(${v},${v+2},${Math.min(255,v+8)})`;g.fillRect(Math.floor(r()*w),Math.floor(r()*h),1+Math.floor(r()*2),1);}
 // groomed corduroy, very faint
 for(let y=0;y<h;y+=4){g.fillStyle='rgba(170,190,215,.05)';g.fillRect(0,y,w,1);}},{repeat:true});}

// ---------- the skier ----------
// Rigid parts are merged per moving group (vertex colours), so the whole skier is nine draw calls.
function part(geo,color,x=0,y=0,z=0,rx=0){const g=geo.index?geo.toNonIndexed():geo;g.deleteAttribute('uv');if(rx)g.rotateX(rx);g.translate(x,y,z);return colored(g,color);}
function makeSkier(ride='ski'){
 const board=ride==='board',mat=new MeshLambertMaterial({vertexColors:true});
 // tilt: the whole rider (and a board's edge) leans into a carve around the direction of travel
 const root=new Group(),tilt=new Group(),body=new Group();root.add(tilt);tilt.add(body);
 const merged=(parent,parts,x=0,y=0,z=0)=>{const m=new Mesh(mergeGeometries(parts),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const jacket=board?'#7b5cff':'#ff7a33',pants='#27365c',dark='#1c2233',skin='#f2c7a4',hat=board?'#ffb020':'#e2474b',white='#fbfbff',ski='#f4b53a',pole='#c9d2de';
 const skis=board
  ? merged(tilt,[part(new BoxGeometry(0.34,0.045,1.42),'#20c3b3',0,0.03,0),part(new BoxGeometry(0.34,0.045,0.2).rotateX(0.35),'#20c3b3',0,0.07,-0.77),part(new BoxGeometry(0.34,0.045,0.2).rotateX(-0.35),'#20c3b3',0,0.07,0.77),part(new BoxGeometry(0.08,0.05,1.2),'#fff3c4',0,0.056,0),...[-1,1].map(s=>part(new BoxGeometry(0.26,0.07,0.14),dark,0,0.08,s*0.3))])
  : merged(tilt,[-1,1].flatMap(s=>[part(new BoxGeometry(0.11,0.035,1.75),ski,s*0.13,0.02,0),part(new BoxGeometry(0.11,0.035,0.24).rotateX(0.45),ski,s*0.13,0.07,-0.95)]));
 const legs=[];
 for(const s of [-1,1]){const hip=new Group();hip.position.set(s*(board?0.2:0.12),0.78,0.02);body.add(hip);
  merged(hip,[part(new CapsuleGeometry(0.085,0.32,3,8),pants,0,-0.2,0)]);
  const knee=new Group();knee.position.set(0,-0.4,0);hip.add(knee);
  merged(knee,[part(new CapsuleGeometry(0.075,0.28,3,8),pants,0,-0.18,0),part(new BoxGeometry(0.15,0.15,0.3),dark,0,-0.38,-0.03)]);legs.push({hip,knee});}
 merged(body,[part(new CapsuleGeometry(0.2,0.34,4,10),jacket,0,1.08,0),part(new BoxGeometry(0.3,0.34,0.14),pants,0,1.1,0.19),part(new TorusGeometry(0.14,0.05,6,12),'#35c2b8',0,1.37,0,Math.PI/2)]);
 const head=new Group();head.position.set(0,1.52,0);body.add(head);
 merged(head,[part(new SphereGeometry(0.15,14,10),skin),part(new SphereGeometry(0.162,14,8,0,Math.PI*2,0,Math.PI/1.9),hat,0,0.02,0),part(new TorusGeometry(0.15,0.035,6,16),white,0,0,0,Math.PI/2),part(new SphereGeometry(0.075,10,8),white,0,0.2,0),part(new BoxGeometry(0.24,0.07,0.06),'#ffb347',0,0.02,-0.13)]);
 const arms=[];
 for(const s of [-1,1]){const sh=new Group();sh.position.set(s*0.24,1.26,0);body.add(sh);
  merged(sh,[part(new CapsuleGeometry(0.07,0.36,3,8),jacket,0,-0.22,0),part(new SphereGeometry(0.07,8,6),dark,0,-0.45,0),...(board?[]:[part(new CylinderGeometry(0.014,0.014,1.15,5),pole,0,-0.9,0.02),part(new CylinderGeometry(0.06,0.06,0.012,8),dark,0,-1.42,0.02)])]);
  sh.rotation.z=s*0.2;arms.push(sh);}
 if(board)body.rotation.y=Math.PI/2; // sideways stance, facing the slope's right-hand side
 return {root,tilt,body,skis,legs,arms,head,mat,board};
}
// ---------- trails and spray ----------
class Trail{
 constructor(n,width,material){this.n=n;this.w=width;this.count=0;this.pos=new Float32Array(n*2*3);const idx=[];for(let i=0;i<n-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  this.geo=new BufferGeometry();this.attr=new BufferAttribute(this.pos,3);this.attr.setUsage(DynamicDrawUsage);this.geo.setAttribute('position',this.attr);this.geo.setIndex(idx);this.geo.setDrawRange(0,0);
  this.mesh=new Mesh(this.geo,material);this.mesh.frustumCulled=false;this.mesh.renderOrder=1;this.last=null;}
 push(p,side){ // side = unit vector across the track
  if(this.last&&this.last.distanceToSquared(p)<0.2)return;this.last=(this.last||new Vector3()).copy(p);
  this.pos.copyWithin(6,0,(this.n-1)*6);const h=this.w/2;
  this.pos[0]=p.x-side.x*h;this.pos[1]=p.y;this.pos[2]=p.z-side.z*h;this.pos[3]=p.x+side.x*h;this.pos[4]=p.y;this.pos[5]=p.z+side.z*h;
  this.count=Math.min(this.n,this.count+1);this.geo.setDrawRange(0,Math.max(0,(this.count-1)*6));this.attr.needsUpdate=true;}
 reset(){this.count=0;this.last=null;this.geo.setDrawRange(0,0);}
}
class Spray{
 constructor(max,texture){this.max=max;this.alive=0;this.p=new Float32Array(max*3);this.v=new Float32Array(max*3);this.age=new Float32Array(max);this.life=new Float32Array(max);this.size=new Float32Array(max);this.alpha=new Float32Array(max);this.sz=new Float32Array(max);
  const g=new BufferGeometry();this.pa=new BufferAttribute(this.p,3).setUsage(DynamicDrawUsage);this.aa=new BufferAttribute(this.alpha,1).setUsage(DynamicDrawUsage);this.sa=new BufferAttribute(this.sz,1).setUsage(DynamicDrawUsage);
  g.setAttribute('position',this.pa);g.setAttribute('aAlpha',this.aa);g.setAttribute('aSize',this.sa);g.setDrawRange(0,0);this.geo=g;
  const m=new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:texture},scale:{value:400}},
   vertexShader:'attribute float aAlpha;attribute float aSize;uniform float scale;varying float vA;void main(){vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*scale/max(0.5,-mv.z);gl_Position=projectionMatrix*mv;}',
   fragmentShader:'uniform sampler2D map;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(mix(vec3(0.78,0.85,0.95),vec3(1.0),t.a*0.55),t.a*vA);\n#include <colorspace_fragment>\n}'});
  this.points=new Points(g,m);this.points.frustumCulled=false;this.points.renderOrder=2;this.budget=max;}
 emit(pos,vel,life,size){if(this.alive>=this.budget)return;const i=this.alive++;this.p.set([pos.x,pos.y,pos.z],i*3);this.v.set([vel.x,vel.y,vel.z],i*3);this.age[i]=0;this.life[i]=life;this.size[i]=size;}
 update(dt){let w=0;for(let i=0;i<this.alive;i++){const a=this.age[i]+dt;if(a>=this.life[i])continue;
   if(w!==i){this.p.copyWithin(w*3,i*3,i*3+3);this.v.copyWithin(w*3,i*3,i*3+3);this.life[w]=this.life[i];this.size[w]=this.size[i];}
   this.age[w]=a;const k=w*3;this.v[k+1]-=7*dt;const drag=Math.exp(-2.2*dt);this.v[k]*=drag;this.v[k+2]*=drag;this.p[k]+=this.v[k]*dt;this.p[k+1]+=this.v[k+1]*dt;this.p[k+2]+=this.v[k+2]*dt;
   const t=a/this.life[w];this.alpha[w]=(t<0.15?t/0.15:1-(t-0.15)/0.85)*0.85;this.sz[w]=this.size[w]*(0.6+t*1.3);w++;}
  this.alive=w;this.geo.setDrawRange(0,w);this.pa.needsUpdate=this.aa.needsUpdate=this.sa.needsUpdate=true;}
}

// ---------- main ----------
export function createSlalomScene(container,opts){
 const {gates,startGate=0,onGate=()=>{},onFinish=()=>{},onStats=()=>{},sound=null,forceQuality=null,reducedMotion=false}=opts;
 let tier=guessTier(globalThis.navigator,forceQuality),T=TIERS[tier];
 const canvas=document.createElement('canvas');canvas.className='slalom-canvas';canvas.setAttribute('aria-label','Snowy mountain ski run');container.prepend(canvas);
 let renderer;
 try{renderer=new WebGLRenderer({canvas,antialias:tier===2,powerPreference:'high-performance',alpha:false,stencil:false});}
 catch(e){canvas.remove();throw e;}
 renderer.toneMapping=NeutralToneMapping;renderer.toneMappingExposure=1.0;
 renderer.shadowMap.enabled=T.shadows;renderer.shadowMap.type=PCFShadowMap;
 const scene=new Scene();scene.fog=new FogExp2('#dfe9f4',0.0021);scene.background=new Color('#dfe9f4');
 const camera=new PerspectiveCamera(58,1,0.3,6000);
 const sunDir=new Vector3(0.72,0.5,-0.48).normalize();
 const hemi=new HemisphereLight('#b3cdea','#e3e9f1',2.3);scene.add(hemi);
 const sun=new DirectionalLight('#fff0dc',4.8);sun.castShadow=T.shadows;scene.add(sun,sun.target);
 const sc=sun.shadow.camera;sc.left=-30;sc.right=30;sc.top=30;sc.bottom=-30;sc.near=5;sc.far=170;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.35;
 if(T.shadowMap)sun.shadow.mapSize.set(T.shadowMap,T.shadowMap);
 const disposables=[];const keep=x=>{disposables.push(x);return x;};
 // sky, ridges, clouds
 const sky=new Mesh(keep(new SphereGeometry(4000,24,12)),keep(skyMaterial(sunDir)));sky.frustumCulled=false;scene.add(sky);
 const ridgeMat=keep(new MeshBasicMaterial({vertexColors:true,fog:false}));
 // far to near: each layer a little less hazy, so the range reads in depth
 const ridgeParts=[];for(const L of [{radius:2900,height:1500,base:-460,seed:3,haze:'#cfdcec',rock:'#8499b5',span:[-1.7,1.7],depth:900,peaks:9,mist:0.5},{radius:2200,height:1000,base:-420,seed:5,haze:'#cbd9ea',rock:'#6f86a6',span:[-1.5,1.35],depth:650,peaks:7,mist:0.36},{radius:1600,height:620,base:-380,seed:11,haze:'#c8d7e9',rock:'#5d7596',span:[-1.25,1.45],depth:420,peaks:6,mist:0.22}]){
  ridgeParts.push(ridgeGeometry(L));}
 {const m=new Mesh(keep(mergeGeometries(ridgeParts)),ridgeMat);ridgeParts.forEach(g=>g.dispose());m.frustumCulled=false;m.renderOrder=-1;scene.add(m);}
 // valley clouds: soft planes facing the run, merged into one mesh (one draw call)
 const cloudTex=keep(cloudTexture(30)),clouds=[];{const r=seeded(21),parts=[];for(let i=0;i<TIERS[2].clouds;i++){const a=-1.25+r()*2.5,rad=1350+r()*800,w=650+r()*550,h=110+r()*80,p=new PlaneGeometry(w,h);p.deleteAttribute('normal');
   p.lookAt(new Vector3(-Math.sin(a),0,Math.cos(a)));p.translate(Math.sin(a)*rad,-215+r()*110,-420-Math.cos(a)*rad);const al=new Float32Array(4).fill(i<T.clouds?1:0);p.setAttribute('alpha',new BufferAttribute(al,1));parts.push(p);}
  const geo=keep(mergeGeometries(parts)),m=new Mesh(geo,keep(new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:cloudTex}},vertexShader:'attribute float alpha;varying float vA;varying vec2 vUv;void main(){vA=alpha;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D map;varying float vA;varying vec2 vUv;void main(){vec4 t=texture2D(map,vUv);gl_FragColor=vec4(vec3(0.97,0.98,1.0),t.a*0.6*vA);\n#include <colorspace_fragment>\n}'})));m.frustumCulled=false;m.renderOrder=-1;scene.add(m);clouds.push(m);}
 // terrain
 const grain=keep(snowGrain());
 const terrain=new Mesh(keep(terrainGeometry()),keep(new MeshLambertMaterial({vertexColors:true,map:grain})));terrain.receiveShadow=true;scene.add(terrain);
 // trees in chunks (frustum culled per chunk); instances ordered so the nearest rows survive lower quality
 const pine=keep(pineGeometry()),farPine=keep(farPineGeometry()),pineMat=keep(new MeshLambertMaterial({vertexColors:true,flatShading:true}));
 const treeChunks=[];{const r=seeded(7),m=new Matrix4(),q=new Quaternion(),s=new Vector3(),p=new Vector3(),up=new Vector3(0,1,0);
  const add=(geo,list,shadow)=>{if(!list.length)return;list.sort((a,b)=>a[3]-b[3]);const mesh=new InstancedMesh(geo,pineMat,list.length);mesh.castShadow=shadow;
   list.forEach(([u,d,k],n)=>{p.set(cx(d)+u,groundY(u,d)-0.3,-d);q.setFromAxisAngle(up,r()*6.28);s.set(k*(0.85+r()*0.3),k*(0.9+r()*0.4),k*(0.85+r()*0.3));m.compose(p,q,s);mesh.setMatrixAt(n,m);});
   mesh.computeBoundingSphere();mesh.userData.full=list.length;mesh.count=Math.round(list.length*T.trees);scene.add(mesh);treeChunks.push(mesh);};
  // near trees in 200 m chunks, far trees in 400 m chunks: frustum culling still works, with few draw calls
  const nearChunks=new Map(),farChunks=new Map(),bucket=(m,k)=>{if(!m.has(k))m.set(k,[]);return m.get(k);};
  for(let d0=-80;d0<1150;d0+=100)for(const side of [-1,1]){const near=bucket(nearChunks,side+':'+Math.floor((d0+80)/200)),far=bucket(farChunks,side+':'+Math.floor((d0+80)/400)),fade=d0>700?0.4:1;
   // clusters by the piste (with open gaps), then a scattered forest up the hillside
   for(let c=0;c<Math.round(5*fade);c++){const cd=d0+r()*100,cu=15+r()*16;for(let i=0;i<3+Math.floor(r()*5);i++)near.push([side*(cu+(r()-0.3)*6),cd+(r()-0.5)*14,0.85+r()*0.85,r()]);}
   for(let i=0;i<Math.round(8*fade);i++)near.push([side*(15.5+r()*22),d0+r()*100,0.8+r()*0.9,1+r()]);
   for(let i=0;i<Math.round(46*fade);i++){const u=side*(38+Math.pow(r(),1.2)*200);far.push([u,d0+r()*100,1.1+r()*1.3,1+Math.abs(u)/80+r()]);}
  }
  for(const list of nearChunks.values())add(pine,list,true);for(const list of farChunks.values())add(farPine,list,false);}
 const rocks=new InstancedMesh(keep(rockGeometry()),keep(new MeshLambertMaterial({vertexColors:true,flatShading:true})),60);{const r=seeded(33),m=new Matrix4(),q=new Quaternion(),s=new Vector3(),p=new Vector3();
  for(let i=0;i<60;i++){const d=-40+r()*760,side=r()<0.5?-1:1,u=side*(13.5+r()*16),k=0.5+r()*1.4;p.set(cx(d)+u,groundY(u,d)-0.2,-d);q.setFromEuler(new Euler(r(),r()*6,r()));s.set(k*1.3,k,k);m.compose(p,q,s);rocks.setMatrixAt(i,m);}
  rocks.castShadow=true;rocks.receiveShadow=true;rocks.count=Math.round(60*T.rocks);rocks.computeBoundingSphere();scene.add(rocks);}
 // piste edge markers (every 16 m, both sides)
 const finishD=COURSE.first+(gates.length-1)*COURSE.spacing+COURSE.finishAfter,stopD=finishD+COURSE.stopAfter;
 {const geo=keep(new CylinderGeometry(0.035,0.035,1.3,5).translate(0,0.65,0)),n=Math.ceil((finishD+10)/16)*2,mk=new InstancedMesh(geo,keep(new MeshLambertMaterial({color:'#e8563f'})),n),m=new Matrix4();let k=0;
  for(let d=8;d<finishD+10&&k<n;d+=16)for(const side of [-1,1]){const u=side*(COURSE.piste+0.6);m.makeTranslation(cx(d)+u,groundY(u,d),-d);mk.setMatrixAt(k++,m);}mk.count=k;mk.castShadow=true;mk.computeBoundingSphere();scene.add(mk);}
 // gates
 // Gates: per row, one small atlas texture, one merged banner mesh and one merged frame mesh (2 draw calls a row).
 // Banners 1.75x the first version (readable from further away), on taller frames; high contrast.
 const res=tier===0?0.6:0.8,BW=5.3,BH=2.34,BY=3.45,PX=2.75,PH=4.75;
 const frameGeo=keep((()=>{const pole=x=>{const g=new CylinderGeometry(0.08,0.09,PH,6,1,true).translate(x,PH/2,0);g.deleteAttribute('uv');return g.toNonIndexed();};
  const flag=sx=>{const g=new BufferGeometry().setFromPoints([new Vector3(0,PH,0),new Vector3(0.75*sx,PH-0.24,0),new Vector3(0,PH-0.48,0)]);g.computeVertexNormals();return g.translate(PX*sx,0,0);};
  return mergeGeometries([pole(-PX),pole(PX),flag(-1),flag(1)]);})());
 const colors=['#e5484d','#2f7fe0'],frameMats=colors.map(color=>keep(new MeshLambertMaterial({color,side:DoubleSide})));
 let bannerScale=1;
 function makeRow(g,i){const d=COURSE.first+i*COURSE.spacing,lanes=laneOffsets(g.options.length),color=colors[i%2],n=g.options.length,yaw=Math.atan2(-dcx(d),1);
  const bw=512*res,bh=224*res,tex=canvasTexture(bw,bh*n,(c)=>{g.options.forEach((text,k)=>drawBanner(c,text,color,res,k*bh));});tex.anisotropy=1;
  const banners=[],frames=[];
  lanes.forEach((u,k)=>{const at=world(u,d);const p=new PlaneGeometry(BW*bannerScale,BH*bannerScale).toNonIndexed(),uv=p.attributes.uv;
   for(let v=0;v<uv.count;v++)uv.setY(v,1-(k+1-uv.getY(v))/n);p.rotateY(yaw).translate(at.x,at.y+BY+(bannerScale-1)*1.1,at.z);
   p.setAttribute('color',new BufferAttribute(new Float32Array(p.attributes.position.count*3).fill(1),3));banners.push(p);
   frames.push(frameGeo.clone().rotateY(yaw).translate(at.x,at.y,at.z));});
  const bannerMesh=new Mesh(mergeGeometries(banners),new MeshBasicMaterial({map:tex,vertexColors:true,transparent:true,fog:false}));banners.forEach(b=>b.dispose());
  const frameMesh=new Mesh(mergeGeometries(frames),frameMats[i%2]);frames.forEach(f=>f.dispose());frameMesh.castShadow=true;
  bannerMesh.userData={gate:i};scene.add(bannerMesh,frameMesh);
  return {d,lanes,bannerMesh,frameMesh,gate:g,state:null,texts:g.options,perBanner:6,yaw,hinted:false,glow:null};}
 function tintRow(row,k,hex){const c=new Color(hex),a=row.bannerMesh.geometry.attributes.color;for(let v=k*row.perBanner;v<(k+1)*row.perBanner;v++)a.setXYZ(v,c.r,c.g,c.b);a.needsUpdate=true;}
 function dropRow(row){if(row.glow){scene.remove(row.glow);row.glow.geometry.dispose();row.glow.material.dispose();}scene.remove(row.bannerMesh,row.frameMesh);row.bannerMesh.geometry.dispose();row.frameMesh.geometry.dispose();row.bannerMesh.material.map?.dispose();row.bannerMesh.material.dispose();}
 // A soft warm halo behind the right banner (shared texture; one small mesh, made only when a hint shows).
 const glowTex=keep(canvasTexture(128,64,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,4,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,214,90,1)');r.addColorStop(0.55,'rgba(255,200,60,.55)');r.addColorStop(1,'rgba(255,190,40,0)');g.fillStyle=r;g.fillRect(0,0,w,h);}));
 const glowMat=keep(new MeshBasicMaterial({map:glowTex,transparent:true,depthWrite:false,fog:false,opacity:0}));
 // Hint: only in the final stretch (12 m, both tracks), never on the first row of a run, and later still (7 m) right after
 // a row where the hint was taken.
 function hintDistance(i){if(i===0)return 0;return rows[i-1]?.hinted?(opts.hintAfterHint??7):(opts.hintDistance??12);}
 const rows=gates.map((g,i)=>makeRow(g,i));
 const rowVisible=(row)=>row.d-st.d<210&&row.d-st.d>-25;
 // finish arch + lodge
 {const u=0,d=finishD,grp=new Group();world(u,d,grp.position);grp.rotation.y=Math.atan2(-dcx(d),1);const post=keep(new BoxGeometry(0.5,4.4,0.5).translate(0,2.2,0)),pm=keep(new MeshLambertMaterial({color:'#2f7fe0'}));
  for(const s of [-1,1]){const p=new Mesh(post,pm);p.position.x=s*7.2;p.castShadow=true;grp.add(p);}
  const tex=keep(canvasTexture(1024,160,(g,w,h)=>{g.fillStyle='#2f7fe0';g.fillRect(0,0,w,h);g.fillStyle='#ffd35c';g.fillRect(0,h-18,w,18);g.fillStyle='#fff';g.font=`800 104px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.fillText('FINISH',w/2,h/2-6);}));
  const b=new Mesh(keep(new PlaneGeometry(14.9,2.3)),keep(new MeshBasicMaterial({map:tex,fog:false})));b.position.y=4.3;grp.add(b);scene.add(grp);
  // the lodge: one merged, vertex-coloured mesh (one draw call)
  const lodge=new Group(),lu=-15,ld=stopD+14;world(lu,ld,lodge.position);lodge.position.y-=0.3;lodge.rotation.y=Math.atan2(-dcx(ld),1)+0.5;
  const roof=s=>{const g=new BoxGeometry(10.4,0.5,4.6);g.rotateX(s*0.62);g.translate(0,5.25,s*1.7);return colored(g,'#f3f7fb');};
  const gable=colored(new CylinderGeometry(0.01,3.35,9.2,3,1).rotateZ(Math.PI/2).rotateX(Math.PI/6).scale(1,0.62,1).translate(0,5.0,0),'#7a4b32');
  const lodgeMesh=new Mesh(keep(mergeGeometries([colored(new BoxGeometry(9,4.2,6.5).translate(0,2.1,0),'#7a4b32'),roof(-1),roof(1),gable,...[-2.6,0,2.6].map(x=>colored(new BoxGeometry(1.3,1.2,0.05).translate(x,2.3,3.27),'#ffd27a')),colored(new BoxGeometry(0.8,2,0.8).translate(2.8,6.3,-1),'#8d8f99')])),keep(new MeshLambertMaterial({vertexColors:true,emissive:'#221400'})));
  lodgeMesh.castShadow=lodgeMesh.receiveShadow=true;lodge.add(lodgeMesh);scene.add(lodge);}
 // skier, blob shadow, tracks, spray
 const skier=makeSkier(opts.ride==='board'?'board':'ski');scene.add(skier.root);
 const blob=new Mesh(keep(new CircleGeometry(0.75,20).rotateX(-Math.PI/2)),keep(new MeshBasicMaterial({color:'#6d87a6',transparent:true,opacity:0.22,depthWrite:false})));blob.renderOrder=1;scene.add(blob);
 const trailMat=keep(new MeshBasicMaterial({side:DoubleSide,color:'#9fb2cb',transparent:true,opacity:0.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
 // skis leave two thin grooves; a board leaves one wide carved track
 const trails=skier.board?[new Trail(260,0.3,trailMat)]:[new Trail(260,0.085,trailMat),new Trail(260,0.085,trailMat)];for(const t of trails){scene.add(t.mesh);keep(t.geo);}
 const spray=new Spray(TIERS[2].spray,keep(softSprite()));spray.budget=T.spray;scene.add(spray.points);keep(spray.geo);keep(spray.points.material);
 // ---------- state ----------
 const firstD=startGate>0?COURSE.first+startGate*COURSE.spacing-44:0;
 const st={d:firstD,u:0,vu:0,v:0,tU:0,go:false,paused:false,next:startGate,finished:false,time:0,pointer:null,tilt:null,prompt:{},camInit:false,intro:startGate>0?0:2.4,end:0,lean:0,bob:0,pole:0};
 const tmp=new Vector3(),tmp2=new Vector3(),fwd=new Vector3(),side=new Vector3(),camPos=new Vector3(),camLook=new Vector3(),skPos=new Vector3();
 let scale=T.scale,width=1,height=1,portrait=false;
 function resize(){const r=container.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);portrait=height>width*1.05;const want=portrait?1.15:1;if(want!==bannerScale){bannerScale=want;rows.forEach((row,k)=>{if(!row.state){dropRow(row);rows[k]=makeRow(row.gate,k);}});}
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,T.maxDpr)*scale);renderer.setSize(width,height,false);camera.aspect=width/height;
  // keep every lane in view: widen the vertical field of view on tall screens
  const hfov=portrait?56:62,v=2*Math.atan(Math.tan(hfov*Math.PI/360)/camera.aspect)*180/Math.PI;camera.fov=clamp(v,50,92);camera.updateProjectionMatrix();spray.points.material.uniforms.scale.value=height*renderer.getPixelRatio()*0.45;}
 const ro=new ResizeObserver(resize);ro.observe(container);resize();
 // ---------- input: finger / mouse = where to go; tap a gate to head for it ----------
 const ray=new Raycaster(),ndc=new Vector2();
 const uFromX=clientX=>{const r=canvas.getBoundingClientRect();return clamp(((clientX-r.left)/r.width-0.5)*2*(COURSE.piste-0.5)*1.12,-(COURSE.piste-0.8),COURSE.piste-0.8);};
 function pickGate(e){const row=rows[st.next];if(!row)return null;const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const hit=ray.intersectObject(row.bannerMesh,false)[0];return hit?row.lanes[Math.floor(hit.faceIndex/2)]??null:null;}
 // Go faster lives on the rider: press and hold ON the skier or
 // snowboarder, or drag up; release or drag back down to ease off. Left/right still steers. The scene only speeds up once
 // the row's question has been heard (lib/slalom-timing.mjs).
 function riderOnScreen(){tmp.copy(skPos);tmp.y+=0.9;tmp.project(camera);const r=canvas.getBoundingClientRect();return {x:r.left+(tmp.x+1)/2*r.width,y:r.top+(1-tmp.y)/2*r.height,r:Math.max(64,Math.min(r.width,r.height)*0.13)};}
 const down=e=>{if(st.pointer!==null&&st.pointer!==e.pointerId)return;st.pointer=e.pointerId;try{canvas.setPointerCapture(e.pointerId);}catch{}
  const rs=riderOnScreen();st.ptrBoost=Math.hypot(e.clientX-rs.x,e.clientY-rs.y)<rs.r;st.ptrY0=st.ptrRef=e.clientY;
  if(!st.ptrBoost){const g=pickGate(e);st.tU=g??uFromX(e.clientX);}st.lastInput=performance.now();e.preventDefault();};
 const move=e=>{if(st.pointer!==e.pointerId)return;st.tU=uFromX(e.clientX);st.lastInput=performance.now();
  if(!st.ptrBoost&&e.clientY<st.ptrY0-45){st.ptrBoost=true;st.ptrRef=e.clientY;}
  if(st.ptrBoost){st.ptrRef=Math.min(st.ptrRef,e.clientY);if(e.clientY>st.ptrRef+35){st.ptrBoost=false;st.ptrY0=e.clientY;}}};
 const up=e=>{if(st.pointer!==e.pointerId)return;st.pointer=null;st.ptrBoost=false;try{canvas.releasePointerCapture(e.pointerId);}catch{}};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);
 canvas.style.touchAction='none';
 // ---------- sound: a soft swish that follows the carving ----------
 let swish=null;
 function startSwish(){if(swish||!sound?.ctx||sound.ctx.state!=='running')return;try{const ctx=sound.ctx,len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),ch=buf.getChannelData(0);let b=0;for(let i=0;i<len;i++){b=0.97*b+0.03*(Math.random()*2-1);ch[i]=b*3;}
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=0.7;const g=ctx.createGain();g.gain.value=0;src.connect(f).connect(g).connect(sound.destination);src.start();swish={src,f,g,ctx};}catch{swish=null;}}
 function updateSwish(carve){if(!swish)return startSwish();const on=sound.enabled()&&!st.paused&&st.go&&!st.finished;const level=on?clamp(0.012+st.v/COURSE.baseSpeed*0.025+carve*0.09,0,0.14):0;swish.g.gain.setTargetAtTime(level,swish.ctx.currentTime,0.08);swish.f.frequency.setTargetAtTime(700+carve*900+st.v*30,swish.ctx.currentTime,0.1);}
 // ---------- quality: measure, then scale down (and, on fast machines, back up) ----------
 const perf={frames:0,sum:0,window:[],all:[],changes:[],lastCheck:0,since:0,fast:0,down:false,up:false};
 function setTier(t,reason){if(t===tier)return;tier=t;T=TIERS[t];scale=Math.min(scale,T.scale);
  renderer.shadowMap.enabled=T.shadows;sun.castShadow=T.shadows;if(T.shadowMap&&sun.shadow.map&&sun.shadow.mapSize.x!==T.shadowMap){sun.shadow.map.dispose();sun.shadow.map=null;}if(T.shadowMap)sun.shadow.mapSize.set(T.shadowMap,T.shadowMap);
  for(const m of [terrain.material,pineMat,rocks.material])m.needsUpdate=true;
  for(const c of treeChunks)c.count=Math.round(c.userData.full*T.trees);rocks.count=Math.round(60*T.rocks);spray.budget=T.spray;{const a=clouds[0].geometry.attributes.alpha;for(let i=0;i<a.count;i++)a.setX(i,Math.floor(i/4)<T.clouds?1:0);a.needsUpdate=true;}
  perf.changes.push({at:+st.time.toFixed(1),tier:T.name,reason});resize();onStats(stats());}
 function measure(ms){perf.frames++;if(perf.frames<20)return;perf.window.push(ms);if(perf.all.length<20000)perf.all.push(ms);perf.sum+=ms;if(perf.window.length>90)perf.window.shift();
  const now=st.time;if(now-perf.lastCheck<1.5||perf.window.length<60)return;perf.lastCheck=now;
  const avg=perf.window.reduce((a,b)=>a+b,0)/perf.window.length;
  // Floor: whenever frames average slower than ~48 fps, lower the resolution, then the tier (keeps >= 30 fps).
  if(avg>21){perf.down=true;if(scale>T.minScale+0.01){scale=Math.max(T.minScale,scale-0.12);perf.changes.push({at:+now.toFixed(1),scale:+scale.toFixed(2),avg:+avg.toFixed(1)});resize();}else if(tier>0)setTier(tier-1,`avg ${avg.toFixed(1)} ms`);perf.window.length=0;return;}
  // A device that started light but is clearly fast steps up one tier, once, and never after a step down.
  if(avg<11&&!perf.down&&!perf.up&&tier<2&&scale>=T.scale-0.01){perf.fast+=1.5;if(perf.fast>=6){perf.up=true;perf.fast=0;scale=TIERS[tier+1].scale;setTier(tier+1,`avg ${avg.toFixed(1)} ms`);perf.window.length=0;return;}}else perf.fast=0;
  if(avg<11.5&&scale<T.scale-0.01){perf.since+=1.5;if(perf.since>=6){scale=Math.min(T.scale,scale+0.1);perf.changes.push({at:+now.toFixed(1),scale:+scale.toFixed(2),avg:+avg.toFixed(1)});perf.since=0;resize();}}else perf.since=0;}
 function stats(){const a=[...perf.all].sort((x,y)=>x-y),q=p=>a.length?+a[Math.min(a.length-1,Math.floor(a.length*p))].toFixed(1):null;const info=renderer.info.render;
  return {tier:T.name,scale:+scale.toFixed(2),pixelRatio:+renderer.getPixelRatio().toFixed(2),size:`${Math.round(width)}x${Math.round(height)}`,frames:perf.all.length,avgMs:a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null,p50Ms:q(0.5),p95Ms:q(0.95),fps:a.length?Math.round(1000/(a.reduce((x,y)=>x+y,0)/a.length)):null,calls:info.calls,triangles:info.triangles,changes:perf.changes,boost:{presses:boostPresses,seconds:+boostTime.toFixed(1)},hints:hintsShown};}
 // ---------- simulation ----------
 function lanesAhead(){const row=rows[st.next];return row?row.lanes:null;}
 function targetSpeed(){
  if(!st.go)return 0;
  if(st.finished)return Math.max(0,(stopD-st.d)*0.55);
  // shared model (lib/slalom-timing.mjs): glide until the question has been heard, ~2 s to look, go faster only after it
  const row=rows[st.next],p=st.prompt[st.next];
  return speedFor({dist:row?row.d-st.d:undefined,promptEnded:p?.ended===undefined?undefined:st.time-p.ended,boost:st.boost});
 }
 function step(dt){
  st.time+=dt;
  const wantBoost=!!(st.boostKey||st.ptrBoost);if(wantBoost&&!st.boost)boostPresses++;st.boost=wantBoost;
  if(st.intro>0)st.intro=Math.max(0,st.intro-dt);
  // steering target: finger > tilt > keyboard/assist
  const lanes=lanesAhead(),row=rows[st.next];
  if(st.pointer===null&&st.tilt!==null)st.tU=clamp(st.tilt*(COURSE.piste-1),-(COURSE.piste-1),COURSE.piste-1);
  if(st.pointer===null&&lanes&&row&&row.d-st.d<30&&row.d-st.d>1){const near=lanes.reduce((a,b)=>Math.abs(b-st.tU)<Math.abs(a-st.tU)?b:a);st.tU+=(near-st.tU)*smooth(st.tilt!==null?1.2:2.6,dt);}
  const au=16*(st.tU-st.u)-8*st.vu;st.vu=clamp(st.vu+au*dt,-9,9);st.u=clamp(st.u+st.vu*dt,-COURSE.piste+0.6,COURSE.piste-0.6);
  const vt=targetSpeed();st.v=nextSpeed(st.v,vt,dt);if(st.v<0.01&&vt===0)st.v=0;
  if(st.boost&&vt===COURSE.boostSpeed)boostTime+=dt;
  const before=st.d;st.d+=st.v*dt;
  // gate crossing: the lane nearest the skier is the choice (every pass is a choice; no crashes)
  // Hint: after the question, only in the final stretch and only while the skier heads for a wrong gate, the
  // right one glows (it corrects, never gives away). A pass after a hint is recorded as hinted, not unaided.
  if(row&&row.state===null){const dist=row.d-st.d,heading=row.lanes.reduce((best,x,k)=>Math.abs(x-st.tU)<Math.abs(row.lanes[best]-st.tU)?k:best,0),right=row.gate.options.indexOf(row.gate.answer);
   const on=st.prompt[st.next]?.ended!==undefined&&dist>0&&dist<hintDistance(st.next)&&heading!==right;
   if(on&&!row.hinted){row.hinted=true;hintsShown++;}row.hintOn=on;}
  if(row&&before<row.d&&st.d>=row.d){const lane=row.lanes.reduce((best,x,k)=>Math.abs(x-st.u)<Math.abs(row.lanes[best]-st.u)?k:best,0);row.state={chosen:lane,at:st.time};row.hintOn=false;st.next++;passLog.push({gate:rows.indexOf(row),at:performance.now(),v:+st.v.toFixed(2)});setTimeout(()=>void loadNextFriend(),350);onGate(rows.indexOf(row),row.gate.options[lane],lane,row.hinted);}
  if(!st.finished&&st.d>=finishD){st.finished=true;st.end=0;void loadNextFriend();onFinish();}
  if(st.finished)st.end+=dt;
  return au;
 }
 const clock={last:performance.now()};let raf=0,disposed=false,lastDraw=0,pendingDt=0,hintsShown=0,boostTime=0,boostPresses=0,friendLoading=false,loader=null;const mixers=[],friends=[],passLog=[],friendQueue=[];
 async function loadNextFriend(){
  if(friendLoading||!friendQueue.length||disposed)return;friendLoading=true;const f=friendQueue.shift();
  try{
   let obj,height=1.05;
   if(f.kind==='standee'){ // paper-cut standee: a camera-facing picture with a soft shadow
    const img=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=f.url;});if(disposed)return;
    const tex=new CanvasTexture(img);tex.colorSpace=SRGBColorSpace;const sp=new Sprite(new SpriteMaterial({map:tex,transparent:true,alphaTest:0.05,fog:false}));
    height=1.25;sp.scale.set(height*img.width/img.height,height,1);sp.center.set(0.5,0);obj=new Group();obj.add(sp);
    const shadow=new Mesh(new CircleGeometry(0.42,16).rotateX(-Math.PI/2),new MeshBasicMaterial({color:'#6d87a6',transparent:true,opacity:0.25,depthWrite:false}));shadow.position.y=0.02;shadow.scale.set(1.3,1,0.7);obj.add(shadow);obj.userData.standee=true;
   }else{
    if(!loader){const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');loader=new GLTFLoader();}
    const gltf=await loader.loadAsync(f.url);if(disposed)return;obj=gltf.scene;const box=new Box3().setFromObject(obj),h=(box.max.y-box.min.y)||1,sc=(f.tall?1.25:1.05)/h;
    obj.scale.setScalar(sc);obj.userData.lift=-box.min.y*sc;obj.traverse(o=>{if(o.isMesh){o.castShadow=T.shadows;o.frustumCulled=false;}});
    const clip=gltf.animations.find(a=>a.name==='cheer')||gltf.animations[0];if(clip){const mixer=new AnimationMixer(obj);mixer.clipAction(clip).play();mixer.timeScale=0;obj.userData.mixer=mixer;mixers.push(mixer);}
   }
   obj.visible=false;obj.userData.id=f.id;scene.add(obj);friends.push(obj);if(st.showFriends)placeFriends();
  }catch{/* a missing toy never blocks the run or the finish */}
  finally{friendLoading=false;if(st.finished&&friendQueue.length)void loadNextFriend();}
 }
 // In a line through the stopped rider, across the finish camera's final view (left, right, further left, ...), a little
 // behind the rider as the camera sees it, facing the camera. The finish camera ends 2.1 rad round from behind.
 function placeFriends(){
  if(!st.showFriends)return;const d=stopD; // where the rider stops (they are already there as he glides in)
 forward(d,fwd);side.set(-fwd.z,0,fwd.x);world(st.u,d,skPos);
  const c=tmp2.copy(fwd).multiplyScalar(-Math.cos(2.1)).addScaledVector(side,Math.sin(2.1)).normalize(),h=new Vector3(-c.z,0,c.x);
  friends.forEach((obj,k)=>{const n=Math.floor(k/2)+1,sgn=k%2?1:-1,off=sgn*(0.25+1.05*n);
   obj.position.copy(skPos).addScaledVector(h,off).addScaledVector(c,-0.9-0.15*n);obj.position.y=groundY(obj.position.x-cx(-obj.position.z),-obj.position.z)+(obj.userData.lift||0);
   obj.visible=true;if(obj.userData.mixer){obj.userData.mixer.timeScale=1;obj.userData.mixer.setTime(k*0.37);}});
 }
 function frame(now){
  raf=requestAnimationFrame(frame);
  const rawMs=now-clock.last;clock.last=now;
  if(st.paused||document.hidden){return;}
  // Real time, even on slow devices: sub-step the simulation (at most 0.12 s per frame, so a stall never jumps a gate).
  const dt=Math.min(0.12,Math.max(0.001,rawMs/1000)),n=Math.ceil(dt/0.034);let au=0;for(let k=0;k<n;k++)au=step(dt/n);
  pendingDt+=dt;
  // The finish view is calm: after it settles, draw at ~15 fps, and stop drawing altogether after a while.
  if(st.finished&&st.end>6){if(st.end>24||now-lastDraw<66)return;}else if(!st.finished)measure(rawMs);
  lastDraw=now;draw(Math.min(0.2,pendingDt),au);pendingDt=0;
 }
 function draw(dt,au){
  const d=st.d;world(st.u,d,skPos);forward(d,fwd);side.set(-fwd.z,0,fwd.x);
  const heading=Math.atan2(st.vu,Math.max(1.5,st.v)),carve=clamp(Math.abs(au)/30+Math.abs(heading)*0.8,0,1);
  // skier pose
  const yaw=Math.atan2(-fwd.x,-fwd.z)+(-heading)*0.9;
  skier.root.position.copy(skPos);skier.root.rotation.set(0,yaw,0);
  st.lean+=(clamp(-au*0.018,-0.45,0.45)-st.lean)*smooth(8,dt);
  st.bob+=dt*(1.5+st.v*0.4);const crouch=0.06+0.04*Math.sin(st.bob)+carve*0.08;skier.body.position.y=-crouch;
  if(skier.board){
   // snowboard: the rider and the board's edge tilt together into the carve (toe side / heel side); knees soak up the turn
   skier.tilt.rotation.set(0,0.42+st.lean*0.5,st.lean*1.15); // a real stance angle, so the board reads as a boardskier.body.rotation.set(0,Math.PI/2+st.lean*0.25,-0.12-crouch*0.6);
   for(const [k,l] of skier.legs.entries()){l.hip.rotation.x=-0.45-crouch*2.4;l.hip.rotation.z=(k?1:-1)*0.18;l.knee.rotation.x=0.85+crouch*3.4;}
   skier.skis.rotation.set(-Math.atan(SLOPE)*0.2,0,0);
  }else{
   skier.body.rotation.set(-0.28,0,st.lean);
   for(const [k,l] of skier.legs.entries()){l.hip.rotation.x=-0.55-crouch*2.2+(k?1:-1)*st.lean*0.2;l.knee.rotation.x=0.95+crouch*3.2;}
   skier.skis.rotation.set(-Math.atan(SLOPE)*0.2,0,st.lean*0.5);
  }
  st.pole+=dt*(st.v<4?3.2:1.4);st.cheer=clamp((st.cheer||0)+(st.finished&&st.v<0.6?dt:-dt)*1.5,0,1);
  for(const [k,a] of skier.arms.entries()){const s=k?1:-1,c=st.cheer;
   if(skier.board){a.rotation.x=(0.2+0.1*Math.sin(st.time*2+k))*(1-c)+c*-2.5;a.rotation.z=s*(0.95+carve*0.3-st.lean*s*0.4)*(1-c)+c*s*0.35;} // arms out for balance
   else{a.rotation.x=(0.55+0.25*Math.sin(st.pole+k*Math.PI)*(st.v<5?1:0.35))*(1-c)+c*(-2.5+0.15*Math.sin(st.time*5+k));a.rotation.z=s*(0.28+carve*0.1+c*0.35);}}
  skier.head.rotation.y=skier.board?-Math.PI/2*0.85-heading*0.3:-heading*0.4; // a boarder looks down the hill over the lead shoulder
  blob.position.set(skPos.x,skPos.y+0.03,skPos.z);
  // tracks behind each ski
  if(skier.board){tmp.copy(skPos);tmp.y=groundY(st.u,d)+0.035;if(st.go&&st.v>0.3)trails[0].push(tmp,side);}
  else for(const s of [-1,1]){tmp.copy(side).multiplyScalar(s*0.13).add(skPos);tmp.y=groundY(st.u+s*0.13,d)+0.035;const t=trails[s<0?0:1];if(st.go&&st.v>0.3)t.push(tmp,side);}
  // spray: steady light dust, bursts when carving
  if(st.go&&st.v>1){const rate=(14+st.v*3+carve*230)*(T.spray/340);let n=rate*dt;while(n>0){if(Math.random()<n){const s=Math.sign(st.vu)||1;tmp.copy(skPos).addScaledVector(fwd,0.5+Math.random()*0.3).addScaledVector(side,(Math.random()-0.5)*0.4);tmp.y+=0.05;
   tmp2.copy(side).multiplyScalar(-s*(1.2+carve*3.2)*(0.5+Math.random())).addScaledVector(fwd,st.v*0.35*Math.random());tmp2.y=0.8+Math.random()*2.2*(0.4+carve);spray.emit(tmp,tmp2,0.6+Math.random()*0.7,0.25+Math.random()*0.4+carve*0.45);}n-=1;}}
  spray.update(dt);for(const m of mixers)m.update(dt);for(const c of friends)if(!c.userData.standee&&c.visible)c.rotation.y+=(Math.atan2(camera.position.x-c.position.x,camera.position.z-c.position.z)-c.rotation.y)*smooth(3,dt);
  // gates: only nearby rows are drawn; feedback glow on passed rows
  for(const row of rows){const vis=rowVisible(row);row.bannerMesh.visible=row.frameMesh.visible=vis;
   // big banners fade as the camera passes under them (full until 14 m from the camera, faint by 6 m)
   if(vis){const cd=row.d-(st.d-8);row.bannerMesh.material.opacity=clamp((cd-5)/9,0.12,1);}
   if(row.hinted&&!row.glow){const k=row.gate.options.indexOf(row.gate.answer),at=world(row.lanes[k],row.d);const g=new PlaneGeometry(BW*bannerScale*1.45,BH*bannerScale*1.8).rotateY(row.yaw).translate(at.x,at.y+BY+(bannerScale-1)*1.1,at.z).translate(-Math.sin(row.yaw)*0.08,0,-Math.cos(row.yaw)*0.08);row.glow=new Mesh(g,glowMat.clone());row.glow.renderOrder=0;scene.add(row.glow);}
   if(row.glow){const target=row.hintOn?0.55+0.35*Math.sin(st.time*6):0;row.glow.material.opacity+=(target-row.glow.material.opacity)*smooth(10,dt);row.glow.visible=vis&&row.glow.material.opacity>0.01;
    if(!row.state)tintRow(row,row.gate.options.indexOf(row.gate.answer),row.hintOn&&Math.sin(st.time*6)>0?'#fff1b0':'#ffffff');}
   if(row.state&&!row.state.tinted){row.state.tinted=true;row.texts.forEach((text,k)=>{const right=text===row.gate.answer,chosen=k===row.state.chosen;tintRow(row,k,right?(chosen?'#9ff0b8':'#ffdf80'):chosen?'#c9d0da':'#ffffff');});}}
  // camera: smooth chase, a short opening sweep, and a turn to the front at the bottom
  const back=portrait?12:8,upH=portrait?7.4:3.7;
  tmp.copy(skPos).addScaledVector(fwd,-back).add(tmp2.set(0,upH,0));tmp.y=Math.max(tmp.y,groundY(st.u-fwd.x*back,d-back)+1.6);
  if(st.intro>0){const k=st.intro/2.4,e=k*k*(3-2*k);tmp.addScaledVector(side,e*9).add(tmp2.set(0,e*5,0)).addScaledVector(fwd,-e*6);}
  // at the bottom: swing round to the front, looking back up the run the child just skied
  const fin=st.finished?(k=>k*k*(3-2*k))(clamp(st.end/2.6,0,1)):0;
  if(st.finished){const ang=fin*2.1,r2=back+((portrait?10:9)-back)*fin;tmp.copy(skPos).addScaledVector(fwd,-Math.cos(ang)*r2).addScaledVector(side,Math.sin(ang)*r2).add(tmp2.set(0,upH+((portrait?3.4:2.6)-upH)*fin,0));}
  // the skier sits in the upper half of the finish view, above the recap and the finish card
  const ahead=portrait?11:7,lift=portrait?-0.6:0.9;const look=tmp2.copy(skPos).addScaledVector(fwd,ahead*(1-fin));look.y+=lift*(1-fin)-(portrait?1.3:0.45)*fin;
  if(!st.camInit){camPos.copy(tmp);camLook.copy(look);st.camInit=true;}else{camPos.lerp(tmp,smooth(st.finished?4:3.6,dt));camLook.lerp(look,smooth(6,dt));}
  camera.position.copy(camPos);camera.lookAt(camLook);sky.position.copy(camPos);
  // the sun (and its shadow box) follows the skier
  sun.position.copy(skPos).addScaledVector(sunDir,90).addScaledVector(fwd,12);sun.target.position.copy(skPos).addScaledVector(fwd,12);
  updateSwish(carve);
  renderer.render(scene,camera);
 }
 raf=requestAnimationFrame(frame);
 const api={
  go(){st.go=true;},
  passes(){return passLog.slice();},
  boost(on){st.boostKey=!!on;},
  canBoost(){const row=rows[st.next];return st.go&&!st.finished&&(!row||st.prompt[st.next]?.ended!==undefined);},
  setPaused(v){st.paused=!!v;clock.last=performance.now();if(swish)updateSwish(0);},
  promptStarted(i){st.prompt[i]={...st.prompt[i],started:st.time};},
  promptEnded(i){st.prompt[i]={...st.prompt[i],ended:st.time};},
  // The child's own toys wait at the bottom and cheer (private). Preloaded one per gate during the run (a small parse
  // right after a gate, never at the finish), hidden until the rider stops; then all appear at once.
  queueFriends(list){friendQueue.push(...(list||[]).slice(0,8));},
  showFriends(){st.showFriends=true;placeFriends();return friends.length;},
  friendCount(){return {loaded:friends.length,queued:friendQueue.length,loading:friendLoading};},
  // A missed gate makes the next triplet a pair (same rule as the server); rebuild that row.
  replaceGate(i,g){const old=rows[i];if(!old||old.state)return;dropRow(old);rows[i]=makeRow(g,i);},
  setTilt(v){st.tilt=v===null?null:clamp(v,-1,1);},
  steer(dir){const lanes=lanesAhead()||[-6.6,0,6.6];const cur=lanes.reduce((best,x,k)=>Math.abs(x-st.tU)<Math.abs(lanes[best]-st.tU)?k:best,0);st.tU=lanes[clamp(cur+dir,0,lanes.length-1)];},
  // For the browser check: the screen x of a lane of the next gate (drag the finger there).
  laneScreenX(i,lane){const row=rows[i];if(!row)return null;world(row.lanes[lane],row.d,tmp);tmp.y+=2.6;tmp.project(camera);const r=canvas.getBoundingClientRect();return r.left+(tmp.x+1)/2*r.width;},
  uToScreenX(u){const r=canvas.getBoundingClientRect();return r.left+(u/((COURSE.piste-0.5)*1.12)/2+0.5)*r.width;},
  state(){return {hint:!!rows[st.next]?.hintOn,boosting:!!st.boost,canBoost:api.canBoost(),spray:spray.alive,d:+st.d.toFixed(2),u:+st.u.toFixed(2),v:+st.v.toFixed(2),next:st.next,finished:st.finished,finishD,gateD:rows.map(r=>r.d),lanes:rows.map(r=>r.lanes)};},
  stats,
  // Cost of one frame at the current quality (simulation + render, waiting for the GPU): an upper bound on the
  // device's frame time without vsync or browser throttling. Used by the browser check; not during play.
  bench(frames=90,tierName=null){if(tierName){const k=TIERS.findIndex(t=>t.name===tierName);if(k>=0){scale=TIERS[k].scale;setTier(k,'bench');}}
   const gl=renderer.getContext(),out=[];for(let k=0;k<frames+10;k++){const t=performance.now();const au=step(1/60);draw(1/60,au);gl.finish();if(k>=10)out.push(performance.now()-t);}
   out.sort((a,b)=>a-b);const info=renderer.info.render;return {tier:T.name,pixelRatio:+renderer.getPixelRatio().toFixed(2),size:`${Math.round(width)}x${Math.round(height)}`,p50Ms:+out[out.length>>1].toFixed(2),p95Ms:+out[Math.floor(out.length*0.95)].toFixed(2),calls:info.calls,triangles:info.triangles};},
  // Deterministic stepping for tests and still renders.
  advance(seconds,fps=60){const dt=1/fps;for(let t=0;t<seconds;t+=dt){const au=step(dt);draw(dt,au);}},
  dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);ro.disconnect();try{swish?.src.stop();swish?.g.disconnect();}catch{}
   for(const r of rows)dropRow(r);for(const x of disposables)x.dispose?.();
   scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isSprite){o.geometry?.dispose?.();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m?.map?.dispose?.();m?.dispose?.();});}});
   sun.shadow.map?.dispose();renderer.dispose();try{renderer.forceContextLoss();}catch{}canvas.remove();}
 };
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();opts.onContextLost?.();});
 void reducedMotion;
 return api;
}
