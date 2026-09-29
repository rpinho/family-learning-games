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
// ---- Composition (2026-09-28): one size system for every page, phone portrait, landscape and Chromebook ----
// Everyone is sized from ONE unit, U = the SMALLER screen side x k (so a scene reads the same turned either way; a
// tall phone's extra height is sky, not smaller people). Heights are relative to Dad (1.0): Dad > Mom > the boys >
// the toys; props are relative to the people (a ball is knee-high to Diogo). Everyone stands on ONE ground line;
// people and props share one row with a gap between neighbours, never overlapping (the row shrinks, and props give
// way first, when it does not fit). A friend who flies is lifted. Pure: sizes in, fractions of the screen out.
// Relative heights (Dad = 1): Dad about 1.35x Diogo, Mom a little shorter than Dad, Francisco between Mom and Diogo;
// the plush friends always shorter than Diogo.
export const PEOPLE={dad:1,'grown-up':1,mom:0.93,francisco:0.82,hero:0.8,diogo:0.74};
export const PROP_REL={ball:0.12,pizza:0.16,egg:0.14,chest:0.28,'baby-dino':0.34,target:0.46};
export const relHeight=(id,A)=>PEOPLE[id]??Math.max(0.3,Math.min(0.62,((A?.h??0.4)/0.64)*0.95));
export const propHeight=(id,P)=>PROP_REL[id]??Math.max(0.1,Math.min(0.4,(P?.h??0.12)/0.64));
// Diogo's standee height as a share of the screen's height: a tall phone 19%, a wide screen 30% (the rest of a tall
// screen is sky). Every page keeps these sizes; only a page with no room at all makes anyone smaller.
export const DIOGO_TALL=0.19,DIOGO_WIDE=0.30,BACK_SCALE=0.92,BACK_LIFT=0.05;
export function sceneUnit({width,height,maxHeight=0.9,tallest=1}){
 const tall=height>width*1.05,target=(tall?DIOGO_TALL:DIOGO_WIDE)*height/PEOPLE.diogo;
 return Math.min(target,maxHeight*height/Math.max(0.3,tallest));}
