// The Book's picture system, shared by the nightly generator (validation) and the player (layout).
// A chapter page is a SCENE composed from an art library: one background, up to four actors (each in a
// pose), a few props and an effect. The library is a manifest of image files:
//   {backgrounds:{id:{file,about}}, actors:{id:{name,h,poses:{pose:{file,ar}}}}, props:{id:{h,file,ar,about,seats?}}}
// h = height as a share of the scene height; ar = width/height of the image. A household keeps its own
// (private) library next to its chapters; this repository ships a small generic one (book-art/).
export const FX=['sparkles','stars','confetti','hearts','bubbles','none'];
export const CARRIERS=['ball','egg','bubble','shield','sign','star'];
export const MAX_ACTORS=5,MAX_PROPS=3;
const clean=s=>String(s??'').trim().toLowerCase();
// "hero:kick" -> {id:"hero",pose:"kick"}; unknown actors are dropped, unknown poses become idle.
export function parseActor(spec,lib,allowed){
 const [id,pose='idle']=String(spec||'').split(':').map(clean);
 const a=lib.actors?.[id];if(!a||(allowed&&!allowed.includes(id)))return null;
 return {id,pose:a.poses[pose]?pose:a.poses.idle?'idle':Object.keys(a.poses)[0]};
}
export function parseProp(spec,lib){
 const [id,n]=String(spec||'').split(/[:x×*]/).map(clean);const p=lib.props?.[id];if(!p)return null;
 return {id,n:Math.max(1,Math.min(12,Number(n)||1))};
}
// Normalise a model-written page scene against the library. Never throws; returns the scene and notes.
export function normalizeScene(page,lib,{allowed=null,fallbackBg,hero}={}){
 const notes=[];
 let bg=clean(page.scene||page.bg);if(!lib.backgrounds?.[bg]){if(bg)notes.push(`unknown scene "${bg}"`);bg=fallbackBg&&lib.backgrounds[fallbackBg]?fallbackBg:Object.keys(lib.backgrounds)[0];}
 const seen=new Set(),actors=[];
 for(const s of (Array.isArray(page.actors)?page.actors:[])){const a=parseActor(s,lib,allowed);if(!a){notes.push(`unknown actor "${s}"`);continue;}if(seen.has(a.id))continue;seen.add(a.id);actors.push(a);}
 const props=[];for(const s of (Array.isArray(page.props)?page.props:[])){const p=parseProp(s,lib);if(p&&!props.some(x=>x.id===p.id))props.push(p);}
 const fx=FX.includes(clean(page.fx))?clean(page.fx):'none';
 const ride=!!page.ride&&props.some(p=>p.id==='train'&&lib.props.train?.seats?.length);
 return {scene:{bg,actors:actors.slice(0,MAX_ACTORS),props:props.slice(0,MAX_PROPS),fx,...(ride?{ride:true}:{})},notes};
}
// Only the images a chapter uses, with URLs, so the player needs nothing else.
export function artFor(pages,lib,base='/book-art/'){
 const out={backgrounds:{},actors:{},props:{}};
 const url=f=>base+f;
 for(const p of pages){const s=p.scene;if(!s)continue;
  const b=lib.backgrounds[s.bg];if(b)out.backgrounds[s.bg]={url:url(b.file),...(b.goal?{goal:b.goal}:{})};
  // Every pose of an actor in the picture (the player switches poses as he plays: kick, cheer, dive, run).
  for(const a of s.actors){const A=lib.actors[a.id];if(!A||out.actors[a.id])continue;out.actors[a.id]={name:A.name||a.id,h:A.h||0.4,poses:Object.fromEntries(Object.entries(A.poses).map(([k,P])=>[k,{url:url(P.file),ar:P.ar||0.6,...(P.fly?{fly:true}:{})}]))};}
  for(const pr of [...s.props,...(p.carrierProp?[{id:p.carrierProp}]:[])]){const P=lib.props[pr.id];if(P)out.props[pr.id]={url:url(P.file),h:P.h||0.12,ar:P.ar||1,...(P.seats?{seats:P.seats}:{}),...(P.cars?{cars:P.cars}:{})};}
 }
 return out;
}
// Layout: where each actor stands, in scene-relative units (0..1). Groups are centred and shrunk
// together until they fit the width, so a tall phone screen gets smaller characters, never overlap.
// Rules that keep every character in sight:
//  - maxHeight: nobody is taller than this share of the screen (the band above is for the page's words and buttons);
//    everyone shrinks by the same factor, so Dad stays taller than the friends.
//  - avoid [x0,x1]: a band the characters step out of (a goal with its keeper, the things he counts): they stand
//    in two groups, left and right of it, each shrunk to fit its side.
export function layoutActors(actors,art,{width=16,height=9,ground=0.93,maxShare=0.94,scale=1,maxHeight=1,avoid=null}={}){
 let items=actors.map(a=>{const A=art.actors[a.id],P=A?.poses[a.pose];if(!P)return null;const h=A.h*scale;return {...a,h,w:h*P.ar*height/width,fly:!!P.fly||a.pose==='fly'};}).filter(Boolean);
 if(!items.length)return [];
 const tallest=Math.max(...items.map(i=>i.h)),cap=Math.min(1,maxHeight/tallest);
 if(cap<1)items=items.map(i=>({...i,h:i.h*cap,w:i.w*cap}));
 const gap=0.02;
 const row=(list,from,to)=>{const room=(to-from)*0.96,total=list.reduce((s,i)=>s+i.w,0)+gap*(list.length-1),k=Math.min(1,room/total);
  // A flying friend is lifted, but never into the band above maxHeight (the page's words).
  let x=from+((to-from)-total*k)/2;return list.map(i=>{const w=i.w*k,h=i.h*k,lift=i.fly?Math.max(0,Math.min(0.22,maxHeight-h)):0,out={id:i.id,pose:i.pose,left:x,width:w,height:h,bottom:1-ground+lift};x+=w+gap*k;return out;});};
 if(avoid&&avoid[1]>avoid[0]){
  const L=Math.max(0,avoid[0]),R=Math.min(1,avoid[1]),leftRoom=L-(1-maxShare)/2,rightRoom=(1+maxShare)/2-R;
  if(leftRoom>0.08||rightRoom>0.08){
   // The hero (first) and every other friend go left; the rest right, balanced by width.
   const left=[],right=[];let lw=0,rw=0;
   for(const i of items){const toLeft=rightRoom<=0.08||(leftRoom>0.08&&lw/leftRoom<=rw/Math.max(rightRoom,1e-6));if(toLeft){left.push(i);lw+=i.w;}else{right.push(i);rw+=i.w;}}
   return [...(left.length?row(left,(1-maxShare)/2,L):[]),...(right.length?row(right,R,(1+maxShare)/2):[])];
  }
 }
 return row(items,(1-maxShare)/2,(1+maxShare)/2);
}
// Where a band of the background picture (fractions of the image, drawn "cover") lands on the screen, 0..1.
export function coverBand([x,,w],{width,height,nw=1600,nh=1067}){const k=Math.max(width/nw,height/nh),dw=nw*k,ox=(width-dw)/2;return [(ox+x*dw)/width,(ox+(x+w)*dw)/width];}
// A train carries every friend in the picture: one open wagon each (the wagons in the picture repeat), never on
// the engine, where the cab and the boiler would hide them. Library: props.train.cars =
//   {parts:[{x:[x0,x1]},…,{x:[x0,x1],engine:true}], rim, body?:[x0,x1] per wagon}  (fractions of the image).
// Each rider stands in his wagon so at least RIDER_SHOWS of him is above the rim, and is never wider than it.
export const RIDER_SHOWS=0.92,MAX_WAGONS=5;
export function layoutTrain(actors,art,{width=16,height=9,maxWidth=0.94,maxHeight=0.5,bottom=0.05}={}){
 const T=art.props?.train,C=T?.cars;if(!C?.parts?.length)return null;
 const wagons=C.parts.filter(p=>!p.engine),engine=C.parts.find(p=>p.engine);if(!wagons.length)return null;
 const riders=actors.filter(a=>art.actors[a.id]).slice(0,MAX_WAGONS),n=Math.max(2,riders.length);
 // Widths in image-width units; the whole train is scaled to fit the screen (and never taller than maxHeight).
 const seq=Array.from({length:n},(_,i)=>wagons[i%wagons.length]),ew=engine?engine.x[1]-engine.x[0]:0;
 const imgW=seq.reduce((s,p)=>s+p.x[1]-p.x[0],0)+ew;
 // Screen fractions: an image-width unit is u of the screen width; the image height is u*W/(ar*H) of the screen height.
 let u=Math.min(maxWidth/imgW,maxHeight*T.ar*height/width);const hOf=u=>u*width/(T.ar*height);
 const h=hOf(u),total=imgW*u,left=(1-total)/2;
 let x=left;const parts=[];
 seq.forEach((p,i)=>{parts.push({kind:'wagon',i,src:p.x,left:x,width:(p.x[1]-p.x[0])*u});x+=(p.x[1]-p.x[0])*u;});
 if(engine)parts.push({kind:'engine',src:engine.x,left:x,width:ew*u});
 const rim=C.rim??0.55,rimY=bottom+h*(1-rim);
 // One scale for everyone, so Dad stays taller than the friends; each still fits his wagon's width.
 const inner=parts[0].width*(C.inner??0.86),info=riders.map(a=>{const A=art.actors[a.id],P=A.poses[a.pose]||Object.values(A.poses)[0];return {a,H:A.h||0.4,ar:P.ar*height/width};});
 const Hm=Math.max(...info.map(i=>i.H)),s=Math.min(h*1.25/0.6,...info.map(i=>inner/(i.ar*Math.max(i.H,0.6*Hm))));
 // Nobody is drawn smaller than 60% of the tallest (a tiny friend would vanish in his wagon).
 const Hmax=Math.max(...info.map(i=>i.H));
 const placed=info.map(({a,H,ar},i)=>{const w=parts[i],body=w.width*(C.inner??0.86);
  let rh=s*Math.max(H,0.6*Hmax);if(rh*ar>body)rh=body/ar;
  const rw=rh*ar,sink=rh*(1-RIDER_SHOWS);
  return {id:a.id,pose:a.pose,wagon:i,left:w.left+w.width/2-rw/2,width:rw,height:rh,bottom:rimY-sink,shows:RIDER_SHOWS};});
 return {train:{left,width:total,height:h,bottom},parts,riders:placed,rimY};
}
