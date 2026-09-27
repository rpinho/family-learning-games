// The living book's host: builds the stage, plays a hero chapter's beats (narration, camera, what the child does)
// and hands the child the moments to act. Everything he must read is flat and big in the overlay (ui.mjs); the
// camera composes every shot for the screen he holds (frame.mjs): wide on a Chromebook or a phone held sideways,
// recomposed (friends regrouped, the lens opened, the camera higher) on an upright phone.
// ?story=<id> (from the household's private story file)  &auto=1 (plays itself, for recordings)  &debug=1 (frame
// stats)  &drive=1 (an outside check taps like a child)  &check=1 (pauses at checkpoints for measurements)
// &preview=1 (grown-ups: nothing is logged)  &closeup=<role> (a still close-up of one character)
import {THREE,makeLight,createStage,director,clamp,lerp,easeInOut,smooth,easeOut} from './engine.mjs';
import {createSound} from './sfx.mjs';
import {station,ride,maze} from './station.mjs';
import {pitch} from './pitch.mjs';
import {viewMode,makeFramer,pointsOf,measureVisibility} from './frame.mjs';
import {createUI} from './ui.mjs';
const q=new URLSearchParams(location.search);const STORY=q.get('story')||'',AUTO=q.get('auto')==='1',DEBUG=q.get('debug')==='1',CHECK=q.get('check')==='1',PREVIEW=q.get('preview')==='1'||AUTO||q.get('drive')==='1',CLOSEUP=q.get('closeup');
const $=s=>document.querySelector(s);const wait=ms=>new Promise(r=>setTimeout(r,ms));
const state=globalThis.__living={story:STORY,beat:'loading',stats:null,log:[],done:false,telemetry:[],voice:[],expect:null,checkpoint:null,ack:null};
const mark=b=>{state.beat=b;state.log.push([Math.round(performance.now()),b]);};
async function getJSON(u){try{const r=await fetch(u);return r.ok?r.json():null;}catch{return null;}}
// Voice lines the scenes need even when the story file has none of its own (the story's lines win).
const UI_LINES={uiTapSay:['narrator','Tap the word and read it out loud!'],uiNothing:['narrator',"I didn't hear you. Tap and say it nice and loud!"],
 uiAgain:['narrator','So close! Try once more.'],uiEcho:['narrator','Now you say it!'],uiGrownUp:['narrator','Ask a grown-up to turn on the microphone.'],
 uiLetterSay:['narrator','Tap the letter and say its sound!']};