// One picture: people and props on the ground line, spread along it (bands left and right of what the page keeps
// clear: the goal, the ball's column, the game). When the row does not fit: props give way first, then the grown-ups
// step back (a second, slightly higher row, drawn behind: they stay taller, their faces clear of the children's
// heads), and only then does everyone shrink. Returns fractions of the screen; actors in draw order (back row first).
export function composeScene(scene,art,{width=16,height=9,ground=0.93,maxHeight=0.9,avoid=null,beat=false,playBall=false,margin=0.03,aside=null}={}){
 // aside: a friend placed elsewhere by the page (the keeper stands in the goal): sized with everyone, not in the row.
 const actors=(scene.actors||[]).filter(a=>a.id!==aside).map(a=>{const A=art.actors[a.id],P=A?.poses[a.pose]||A?.poses?.idle;if(!P)return null;return {kind:'actor',id:a.id,pose:a.pose,rel:relHeight(a.id,A),ar:P.ar,fly:!!P.fly||a.pose==='fly'};}).filter(Boolean);
 let props=(scene.props||[]).filter(p=>p.id!=='train'&&!(playBall&&p.id==='ball')).map(p=>{const P=art.props?.[p.id];return P?{kind:'prop',id:p.id,rel:propHeight(p.id,P),ar:P.ar||1}:null;}).filter(Boolean);
 const tallest=Math.max(0.3,...actors.map(a=>a.rel));let U=sceneUnit({width,height,maxHeight,tallest});const U0=U;
 // Props stand between people (after the first person, and at the end), never under them.
 const order=list=>{const out=[];actors.forEach((a,i)=>{out.push(a);if(i===0&&list[0])out.push(list[0]);});out.push(...list.slice(1));if(!actors.length)out.push(...list.slice(0,1));return out;};
 // (props alone with no room beside what is kept clear, e.g. a big train: they stay out of the picture)
 const bands=(()=>{const L=margin,R=1-margin;if(avoid&&avoid[1]>avoid[0]){const a=Math.max(L,avoid[0]),b=Math.min(R,avoid[1]);const out=[];if(a-L>0.08)out.push([L,a]);if(R-b>0.08)out.push([b,R]);if(out.length||!actors.length)return out;}return [[L,R]];})();
 if(!bands.length)return {actors:[],props:[],unit:U0,back:[],sky:1-(1-ground)};
 const room=bands.reduce((s,[a,b])=>s+(b-a),0)*width;
 const bodyW=(g,u)=>g.reduce((s,i)=>s+i.rel*u*i.ar,0),minGap=u=>Math.max(8,0.05*u);
 // The unit at which a list fits its band(s) (two bands: the split that keeps everyone biggest).
 function plan(list,u){
  const fitSide=(g,[a,b],uu)=>{const gb=bodyW(g,uu),n=Math.max(0,g.length-1)*minGap(uu);return gb>0&&gb+n>(b-a)*width?uu*Math.max(0.2,((b-a)*width-n)/gb):uu;};
  let groups=[list],best=fitSide(list,bands[0],u);
  if(bands.length>1){best=-1;for(let cut=0;cut<=list.length;cut++){const g=[list.slice(0,cut),list.slice(cut)],v=Math.min(fitSide(g[0],bands[0],u),fitSide(g[1],bands[1],u));if(v>best+1e-9){best=v;groups=g;}}}
  return {u:best,groups};}
 let items=order(props),P=plan(items,U),back=[];
 const fits=p=>p.u>=U0*0.995;
 while(!fits(P)&&items.some(i=>i.kind==='prop')){const k=items.map(i=>i.kind).lastIndexOf('prop');items.splice(k,1);P=plan(items,U);}
 // step back: the grown-ups first; still too wide, the plush friends too (the children always stay in front)
 const stepBack=more=>{const front=items.filter(i=>!more.includes(i));if(!more.length||!front.length)return;const F=plan(front,U);if(F.u>P.u+1e-6){back=[...back,...more];items=front;P=F;}};
 if(!fits(P))stepBack(items.filter(i=>i.kind==='actor'&&(PEOPLE[i.id]||0)>=0.9));
 // plush friends one at a time (the widest first), only as many as needed
 for(const t of items.filter(i=>i.kind==='actor'&&!(i.id in PEOPLE)).sort((a,b)=>b.rel*b.ar-a.rel*a.ar)){if(fits(P))break;stepBack([t]);}
 U=P.u;const groups=P.groups;
 const out={actors:[],props:[],unit:U,back:back.map(b=>b.id)};
 const backRow=[];
 groups.forEach((g,bi)=>{const [a,b]=bands[Math.min(bi,bands.length-1)],gb=bodyW(g,U),bw=(b-a)*width;
  // spread along the band: even gaps, up to a friend's width apart
  const gg=g.length>1?Math.max(4,Math.min(0.35*U,(bw-gb)/(g.length+1))):0,w=gb+Math.max(0,g.length-1)*gg;let x=(a+b)/2*width-w/2;
  for(const i of g){const h=i.rel*U,wd=h*i.ar,lift=i.fly?Math.min(0.2*height,Math.max(0,maxHeight*height-h-(1-ground)*height)):0;
   const r={id:i.id,left:x/width,width:wd/width,height:h/height,bottom:(1-ground)+lift/height};if(i.kind==='actor')out.actors.push({...r,pose:i.pose});else out.props.push(r);x+=wd+gg;}});
 // back row: a little smaller and higher, drawn first, each where he is least hidden (in the gaps between the
 // children, sampled along the bands; never over another back-row friend)
 // (a back-row friend wider than a band may reach past its edge, but pays dearly for standing in the kept-clear
 // column: the goal, the ball, the game)
 const keep=avoid&&avoid[1]>avoid[0]?[avoid[0]*width,avoid[1]*width]:null;
 for(const i of back){const h=i.rel*U*BACK_SCALE,wd=h*i.ar;let best=null;
  for(let cx=margin*width+wd/2;cx<=(1-margin)*width-wd/2+1e-6;cx+=Math.max(2,width*0.01)){const l=cx-wd/2,r=cx+wd/2;
   const fl=cx-wd*0.3,fr=cx+wd*0.3,ov=(f,a,b)=>Math.max(0,Math.min(b,(f.left+f.width)*width)-Math.max(a,f.left*width));
   const cover=[...out.actors,...out.props].reduce((s,f)=>s+ov(f,l,r)+4*ov(f,fl,fr),0)+backRow.reduce((s,f)=>s+10*ov(f,l,r),0);
   const inKeep=keep?Math.max(0,Math.min(r,keep[1])-Math.max(l,keep[0])):0;const c=cover+20*inKeep;
   if(!best||c<best.cover-1e-6)best={cover:c,l};}
  const r={id:i.id,pose:i.pose,left:(best?best.l:(width-wd)/2)/width,width:wd/width,height:h/height,bottom:(1-ground)+BACK_LIFT,depth:1};backRow.push(r);}
 out.actors.unshift(...backRow);
 // a friend flying in front of the back row flies no higher than a grown-up's shoulders (never over a face)
 for(const f of out.actors.filter(a=>!a.depth&&a.bottom>(1-ground)+1e-9))for(const b of out.actors.filter(a=>a.depth))
  if(f.left<b.left+b.width&&b.left<f.left+f.width)f.bottom=Math.max(1-ground,Math.min(f.bottom,b.bottom+b.height*0.7-f.height));
 const K=aside&&(scene.actors||[]).find(a=>a.id===aside),KA=K&&art.actors[K.id],KP=KA&&(KA.poses[K.pose]||KA.poses.idle);
 if(KP){const h=relHeight(K.id,KA)*U,w=h*KP.ar;out.actors.push({id:K.id,pose:K.pose,left:0.5-w/2/width,width:w/width,height:h/height,bottom:1-ground});}
 // The sky: effects (stars, hearts) stay above everyone's head.
 out.sky=1-Math.max(0,...[...out.actors,...out.props].map(r=>r.bottom+r.height));
 return out;
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
