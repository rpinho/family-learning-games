import {addReadingSupport,readingAudio} from '../reading-support.mjs';
// The living book's flat layer over the 3D picture. Readability and usability beat 3D fidelity: every letter or
// word a child must read is flat, high-contrast text on a solid badge (never shaded, skewed, blurred or fogged),
// sized from the screen's short side, and every play target is a big button with a generous hit area.
// - choose(): options he taps (a departures board, letter balls, signs); two misses make the right one glow.
//   After a word is tapped, a friend sounds it out slowly (c-a-t, cat), right or wrong.
// - sayIt(): the book's listening flow. The first tap on a talk button opens the microphone inside that tap, so
//   the browser asks for permission right then; blocked -> a friendly card with "Tap instead"; one miss -> "so
//   close"; two misses -> the word glows, the narrator says it, and any attempt counts. Without a recogniser the
//   tap itself counts, so there is always a way through without the microphone.
// - controls(): hold-to-move steering (drag anywhere, hold where you want to go, arrow buttons, keyboard); he
//   stops the moment he lets go.
// - telemetry: attempts, misses, time to the first tap (a tap under 1.5 s is a guess, not reading) per beat.
import {THREE,clamp} from './engine.mjs';
import {listenOnce,recognise,listenAvailable,checkMic,micState} from '../listen.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const GUESS_MS=2000;
export function createUI({layer,say,sound=null,player='',preview=false,story='',beat=()=>''}){
 const anchored=new Set();let alive=true,canListen=false,cardShown=false;
 const phonics=readingAudio({player,enabled:()=>alive});
 const support=(b,w)=>addReadingSupport(b,w,{letter:phonics.letter,blend:phonics.word});
 void listenAvailable().then(v=>{canListen=v;});void checkMic();
 const micUsable=()=>canListen&&!micState().blocked;
 const tele=globalThis.__living?.telemetry||[];
 function el(tag,cls,html=''){const e=document.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;return e;}
 // A readable token: the word or letter itself on a solid badge (the checks measure every .lv-read).
 // One case everywhere he reads (capitals, as on the signs and boards in the picture).
 const token=(text,kind='word')=>`<span class="lv-read lv-${kind}">${esc(String(text).toUpperCase())}</span>`;
 // ---- anchoring flat things to places in the 3D world ----
 const v=new THREE.Vector3();
 // below: hang it under the point (on a tall screen the empty ground below the balls is the best place).
 // hideOff: a label for something in the picture hides when that thing is off screen (options stay on screen).
 function anchor(e,where,{dy=0,below=false,hideOff=false}={}){e._where=where;e._dy=dy;e._below=below;e._hideOff=hideOff;e.classList.add('lv-anchored');e.classList.toggle('below',below);anchored.add(e);return e;}
 function update(camera,rect){
  const items=[];
  for(const e of anchored){if(!e.isConnected){anchored.delete(e);continue;}const p=e._where();if(!p){e.style.visibility='hidden';continue;}
   v.copy(p).project(camera);if(v.z>1||(e._hideOff&&(Math.abs(v.x)>.92||Math.abs(v.y)>.92))){e.style.visibility='hidden';continue;}e.style.visibility='';
   items.push({e,x:(v.x+1)/2*rect.width,y:(1-v.y)/2*rect.height+(e._below?-e._dy+22:e._dy),w:e.offsetWidth,h:e.offsetHeight,below:e._below});}
  // Options never overlap (spread apart around their middle) and never leave the screen.
  const opts=items.filter(i=>i.e.classList.contains('lv-opt')).sort((a,b)=>a.x-b.x);
  // Spread apart (keeping a 14 px gap) and inside the screen, alternating until both hold.
  const pad=10,gap=14,edge=i=>{i.x=clamp(i.x,i.w/2+pad,rect.width-i.w/2-pad);};
  for(let k=0;k<12;k++){let moved=false;for(let i=1;i<opts.length;i++){const a=opts[i-1],b=opts[i],need=(a.w+b.w)/2+gap-(b.x-a.x);if(need>.5){a.x-=need/2;b.x+=need/2;moved=true;}}opts.forEach(edge);if(!moved)break;}
  for(const i of items){edge(i);i.y=i.below?clamp(i.y,pad,rect.height-i.h-pad):clamp(i.y,i.h+pad,rect.height-pad);
   i.e.style.transform=`translate(${i.x.toFixed(1)}px,${i.y.toFixed(1)}px) translate(-50%,${i.below?'0':'-100%'})`;}
 }
 // ---- telemetry per beat ----
 function beatLog(id,extra={}){const b={story,beat:id,shownAt:performance.now(),taps:[],attempts:0,misses:0,...extra};tele.push(b);
  return {tap(value,ok){const ms=Math.round(performance.now()-b.shownAt);if(!b.taps.length)b.firstTapMs=ms;b.taps.push([ms,String(value).slice(0,16),ok?1:0]);b.attempts++;if(!ok)b.misses++;},
   mic(r){(b.mic??=[]).push(r);},
   done(via='tap'){b.via=via;b.ms=Math.round(performance.now()-b.shownAt);b.correct=b.taps.length?b.taps[0][2]===1:null;b.guess=b.firstTapMs!=null&&b.firstTapMs<GUESS_MS;
    if(!preview&&player)void fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
     body:JSON.stringify({type:'living',story,beat:id,attempts:b.attempts,misses:b.misses,firstTapMs:b.firstTapMs??null,correct:b.correct,guess:b.guess,via:b.via,ms:b.ms,taps:b.taps.slice(0,12)})}).catch(()=>{});
    return b;}};}
 // ---- a card for grown-ups when the microphone is blocked (always with a way through) ----
 function card(why){cardShown=true;const c=el('div','lv-card');
  const head=why==='no-mic'?"There's no microphone here.":why==='insecure'?'The microphone needs the secure address.':'Ask a grown-up to turn on the microphone.';
  c.innerHTML=`<div class="lv-card-in"><div class="lv-card-mic" aria-hidden="true">🎤</div><h2>${esc(head)}</h2>
   <p class="grown">For grown-ups: in Chrome tap the icon left of the address, then <b>Permissions → Microphone → Allow</b>. In the installed app: long-press its icon → <b>App info → Permissions → Microphone</b>. On a Chromebook: the icon in the address bar. Everything he says stays on this home computer and is never recorded.</p>
   <div class="lv-card-btns"><button class="lv-btn" type="button" data-a="tap">Tap instead 👆</button><button class="lv-btn ghost" type="button" data-a="retry">Try again 🎤</button></div></div>`;
  layer.append(c);if(why!=='insecure'&&why!=='no-mic')void say('uiGrownUp');
  return new Promise(res=>c.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();c.remove();res(b.dataset.a);}));}
 // ---- say it aloud (the book's flow) ----
 function sayIt(btn,{target,kind,help=null,log=null}){
  return new Promise(resolve=>{
   let attempts=0,misses=0,busy=false,done=false;
   const badge=el('span','lv-mic-badge');badge.setAttribute('aria-hidden','true');btn.append(badge);
   const paint=()=>{badge.textContent=micUsable()?'🎤':'👆';};paint();const timer=setInterval(()=>{if(!alive||done)clearInterval(timer);else paint();},800);
   const finish=via=>{if(done)return;done=true;clearInterval(timer);badge.remove();btn.classList.remove('listening','thinking','glow');btn.classList.add('read');log?.done(via);resolve({via,misses,attempts});};
   btn.onclick=e=>{e?.stopPropagation?.();if(done||busy)return;
    if(!micUsable()){
     if(canListen&&micState().blocked&&!cardShown){void card(micState().why).then(a=>{if(a==='tap')finish('tap');});return;}
     log?.tap('tap',true);return finish('tap');}
    busy=true;attempts++;btn.classList.add('listening');
    // Called inside the tap: this is when the browser shows its permission prompt the first time.
    listenOnce({onLevel:x=>btn.style.setProperty('--lvl',x.toFixed(2))}).then(async({pcm,speech})=>{
     btn.classList.remove('listening');if(done)return void(busy=false);
     if(!speech){busy=false;await say('uiNothing');return;}
     btn.classList.add('thinking');let r=null;try{r=await recognise({player,target,kind,attempt:attempts,preview,pcm});}catch{}
     btn.classList.remove('thinking');busy=false;if(done)return;
     log?.mic([r?(r.match?1:0):-1,String(r?.how||'').slice(0,10)]);log?.tap('voice',!!r?.match);
     // If the recogniser is having a bad moment, he is never stuck: it counts.
     if(!r)return finish('tap');if(r.match)return finish('voice');if(misses>=2)return finish('echo');
     misses++;btn.classList.remove('soft-miss');void btn.offsetWidth;btn.classList.add('soft-miss');
     if(misses===1)await say('uiAgain');else{btn.classList.add('glow');if(help)await help();await say('uiEcho');}
    },async err=>{btn.classList.remove('listening');busy=false;paint();if(done)return;
     const a=await card(micState().why||(err?.name==='NotFoundError'?'no-mic':'denied'));paint();if(a==='tap')finish('tap');});
   };
  });
 }
 // A magic word (or a letter) to read aloud: a big glowing talk button.
 function talkButton(text,{label='',kind='word'}={}){const b=el('button','lv-talk',`${label?`<small>${esc(label)}</small>`:''}${token(text,kind)}`);b.type='button';if(kind==='word')support(b,text);layer.append(b);return b;}
 // ---- choices: a board of words, letter balls, signs ----
 // layout 'board' (a panel: rows on a tall screen, one row on a wide one) or 'anchored' (each option floats
 // above a place in the world, e.g. a ball). soundOut(value): the friend sounds the tapped word out.
 function choose({id,options,answer,layout='board',title='',kind='word',anchors=null,below=false,onWrong=null,soundOut=null,glowAfter=2,cls=''}){
  const log=beatLog(id,{answer:String(answer),options:options.map(String)});
  return new Promise(resolve=>{
   const wrap=el('div',`lv-choices lv-${layout} ${cls}`);if(title)wrap.append(el('div','lv-board-title',esc(title)));
   let misses=0,busy=false,done=false;
   options.forEach((o,i)=>{const b=el('button',`lv-opt lv-opt-${kind}`,token(o,kind));b.type='button';b.dataset.v=o;if(kind==='word')support(b,String(o));
    if(layout==='anchored'&&anchors?.[i]){anchor(b,anchors[i],{dy:-6,below:below&&document.body.classList.contains('tall')});layer.append(b);}else wrap.append(b);
    b.onclick=async e=>{e.stopPropagation();if(done||busy)return;const ok=String(o)===String(answer);log.tap(o,ok);busy=true;b.classList.add('pressed');
     if(soundOut)await soundOut(o,ok);busy=false;b.classList.remove('pressed');
     if(ok){done=true;b.classList.add('right');[...wrap.querySelectorAll('.lv-opt'),...layer.querySelectorAll('.lv-opt.lv-anchored')].forEach(x=>{x.classList.remove('glow');if(x!==b)x.classList.add('gone');});log.done('tap');resolve({value:o,misses,button:b,log,remove});return;}
     misses++;b.classList.remove('wiggle');void b.offsetWidth;b.classList.add('wiggle');sound?.play('soft');
     if(misses>=glowAfter)(layout==='anchored'?[...layer.querySelectorAll('.lv-opt')]:[...wrap.querySelectorAll('.lv-opt')]).find(x=>x.dataset.v===String(answer))?.classList.add('glow');
     await onWrong?.(o,misses);};});
   if(layout!=='anchored'||title)layer.append(wrap);
   function remove(){wrap.remove();layer.querySelectorAll('.lv-opt.lv-anchored').forEach(x=>x.remove());}
  });
 }
 // ---- a gentle hint (never required) ----
 function hint(text,ms=5000){const h=el('div','lv-hint',esc(text));layer.append(h);setTimeout(()=>h.classList.add('out'),ms);setTimeout(()=>h.remove(),ms+800);return h;}
 // ---- hold-to-move steering ----
 // onDir(dir): dir is {x,y} in screen space (unit length) while held, null when let go. origin(): the hero's
 // screen position (holding a finger somewhere steers toward it; dragging steers along the drag).
 function controls({canvas,origin,onDir}){
  const pad=el('div','lv-pad');pad.innerHTML=['up','left','right','down'].map(d=>`<button type="button" class="lv-arrow ${d}" data-d="${d}" aria-label="${d}">${{up:'▲',down:'▼',left:'◀',right:'▶'}[d]}</button>`).join('');layer.append(pad);
  const D={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};let active=null,start=null,held=new Set(),keys=new Set();
  const emit=d=>onDir(d);
  pad.querySelectorAll('button').forEach(b=>{const on=e=>{e.preventDefault();e.stopPropagation();b.setPointerCapture?.(e.pointerId);held.add(b.dataset.d);b.classList.add('held');emit(D[b.dataset.d]);};
   const off=e=>{e?.preventDefault?.();held.delete(b.dataset.d);b.classList.remove('held');emit(held.size?D[[...held].at(-1)]:null);};
   b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);});
  const dirFrom=(x,y)=>{let dx,dy;if(start&&Math.hypot(x-start.x,y-start.y)>14){dx=x-start.x;dy=y-start.y;}else{const o=origin();if(!o)return null;dx=x-o.x;dy=y-o.y;if(Math.hypot(dx,dy)<18)return null;}const n=Math.hypot(dx,dy);return {x:dx/n,y:dy/n};};
  const down=e=>{if(active!=null)return;active=e.pointerId;start={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);emit(dirFrom(e.clientX,e.clientY));};
  const move=e=>{if(e.pointerId!==active)return;emit(dirFrom(e.clientX,e.clientY));};
  const up=e=>{if(e.pointerId!==active)return;active=null;start=null;emit(null);};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  const KEY={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'};
  const kd=e=>{const k=KEY[e.key];if(!k)return;e.preventDefault();keys.add(k);emit(D[k]);},ku=e=>{const k=KEY[e.key];if(!k)return;keys.delete(k);emit(keys.size?D[[...keys].at(-1)]:null);};
  addEventListener('keydown',kd);addEventListener('keyup',ku);
  return {dispose(){pad.remove();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);removeEventListener('keydown',kd);removeEventListener('keyup',ku);emit(null);}};
 }
 // ---- checks: every readable token's size and contrast, and where the buttons are ----
 function measureReadables(){
  const W=innerWidth,H=innerHeight,short=Math.min(W,H),cv=new OffscreenCanvas(8,8),g=cv.getContext('2d');
  const rgb=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
  const lum=c=>{const f=x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
  return [...layer.querySelectorAll('.lv-read')].filter(e=>{if(e.closest('.gone'))return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&e.getClientRects().length;}).map(e=>{
   const s=getComputedStyle(e),r=e.getBoundingClientRect();g.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;const m=g.measureText(e.textContent);
   const glyph=(m.actualBoundingBoxAscent||0)+(m.actualBoundingBoxDescent||0);
   // Its own solid badge (or the nearest solid background behind it).
   let bg=null;for(let n=e;n&&!bg;n=n.parentElement){const c=rgb(getComputedStyle(n).backgroundColor);if(c&&c.a>=.95)bg=c;}
   const fg=rgb(s.color);const L1=fg?lum(fg):0,L2=bg?lum(bg):0,contrast=bg&&fg?(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05):0;
   return {text:e.textContent,kind:e.classList.contains('lv-letter')?'letter':'word',glyphPx:+glyph.toFixed(1),ratio:+(glyph/short).toFixed(3),contrast:+contrast.toFixed(2),
    onScreen:r.left>=0&&r.top>=0&&r.right<=W+.5&&r.bottom<=H+.5,rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]};});
 }
 function targets(){return [...layer.querySelectorAll('button')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden'&&!b.closest('.gone')).map(b=>{const r=b.getBoundingClientRect();return {cls:b.className.split(' ')[0],w:Math.round(r.width),h:Math.round(r.height)};});}
 function covers(){return [...document.querySelectorAll('#ui .lv-choices,#ui button,#ui .lv-card,#ui .lv-hint,#no,#exit')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.hidden&&!e.closest('.gone')).map(e=>e.getBoundingClientRect());}
 return {token,anchor,update,choose,sayIt,talkButton,card,hint,controls,beatLog,measureReadables,targets,covers,micUsable,clear(){phonics.stop();layer.innerHTML='';anchored.clear();},dispose(){phonics.stop();alive=false;}};
}
