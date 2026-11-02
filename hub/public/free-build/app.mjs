import {WIDTH,HEIGHT,FLOOR,PIECE_LIMIT,BALL_LIMIT,add,restore,snapshot,step,spin,tapSpin,snapGear,clearSpot,releasePiece,bodyInRect,starter,clamp} from './physics.mjs';
import {drawPiece,icon} from './art.mjs';
const bin='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M10 12h20l-2 22H12zm7 5v11m6-11v11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><g class="fb-bin-lid"><path d="M7 7h26M16 7V3h8v4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></g></svg>';
const broom='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M35 5L20 26M13 24l15 10-8 10L4 33zM12 31l-4 5m10-1-4 6" fill="#dfb774" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>';
const back='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M21 10L8 23l13 13M9 23h20q12 0 12 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const activeTime=(from,to,lastInput,visible=true)=>visible?Math.max(0,(Math.min(to,lastInput+20000)-Math.max(from,lastInput))/1000):0;
export function mountFreeBuild(root,{player,event=()=>{}}){
 root.innerHTML=`<section class="fb" aria-label="free build"><div class="fb-bar"><button class="fb-clear" type="button" aria-label="Clear room">${broom}</button></div><div class="fb-clear-confirm" hidden><button class="fb-yes" aria-label="Clear room">${broom}</button><button class="fb-no" aria-label="Keep room">${back}</button></div><div class="fb-stage"><canvas tabindex="0" aria-label="Building room. Drag toys from the tray. Drag a gear to move it, tap to spin, or turn its wooden crank knob. Drag a toy to the bin to remove it."></canvas><div class="fb-trash" aria-label="Remove piece">${bin}</div></div><div class="fb-tray" role="group" aria-label="Toys">${[['block','Wooden block'],['bounce','Bouncy block'],['gear','Gear'],['ball','Ball']].map(([t,label])=>`<button type="button" data-type="${t}" aria-label="${label}" title="${label}" disabled>${icon(t)}</button>`).join('')}</div><p class="fb-status" role="status">Opening room…</p></section>`;
 const host=root.querySelector('.fb'),canvas=host.querySelector('canvas'),c=canvas.getContext('2d'),stage=host.querySelector('.fb-stage'),trash=host.querySelector('.fb-trash'),status=host.querySelector('.fb-status'),confirm=host.querySelector('.fb-clear-confirm');
 const endpoint='/api/free-build?player='+encodeURIComponent(player),session=crypto.randomUUID();
 document.documentElement.classList.add('free-build-page');
 let toyGearContacts=0,gesture,cleared=false;
 let pieces=[],alive=true,ready=false,revision=0,seq=0,drag=null,raf=0,lastFrame=0,acc=0,activeSeconds=0,lastInput=-Infinity,lastClock=performance.now(),queue=[],sending=false,failed=false,scale=1,ox=0,oy=0;
 const message=(text='')=>{status.textContent=text;};
 function controls(){for(const b of host.querySelectorAll('[data-type]'))b.disabled=!ready||pieces.length>=PIECE_LIMIT||b.dataset.type==='ball'&&pieces.filter(p=>p.type==='ball').length>=BALL_LIMIT;}
 function clock(){const t=performance.now();activeSeconds+=activeTime(lastClock,t,lastInput,ready&&!document.hidden);lastClock=t;}
 function interact(){clock();lastInput=performance.now();}
 function enqueue(action,extra={}){host.setAttribute('aria-busy','true');if(action==='update'&&queue.at(-1)?.action==='update'&&queue.length>1)queue.pop();queue.push({action,session,seq:++seq,pieces:snapshot(pieces),activeSeconds,toyGearContacts,cleared,...((action==='spin'||action==='update')&&gesture?{gesture}:{}),...extra});drain();}
 async function drain(){
  if(sending||failed||!queue.length)return;sending=true;
  const input=queue[0];try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,revision}),keepalive:!alive||input.action==='close'||document.hidden}),d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Could not save.'),{status:r.status});
   revision=d.revision;queue.shift();message('');
  }catch(e){failed=true;message(e.message+' ');const b=document.createElement('button');if(e.status===409){ready=false;controls();b.textContent='Reopen room';b.onclick=()=>location.reload();}else{b.textContent='Retry save';b.onclick=()=>{failed=false;message('Saving…');drain();};}status.append(b);}
  finally{sending=false;if(!queue.length)host.setAttribute('aria-busy','false');if(!failed)drain();}
 }
 function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left-ox)/scale,y:(e.clientY-r.top-oy)/scale};}
 function inBin(p){const r=trash.getBoundingClientRect(),a=point({clientX:r.left,clientY:r.top}),b=point({clientX:r.right,clientY:r.bottom});return bodyInRect(p,{left:a.x,top:a.y,right:b.x,bottom:b.y});}
 function pick(pos){return [...pieces].reverse().find(p=>{const dx=pos.x-p.x,dy=pos.y-p.y,x=dx*Math.cos(p.a)+dy*Math.sin(p.a),y=-dx*Math.sin(p.a)+dy*Math.cos(p.a);return p.round?Math.hypot(dx,dy)<=p.w/2+8:Math.abs(x)<=p.w/2+8&&Math.abs(y)<=p.h/2+8;});}
 function down(e){
  if(!ready||failed||drag||e.button>0)return;interact();const pos=point(e),type=e.target.closest('[data-type]')?.dataset.type;
  let p=type?add(pieces,type,WIDTH/2,160,crypto.randomUUID()):pick(pos);if(!p)return;
  e.preventDefault();const rotating=!type&&p.type==='gear'&&Math.hypot(pos.x-p.x-Math.cos(p.a)*30,pos.y-p.y-Math.sin(p.a)*30)<15;
  drag={p,pointer:e.pointerId,new:!!type,rotating,start:pos,last:pos,angle:Math.atan2(pos.y-p.y,pos.x-p.x),dx:type?0:pos.x-p.x,dy:type?0:pos.y-p.y,moved:false,origin:{x:p.x,y:p.y,a:p.a},time:performance.now()};
  p.held=!rotating;p.cranking=rotating;delete p._returnX;delete p._returnY;p.vx=p.vy=0;if(type){p.x=clamp(pos.x,p.w/2,WIDTH-p.w/2);p.y=clamp(pos.y,0,HEIGHT);}
  host.setPointerCapture(e.pointerId);trash.classList.toggle('fb-over',!rotating&&inBin(p));controls();
 }
 function move(e){if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();interact();const pos=point(e),p=drag.p;drag.moved||=Math.hypot(pos.x-drag.start.x,pos.y-drag.start.y)>8;
  if(drag.rotating){const angle=Math.atan2(pos.y-p.y,pos.x-p.x),delta=Math.atan2(Math.sin(angle-drag.angle),Math.cos(angle-drag.angle));p.a+=delta;spin(pieces,p.id,clamp(delta/Math.max(.016,(performance.now()-drag.time)/1000),-14,14));drag.angle=angle;}
  else if(drag.moved){p.x=clamp(pos.x-drag.dx,p.w/2,WIDTH-p.w/2);p.y=clamp(pos.y-drag.dy,0,HEIGHT);p.av=0;}
  drag.last=pos;drag.time=performance.now();trash.classList.toggle('fb-over',!drag.rotating&&inBin(p));
 }
 function up(e,cancel=false){if(!drag||drag.pointer!==e.pointerId)return;if(!cancel&&!drag.rotating)move(e);const d=drag,p=d.p;drag=null;trash.classList.remove('fb-over');interact();
  if(cancel){p.held=p.cranking=false;if(d.new)pieces.splice(pieces.indexOf(p),1);else Object.assign(p,d.origin);controls();return;}
  if(inBin(p)&&!d.rotating){pieces.splice(pieces.indexOf(p),1);if(!d.new)enqueue('remove');}
  else{releasePiece(p);if(d.new&&!d.moved){p.x=400;p.y=220;clearSpot(pieces,p);}if(p.type==='gear'){if(d.moved&&!d.rotating)snapGear(pieces,p);if(!d.new&&!d.moved){const side=d.start.x>=p.x?1:-1;tapSpin(pieces,p.id,side);}}
   gesture=d.rotating&&d.moved?'crank':d.moved?'move':'tap';
   enqueue(d.new?'place':p.type==='gear'&&(d.rotating||!d.moved)?'spin':'update',d.new?{pieceType:p.type}:{});}
  controls();
 }
 host.addEventListener('dragstart',e=>e.preventDefault());host.addEventListener('contextmenu',e=>e.preventDefault());
 host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);const release=e=>up(e),cancel=e=>up(e,true);host.addEventListener('pointerup',release);host.addEventListener('pointercancel',cancel);
 // Keyboard users can add from the tray and move/remove the most recently selected toy.
 host.addEventListener('click',e=>{const type=e.target.closest('[data-type]')?.dataset.type;if(e.detail===0&&type&&ready){const p=add(pieces,type,400,220,crypto.randomUUID());if(p){clearSpot(pieces,p);enqueue('place',{pieceType:type});interact();controls();}}});
 canvas.addEventListener('keydown',e=>{const p=pieces.at(-1);if(!p)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace',' '].includes(e.key)){e.preventDefault();interact();gesture=e.key===' '?'tap':'move';if(e.key==='Delete'||e.key==='Backspace'){pieces.pop();enqueue('remove');controls();}else if(e.key===' '&&p.type==='gear'){spin(pieces,p.id);enqueue('spin');}else{p.x=clamp(p.x+(e.key==='ArrowRight'?24:e.key==='ArrowLeft'?-24:0),p.w/2,WIDTH-p.w/2);p.y=clamp(p.y+(e.key==='ArrowDown'?24:e.key==='ArrowUp'?-24:0),p.h/2,FLOOR-p.h/2);p.vx=p.vy=0;snapGear(pieces,p);enqueue('update');}}});
 host.querySelector('.fb-clear').onclick=()=>{confirm.hidden=!confirm.hidden;};host.querySelector('.fb-no').onclick=()=>{confirm.hidden=true;};host.querySelector('.fb-yes').onclick=()=>{if(!ready)return;pieces=[];drag=null;cleared=true;confirm.hidden=true;interact();enqueue('clear');controls();};
 function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);scale=Math.min(r.width/WIDTH,r.height/HEIGHT);ox=(r.width-WIDTH*scale)/2;oy=r.height-HEIGHT*scale;c.setTransform(dpr,0,0,dpr,0,0);}
 const observer=new ResizeObserver(resize);observer.observe(stage);
 // Cache original art and the wall once: no per-toy shadow filters or paths per frame.
 const sprites=new Map(),wall=document.createElement('canvas');wall.width=WIDTH;wall.height=HEIGHT;
 const bg=wall.getContext('2d');bg.fillStyle='#e8eee1';bg.fillRect(0,0,WIDTH,HEIGHT);bg.fillStyle='#cad9c6';bg.fillRect(0,FLOOR,WIDTH,HEIGHT-FLOOR);
 bg.fillStyle='#bccdbc';for(let x=40;x<WIDTH;x+=60)for(let y=40;y<FLOOR-30;y+=60){bg.beginPath();bg.arc(x,y,2.5,0,Math.PI*2);bg.fill();}
 bg.fillStyle='#b89973';bg.beginPath();bg.roundRect(0,FLOOR,WIDTH,16,6);bg.fill();bg.fillStyle='#d1b58c';bg.fillRect(0,FLOOR,WIDTH,5);
 function sprite(p){if(!sprites.has(p.type)){const s=document.createElement('canvas');s.width=(p.w+32)*2;s.height=(p.h+32)*2;const ctx=s.getContext('2d');ctx.scale(2,2);ctx.shadowColor='#4b695533';ctx.shadowBlur=7;ctx.shadowOffsetY=5;drawPiece(ctx,{...p,x:p.w/2+16,y:p.h/2+16,a:0,_returnX:undefined,_returnY:undefined});sprites.set(p.type,s);}return sprites.get(p.type);}
 function draw(){c.clearRect(0,0,canvas.width,canvas.height);c.save();c.translate(ox,oy);c.scale(scale,scale);c.drawImage(wall,0,0);
  for(let layer=0;layer<2;layer++)for(const p of pieces){if((p.type==='gear')!==(layer===0))continue;c.save();c.translate(p._returnX??p.x,p._returnY??p.y);c.rotate(p.a);c.drawImage(sprite(p),-p.w/2-16,-p.h/2-16,p.w+32,p.h+32);c.restore();}
  c.restore();
 }
 function frame(t){if(!alive)return;clock();if(drag?.rotating&&performance.now()-drag.time>150&&drag.p.av)spin(pieces,drag.p.id,0);if(!document.hidden&&ready){acc+=Math.min((t-(lastFrame||t))/1000,.05);let n=0;while(acc>=1/120&&n++<4){toyGearContacts+=step(pieces);acc-=1/120;}if(acc>=1/120)acc=0;}else acc=0;lastFrame=t;draw();raf=requestAnimationFrame(frame);}
 raf=requestAnimationFrame(frame);
 const interval=setInterval(()=>{if(ready&&!document.hidden){clock();enqueue('update');}},10000);
 const visibility=()=>{clock();if(document.hidden&&ready)enqueue('update');lastInput=-Infinity;};document.addEventListener('visibilitychange',visibility);
 const pagehide=()=>{if(ready){clock();enqueue('close');ready=false;}};window.addEventListener('pagehide',pagehide);
 const pageshow=e=>{if(e.persisted)location.reload();};window.addEventListener('pageshow',pageshow);
 (async()=>{try{const r=await fetch(endpoint),d=await r.json();if(!r.ok)throw Error(d.error);if(!alive)return;revision=d.revision;cleared=!!d.cleared;pieces=d.pieces.length?restore(d.pieces):cleared?[]:starter();enqueue('open');ready=true;message('');controls();event('open_game','free-build');}catch(e){message(e.message||'Could not open the room.');}})();
 const dispose=()=>{document.documentElement.classList.remove('free-build-page');clock();alive=false;cancelAnimationFrame(raf);clearInterval(interval);observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);if(ready){if(drag)drag.p.held=drag.p.cranking=false;enqueue('close');ready=false;}};
 dispose.busy=()=>sending||queue.length>0;
 dispose.prepareLeave=async()=>{if(!ready)return;clock();enqueue('update');const until=Date.now()+5000;while(queue.length&&!failed&&Date.now()<until)await new Promise(r=>setTimeout(r,40));if(failed||queue.length)throw Error('The room has not finished saving.');};
 return dispose;
}
