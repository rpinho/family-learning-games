// Real WebGL triangle geometry, perspective camera and depth buffering; no CDN/assets.
// Reference: MDN, Creating 3D objects using WebGL. All shaders/scene code are original.
import {mazeBoard,mazeState,mazeClue} from './maze.mjs';
import {mazeTheme} from './maze-themes.mjs';
const vertex=`attribute vec3 aPosition;attribute vec3 aColor;attribute float aStone;
uniform vec3 uEye;uniform float uYaw;uniform float uAspect;
varying vec3 vColor;varying vec3 vWorld;varying float vDepth;varying float vStone;
void main(){vec3 d=aPosition-uEye;float c=cos(uYaw),s=sin(uYaw);vec3 p=vec3(d.x*c+d.z*s,d.y,-d.x*s+d.z*c);float n=.06,f=55.;gl_Position=vec4(p.x*1.35/uAspect,p.y*1.35,-(f+n)/(f-n)*p.z-2.*f*n/(f-n),-p.z);vColor=aColor;vWorld=aPosition;vDepth=length(d);vStone=aStone;}`;
const fragment=`precision mediump float;uniform vec3 uFog;varying vec3 vColor;varying vec3 vWorld;varying float vDepth;varying float vStone;
void main(){vec3 color=vColor;float along=abs(fract(vWorld.x))<.02||abs(fract(vWorld.x))>.98?vWorld.z:vWorld.x;
if(vStone>3.5){float seam=step(fract((along+vWorld.y)*2.),.04)+step(fract((along-vWorld.y)*2.),.04);color*=1.-min(seam,1.)*.25;}
else if(vStone>2.5){float seam=step(fract(along),.045)+step(fract(vWorld.y*1.2),.04);color*=1.-min(seam,1.)*.35;}
else if(vStone>1.5){color*=.85+.15*step(.09,fract(vWorld.y*4.));}
else if(vStone>.5){float row=floor(vWorld.y*2.6);float horizontal=fract(vWorld.y*2.6);float seam=fract(along*1.5+mod(row,2.)*.5);float mortar=step(horizontal,.045)+step(seam,.025);color*=1.-min(mortar,1.)*.25;float grain=fract(sin(dot(vWorld.xz+vWorld.y,vec2(12.98,78.23)))*4375.5);color*=.94+grain*.08;}float fog=smoothstep(3.,22.,vDepth);color=mix(color,uFog,fog*.87);gl_FragColor=vec4(color,1.);}`;
export function mazeMesh(board,clue=null,pos=null){
 const data=[],theme=board.theme||mazeTheme(1),height=theme.wallHeight,variant=theme.variant;
 const face=(points,color,stone=0)=>{for(const i of [0,1,2,0,2,3])data.push(...points[i],...color,stone);};
 const box=(x,y,z,w,h,d,color,stone=0)=>{
  face([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],color.map(v=>v*.85),stone);
  face([[x+w,y,z+d],[x,y,z+d],[x,y+h,z+d],[x+w,y+h,z+d]],color,stone);
  face([[x,y,z+d],[x,y,z],[x,y+h,z],[x,y+h,z+d]],color.map(v=>v*.73),stone);
  face([[x+w,y,z],[x+w,y,z+d],[x+w,y+h,z+d],[x+w,y+h,z]],color.map(v=>v*.9),stone);
  face([[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]],color.map(v=>Math.min(1,v*1.12)),stone);
 };
 for(let z=0;z<board.size;z++)for(let x=0;x<board.size;x++){
  if(board.grid[z][x]&&!board.bridgeCells?.includes(z*board.size+x)){
   const tone=(x*13+z*7)%4*.02;box(x,0,z,1,height,1,theme.wall.map(c=>Math.min(1,c+tone)),theme.material);
   box(x-.02,height-.03,z-.02,1.04,.13,1.04,theme.trim);
   if(variant>=2){box(x-.01,.35,z-.01,1.02,.07,1.02,theme.trim);box(x-.01,1.2,z-.01,1.02,.05,1.02,theme.lamp);}
   // Copper lanterns mounted on exposed faces, a warm visual landmark.
   if((x+z)%(variant===1?2:3)===0){for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]])if(board.grid[z+dz]?.[x+dx]===0){const lx=x+.5+dx*.53,lz=z+.5+dz*.53;box(lx-.045,.75,lz-.045,.09,.3,.09,theme.trim);box(lx-.06,1.,lz-.06,.12,variant===3?.35:.17,.12,theme.lamp);box(lx-.03,1.16,lz-.03,.06,.07,.06,[1,.94,.82]);}}
  }else{
   face([[x,0,z],[x+1,0,z],[x+1,0,z+1],[x,0,z+1]],theme.floor.map(c=>(x+z)%2?c:c+.04));
   // Thin floor inlays show perspective and distance without camera bob.
   const inlay=variant?theme.lamp:theme.trim;
   if(variant===1){box(x+.1,.003,z+.08,.035,.003,.84,inlay);box(x+.86,.003,z+.08,.035,.003,.84,inlay);}
   else if(variant===3){box(x+.32,.003,z+.32,.36,.003,.36,inlay);}
   else{box(x+.05,.003,z+.05,.9,.003,.02,inlay);box(x+.05,.003,z+.05,.02,.003,.9,inlay);}
  }
 }
 // Rescue landmarks are actual 3D objects, not only icons on the map.
 for(const marker of board.markers||[]){
  const x=marker.position%board.size+.5,z=Math.floor(marker.position/board.size)+.5;
  if(marker.kind==='crate'){
   box(x-.34,0,z-.34,.68,.68,.68,[.68,.39,.14],3);box(x-.36,.3,z-.36,.72,.08,.72,[1,.75,.3]);
  }else if(marker.kind==='pad'){
   box(x-.4,.01,z-.4,.8,.025,.8,[1,.8,.2]);box(x-.29,.04,z-.29,.58,.015,.58,[.27,.61,.47]);
  }else if(marker.kind==='switch'){
   const c=[[.96,.22,.19],[.18,.52,1],[1,.82,.16]][marker.color];box(x-.2,0,z-.2,.4,.18,.4,c);box(x-.04,.18,z-.04,.08,marker.active?.2:.5,.08,c);
  }else if(marker.kind==='bridge'){
   const c=[[.96,.22,.19],[.18,.52,1],[1,.82,.16]][marker.color||0];
   for(const dx of [-.42,.34])for(const dz of [-.42,.34])box(x+dx,0,z+dz,.08,1.3,.08,c);
   if(marker.closed){box(x-.42,.65,z-.05,.84,.13,.1,c);box(x-.05,.65,z-.42,.1,.13,.84,c);}
  }else if(marker.kind==='key'){
   const gold=[1,.76,.12];box(x-.18,.4,z-.05,.36,.08,.1,gold);box(x-.18,.4,z-.05,.08,.32,.1,gold);box(x+.1,.4,z-.05,.08,.32,.1,gold);box(x-.18,.64,z-.05,.36,.08,.1,gold);box(x-.04,.16,z-.05,.08,.27,.1,gold);box(x,.17,z-.05,.13,.07,.1,gold);
  }else{
   const c=board.theme.lamp;box(x-.19,0,z-.15,.38,.4,.3,c);box(x-.22,.4,z-.19,.44,.34,.38,c);box(x-.2,.74,z-.08,.1,.15,.16,c);box(x+.1,.74,z-.08,.1,.15,.16,c);
   for(const side of [-1,1]){box(x+side*.11-.035,.56,z-.198,.07,.07,.01,[.1,.15,.18]);box(x+side*.11-.035,.56,z+.188,.07,.07,.01,[.1,.15,.18]);}
  }
 }
 const ex=board.exit%board.size,ez=Math.floor(board.exit/board.size);
 // Open air beyond the doorway: an exterior landing and a path to the horizon.
 // No wall or opaque 'portal' quad is placed behind the golden arch.
 face([[-board.size,-.01,-18],[board.size*2,-.01,-18],[board.size*2,-.01,0],[-board.size,-.01,0]],theme.outside);
 face([[ex+.15,.002,-12],[ex+.85,.002,-12],[ex+.85,.002,0],[ex+.15,.002,0]],theme.floor.map(c=>Math.min(1,c+.2)));
 box(ex+.09,0,ez+.1,.13,1.5,.16,[.98,.7,.23]);box(ex+.78,0,ez+.1,.13,1.5,.16,[.98,.7,.23]);box(ex+.09,1.4,ez+.1,.82,.14,.16,[1,.82,.39]);box(ex+.27,.02,ez+.3,.46,.03,.46,[.96,.78,.25]);
 if(clue&&pos!==null){
  const x=pos%board.size+.5,z=Math.floor(pos/board.size)+.5,angle=clue.absolute*Math.PI/2;
  const convert=([a,b])=>[x+a*Math.cos(angle)-b*Math.sin(angle),.025,z+a*Math.sin(angle)+b*Math.cos(angle)];
  const points=[[-.08,.23],[.08,.23],[.08,-.04],[.22,-.04],[0,-.32],[-.22,-.04],[-.08,-.04]];
  for(let i=1;i<points.length-1;i++)for(const point of [points[0],points[i],points[i+1]])data.push(...convert(point),1,.84,.2,0);
 }
 return new Float32Array(data);
}
export function createMazeRenderer(canvas,report=()=>{}){
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});
 if(!gl){report('WebGL is unavailable');return {available:false,update(){},dispose(){}};}
 let program,buffer,disposed=false,raf=0,profile,eye=[0,.76,0],yaw=0,start=0,origin,goal,meshKey='',count=0;
 const shaders=[];
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));shaders.push(s);return s;}
 try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));buffer=gl.createBuffer();}catch(e){report(e.message);for(const s of shaders)gl.deleteShader(s);if(program)gl.deleteProgram(program);return {available:false,update(){},dispose(){}};}
 gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [name,size,offset] of [['aPosition',3,0],['aColor',3,12],['aStone',1,24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,28,offset);}
 const uniforms=Object.fromEntries(['uEye','uYaw','uAspect','uFog'].map(k=>[k,gl.getUniformLocation(program,k)]));
 gl.enable(gl.DEPTH_TEST);gl.clearColor(.42,.7,.73,1);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function draw(now=performance.now()){
  if(disposed||!profile||gl.isContextLost())return;
  const rect=canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(rect.width*scale)),h=Math.max(1,Math.floor(rect.height*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
  const t=goal?Math.min(1,(now-start)/320):1,ease=t*t*(3-2*t);
  if(goal){eye=origin.eye.map((v,i)=>v+(goal.eye[i]-v)*ease);yaw=origin.yaw+(goal.yaw-origin.yaw)*ease;}
  gl.uniform3fv(uniforms.uEye,eye);gl.uniform1f(uniforms.uYaw,yaw);gl.uniform1f(uniforms.uAspect,w/h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,count);canvas.dataset.renderer='webgl';
  if(t<1)raf=requestAnimationFrame(draw);else goal=null;
 }
 const resize=new ResizeObserver(()=>draw());resize.observe(canvas);
 const lost=e=>{e.preventDefault();cancelAnimationFrame(raf);report('The 3D view was interrupted. Reload to restore it; progress is saved.');};canvas.addEventListener('webglcontextlost',lost);
 return {available:true,update(p,scene){
  profile=p;const s=scene?.state||mazeState(p),b=scene?.board||mazeBoard(p),pos=s.position??b.start,clue=scene?scene.clue:mazeClue(p),key=`${b.seed}:${pos}:${clue?.absolute}`;
  gl.clearColor(...b.theme.sky,1);gl.uniform3fv(uniforms.uFog,b.theme.fog);canvas.dataset.world=b.theme.id;
  if(key!==meshKey){const vertices=mazeMesh(b,clue,pos);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);count=vertices.length/7;meshKey=key;}
  const nextEye=[pos%b.size+.5,.76,Math.floor(pos/b.size)+.5];let nextYaw=s.direction*Math.PI/2;while(nextYaw-yaw>Math.PI)nextYaw-=Math.PI*2;while(nextYaw-yaw< -Math.PI)nextYaw+=Math.PI*2;
  cancelAnimationFrame(raf);if(!origin||reduced()){eye=nextEye;yaw=nextYaw;goal=null;origin={eye,yaw};}else{origin={eye:[...eye],yaw};goal={eye:nextEye,yaw:nextYaw};start=performance.now();}draw();
 },dispose(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();canvas.removeEventListener('webglcontextlost',lost);gl.deleteBuffer(buffer);gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
