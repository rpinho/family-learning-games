// Shared by check-timeline.mjs and record-chapter.mjs: the in-page sampler (every friend AND every prop, every 100 ms),
// how a child plays each game, and the verdict on the samples. One set of rules for both.
//
// Friends (as before): overlap in the same row, a back-row face covered, off the ground for more than 0.6 s (unless he
// flies, rides or keeps goal), cut off.
// Props and things in the picture (2026-09-29: two plain white circles and an emoji drumstick floated over Mom, and the
// friends-only check passed it):
//  - DRAWN: every prop is a library picture that loaded (no plain shape, no emoji, no empty box);
//  - NEVER OVER A FRIEND: a prop covers no friend's face or body (a ball in his own hands is held, not covering);
//  - ON THE GROUND OR IN HANDS: its bottom rests on the ground (the friends' ground line, or the grass in front of it,
//    or a little behind it: rows further back), or it is held (in the middle of a friend's picture), for more than
//    0.6 s; a ball in flight (thrown, kicked, in the net) is exempt.
// The reward that flies into the keyring or spellbook (.bk-key-fly) is part of the book's controls, not the picture.
import {relHeight} from '../public/book-scene.mjs';
export const SAMPLE_JS=`(t0)=>{const pg=document.querySelector('.bk-view .bk-page:last-child:not(.out)');if(!pg)return null;const R=document.querySelector('.bk').getBoundingClientRect();
 const page=[...document.querySelectorAll('.bk-dots i')].findIndex(x=>x.classList.contains('now'));
 const chapter=globalThis.__tlChapter,p=chapter?.pages[page],kick=p&&(p.action?.kind==='kick'||p.beat?.kind==='kick-letter');
 const ids=kick?p.scene.actors.map(a=>a.id).filter(id=>id!==chapter.player):[];const keeperId=ids.find(id=>chapter.art.actors[id]?.poses.dive)||ids.find(id=>id!=='dad')||ids[0];
 const goal=kick&&pg.dataset.goal?JSON.parse(pg.dataset.goal):null;
 const train=pg.querySelector('.bk-prop.train');const tr=train?.getBoundingClientRect(),trainFaded=!!train&&Number(getComputedStyle(train).opacity)<0.2;
 const box=r=>({x:r.left-R.left,y:r.top-R.top,w:r.width,h:r.height});
 const actors=[...pg.querySelectorAll('.bk-actor')].map(a=>{const img=a.querySelector('img');const r=(img||a).getBoundingClientRect();
  let y=0,n=a;while(n&&n!==pg){y+=n.offsetTop;n=n.offsetParent;}
  return {id:a.dataset.id,pose:a.dataset.pose,diveImage:!!chapter?.art?.actors[a.dataset.id]?.poses.dive&&img?.getAttribute('src')===chapter.art.actors[a.dataset.id].poses.dive.url,depth:Number(a.dataset.depth||0),rider:a.classList.contains('rider'),diving:a.classList.contains('keeper'),keeper:a.dataset.id===keeperId||a.classList.contains('keeper-ready')||a.classList.contains('keeper'),fly:a.classList.contains('fly'),
   paintedBalls:['kick','throw'].includes(a.dataset.pose)?1:0,rel:chapter?.art?.actors[a.dataset.id]?.h||null,drawnH:img&&img.naturalWidth?Math.min(r.height,r.width*img.naturalHeight/img.naturalWidth):r.height,drawnW:img&&img.naturalHeight?Math.min(r.width,r.height*img.naturalWidth/img.naturalHeight):r.width,...box(r),foot:y+a.offsetHeight};});
 const EMOJI=/\\p{Extended_Pictographic}/u;
 const props=[...pg.querySelectorAll('.bk-prop:not(.train), .bk-table > *, .bk-ball, .bk-plate, .bk-things > *, .bk-plates, .bk-pizza, .bk-box')].filter((e,i,a)=>a.indexOf(e)===i&&!e.closest('.bk-play')).map(e=>{
  const r=e.getBoundingClientRect(),cs=getComputedStyle(e);if(!r.width||!r.height||cs.visibility==='hidden'||cs.display==='none'||Number(cs.opacity)===0)return null;
  const imgs=[...e.querySelectorAll('img')],art=imgs.find(i=>/\\/book-art\\//.test(i.getAttribute('src')||''));
  const text=[...e.childNodes].map(n=>n.nodeType===3?n.textContent:n.tagName==='B'?'':n.textContent||'').join('').trim();
  return {cls:[...e.classList].filter(c=>c.startsWith('bk-')).join('.')||e.tagName.toLowerCase(),id:e.dataset.id||'',...box(r),
   drawn:!!art&&(!art.complete||art.naturalWidth>0),emoji:EMOJI.test(text),flying:e.classList.contains('flying'),held:e.dataset.held||''};}).filter(Boolean);
 const front=actors.filter(a=>!a.depth&&!a.fly&&!a.rider&&!a.keeper);
 // The painted objects of the background (its keep-out zones: the tetherball, the brain, the bar...), where they are on
 // screen right now: the picture is drawn "cover" (object-position read from the page) and drifts and shifts with the
 // parallax, so the zones are measured from the picture element as drawn. A check may pass its own zones (__tlZones).
 const bgEl=pg.querySelector('.bk-bg'),bgId=pg.dataset.scene,zdef=(globalThis.__tlZones||{})[bgId]||chapter?.art?.backgrounds?.[bgId]?.keepOut||[];let zones=[];
 if(bgEl&&zdef.length&&bgEl.naturalWidth){const r=bgEl.getBoundingClientRect(),nw=bgEl.naturalWidth,nh=bgEl.naturalHeight,k=Math.max(r.width/nw,r.height/nh),pos=getComputedStyle(bgEl).objectPosition.split(' ').map(v=>/%$/.test(v)?parseFloat(v)/100:v==='0px'?0:0.5);
  const ox=r.left-R.left+(r.width-nw*k)*(pos[0]??0.5),oy=r.top-R.top+(r.height-nh*k)*(pos[1]??0.5);
  zones=zdef.map(z=>{const [x,y,w,h]=z.r||z;return {name:z.name||'painted object',x:ox+x*nw*k,y:oy+y*nh*k,w:w*nw*k,h:h*nh*k};});}
 const trainBox=tr?{...box(tr)}:null;
 return {zones,trainBox,t:Math.round(performance.now()-t0),page,W:R.width,H:R.height,actors,props,keeperId,kickerId:kick?chapter.player:null,singleBall:!!p?.action&&['kick','throw'].includes(p.action.kind)||p?.beat?.kind==='kick-letter',goal,shot:pg.dataset.shot==='taken',ground:front.length?Math.max(...front.map(a=>a.foot)):null,trainGone:!!tr&&(trainFaded||tr.right<R.left+20||tr.left>R.right-20)};}`;
