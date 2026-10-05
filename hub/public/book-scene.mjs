import {backgroundRect,portraitTerrace} from './book-painted-layout.mjs';
export {backgroundRect,portraitTerrace} from './book-painted-layout.mjs';
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
// The things a game page puts in the picture (what he counts, shares or deals) are DRAWN library props, never
// emoji or plain shapes (2026-09-29: two white circles and a floating emoji drumstick covered Mom). A beat names its
// thing by prop id; the plates and the basket they are dealt from are props too.
export const THING_PROPS={'chicken nuggets':'chicken-nugget',cookies:'cookie',grapes:'grape','pizza slices':'pizza-slice','pizza bites':'pizza-slice',
 'baby dinosaurs':'baby-dino','soccer balls':'ball','dinosaur eggs':'egg',pizzas:'pizza',stars:'star','little dumbbells':'dumbbell'};
export function beatProps(b){if(!b)return [];
 if(b.painted)return [];
 if(b.kind==='count')return [b.prop||b.thing].filter(Boolean);
 // (a fair share from the basket: the things he deals, the plates and the basket; the older pizza share: pizza, slices, plates)
 if(b.kind==='share')return b.prop?[b.prop,'plate',b.basket||'snack-basket']:['pizza','pizza-slice','plate'];
 // a chess puzzle's painted pieces (chess-white-knight, chess-black-king, ...)
 if(b.kind==='puzzle'&&b.variant==='chess')return [...new Set((b.pieces||[]).map(p=>`chess-${p.c==='w'?'white':'black'}-${p.t}`))];
 // captured pieces standing beside the board (Dad took cream ones, he took dark ones)
 if(b.kind==='puzzle'&&b.variant==='captures')return [...new Set([...(b.captures?.dad||[]).map(t=>`chess-white-${t}`),...(b.captures?.hero||[]).map(t=>`chess-black-${t}`)])];
 if(b.kind==='remainder')return [b.prop||THING_PROPS[b.thing]||b.thing,'plate','snack-basket'].filter(Boolean);
 return [];}
