// The Book's picture system, shared by the nightly generator (validation) and the player (layout).
// A chapter page is a SCENE composed from an art library: one background, up to four actors (each in a
// pose), a few props and an effect. The library is a manifest of image files:
//   {backgrounds:{id:{file,about}}, actors:{id:{name,h,poses:{pose:{file,ar}}}}, props:{id:{h,file,ar,about,seats?}}}
// h = height as a share of the scene height; ar = width/height of the image. A household keeps its own
// (private) library next to its chapters; this repository ships a small generic one (book-art/).
export const FX=['sparkles','stars','confetti','hearts','bubbles','none'];
export const CARRIERS=['ball','egg','bubble','shield','sign','star'];
export const MAX_ACTORS=4,MAX_PROPS=3;
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
  for(const pr of [...s.props,...(p.carrierProp?[{id:p.carrierProp}]:[])]){const P=lib.props[pr.id];if(P)out.props[pr.id]={url:url(P.file),h:P.h||0.12,ar:P.ar||1,...(P.seats?{seats:P.seats}:{})};}
 }
 return out;
}
// Layout: where each actor stands, in scene-relative units (0..1). Groups are centred and shrunk
// together until they fit the width, so a tall phone screen gets smaller characters, never overlap.
export function layoutActors(actors,art,{width=16,height=9,ground=0.93,maxShare=0.94,scale=1}={}){
 const items=actors.map(a=>{const A=art.actors[a.id],P=A?.poses[a.pose];if(!P)return null;const h=A.h*scale;return {...a,h,w:h*P.ar*height/width,fly:!!P.fly||a.pose==='fly'};}).filter(Boolean);
 if(!items.length)return [];
 const gap=0.02,total=items.reduce((s,i)=>s+i.w,0)+gap*(items.length-1),k=Math.min(1,maxShare/total);
 let x=(1-total*k)/2;
 return items.map(i=>{const w=i.w*k,h=i.h*k,out={id:i.id,pose:i.pose,left:x,width:w,height:h,bottom:1-ground+(i.fly?0.22:0)};x+=w+gap*k;return out;});
}