// Install in the page: pushes to globalThis.__tl every 100 ms (t from t0Expr).
export const SAMPLER=(t0Expr='performance.now()',chapter=null)=>`(()=>{if(globalThis.__tlOn)return;globalThis.__tlOn=true;globalThis.__tl=globalThis.__tl||[];globalThis.__tlChapter=${JSON.stringify(chapter)};const t0=${t0Expr};const f=${SAMPLE_JS};
 const take=()=>{const s=f(t0);if(s)globalThis.__tl.push(s);};let last=null;
 // Every page's first animation frame is checked, even if the 100 ms timer misses its entrance.
 const frame=()=>{if(!globalThis.__tlOn)return;const pg=document.querySelector('.bk-page:last-child:not(.out)');if(pg!==last){last=pg;take();}requestAnimationFrame(frame);};requestAnimationFrame(frame);setInterval(take,100);})()`;
export const READY={'teach-letter':'.bk-glyph','kick-letter':'.bk-ball','count':'.bk-thing','signs':'.bk-play .bk-btn','spell':'.bk-play .bk-btn.word','puzzle':'.bk-play .bk-btn','fork':'.bk-btn.fork','no':'.bk-btn.no','order':'.bk-play .bk-btn.ball','score':'.bk-play .bk-btn','share':'.bk-pizza,.bk-share-basket','remainder':'.bk-box'};
const ans=v=>`.bk-play [data-v="${String(v).replace(/"/g,'\\"')}"]`;
// Play one game like a child: io = {js, tap, swipe, until, sleep}; wrong = answer wrong first; pace = 1 (checks) or
// slower (recordings, so the frames show each step).
export async function playBeat(b,{js,tap,swipe,until,sleep},{wrong=false,pace=1}={}){
 const other=(b.options||b.balls||[]).map(String).find(v=>v!==String(b.answer??b.right??b.target??b.letter)),z=ms=>sleep(ms*pace);
 const answerWhenShown=async v=>{await until(`!!document.querySelector('${ans(v)}')`,30000);await z(500);if(wrong&&other){await tap(ans(other));await z(1800);}await tap(ans(v));};
 switch(b.kind){
  case 'teach-letter':for(let k=0;k<8&&!(await js(`!!document.querySelector('.bk-tapnext.on')`));k++){await tap('.bk-glyph');await z(800);}return;
  case 'order':if(wrong){await tap('.bk-play [data-v="3"]');await z(1200);}for(let k=1;k<=5;k++){await tap(`.bk-play [data-v="${k}"]`);await z(900);}return;
  case 'count':for(let k=0;k<b.n;k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-thing')].find(x=>!x.dataset.n);t&&t.click()})()`);await z(800);}
   await tap('.bk-calm-done');return void await answerWhenShown(b.answer);
  // deal round by round: tap the basket (or the pizza) until it has dealt all it can, then answer
  case 'remainder':case 'share':{const sel=b.kind==='share'?(b.prop?'.bk-share-basket':'.bk-pizza'):'.bk-box';
   for(let k=0;k<25&&!(await js(`!!document.querySelector('.bk-play [data-v]')`));k++){await tap(sel);await z(900);}return void await answerWhenShown(b.answer);}
  case 'kick-letter':await z(700);if(wrong&&other){await tap(`.bk-letter-pick[data-v="${other}"]`);await swipe('.bk-ball');await z(2000);}await tap(`.bk-letter-pick[data-v="${b.letter}"]`);await swipe('.bk-ball');return;
  case 'signs':await z(700);if(wrong&&other){await tap(ans(other));await z(1800);}return void await tap(ans(b.target));
  // a word tile sounds itself out when tapped: wait until it is placed before the next one
  case 'spell':for(const x of b.answer){await until(`!!document.querySelector('.bk-play .bk-btn.word') && ![...document.querySelectorAll('.bk-play .bk-btn.word')].some(y=>y.dataset.busy)`,15000);
   await js(`(()=>{const t=[...document.querySelectorAll('.bk-play .bk-btn.word')].find(y=>y.textContent===${JSON.stringify(x)}&&!y.classList.contains('used'));t&&t.click()})()`);await z(700);
   await until(`![...document.querySelectorAll('.bk-play .bk-btn.word')].some(y=>y.dataset.busy)`,15000);}return;
  case 'fork':await z(700);return void await tap('.bk-btn.fork');
  case 'no':await z(700);await tap('.bk-btn.no');return void await answerWhenShown(b.right);
  default:await z(700);if(wrong&&other){await tap(ans(other));await z(1800);}return void await tap(ans(b.answer));
 }
}
// A friend's body (the middle of his picture) or a prop over more than this share of a painted object = covered.
export const KEEPOUT_COVER=0.1;
const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
// The verdict, sample by sample: [{t,page,kind,who,detail}] (off-the-ground / floating only once they last > 0.6 s).
export function problems(samples){
 const out=[],since=new Map(),readyH=new Map();const hold=(key,s,bad)=>{if(!bad){since.delete(key);return false;}if(!since.has(key))since.set(key,s.t);return s.t-since.get(key)>600;};
 for(const s of samples){if(s.page<0)continue;const A=s.actors,add=(kind,who,detail)=>out.push({t:s.t,page:s.page,kind,who,detail});
  if(s.singleBall){const n=(s.props||[]).filter(p=>p.id==='ball'||p.cls==='bk-ball').length+A.reduce((n,a)=>n+(a.paintedBalls||0),0);if(n>1)add('multiple balls','ball',`${n} visible balls`);}
  if(s.keeperId){const k=A.find(a=>a.id===s.keeperId),g=s.goal;
   if(!k)add('keeper missing',s.keeperId);
   else{const kid=A.find(a=>a.id===s.kickerId);if(kid&&!k.diving&&k.h<kid.h*0.6)add('keeper too small',k.id,`${Math.round(k.h/kid.h*100)}% of kicker height`);
    // only a goal too small for him (a far painted goal) may make him smaller.
    // (up the field he may look a little smaller: at most a quarter)
    if(kid&&!k.diving&&k.rel&&kid.rel){const want=relHeight(k.id,{h:k.rel})/relHeight(kid.id,{h:kid.rel}),capped=g&&k.h>=g.h*0.88;if(!capped&&k.h<kid.h*want*0.75)add('keeper resized',k.id,`${Math.round(k.h/kid.h*100)}% of kicker height, family heights say ${Math.round(want*100)}%`);}
    if(!k.diving&&!k.diveImage)readyH.set(`${s.page}:${k.id}`,k.drawnH??k.h);
    // Stretched out in a dive he is about as long as he stood tall (a wide dive picture in a standing box was drawn
    // at less than half his size).
    else if(k.diveImage){const r0=readyH.get(`${s.page}:${k.id}`),long=Math.max(k.drawnW??k.w,k.drawnH??k.h);if(r0&&long<r0*0.8)add('keeper shrinks in dive',k.id,`${Math.round(long/r0*100)}% of his ready height`);}if(!s.shot&&(k.pose==='dive'||k.diveImage||k.diving))add('keeper dives before shot',k.id);
    if(g&&(!s.shot||!k.diving)&&(k.x<g.x-2||k.x+k.w>g.x+g.w+2||k.y<g.y-2||k.y+k.h>g.y+g.h+2))add('keeper outside goal',k.id);}}
  // (the picture's box includes transparent margins: judge the middle of each body)
  const core=r=>({x:r.x+r.w*0.2,y:r.y+r.h*0.05,w:r.w*0.6,h:r.h*0.95}),face=r=>({x:r.x+r.w*0.25,y:r.y+r.h*0.02,w:r.w*0.5,h:r.h*0.3});
  for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const a=A[i],b=A[j];if(a.rider&&b.rider)continue;if(!a.w||!b.w)continue;
   const ca=core(a),cb=core(b),ov=area(ca,cb),small=Math.min(ca.w*ca.h,cb.w*cb.h);
   if(a.depth!==b.depth){const [bk,fr]=a.depth?[ca,cb]:[cb,ca],f={x:bk.x+bk.w*0.1,y:bk.y,w:bk.w*0.8,h:bk.h*0.3};if(area(f,fr)>0.5*f.w*f.h)add('covers a face',`${a.depth?b.id:a.id} over ${a.depth?a.id:b.id}`);}
   else if(ov>0.12*small)add('overlap',[a.id,b.id].sort().join('/'),`${Math.round(ov/small*100)}%`);}
  for(const a of A){if(!a.w)continue;
   if(!a.fly&&!a.rider&&!a.keeper){const off=(a.foot-(a.y+a.h))/a.h;if(hold(`${s.page}|${a.id}|foot`,s,Math.abs(off)>0.25))add('off the ground',a.id,`${Math.round(off*100)}% of his height`);}
   const vis=Math.max(0,Math.min(a.x+a.w,s.W)-Math.max(a.x,0))/a.w;if(vis<0.66&&!a.rider)add('cut off',a.id,`${Math.round(vis*100)}% visible`);}
  // A painted object of the background (keep-out zone) covered by a friend or a prop, at any moment (2026-10-01,
  // ball in flight are exempt; a rider counts until his train has driven off (or faded). The keeper in his goal is placed by the goal (it
  // stands up the field), and a game's things on the grass (the table) belong to the game: neither is judged here.
  for(const z of s.zones||[]){const za=z.w*z.h;if(!za)continue;
   for(const a of A){if(!a.w||a.keeper||(a.rider&&s.trainGone))continue;const c=core(a),f=area(c,z)/za;if(f>KEEPOUT_COVER)add('covers a painted object',`${a.id} over ${z.name}`,`${Math.round(f*100)}% of it`);}
   for(const p of s.props||[]){if(p.flying||p.held||!/(^|\.)bk-prop($|\.)/.test(p.cls))continue;const pr={x:p.x+p.w*0.1,y:p.y+p.h*0.1,w:p.w*0.8,h:p.h*0.8},f=area(pr,z)/za;if(f>KEEPOUT_COVER)add('covers a painted object',`${p.id||p.cls} over ${z.name}`,`${Math.round(f*100)}% of it`);}
   if(s.trainBox&&!s.trainGone){const f=area(s.trainBox,z)/za;if(f>KEEPOUT_COVER)add('covers a painted object',`train over ${z.name}`,`${Math.round(f*100)}% of it`);}}
  // props and things
  const ground=s.ground??s.H*0.93,tol=s.H*0.08;
  (s.props||[]).forEach((p,k)=>{const name=p.id||p.cls,key=`${s.page}|${p.cls}|${k}`;
   if(!p.drawn||p.emoji)add('prop not drawn',name,p.emoji?'an emoji':'no library picture (a plain shape)');
   if(p.flying)return void since.delete(key);
   // held: a friend's own ball, in the middle of his picture
   const holder=p.held?A.find(a=>a.id===p.held&&p.x+p.w/2>a.x&&p.x+p.w/2<a.x+a.w&&p.y+p.h/2>a.y+a.h*0.2&&p.y+p.h/2<a.y+a.h*0.8):null;
   for(const a of A){if(!a.w||a.rider||a.keeper||(holder&&a.id===holder.id))continue;
    const f=face(a),c=core(a),pr={x:p.x+p.w*0.1,y:p.y+p.h*0.1,w:p.w*0.8,h:p.h*0.8};
    if(area(pr,f)>0.08*f.w*f.h)add('prop over a face',`${name} over ${a.id}`);else if(area(pr,c)>0.15*Math.min(pr.w*pr.h,c.w*c.h))add('prop over a body',`${name} over ${a.id}`,`${Math.round(area(pr,c)/Math.min(pr.w*pr.h,c.w*c.h)*100)}%`);}
   const bottom=p.y+p.h;if(s.ground!=null&&hold(key,s,!holder&&bottom<ground-tol))add('prop floating',name,`${Math.round((ground-bottom)/s.H*100)}% of the screen above the ground`);});}
 return out;
}
// Grouped for a report: one line per page, kind and who.
export function summarise(list){const m=new Map();for(const x of list){const k=`${x.page}|${x.kind}|${x.who}`;const f=m.get(k);if(!f)m.set(k,{page:x.page+1,kind:x.kind,who:x.who,first:x.t,detail:x.detail,n:1});else f.n++;}return [...m.values()].sort((a,b)=>a.page-b.page||a.first-b.first);}
