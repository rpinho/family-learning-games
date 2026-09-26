import {PLAYERS} from '/engine.mjs';
import {ANCHOR,MAX_PULL,MIN_PULL,STONES,GROUND,FLIGHT_MS,SLING_VERSION,slingItem,slingShot,slingFeel,clampPull,aimPoint} from '/sling.mjs';
import {wordBreak,fetchWordLevel,DEFAULT_TRACK,onceThisSession,IDLE_REPEAT_MS,IDLE_REPEATS} from '/word-break.mjs';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let player=null,p=null,busy=false,drag=null,pull={dx:0,dy:0},flight=null,feedback=null,sound=true,voiceEpoch=0,audio,manifest,sfx,parentSum=15,wbLevel=null,midBreakDone=false,breakAt=2+Math.floor(Math.random()*2);
let voiceBlocked=false,pending=null,idleTimer=null,idleCount=0;
const valid=id=>Object.hasOwn(PLAYERS,id),wait=ms=>new Promise(r=>setTimeout(r,ms));
try{const id=new URL(location.href).searchParams.get('player'),saved=localStorage.getItem('target-player');player=valid(id)?id:valid(saved)?saved:null;sound=localStorage.getItem('target-sound')!=='off';}catch{}
function log(kind,detail){if(player)void fetch('/api/events?player='+player,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,detail})}).catch(()=>{});}
async function request(path,input){const r=await fetch('/api/'+path+'?player='+player,{method:input?'POST':'GET',headers:input?{'Content-Type':'application/json'}:{},body:input?JSON.stringify(input):undefined,cache:'no-store',signal:AbortSignal.timeout(8000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Connection lost. Tap Refresh.');return data;}
// ---- Speech. CONTENT (what to hit) is essential: it always plays, even with the effects toggle off.
// Instructions and praise obey the toggle; the controls instruction is said once per session.
function stopVoice(){voiceEpoch++;audio?.pause();audio=null;try{globalThis.speechSynthesis?.cancel();}catch{}}
// Public version: browser speech (no local voice cache).
function utter(line){const u=new SpeechSynthesisUtterance(line);u.lang='en-US';u.rate=.9;const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang==='en-US')||null;return u;}
async function speak(lines,{essential=false,manual=false}={}){
 lines=[].concat(lines).filter(Boolean);if(!lines.length||!essential&&!manual&&!sound||!globalThis.speechSynthesis)return;
 stopVoice();const epoch=voiceEpoch;
 for(const line of lines){
  if(epoch!==voiceEpoch)return;
  const ok=await new Promise(done=>{const u=utter(line);u.onstart=()=>{voiceBlocked=false;pending=null;};u.onend=()=>done(true);u.onerror=e=>{if(e.error==='not-allowed'&&epoch===voiceEpoch){voiceBlocked=true;pending={lines,essential,manual};render();}else if(e.error!=='interrupted'&&e.error!=='canceled')log('voice',e.error);done(false);};speechSynthesis.speak(u);});
  if(!ok)return;
 }
}
function unlock(){try{sfx??=new AudioContext();void sfx.resume();}catch{}}
// Any tap retries a prompt the browser blocked before the first touch.
function retryPending(){unlock();if(!pending||drag||needTap())return;const q=pending;pending=null;void speak(q.lines,q);}
for(const type of ['pointerup','keydown'])document.addEventListener(type,e=>{if(e.target===canvas)return;retryPending();},{capture:true});
function effect(kind){if(!sound)return;try{unlock();const c=sfx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=kind==='fling'?'triangle':'sine';const [a,b]=kind==='fling'?[220,660]:kind==='pop'?[700,1200]:[180,90];o.frequency.setValueAtTime(a,t);o.frequency.exponentialRampToValueAtTime(b,t+.15);g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g).connect(c.destination);o.start();o.stop(t+.26);}catch{}}
const round=()=>p?.sling?.round,live=()=>round()&&!round().done,needTap=()=>voiceBlocked&&live();
const active=()=>live()&&!busy&&!flight&&!feedback&&!needTap()&&!$('parent').open&&!$('welcome').open&&!document.querySelector('dialog.wb[open]');
const currentItem=()=>{const r=round();if(!r)return null;const i=feedback?feedback.index:flight?flight.index:Math.min(STONES-1,r.shots.length);return slingItem(r,i);};
const CONTROLS='Pull back and let go.';
// New target: say what to hit, by itself. Then gently repeat it (at most twice) if the child waits.
function announce(manual=false){const it=currentItem();if(!it||!live())return;$('message').textContent=it.mode==='pattern'?'What comes next? Hit it.':it.mode==='math'?'Hit the answer.':it.mode==='spelling'?`Spell ${it.word}.`:'Listen, then hit it.';
 const lines=!manual&&sound&&onceThisSession('sling:controls')?[CONTROLS,it.spoken]:[it.spoken];void speak(lines,{essential:true,manual});if(!manual)idleCount=0;idleArm();}
function idleArm(){clearTimeout(idleTimer);if(idleCount>=IDLE_REPEATS)return;idleTimer=setTimeout(()=>{if(!active())return;if(drag){idleArm();return;}idleCount++;const it=currentItem();if(it)void speak(it.spoken,{essential:true});idleArm();},IDLE_REPEAT_MS);}
function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
const BALLOONS=['#f25f4c','#3d8bf2','#f2b134','#48b86b','#a066d8'];
function draw(){
 ctx.clearRect(0,0,800,600);const sky=ctx.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#bfe3ff');sky.addColorStop(1,'#eaf7ff');ctx.fillStyle=sky;ctx.fillRect(0,0,800,600);
 ctx.fillStyle='#8cc56b';ctx.fillRect(0,GROUND,800,600-GROUND);ctx.fillStyle='#6fae50';ctx.fillRect(0,GROUND,800,8);
 const it=currentItem(),r=round(),feel=slingFeel(r?.track||'letters');
 const preview=drag&&it&&active()?slingShot(it.targets,feel,pull.dx,pull.dy):null,aimed=preview?.target?.id??null;
 if(it?.prompt){ctx.save();ctx.fillStyle='#ffffffee';ctx.strokeStyle='#2d4a1e';ctx.lineWidth=3;const w=Math.min(560,90+it.prompt.length*26);ctx.beginPath();ctx.roundRect(400-w/2+60,18,w,78,20);ctx.fill();ctx.stroke();ctx.fillStyle='#1f3514';ctx.font='800 46px "Avenir Next",system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(it.prompt,460,58,w-24);ctx.restore();}
 if(it&&live()||feedback)for(const t of it.targets){const color=BALLOONS[t.id%BALLOONS.length];ctx.strokeStyle='#5a6b78';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(t.x,t.y+t.radius);ctx.quadraticCurveTo(t.x+8,t.y+t.radius+9,t.x,t.y+t.radius+16);ctx.stroke();
  if(feedback&&feedback.popped===t.id)continue;
  if(aimed===t.id){ctx.save();ctx.strokeStyle='#ffcf33';ctx.shadowColor='#ffcf33';ctx.shadowBlur=18;ctx.lineWidth=10;ctx.beginPath();ctx.arc(t.x,t.y,t.radius+10,0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.save();ctx.shadowColor='#0003';ctx.shadowBlur=12;ctx.shadowOffsetY=6;circle(t.x,t.y,t.radius,color);ctx.restore();circle(t.x,t.y,t.radius*.78,'#fffaf0');
  ctx.fillStyle='#17324a';ctx.textAlign='center';ctx.textBaseline='middle';const emoji=/\p{Extended_Pictographic}/u.test(t.label);ctx.font=`800 ${emoji?t.radius*1.05:t.label.length>1?t.radius*.85:t.radius*1.05}px "Avenir Next",system-ui`;ctx.fillText(t.label,t.x,t.y+3,t.radius*1.5);
  if(feedback&&feedback.answer===t.label){ctx.strokeStyle='#e0a100';ctx.lineWidth=7;ctx.beginPath();ctx.arc(t.x,t.y,t.radius+9,0,Math.PI*2);ctx.stroke();}}
 // Slingshot frame and bands.
 const shown=clampPull(Math.min(30,pull.dx),pull.dy),pouch=drag?{x:ANCHOR.x+shown.dx,y:ANCHOR.y+shown.dy}:{...ANCHOR},wood='#a86b32';
 ctx.lineCap='round';ctx.strokeStyle=wood;ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(ANCHOR.x,GROUND+4);ctx.lineTo(ANCHOR.x,ANCHOR.y+55);ctx.lineTo(ANCHOR.x-28,ANCHOR.y-18);ctx.moveTo(ANCHOR.x,ANCHOR.y+55);ctx.lineTo(ANCHOR.x+28,ANCHOR.y-18);ctx.stroke();
 ctx.strokeStyle='#5b3417';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(ANCHOR.x-28,ANCHOR.y-18);ctx.lineTo(pouch.x,pouch.y);ctx.lineTo(ANCHOR.x+28,ANCHOR.y-18);ctx.stroke();
 // Full dotted arc to where the stone will go; it ends on the glowing target it will hit.
 if(preview?.path.length){const path=preview.path;ctx.fillStyle=preview.target?'#1f3514':'#1f351488';const t=preview.target;for(let i=3;i<path.length;i+=3){if(t&&Math.hypot(path[i].x-t.x,path[i].y-t.y)<t.radius+4)break;circle(path[i].x,path[i].y,t?6:5,ctx.fillStyle);}}
 if(!flight)circle(pouch.x,pouch.y,16,'#6c7a86');
 if(flight){const q=Math.min(1,(performance.now()-flight.at)/flight.duration),i=Math.min(flight.path.length-1,Math.floor(q*(flight.path.length-1))),pt=flight.path[i];for(let k=Math.max(0,i-9);k<i;k+=2){ctx.globalAlpha=.15+.5*(k-(i-9))/9;circle(flight.path[k].x,flight.path[k].y,7,'#6c7a86');}ctx.globalAlpha=1;circle(pt.x,pt.y,15,'#6c7a86');}
 if(feedback?.end&&feedback.outcome==='miss'){const e={x:Math.max(12,Math.min(788,feedback.end.x)),y:Math.max(12,Math.min(GROUND,feedback.end.y))};ctx.strokeStyle='#1f3514';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(e.x-9,e.y-9);ctx.lineTo(e.x+9,e.y+9);ctx.moveTo(e.x+9,e.y-9);ctx.lineTo(e.x-9,e.y+9);ctx.stroke();}
 if(active()){ctx.fillStyle='#1f3514';ctx.font='700 17px system-ui';ctx.textAlign='center';ctx.fillText(drag?(preview?.target?'LET GO!':'PULL BACK'):'PULL BACK',ANCHOR.x,GROUND+24);}
 requestAnimationFrame(draw);
}
function render(){if(!p)return;const s=p.sling||{},r=s.round,done=!r||r.done,tap=needTap();$('name').textContent=p.name;document.title=p.name+' · Sling Shot';$('sound').textContent=sound?'♪ Effects on':'♪ Effects off';
 $('score').textContent=r?.correct||0;$('stones').textContent=Array.from({length:STONES},(_,i)=>i<(r?.shots.length||0)?'○':'●').join(' ');$('best').textContent=`★ ${s.stars||0}`;
 $('overlay').hidden=!(done||tap)||busy&&!!r&&!tap;$('round-title').textContent=tap?'Ready?':r?.done?`${r.correct} / 5 hits!`:'Pull back. Let go.';$('round-detail').textContent=tap?'Tap to hear what to hit.':r?.done?'Another round has new targets.':'Listen, then hit the right one.';$('start').textContent=tap?'▶ Let’s play':r?.done?'▶ Another round':'▶ Let’s play';$('start').disabled=busy&&!tap;
 $('stats').textContent=`★ ${s.stars||0} · ${s.rounds||0} rounds${p.id==='admin'?' · ADMIN TEST SAVE':''}`;}
async function sync(){p=await request('state');render();if(live())announce();}
async function checkpoint(reason){clearTimeout(idleTimer);try{wbLevel??=await fetchWordLevel('/api/word-break?player='+player,DEFAULT_TRACK[player]);stopVoice();drag=null;await wordBreak({player,level:wbLevel,speak:(line,essential)=>void speak(line,{essential}),effects:()=>sound,log:r=>log('word-break',JSON.stringify(r)),reason});}catch(e){log('word-break-error',e.message);}}
// A newer Sling Shot was installed: load it between rounds instead of playing old code.
function stale(){return p?.slingVersion&&p.slingVersion!==SLING_VERSION;}
function reloadFresh(){const url=new URL(location.href);url.searchParams.set('v',Date.now());location.replace(url);}
async function start(){if(needTap()){voiceBlocked=false;unlock();render();const q=pending;pending=null;if(q)void speak(q.lines,q);else announce();idleArm();return;}if(busy||!p)return;if(stale()){reloadFresh();return;}busy=true;$('error').textContent='';render();try{p=await request('action',{type:'sling-start',revision:p.revision});feedback=null;flight=null;render();announce();}catch(e){$('error').textContent=e.message;try{await sync();}catch{}}finally{busy=false;render();}}
async function fling(pointer='touch'){
 if(!active())return;const r=round(),index=r.shots.length,shot=clampPull(pull.dx,pull.dy);
 if(!aimPoint(shot.dx,shot.dy)){const short=Math.hypot(shot.dx,shot.dy)<MIN_PULL;drag=null;pull={dx:0,dy:0};const line=short?CONTROLS:'Pull back, away from the balloons.';$('message').textContent=short?'Pull back further, then let go.':line;if(!short)void speak(line);idleArm();return;}
 clearTimeout(idleTimer);busy=true;drag=null;stopVoice();effect('fling');const it=slingItem(r,index),aim=slingShot(it.targets,slingFeel(r.track),shot.dx,shot.dy);
 flight={path:aim.path,index,at:performance.now(),duration:FLIGHT_MS*Math.max(.6,aim.path.at(-1).t)};pull={dx:0,dy:0};render();
 try{const next=await request('action',{type:'sling-shot',v:SLING_VERSION,roundId:r.id,shot:index,dx:shot.dx,dy:shot.dy,pointer,revision:p.revision});await wait(Math.max(0,flight.duration-(performance.now()-flight.at)));p=next;const s=p.sling.round.shots.at(-1);
  feedback={index,outcome:s.outcome,answer:s.answer,end:s.end,popped:s.outcome==='correct'?it.answerIndex:null};flight=null;effect(s.outcome==='correct'?'pop':'thud');
  $('burst').textContent=s.outcome==='correct'?'Yes!':s.outcome==='miss'?'Missed':'Not that one';$('burst').classList.remove('show');void $('burst').offsetWidth;$('burst').classList.add('show');
  $('message').textContent=s.outcome==='correct'?`Yes! ${s.answer}`:s.outcome==='miss'?`Missed. It was ${s.answer}.`:`That was ${s.hitLabel}. It was ${s.answer}.`;
  // Praise obeys the toggle; naming the right answer after a mistake is teaching content.
  if(s.outcome==='correct')void speak('Yes!');else void speak(it.name,{essential:true});render();
  await wait(1700);feedback=null;const doneNow=p.sling.round.done;
  if(doneNow){render();void speak('Five stones! Ready for another round?');await wait(900);await checkpoint('sling-round-end');}
  else if(!midBreakDone&&index+1===breakAt){midBreakDone=true;await checkpoint('sling-mid-round');announce();}
  else announce();
 }catch(e){flight=null;feedback=null;$('error').textContent=e.message+' Your stones will reload.';log('shot-error',e.message);try{await sync();}catch{}}finally{busy=false;render();}
}
function point(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*800/b.width,y:(e.clientY-b.top)*600/b.height};}
// Grab anywhere: the pull is measured from wherever the finger lands, not from a small handle.
canvas.onpointerdown=e=>{if(!active()||drag||e.button!==0)return;e.preventDefault();unlock();clearTimeout(idleTimer);canvas.focus({preventScroll:true});drag={id:e.pointerId,from:point(e),pointer:e.pointerType};pull={dx:0,dy:0};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(drag?.id!==e.pointerId)return;const q=point(e);pull=clampPull(q.x-drag.from.x,q.y-drag.from.y);};
canvas.onpointerup=e=>{if(drag?.id!==e.pointerId)return;canvas.onpointermove(e);const kind=drag.pointer;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);void fling(['touch','mouse','pen'].includes(kind)?kind:'touch');};
canvas.onpointercancel=()=>{drag=null;pull={dx:0,dy:0};idleArm();};
canvas.onkeydown=e=>{if(!active())return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(e.key)){e.preventDefault();unlock();clearTimeout(idleTimer);if(e.key===' '||e.key==='Enter'){if(drag)void fling('keyboard');return;}if(!drag){drag={id:'keys',from:{x:0,y:0},pointer:'keyboard'};pull={dx:-90,dy:0};}const step=e.shiftKey?3:10;pull=clampPull(pull.dx+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),pull.dy+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));}};
$('start').onclick=()=>{unlock();void start();};$('hear').onclick=()=>{unlock();announce(true);};
$('sound').onclick=()=>{sound=!sound;unlock();try{localStorage.setItem('target-sound',sound?'on':'off');}catch{}render();};
$('refresh').onclick=async()=>{if(busy)return;stopVoice();try{await request('state');reloadFresh();}catch(e){$('error').textContent=e.message;}};
document.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{const id=b.dataset.player;if(!valid(id)||busy)return;try{localStorage.setItem('target-player',id);}catch{}const u=new URL(location.href);u.searchParams.set('player',id);location.assign(u);});
$('parents').onclick=()=>{if(busy)return;stopVoice();clearTimeout(idleTimer);drag=null;$('settings').hidden=true;$('gate').hidden=false;$('answer').value='';const a=5+Math.floor(Math.random()*5),b=5+Math.floor(Math.random()*5);parentSum=a+b;$('question').textContent=`What is ${a} + ${b}?`;$('parent').showModal();};$('gate').onsubmit=e=>{e.preventDefault();if(Number($('answer').value)!==parentSum){$('answer').value='';return;}$('gate').hidden=true;$('settings').hidden=false;};$('close-parent').onclick=()=>{$('parent').close();if(live())announce();};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){drag=null;stopVoice();clearTimeout(idleTimer);}else if(player&&!busy&&!document.querySelector('dialog.wb[open]'))void sync().catch(e=>{$('error').textContent=e.message;});});
window.addEventListener('error',e=>log('error',e.message));window.addEventListener('unhandledrejection',e=>log('error',String(e.reason)));
if(player){try{localStorage.setItem('target-player',player);}catch{}sync().then(()=>log('open','Sling Shot')).catch(e=>{$('error').textContent=e.message;});}else $('welcome').showModal();draw();