async function main(){
 const canvas=$('#stage');
 const [library,book]=await Promise.all([getJSON('/api/book/library'),getJSON('/api/book/living?story='+encodeURIComponent(STORY))]);
 // The story (words, voices, who plays which part) is the household's own, private file.
 const story=book?.story;if(!story){$('#fallback').hidden=false;$('#title').hidden=true;mark('fallback');return;}
 const L={...UI_LINES,...story.lines},V=story.voices,voice=book.clips||{};
 const stage=createStage(canvas,{maxScale:q.get('scale')?Number(q.get('scale')):1});
 if(!stage||!library){$('#fallback').hidden=false;$('#title').hidden=true;mark('fallback');return;}
 const camera=new THREE.PerspectiveCamera(40,1,.1,600);const light=makeLight();const post=stage.post;
 const ctx={light,art:library,camera,post,cast:{roles:story.roles},story,puppetsOnly:q.get('puppets')==='1'};
 // ---- the screen: wide or tall (and what changes when he turns the phone) ----
 let mode=viewMode(canvas.clientWidth,canvas.clientHeight),world=null,letterbox=0;
 const applyMode=()=>{post.uLetterbox=mode.tall?0:letterbox;world?.arrange?.(mode.tall);world?.setTall?.(mode.tall);document.body.classList.toggle('tall',mode.tall);};
 const fit=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();const m=viewMode(w,h);const changed=m.tall!==mode.tall;mode=m;if(changed&&!busyMoving)applyMode();};
 let busyMoving=false;addEventListener('resize',fit);fit();
 const keepPoints=s=>{const out=[];for(const k of s.keep||[]){const v=k==='people'?world?.people:world?.[k];if(v)pointsOf(v,out);}return out;};
 const framer=makeFramer(camera,{getKeep:keepPoints,letterbox:()=>post.uLetterbox});
 const frame=e=>framer(mode.tall&&e.tall?{...e,...e.tall,keep:e.keep}:e);
 const dir=director(camera,post,{frame});
 // ---- sound and narration: one audio element, one source per line ----
 const sound=createSound();const audio=new Audio();audio.preload='auto';
 const who2puppet=w=>({small:world?.small,guide:world?.guide,grownup:world?.dad||world?.mom,grownup2:world?.mom,mom:world?.mom,flyer:world?.flyer,friend:world?.friend,pet:world?.pet,hero:world?.hero}[w]);
 // A line is only ever spoken by its own clip (made by the household's voice engine). No clip yet: the server
 // renders it now (and keeps it); if that fails, the words show on screen and the story stays silent. The
 // device's own voice is never used. One line at a time: a line never overlaps or repeats itself.
 let speaking=0,lastKey='',lastAt=0;const rendered={};
 async function clipFor(key,v,text){const k=`${v.voice}|${v.speed}|${text}`;if(voice[k])return voice[k];if(rendered[k]!==undefined)return rendered[k];
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),20000);
  try{const r=await fetch('/api/book/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({story:STORY,key}),signal:ctl.signal});const j=r.ok?await r.json():null;rendered[k]=j?.clip||null;}catch{rendered[k]=null;}finally{clearTimeout(to);}
  if(rendered[k])voice[k]=rendered[k];return rendered[k];}
 function showWords(text,ms){const w=$('#words');w.textContent=text.replace(/\[\[[^\]]*\]\]/g,'').replace(/\s+/g,' ').trim();w.hidden=false;clearTimeout(showWords.t);showWords.t=setTimeout(()=>{w.hidden=true;},ms);}
 async function say(key){const line=L[key];if(!line||!line[1])return;const [who,text]=line;const v=V[who]||V.narrator;const est=Math.max(1400,text.replace(/\[\[[^\]]*\]\]/g,'uh').length*62);
  // The same line twice in a row within 1.5 s is a double trigger, not a repeat: say it once.
  const now=performance.now();if(key===lastKey&&now-lastAt<1500)return;lastKey=key;lastAt=now;
  const my=++speaking;mark('say:'+key);const clip=await clipFor(key,v,text);state.voice.push({key,clip:clip||null,at:Math.round(performance.now())});who2puppet(who)?.talk(est);sound?.duck(.2);
  let ok=false;
  if(clip){try{audio.src='/book-voice/'+clip;await audio.play();ok=true;await new Promise(r=>{const to=setTimeout(r,est*2+2000);audio.onended=()=>{clearTimeout(to);r();};});}catch{}}
  if(!ok){showWords(text,est);await wait(est);}
  if(my===speaking)sound?.duck(.55);await wait(250);}
 const host={wait,sfx:k=>sound?.play(k),confetti:()=>confetti()};
 // ---- the overlay ----
 const ui=createUI({layer:$('#ui'),say,sound,player:story.player||'',preview:PREVIEW,story:STORY});
 // ---- the frame loop ----
 let t0=performance.now(),last=t0,running=false;
 function frameLoop(){if(!running)return;const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;const t=(now-t0)/1000;
  world?.update(t,dt);dir.update(now,dt);if(world){stage.render(world.scene,camera,t);ui.update(camera,canvas.getBoundingClientRect());}
  if(DEBUG){const s=stage.stats();$('#debug').textContent=`${s.w}x${s.h} scale ${s.scale} · p50 ${s.p50} ms · p95 ${s.p95} ms · ${state.beat}`;}
  state.stats=stage.stats();requestAnimationFrame(frameLoop);}
 const start=()=>{if(!running){running=true;requestAnimationFrame(frameLoop);}};
 // ---- checks: what the child can see at a checkpoint ----
 state.measure=()=>{if(!world)return null;const s=dir.shot?.to,keys=(mode.tall&&s?.tall?{...s,...s.tall,keep:s.keep}:s)?.keep||[];
  const who=new Set();for(const k of keys){if(k==='people')(world.people||[]).forEach(p=>who.add(p));else if(world[k]?.root)who.add(world[k]);}
  if(dir.following)for(const p of world.people||[])who.add(p);
  const targets=[...who].filter(p=>p?.root?.visible).map(p=>({id:p.name||'?',obj:p}));
  return {mode:mode.tall?'tall':'wide',shot:state.shotName||null,chars:measureVisibility(stage.renderer,world.scene,camera,targets,{letterbox:post.uLetterbox,hide:ui.covers(),css:{w:canvas.clientWidth,h:canvas.clientHeight}}),readables:ui.measureReadables(),targets:ui.targets()};};
 async function checkpoint(id){state.checkpoint={id,at:Math.round(performance.now())};if(!CHECK)return;const t=performance.now();while(state.ack!==id&&performance.now()-t<6000)await wait(80);}
 async function shot(name,from,to,opts={}){state.shotName=name;await dir.play({dur:opts.dur??4,from,to,ease:opts.ease||easeInOut,...opts},performance.now());}
 // What the child is expected to do now (a check taps it like a child; auto mode does it itself).
 function expect(e){state.expect=e;if(AUTO)autoPlay(e);}
 async function autoPlay(e){await wait(1600);if(state.expect!==e)return;
  if(e.kind==='choose'){const bs=[...document.querySelectorAll('#ui .lv-opt')];const wrong=bs.find(b=>b.dataset.v!==String(e.answer));if(wrong){wrong.click();await wait(5200);}if(state.expect===e)bs.find(b=>b.dataset.v===String(e.answer))?.click();}
  else if(e.kind==='say'){for(let k=0;k<5&&state.expect===e;k++){document.querySelector(e.selector)?.click();await wait(7000);const c=document.querySelector('.lv-card [data-a="tap"]');if(c)c.click();}}
  else if(e.kind==='no')$('#no').click();
  else if(e.kind==='aim')e.aim({x:.9,y:1});
  else if(e.kind==='steer'){while(state.expect===e){const d=world.nextStep?.(e.target());if(!d)break;world.steer(d);await wait(250);if(e.pauseAt?.()){world.steer(null);await wait(2500);}}world.steer?.(null);}}
 function confetti(){const c=$('#confetti');c.innerHTML=Array.from({length:40},(_,i)=>`<i style="left:${50+(Math.random()-.5)*30}%;--dx:${(Math.random()-.5)*90}vw;--dy:${-30-Math.random()*50}vh;--r:${Math.random()*720}deg;background:hsl(${Math.random()*360},85%,60%);animation-delay:${Math.random()*.2}s"></i>`).join('');setTimeout(()=>c.innerHTML='',2600);}
 function irisOpen(){post.uIris=0;return new Promise(r=>{const t=performance.now();const f=()=>{const k=clamp((performance.now()-t)/1600);post.uIris=easeInOut(k)*1.2;k<1?requestAnimationFrame(f):(post.uIris=2,r());};f();});}
 function irisClose(){post.uIris=1.2;return new Promise(r=>{const t=performance.now();const f=()=>{const k=clamp((performance.now()-t)/1600);post.uIris=(1-easeInOut(k))*1.2;k<1?requestAnimationFrame(f):r();};f();});}
 const setWorld=w=>{world=w;applyMode();};
 // A reading beat: he finds the word among look-alikes (the friend sounds out each word he taps, right or wrong),
 // then reads it aloud (the book's listening flow; a tap counts when there is no microphone).
 async function readBeat({id,options,answer,layout,title='',anchors=null,below=false,ask=null,wrongLine,sayLine='uiTapSay',kind='word'}){
  const soundOut=async w=>{await say((kind==='letter'?'lt:':'so:')+String(w).toLowerCase());};
  const e={kind:'choose',answer,id};expect(e);
  const res=await ui.choose({id,options,answer,layout,title,kind,anchors,below,soundOut,onWrong:async()=>{if(wrongLine)await say(wrongLine);}});
  // Read it aloud: the chosen word itself is the talk button.
  const log=ui.beatLog(id+'-say',{answer:String(answer)});
  const target=kind==='letter'?{kind:'letter',letter:String(answer).toUpperCase(),names:story.names?.[String(answer).toUpperCase()]||[]}:{kind:'word',word:String(answer)};
  const said=ui.sayIt(res.button,{target,kind:id,help:()=>soundOut(answer),log});
  const e2={kind:'say',selector:'#ui .lv-opt.right',id};expect(e2);
  if(ui.micUsable())await say(sayLine);
  await said;state.expect=null;res.remove();return res;}
 // ---- a close-up of one character (a still, for the checks and for grown-ups) ----
 async function closeup(role){const w=story.scene==='station'?await station(ctx):await pitch(ctx);setWorld(w);const p=w[role]||w.people[0];start();post.uIris=2;post.uLetterbox=0;
  // From the front-left, or (angle=back) from behind, so the fur on his back shows.
  const at=p.root.position,h=p.height||1,back=q.get('angle')==='back',cp={pos:[at.x+(back?-h*1.3:h*.5),at.y+h*.85,at.z+(back?-h*1.6:h*2)],look:[at.x,at.y+h*.45,at.z],fov:34,keep:[role]};
  post.uAperture=0;await shot('closeup',cp,cp,{dur:.2});
  world.people.forEach(o=>{if(o!==p)o.root.visible=false;});mark('closeup');await checkpoint('closeup');state.done=true;}
 // ---------------- The Night Train ----------------
 async function nightTrain(){
  sound?.ambience('dusk');sound?.music(true,{key:220,mood:'night'});
  setWorld(await station(ctx));mark('station');letterbox=.06;applyMode();post.uIris=0;post.uAperture=0;post.uBloom=.65;post.uWarm=1;post.uSat=1.08;post.uExposure=1.05;post.uGain.setRGB(1.04,1,.96);post.uLift.setRGB(.02,.01,.04);
  start();const s=world.shots;
  await shot('sky',s.sky,s.sky,{dur:.1});await irisOpen();
  const crane=shot('crane',s.sky,s.crane,{dur:9,focusFrom:30,focusTo:8,aperture:.35});
  await wait(1400);await say('st1');const lw=world.lampsWake(host);await crane;await lw;await checkpoint('crane');
  shot('two',s.crane,s.two,{dur:6,focusFrom:8,focusTo:4.2,aperture:.9});await say('st2');world.guide?.hop(.1);await say('st3');await say('st4');await checkpoint('two');
  // The departures board: find the train to the word on the ticket, then read it aloud.
  await shot('board',s.two,s.board,{dur:3.2,focusFrom:4.2,focusTo:4,aperture:.5});
  await say('st5');await say('stTeach');mark('board');await checkpoint('board');
  const B=story.board||{word:'cat',options:['can','cat','cap']};
  await readBeat({id:'board',options:B.options,answer:B.word,layout:'board',title:'DEPARTURES',wrongLine:'stWrong'});
  mark('board-right');world.dep.userData&&redraw(world.dep,B.options,B.options.indexOf(B.word));await say('stRight');
  // The night train arrives; everyone is ready.
  const lowShot=shot('low',s.board,s.low,{dur:4,focusFrom:4,focusTo:14,aperture:.7});
  const arrive=world.trainArrives(host);await say('st6');await lowShot;await arrive;
  shot('wide',s.low,s.wide,{dur:5,focusFrom:14,focusTo:9,aperture:.25});
  if(world.dad){world.dad.setPose('cheer');await say('st7');}
  if(world.mom&&L.st7b){world.mom.setPose('cheer');await say('st7b');}
  await checkpoint('wide');
  // The magic word: everyone hops aboard when the conductor reads it.
  const M=story.magic||{word:'hop'};await say('mg1');mark('magic');
  const btn=ui.talkButton(M.word,{label:'magic word'});const mlog=ui.beatLog('magic',{answer:M.word});
  const said=ui.sayIt(btn,{target:{kind:'word',word:M.word},kind:'magic',help:()=>say('so:'+M.word),log:mlog});expect({kind:'say',selector:'#ui .lv-talk'});
  await checkpoint('magic');await say('uiTapSay');await said;state.expect=null;btn.remove();
  sound?.play('sparkle');for(const p of [world.hero,world.guide,world.small])p?.hop(.35);await say('mgDone');
  for(const p of [world.hero,world.guide,world.small,world.dad,world.mom])if(p)p.root.visible=false;
  sound?.play('whistle');shot('depart',s.wide,s.depart,{dur:6});await world.trainLeaves();await irisClose();
  // ---- the night ride ----
  sound?.ambience('night');setWorld(await ride(ctx));mark('ride');letterbox=.05;applyMode();const r=world;post.uAperture=.3;post.uFocus=12;post.uWarm=0;post.uGain.setRGB(.96,1,1.08);post.uLift.setRGB(.01,.01,.05);post.uBloom=.8;post.uExposure=1.1;
  await shot('valley',r.shots.valley,r.shots.valley,{dur:.1});await irisOpen();
  dir.setFollow(()=>{const c=r.trackCam();camera.position.lerp(new THREE.Vector3(...c.pos),.08);const l=new THREE.Vector3(...c.look);camera.lookAt(l);camera.fov=mode.tall?52:40;camera.updateProjectionMatrix();post.uFocus=lerp(post.uFocus,9.5,.05);});
  await say('rd1');await say('rd2');sound?.play('whistle');await r.arrived();dir.setFollow(null);
  await shot('junction',{pos:camera.position.toArray(),look:r.engine.localToWorld(new THREE.Vector3(8,1,0)).toArray(),fov:camera.fov,raw:true},r.shots.junction,{dur:3,focusFrom:10,focusTo:14,aperture:.2});
  await say('rd3');await say('rd4');mark('signs');await checkpoint('signs');
  const G=story.signs||{word:'big',options:['bag','big','bug']};
  await readBeat({id:'signs',options:G.options,answer:G.word,layout:'anchored',anchors:r.signTops,wrongLine:'rdWrong'});
  mark('signs-right');await say('rdRight');r.go(G.options.indexOf(G.word));sound?.play('whistle');
  await shot('away',r.shots.junction,r.shots.away,{dur:5});await irisClose();
  // ---- the maze ----
  world=null;setWorld(await maze(ctx));mark('maze');const m=world;letterbox=0;applyMode();post.uAperture=.45;post.uFocus=14;post.uWarm=0;post.uGain.setRGB(.96,1,1.08);post.uLift.setRGB(.01,.01,.05);post.uBloom=.8;post.uExposure=1.1;
  await shot('over',m.shots.over,m.shots.over,{dur:.1});await irisOpen();
  const reveal=shot('overEnd',m.shots.over,m.shots.overEnd,{dur:7,focusFrom:22,focusTo:16,aperture:.2});await say('mz1');await reveal;
  m.snapCam();dir.setFollow(()=>{m.followCam();camera.fov=lerp(camera.fov,mode.tall?54:40,.1);camera.updateProjectionMatrix();post.uFocus=lerp(post.uFocus,camera.position.distanceTo(m.hero.root.position),.1);});post.uAperture=.3;
  await say('mz2');mark('maze-play');
  // He steers; his friends follow. At the fork a friend's bad idea meets a sign he can read.
  let forkDone=false,noShown=false,atGoal=false,noSaid=false;
  const signWord=String(story.maze?.sign||'not').toUpperCase();const signTag=document.createElement('div');signTag.className='lv-sign';signTag.innerHTML=ui.token(signWord,'word');$('#ui').append(signTag);
  ui.anchor(signTag,()=>m.signG.position.distanceTo(m.hero.root.position)<7?m.signG.localToWorld(new THREE.Vector3(0,.45,0)):null);
  const v2=new THREE.Vector3();
  const heroScreen=()=>{v2.copy(m.hero.root.position).setY(.6).project(camera);const rc=canvas.getBoundingClientRect();return {x:(v2.x+1)/2*rc.width+rc.left,y:(1-v2.y)/2*rc.height+rc.top};};
  const toWorld=d=>{if(!d)return null;const rgt=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize(),fwd=new THREE.Vector3();camera.getWorldDirection(fwd);fwd.setY(0).normalize();return rgt.multiplyScalar(d.x).addScaledVector(fwd,-d.y);};
  busyMoving=true;
  const ctl=ui.controls({canvas,origin:heroScreen,onDir:d=>m.steer(toWorld(d))});
  state.steerHint=()=>{const d=m.nextStep(m.goal);const p=m.hero.root.position.clone(),a=p.clone().add(new THREE.Vector3(d.x,0,d.z));const pa=p.clone().project(camera),pb=a.project(camera);const dx=pb.x-pa.x,dy=-(pb.y-pa.y),n=Math.hypot(dx,dy)||1;const h=heroScreen();const lag=Math.max(0,...[m.small,m.guide].filter(f=>f&&!f._lead).map(f=>Math.hypot(f.root.position.x-m.hero.root.position.x,f.root.position.z-m.hero.root.position.z)));return {hero:h,dir:{x:dx/n,y:dy/n},moving:m.moving,cell:m.cellOf(m.hero.root.position),noShown,lag:+lag.toFixed(2)};};
  const noBtn=$('#no');
  const watch=setInterval(async()=>{const c=m.cellOf(m.hero.root.position);
   if(!forkDone&&c[0]===m.fork[0]&&c[1]===m.fork[1]){forkDone=true;const d=m.W(...m.dead);if(m.small){m.small._lead=true;m.small.walkTo([[lerp(m.small.root.position.x,d.x,.5),0,lerp(m.small.root.position.z,d.z,.5)]],1.8);m.small.hop(.2);}
    noShown=true;noBtn.hidden=false;mark('fork');expect({kind:'no'});await checkpoint('fork');await say('fork');}
   if(c[0]===m.dead[0]&&c[1]===m.dead[1]&&noShown){noShown=false;noBtn.hidden=true;if(m.small)m.small._lead=false;state.expect=steerE;mark('dead-end');await say('oops');}
   if(!atGoal&&c[0]===m.goal[0]&&c[1]===m.goal[1]){atGoal=true;}},150);
  noBtn.onclick=async()=>{if(!noShown)return;noShown=false;noSaid=true;noBtn.hidden=true;sound?.play('no');mark('said-no');const lg=ui.beatLog('no');lg.tap('no',true);lg.done('tap');if(m.small){m.small.hop(.25);m.small._lead=false;}state.expect=steerE;await say('no');};
  const steerE={kind:'steer',target:()=>noShown?m.fork:m.goal,pauseAt:()=>noShown&&AUTO&&(noBtn.click(),true)};expect(steerE);
  await new Promise(r=>{const f=()=>atGoal?r():setTimeout(f,120);f();});clearInterval(watch);ctl.dispose();state.expect=null;noBtn.hidden=true;signTag.remove();busyMoving=false;
  // Found it.
  mark('found');m.setFound(true);sound?.play('sparkle');dir.setFollow(null);m.steer(null);m.hero.setPose('cheer');m.hero.hop(.3);
  await shot('goal',{pos:camera.position.toArray(),look:m.hero.root.position.toArray(),fov:camera.fov,raw:true},m.shots.goal,{dur:3.5,focusFrom:8,focusTo:3.4,aperture:.45});
  await checkpoint('found');await say('found');m.guide?.setPose('happy');await say('big2');
  const rise=shot('rise',m.shots.goal,m.shots.rise,{dur:9,focusFrom:3.6,focusTo:12,aperture:.3});await say('end');await rise;
  sound?.music(false);await irisClose();mark('end');state.done=true;
 }
 // ---------------- The Big Kick ----------------
 async function bigKick(){
  sound?.ambience('dawn');sound?.music(true,{key:293.66,mood:'warm'});
  setWorld(await pitch(ctx));mark('pitch');const s=world.shots,w=world;letterbox=0;applyMode();post.uIris=0;post.uBloom=.45;post.uBloomT=.85;post.uWarm=.6;post.uSat=1.1;post.uExposure=1.02;post.uGain.setRGB(1.02,1.01,.97);
  start();
  await shot('leaves',s.leaves,s.leaves,{dur:.1});await irisOpen();
  const rv=shot('reveal',s.leaves,s.reveal,{dur:8,focusFrom:1.8,focusTo:13,aperture:.6,focusEase:t=>smooth(Math.min(1,t*1.6))});setTimeout(()=>w.clearLeaves(),2600);await say('d1');const bird=w.flyerArrives(host);await rv;await checkpoint('reveal');
  await shot('crossbar',s.reveal,s.crossbar,{dur:3.5,focusFrom:12,focusTo:4.2,aperture:.8});await bird;await say('d2');
  await shot('friends',s.crossbar,s.friends,{dur:3.5,focusFrom:4.2,focusTo:5,aperture:.8});w.friend?.setPose('happy');w.friend?.hop(.15);await say('d3');await say('d4');w.friend?.setPose('idle');await checkpoint('friends');
  // 1. The letter balls: kick the one with Birdie's letter (then say its sound).
  const K=story.kick||{balls:story.balls||['D','B','P'],answer:story.answer||'B'};w.relabel(K.balls);for(const b of w.balls)b.visible=true;sound?.play('sparkle');
  await shot('kick',s.friends,s.kick,{dur:3,focusFrom:5,focusTo:5,aperture:.25});await say('d5');mark('kick');await checkpoint('kick');
  const res=await readBeat({id:'kick-letter',options:K.balls,answer:K.answer,layout:'anchored',anchors:K.balls.map((_,i)=>w.ballTop(i,mode.tall)),below:true,wrongLine:'dWrong',sayLine:'uiLetterSay',kind:'letter'});
  const ball=w.balls[K.balls.indexOf(K.answer)];w.balls.forEach(b=>{if(b!==ball)b.visible=false;});await w.kick(ball,host);
  mark('goal');await say('dGoal');await shot('cheer',s.kick,s.cheer,{dur:3});if(w.mom&&L.dMom){w.mom.setPose('cheer');await say('dMom');}w.pet?.hop(.3);await checkpoint('cheer');
  // 2. A penalty: Birdie in goal. He taps where he wants to kick (anywhere counts).
  if(L.pk1){await say('pk1');await w.toGoal(host);const pb=w.penalty();await shot('spot',s.cheer,s.spot,{dur:3,focusFrom:8,focusTo:7,aperture:.15});await say('pk2');mark('penalty');await checkpoint('penalty');
   const aim=await new Promise(res=>{const plane=new THREE.Plane(new THREE.Vector3(0,0,1),6.4),hit=new THREE.Vector3(),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),lg=ui.beatLog('penalty');
    const tapZone=document.createElement('button');tapZone.type='button';tapZone.className='lv-aim';tapZone.setAttribute('aria-label','Kick here');$('#ui').append(tapZone);
    const done=a=>{tapZone.remove();lg.tap('aim',true);lg.done('tap');state.expect=null;res(a);};
    tapZone.onclick=e=>{const rc=canvas.getBoundingClientRect();ndc.set((e.clientX-rc.left)/rc.width*2-1,-((e.clientY-rc.top)/rc.height)*2+1);ray.setFromCamera(ndc,camera);ray.ray.intersectPlane(plane,hit)?done({x:hit.x,y:hit.y}):done({x:0,y:1});};
    expect({kind:'aim',aim:done,selector:'#ui .lv-aim'});});
   const diveTo=aim.x>0?-1:1;const k=w.kick(pb,host,aim);await wait(380);await w.dive(diveTo);await k;await say('pk3');}
  // 3. NO!: Birdie gets his own letter wrong; he says NO! and fixes it.
  if(L.no1){await w.toBar(host);await shot('bar',s.spot,s.bar,{dur:2.5,focusFrom:7,focusTo:5,aperture:.4});await say('no1');mark('no');
   const noBtn=$('#no');noBtn.hidden=false;expect({kind:'no'});await checkpoint('no');const lg=ui.beatLog('no');
   const ask=setTimeout(()=>{if(!noBtn.hidden)void say('noAsk');},9000);
   await new Promise(r=>{noBtn.onclick=()=>{clearTimeout(ask);noBtn.hidden=true;sound?.play('no');lg.tap('no',true);lg.done('tap');state.expect=null;r();};});
   await say('no2');const N=story.no||{options:['B','D'],answer:'B'};const e={kind:'choose',answer:N.answer};expect(e);
   await ui.choose({id:'no-fix',options:N.options,answer:N.answer,layout:'board',kind:'letter',soundOut:async l=>say('lt:'+String(l).toLowerCase()),onWrong:async()=>{}}).then(r=>r.remove());state.expect=null;
   await say('no3');w.flyer?.hop(.2);await say('no4');}
  // 4. Fetch: the puppy fetches only the ball with her letter.
  if(L.f1){const F=story.fetch||{balls:['T','L','I'],answer:'L'};await w.regroup();w.relabel(F.balls);for(const b of w.balls)b.visible=true;
   await shot('fetch',s.bar,s.fetch,{dur:3,focusFrom:5,focusTo:9,aperture:.2});await say('f1');await say('f2');mark('fetch');await checkpoint('fetch');
   await readBeat({id:'fetch-letter',options:F.balls,answer:F.answer,layout:'anchored',anchors:F.balls.map((_,i)=>w.ballTop(i,mode.tall)),below:true,wrongLine:'fWrong',sayLine:'uiLetterSay',kind:'letter'});
   const fb=w.balls[F.balls.indexOf(F.answer)];w.balls.forEach(b=>{if(b!==fb)b.visible=false;});await w.fetchBall(fb,host);await say('f3');}
  // Breakfast under the treehouse.
  await w.regroup();await shot('cheer2',s.fetch||s.kick,s.cheer,{dur:3});if(L.e1&&w.mom){w.mom.setPose('cheer');await say('e1');}await say('d6');
  const cr=shot('crane',s.cheer,s.crane,{dur:9,focusFrom:6,focusTo:14,aperture:.3});await say('d7');await cr;
  sound?.music(false);await irisClose();mark('end');state.done=true;
 }
 function redraw(mesh,rows,hi){const c=mesh.userData.canvas,g=c.getContext('2d');const b=c.width*.035;g.fillStyle='#2e3b2a';g.fillRect(b,b,c.width-2*b,c.height-2*b);
  rows.forEach((l,i)=>{const y=c.height*(i+.5)/rows.length;if(i===hi){g.fillStyle='#e8c75a';g.globalAlpha=.35;g.fillRect(b*1.6,y-c.height/rows.length*.4,c.width-b*3.2,c.height/rows.length*.8);g.globalAlpha=1;}g.fillStyle='#f6ecd2';g.font='700 64px Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(`${i+1}   ${String(l).toUpperCase()}`,c.width/2,y);});
  mesh.userData.tex.needsUpdate=true;}
 // ---- title card: the first tap starts the sound ----
 $('#title h1').textContent=story.title||'';$('#title p').textContent=story.kicker||'';
 // A gentle hint on an upright phone (never required).
 if(mode.tall&&!AUTO)$('#turn').hidden=false;
 const begin=async()=>{$('#title').hidden=true;$('#turn').hidden=true;await sound?.resume();mark('begin');try{if(CLOSEUP)await closeup(CLOSEUP);else await (story.scene==='station'?nightTrain():bigKick());}catch(e){console.error(e);mark('error:'+e.message);}};
 $('#begin').onclick=begin;mark('ready');if(AUTO||CLOSEUP)setTimeout(begin,400);
}
main();