export const missingBeatProps=(b,lib)=>beatProps(b).filter(id=>!lib?.props?.[id]);
// Only the images a chapter uses, with URLs, so the player needs nothing else.
export function artFor(pages,lib,base='/book-art/'){
 const out={backgrounds:{},actors:{},props:{}};
 const url=f=>base+f;
 for(const p of pages){const s=p.scene;if(!s)continue;
  const b=lib.backgrounds[s.bg];if(b)out.backgrounds[s.bg]={url:url(b.file),...(b.variants?{variants:Object.fromEntries(Object.entries(b.variants).map(([k,v])=>[k,{...v,url:url(v.file)}]))}:{}),...(b.bed!==undefined?{bed:b.bed}:{}),...(b.goal?{goal:b.goal}:{}),...(Array.isArray(b.keepOut)&&b.keepOut.length?{keepOut:b.keepOut}:{}),...(Number.isFinite(b.foreground)?{foreground:b.foreground}:{}),...(b.oneRow?{oneRow:true}:{}),...(b.fit?{fit:b.fit}:{}),...(b.realForeground?{realForeground:true}:{}),...(Array.isArray(b.door)?{door:b.door}:{}),...(b.portraitHeight?{portraitHeight:b.portraitHeight}:{}),...(b.portraitGround?{portraitGround:b.portraitGround}:{}),...(b.floorColor?{floorColor:b.floorColor}:{}),...(b.targets?{targets:b.targets}:{}),...(b.size?{size:b.size}:{}),...(b.focal?{focal:b.focal}:{}),...(b.standBand?{standBand:b.standBand}:{}),...(Number.isFinite(b.groundStart)?{groundStart:b.groundStart}:{}),...(Number.isFinite(b.ground)?{ground:b.ground}:{})};
  // Every pose of an actor in the picture (the player switches poses as he plays: kick, cheer, dive, run).
  for(const a of s.actors){const A=lib.actors[a.id];if(!A||out.actors[a.id])continue;out.actors[a.id]={name:A.name||a.id,h:A.h||0.4,poses:Object.fromEntries(Object.entries(A.poses).map(([k,P])=>[k,{url:url(P.file),ar:P.ar||0.6,...(P.fly?{fly:true}:{})}]))};}
  for(const pr of [...s.props,...(p.carrierProp?[{id:p.carrierProp}]:[]),...beatProps(p.beat).map(id=>({id})),...(s.fx==='gate-open'?[{id:p.gateReveal||'treasure-chest'}]:[])]){const P=lib.props[pr.id];if(P)out.props[pr.id]={url:url(P.file),h:P.h||0.12,ar:P.ar||1,...(P.seats?{seats:P.seats}:{}),...(P.cars?{cars:P.cars}:{}),...(P.rel?{rel:P.rel}:{})};}
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
// people and props share one row with a gap between neighbours, never overlapping (the row shrinks, and props give
// way first, when it does not fit). A friend who flies is lifted. Pure: sizes in, fractions of the screen out.
export const PEOPLE={dad:1,'grown-up':1,mom:0.93,explorer:0.82,hero:0.8,beginner:0.74};
export const PROP_REL={ball:0.12,pizza:0.16,egg:0.14,chest:0.28,'baby-dino':0.34,target:0.46};
export const relHeight=(id,A)=>PEOPLE[id]??Math.max(0.3,Math.min(0.62,((A?.h??0.4)/0.64)*0.95));
// A library prop may give its real height (rel, Dad = 1): a little dumbbell is drawn at its true size beside the
// children, never blown up to a ball's size (2026-10-01: equipment at real scale, not flat icons).
export const propHeight=(id,P)=>PROP_REL[id]??(P?.rel>0?P.rel:Math.max(0.1,Math.min(0.4,(P?.h??0.12)/0.64)));
// screen is sky). Every page keeps these sizes; only a page with no room at all makes anyone smaller.
export const BEGINNER_TALL=0.19,BEGINNER_WIDE=0.30,BACK_SCALE=0.92,BACK_LIFT=0.05;
export function sceneUnit({width,height,maxHeight=0.9,tallest=1}){
 const tall=height>width*1.05,target=(tall?BEGINNER_TALL:BEGINNER_WIDE)*height/PEOPLE.beginner;
 return Math.min(target,maxHeight*height/Math.max(0.3,tallest));}
// ---- Keep-out zones (2026-10-01): the painted objects of a background that nobody may stand on or in front of ----
// A library background may list them: keepOut:[{name,r:[x,y,w,h]}] in fractions of the picture (like goal), most
// zonesOnScreen turns them into screen fractions {name,x0,x1,y0,y1} (y from the top) for one screen shape: the picture
// is drawn "cover" (or pinned to the top: TOP_ANCHORED, as book.css draws it). A picture with zones is held still while
// it is shown (still: book.mjs stops its drift and parallax); one that drifts (scale 1.02-1.08 and 0.6% sideways) gets
// the union of where each zone can be. Padded either way (the friends' layer still shifts a few pixels).
export const ZONE_FLOOR=0.8,ZONE_SHRINK=0.9,ZONE_HOP=0.15,ZONE_PAD=0.012;
export const TOP_ANCHORED=new Set(['gym-bars-home']);
// One image transform shared by painted hit areas and keep-out zones.
export function zonesOnScreen(entry,{width,height,top=false,still=false,nw=1536,nh=1024}={}){
 const zs=Array.isArray(entry?.keepOut)?entry.keepOut:[];const out=[];if(!zs.length||!(width>0&&height>0))return out;
 const {x:ox,y:oy,w:dw,h:dh}=backgroundRect(entry,{width,height,nw,nh,top});
 for(const z of zs){const [x,y,w,h]=(z?.r||z||[]).map(Number);if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const sc of top||still?[1]:[1.02,1.08])for(const t of top||still?[0]:[-0.006,0.006]){
   const X=v=>((ox+v*dw-width/2)*sc+width/2)/width+t,Y=v=>((oy+v*dh-height/2)*sc+height/2)/height;
   x0=Math.min(x0,X(x));x1=Math.max(x1,X(x+w));y0=Math.min(y0,Y(y));y1=Math.max(y1,Y(y+h));}
  const pad=ZONE_PAD+12/width;if(x1<0||x0>1)continue;out.push({name:String(z?.name||'painted object'),x0:x0-pad,x1:x1+pad,y0:y0-6/height,y1:y1+6/height});}
 return out;}
// One picture: people and props on the ground line, spread along it (bands left and right of what the page keeps
// clear: the goal, the ball's column, the game). When the row does not fit: props give way first, then the grown-ups
// step back (a second, slightly higher row, drawn behind: they stay taller, their faces clear of the children's
// heads), and only then does everyone shrink. Returns fractions of the screen; actors in draw order (back row first).
export function composeScene(scene,art,{width=16,height=9,ground=0.93,maxHeight=0.9,avoid=null,beat=false,playBall=false,margin=0.03,aside=null,keepOut=[],oneRow=false,minHeight=0,backLift=BACK_LIFT}={}){
 if(minHeight)margin=.015;
 // aside: a friend placed elsewhere by the page (the keeper stands in the goal): sized with everyone, not in the row.
 const actors=(scene.actors||[]).filter(a=>a.id!==aside).map(a=>{const A=art.actors[a.id],P=A?.poses[a.pose]||A?.poses?.idle;if(!P)return null;return {kind:'actor',id:a.id,pose:a.pose,rel:relHeight(a.id,A),ar:P.ar,fly:!!P.fly||a.pose==='fly'};}).filter(Boolean);
 let props=(scene.props||[]).filter(p=>p.id!=='train'&&!(playBall&&p.id==='ball')).map(p=>{const P=art.props?.[p.id];return P?{kind:'prop',id:p.id,rel:propHeight(p.id,P),ar:P.ar||1}:null;}).filter(Boolean);
 const tallest=Math.max(0.3,...actors.map(a=>a.rel));let U0=Math.max(sceneUnit({width,height,maxHeight,tallest}),Math.min(minHeight,maxHeight)*height);
 // The painted objects the friends must not cover (keepOut: the background's keep-out zones on this screen, see
 // zonesOnScreen). Only a zone the row reaches counts: its bottom below the highest head (a hop included, a step back
 // included); a zone the heads only just touch makes everyone a little smaller (at most ZONE_SHRINK) instead.
 const hard=(Array.isArray(avoid?.[0])?avoid:avoid?[avoid]:[]).filter(a=>a&&a[1]>a[0]);
 const reach=u=>{const h=tallest*u/height;return (minHeight?Math.max(h*(1+ZONE_HOP),backLift+h*BACK_SCALE*(1+ZONE_HOP)):Math.max(h,backLift+h*BACK_SCALE)*(1+ZONE_HOP))+(actors.some(a=>a.fly)?0.12:0);};
 const zonesIn=(keepOut||[]).filter(z=>z&&z.x1>0&&z.x0<1&&z.y1>z.y0&&z.y0<ground);
 let blocking=[];
 const planZones=()=>{for(const z of zonesIn){const r=reach(U0),top=ground-r;if(!minHeight&&z.y1>top&&(ground-z.y1)/r>=ZONE_SHRINK)U0*=(ground-z.y1)/r;}
  blocking=zonesIn.filter(z=>z.y1>ground-reach(U0)+1e-9);};
 // Props stand between people (after the first person, and at the end), never under them.
 const order=list=>{const out=[];actors.forEach((a,i)=>{out.push(a);if(i===0&&list[0])out.push(list[0]);});out.push(...list.slice(1));if(!actors.length)out.push(...list.slice(0,1));return out;};
 // (props alone with no room beside what is kept clear, e.g. a big train: they stay out of the picture)
 const bodyW=(g,u)=>g.reduce((s,i)=>s+i.rel*u*i.ar,0),minGap=u=>minHeight?Math.max(4,.025*u):Math.max(8,0.05*u);
 // The places along the ground line left free by the kept-clear columns (hard: the goal, the ball, the game; zones:
 // the painted objects). Hard columns that leave no room are ignored (as before); zones that leave none fail (null).
 function freeBands(cols,zoneCount){const L=margin,R=1-margin;if(!cols.length)return [[L,R]];
  const iv=cols.map(([a,b])=>[Math.max(L,a),Math.min(R,b)]).filter(([a,b])=>b>a).sort((x,y)=>x[0]-y[0]);const out=[];let x=L;
  for(const [a,b] of iv){if(a-x>0.08)out.push([x,a]);x=Math.max(x,b);}if(R-x>0.08)out.push([x,R]);
  if(out.length||!actors.length)return out;return zoneCount?null:[[L,R]];}
 // every way of handing the row, in order, to the bands (a band may stay empty)
 const splits=(n,k)=>k<=1?[[n]]:Array.from({length:n+1},(_,i)=>splits(n-i,k-1).map(r=>[i,...r])).flat();
 function solve(bands,keepCols){
 if(!bands.length)return {out:{actors:[],props:[],unit:U0,back:[]},bad:false};
 // The unit at which a list fits its band(s) (several bands: the split that keeps everyone biggest).
 function plan(list,u){
  const fitSide=(g,[a,b],uu)=>{const gb=bodyW(g,uu),n=Math.max(0,g.length-1)*minGap(uu);return gb>0&&gb+n>(b-a)*width?uu*Math.max(oneRow?0.01:0.2,((b-a)*width-n)/gb):uu;};
  let groups=[list],best=fitSide(list,bands[0],u);
  if(bands.length>1){best=-1;for(const sp of splits(list.length,bands.length)){let k=0;const g=sp.map(n=>list.slice(k,k+=n)),v=Math.min(...g.map((x,i)=>fitSide(x,bands[i],u)));if(v>best+1e-9){best=v;groups=g;}}}
  return {u:best,groups};}
 // One size for everyone; if at that size a back-row face would still be hidden (no place left where it shows),
 // everyone is drawn a little smaller and the picture is arranged again (fewer friends need to step back).
 function arrange(Ut){
  let items=order(props).map(i=>({...i})),P=plan(items,Ut),back=[];
  const fits=p=>p.u>=Ut*0.995;
  while(!fits(P)&&items.some(i=>i.kind==='prop')){const k=items.map(i=>i.kind).lastIndexOf('prop');items.splice(k,1);P=plan(items,Ut);}
  // step back: the grown-ups first; still too wide, the plush friends too (the children always stay in front)
  const stepBack=more=>{const front=items.filter(i=>!more.includes(i));if(!more.length||!front.length)return;const F=plan(front,Ut);if(F.u>P.u+1e-6){back=[...back,...more];items=front;P=F;}};
  if(!oneRow&&!fits(P))stepBack(items.filter(i=>i.kind==='actor'&&(PEOPLE[i.id]||0)>=0.9));
  // Keep the people at foreground scale; a plush occupies the space left
  // beside the children before it is sent into an overcrowded rear row.
  if(minHeight&&!fits(P)&&bands.length===1){const room=(bands[0][1]-bands[0][0])*width;
   for(const t of items.filter(i=>i.kind==='actor'&&!(i.id in PEOPLE)).sort((a,b)=>b.rel*b.ar-a.rel*a.ar)){
    const other=bodyW(items.filter(i=>i!==t),Ut),gaps=Math.max(0,items.length-1)*minGap(Ut);
    t.rel=Math.max(.12,Math.min(t.rel,(room-other-gaps)/(Ut*t.ar)));P=plan(items,Ut);if(fits(P))break;
   }
  }
  // plush friends one at a time (the widest first), only as many as needed
  for(const t of items.filter(i=>i.kind==='actor'&&!(i.id in PEOPLE)).sort((a,b)=>b.rel*b.ar-a.rel*a.ar)){if(oneRow||fits(P))break;stepBack([t]);}
  const U=P.u,groups=P.groups;
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
  const keeps=keepCols.map(([a,b])=>[a*width,b*width]),inKeep=(l,r)=>keeps.reduce((t,[a,b])=>t+Math.max(0,Math.min(r,b)-Math.max(l,a)),0);
  // His FACE must show, not only his sides: a short friend a step back is hidden by whoever stands in front of him,
  // however little he sticks out to the side; a tall one shows his face over a short friend's head. So the cost is
  // what covers his face (heights count, not only the width), and the back row is seated together: every order of
  const front=[...out.actors,...out.props].map(f=>{const x0=f.left*width,x1=(f.left+f.width)*width;
   return {x0,x1,cx0:x0+(x1-x0)*0.15,cx1:x1-(x1-x0)*0.15,top:(1-f.bottom-f.height)*height};});
  const backTop=(1-(1-ground)-backLift)*height;
  const seat=list=>{const row=[];let total=0;
   for(const i of list){const h=i.rel*U*BACK_SCALE,wd=h*i.ar,top=backTop-h,faceB=top+h*0.4;let best=null;
    const fitsBand=bands.some(([a,b])=>(b-a)*width>=wd);
    for(let cx=margin*width+wd/2;cx<=(1-margin)*width-wd/2+1e-6;cx+=Math.max(2,width*0.01)){const l=cx-wd/2,r=cx+wd/2;
     if(fitsBand&&!bands.some(([a,b])=>l>=a*width-1e-6&&r<=b*width+1e-6))continue;
     const fl=cx-wd*0.3,fr=cx+wd*0.3,ov=(a0,a1,b0,b1)=>Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));
     // (the face: the middle of his top two fifths, against the middle of each body in front, from its head down)
     const face=front.reduce((s,f)=>s+ov(fl,fr,f.cx0,f.cx1)*ov(top,faceB,f.top,height),0)/Math.max(1,faceB-top);
     const cover=front.reduce((s,f)=>s+ov(l,r,f.x0,f.x1),0)+40*face+row.reduce((s,f)=>s+10*ov(l,r,f.l,f.l+f.wd),0);
     const c=cover+20*inKeep(l,r);
     if(!best||c<best.cover-1e-6)best={cover:c,l};}
    const l=best?best.l:(width-wd)/2;total+=best?best.cover:0;row.push({i,h,wd,l,top,faceB});}
   return {row,total};};
  const orders=list=>list.length<=1?[list]:list.flatMap((x,k)=>orders([...list.slice(0,k),...list.slice(k+1)]).map(o=>[x,...o]));
  let seated=null;if(back.length)for(const o of back.length<=5?orders(back):[back]){const s=seat(o);if(!seated||s.total<seated.total-1e-6)seated=s;}
  // (drawn in the scene's order, so the same friends keep the same drawing order whatever the seating)
  for(const i of back){const s=seated.row.find(x=>x.i===i);
   backRow.push({id:i.id,pose:i.pose,left:s.l/width,width:s.wd/width,height:s.h/height,bottom:(1-ground)+backLift,depth:1});}
  out.actors.unshift(...backRow);
  // Still a face behind someone, two back-row friends on top of each other, or one standing in the kept-clear column
  // (no free place left for him): this size does not work.
  let bad=false;const ov=(a0,a1,b0,b1)=>Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));
  for(const s of seated?.row||[]){const fl=s.l+s.wd*0.2,fr=s.l+s.wd*0.8,hid=front.reduce((t,f)=>t+ov(fl,fr,f.cx0,f.cx1)*ov(s.top,s.faceB,f.top,height),0)/((fr-fl)*(s.faceB-s.top));
   if(hid>0.1||inKeep(s.l,s.l+s.wd)>0.15*s.wd||seated.row.some(o=>o!==s&&ov(s.l,s.l+s.wd,o.l,o.l+o.wd)*Math.min(s.h,o.h)>0.12*Math.min(s.wd*s.h,o.wd*o.h)))bad=true;}
  return {out,bad};
 }
 // (if no size up to a third smaller shows every face, the full size stays: shrinking everyone would not help)
 const first=arrange(U0);let res=first;for(let k=1;res.bad&&k<=5;k++)res=arrange(Math.max(minHeight*height,U0*0.92**k));if(res.bad)res=first;
 return res;}
 // Every painted object stays clear while that keeps everyone at least ZONE_FLOOR of his size; when it does not, the
 // least important objects (the end of the background's list) give way one at a time (2026-10-01: Mom stood on the
 // tetherball). With no zones at all, exactly the layout of before.
 // First the picture of before: if nobody and nothing in it touches a painted object (a hop above the head included),
 // it stays exactly as it was (2026-10-01: a zone the row only might reach sent Mom a step back and the chest away).
 const touches=r=>{const all=[...r.out.actors,...r.out.props];return zonesIn.some(z=>all.some(b=>{const t=1-b.bottom-b.height*(1+ZONE_HOP);
  return Math.max(0,Math.min(b.left+b.width,z.x1)-Math.max(b.left,z.x0))*Math.max(0,Math.min(1-b.bottom,z.y1)-Math.max(t,z.y0))>0.01*(z.x1-z.x0)*(z.y1-z.y0);}));};
 let res=null,active=[];
 if(zonesIn.length){const b0=freeBands(hard,0);res=solve(b0,hard);if(touches(res))res=null;else{blocking=zonesIn.slice();active=blocking.slice();}}
 if(!res){planZones();active=blocking.slice();
 for(;;){const cols=[...hard,...active.map(z=>[z.x0,z.x1])],bands=freeBands(cols,active.length);
  if(bands){res=solve(bands,cols);if(!active.length||(res.out.unit>=U0*ZONE_FLOOR-1e-9&&!res.bad)||(!actors.length&&!(scene.props||[]).length))break;}
  active.pop();}
 }
 const out=res.out,U=out.unit;out.keepOut={clear:active.map(z=>z.name),covered:blocking.filter(z=>!active.includes(z)).map(z=>z.name)};
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
export const TRAIN_MIN=0.6,TRAIN_SHRINK=0.75;
export function layoutTrain(actors,art,{width=16,height=9,maxWidth=0.94,maxHeight=0.5,bottom=0.05,keepOut=[],preferRight=false}={}){
 const T=art.props?.train,C=T?.cars;if(!C?.parts?.length)return null;
 const wagons=C.parts.filter(p=>!p.engine),engine=C.parts.find(p=>p.engine);if(!wagons.length)return null;
 const riders=actors.filter(a=>art.actors[a.id]).slice(0,MAX_WAGONS),n=Math.max(2,riders.length);
 // Widths in image-width units; the whole train is scaled to fit the screen (and never taller than maxHeight).
 const seq=Array.from({length:n},(_,i)=>wagons[i%wagons.length]),ew=engine?engine.x[1]-engine.x[0]:0;
 const imgW=seq.reduce((s,p)=>s+p.x[1]-p.x[0],0)+ew;
 // Screen fractions: an image-width unit is u of the screen width; the image height is u*W/(ar*H) of the screen height.
 let u=Math.min(maxWidth/imgW,maxHeight*T.ar*height/width);const hOf=u=>u*width/(T.ar*height);
 // One layout of the train at scale u, its left end at left (screen fractions).
 function build(u,left){
  const h=hOf(u),total=imgW*u;
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
  return {train:{left,width:total,height:h,bottom},parts,riders:placed,rimY};}
 // The train (with its riders) never stands in front of a painted object (keepOut zones on this screen, as composeScene
 // takes them; 2026-10-01: Mom rode right over the tetherball pole). In order: a train a little smaller (down to
 // TRAIN_SHRINK) whose riders' heads stay below the object; else the widest free stretch beside the objects (preferRight:
 // the stretch right of them, for a train about to drive off, so it never drives across one), smaller if it must (never
 // under TRAIN_MIN); else the least important objects give way, one at a time. No zones: exactly the train of before.
 const box=L=>({x0:L.train.left,x1:L.train.left+L.train.width,y0:1-Math.max(L.train.bottom+L.train.height,...L.riders.map(r=>r.bottom+r.height)),y1:1-L.train.bottom});
 const hits=(L,zs)=>{const b=box(L);return zs.filter(z=>Math.max(0,Math.min(b.x1,z.x1)-Math.max(b.x0,z.x0))*Math.max(0,Math.min(b.y1,z.y1)-Math.max(b.y0,z.y0))>0.01*(z.x1-z.x0)*(z.y1-z.y0));};
 // (every object at the train's height counts, wherever it is along the line: moving the train must not land it on one)
 const centred=u=>build(u,(1-imgW*u)/2),first=centred(u),fb=box(first),
  blocking=(keepOut||[]).filter(z=>z&&z.x1>0&&z.x0<1&&z.y1>z.y0&&Math.min(fb.y1,z.y1)-Math.max(fb.y0,z.y0)>0.01*(z.y1-z.y0));
 let out=first,active=blocking.slice();
 if(blocking.length&&hits(first,blocking).length){const Lm=(1-maxWidth)/2,Rm=(1+maxWidth)/2;let found=null;
  while(active.length&&!found){
   for(let f=1;f>=TRAIN_SHRINK-1e-9&&!found;f-=0.025){const L=centred(u*f);if(!hits(L,active).length)found=L;}
   if(found)break;
   const iv=active.map(z=>[Math.max(Lm,z.x0),Math.min(Rm,z.x1)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]),free=[];let x=Lm;
   for(const [a,b] of iv){if(a>x)free.push([x,a]);x=Math.max(x,b);}if(Rm>x)free.push([x,Rm]);
   const need=imgW*u*TRAIN_MIN,fits=free.filter(([a,b])=>b-a>=need),pick=preferRight&&fits.length?fits.at(-1):fits.sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
   if(pick){const uu=u*Math.min(1,(pick[1]-pick[0])/(imgW*u)),L=build(uu,(pick[0]+pick[1])/2-imgW*uu/2);if(!hits(L,active).length){found=L;break;}}
   active.pop();}
  out=found||first;if(!found)active=[];}
 return {...out,keepOut:{clear:active.map(z=>z.name),covered:blocking.filter(z=>!active.includes(z)).map(z=>z.name)}};
}

// Painted scene objects keep their own space. Project their rectangles through the same cover crop as the
// background; only protect the visible part if it reaches the characters' vertical band.
export function paintedObjectBand(rects,{width,height,top,ground,imageWidth=1536,imageHeight=1024}){
 const k=Math.max(width/imageWidth,height/imageHeight),dw=imageWidth*k,dh=imageHeight*k;let band=null;
 for(const r of rects||[]){if(!Array.isArray(r)||r.length!==4||!r.every(Number.isFinite)||r[2]<=0||r[3]<=0)continue;
  const y=((height-dh)/2+r[1]*dh)/height,b=y+r[3]*dh/height;
  if(b<=top||y>=ground)continue;
  const a=Math.max(0,((width-dw)/2+r[0]*dw)/width),z=Math.min(1,((width-dw)/2+(r[0]+r[2])*dw)/width);
  if(z<=a)continue;band=band?[Math.min(band[0],a),Math.max(band[1],z)]:[a,z];
 }return band? [Math.max(0,band[0]-.02),Math.min(1,band[1]+.02)]:null;
}
