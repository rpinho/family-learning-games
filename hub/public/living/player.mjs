// The living book's host: builds the stage, plays a hero chapter's beats (narration, camera, what the child does)
// and hands the child the moments to act: read the board, lead through the maze, kick the ball, say NO!
// ?story=<id> (from the household's private story file)  &auto=1 (plays itself, for recordings)  &debug=1 (frame stats)
import {THREE,makeLight,createStage,director,clamp,lerp,easeInOut,smooth,easeOut} from './engine.mjs';
import {createSound} from './sfx.mjs';
import {station,maze} from './station.mjs';
import {pitch} from './pitch.mjs';
const q=new URLSearchParams(location.search);const STORY=q.get('story')||'',AUTO=q.get('auto')==='1',DEBUG=q.get('debug')==='1';
const $=s=>document.querySelector(s);const wait=ms=>new Promise(r=>setTimeout(r,ms));
const state=globalThis.__living={story:STORY,beat:'loading',stats:null,log:[],done:false};
const mark=b=>{state.beat=b;state.log.push([Math.round(performance.now()),b]);};
async function getJSON(u){try{const r=await fetch(u);return r.ok?r.json():null;}catch{return null;}}
async function main(){
 const canvas=$('#stage');
 const [library,book]=await Promise.all([getJSON('/api/book/library'),getJSON('/api/book/living?story='+encodeURIComponent(STORY))]);
 // The story (words, voices, who plays which part) is the household's own, private file.
 const story=book?.story;if(!story){$('#fallback').hidden=false;$('#title').hidden=true;mark('fallback');return;}
 const L=story.lines,V=story.voices,voice=book.clips||{};
 const stage=createStage(canvas,{maxScale:q.get('scale')?Number(q.get('scale')):1});
 if(!stage||!library){$('#fallback').hidden=false;$('#title').hidden=true;mark('fallback');return;}
 const camera=new THREE.PerspectiveCamera(40,1,.1,600);const light=makeLight();const post=stage.post;
 const ctx={light,art:library,camera,post,cast:{roles:story.roles},story};
 const fit=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();};addEventListener('resize',fit);fit();
 const dir=director(camera,post);
 let world=null,t0=performance.now(),last=t0,running=true;
 function frame(){if(!running)return;const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;const t=(now-t0)/1000;
  world?.update(t,dt);dir.update(now,dt);if(world)stage.render(world.scene,camera,t);
  if(DEBUG){const s=stage.stats();$('#debug').textContent=`${s.w}x${s.h} scale ${s.scale} · p50 ${s.p50} ms · p95 ${s.p95} ms · ${state.beat}`;}
  state.stats=stage.stats();requestAnimationFrame(frame);}
 // ---- sound and narration ----
 const sound=createSound();const audio=new Audio();audio.preload='auto';
 const who2puppet=w=>({small:world?.small,guide:world?.guide,grownup:world?.dad,flyer:world?.flyer,friend:world?.friend,pet:world?.pet}[w]);
 async function say(key){const [who,text]=L[key];const v=V[who]||V.narrator;const clip=voice[`${v.voice}|${v.speed}|${text}`];const est=Math.max(1400,text.length*62);
  mark('say:'+key);who2puppet(who)?.talk(est);sound?.duck(.2);
  if(clip){audio.src='/book-voice/'+clip;try{await audio.play();await new Promise(r=>{const to=setTimeout(r,est*2+2000);audio.onended=()=>{clearTimeout(to);r();};});}catch{await wait(est);}}else await wait(est);
  sound?.duck(.55);await wait(250);}
 const host={wait,sfx:k=>sound?.play(k),confetti:()=>confetti()};
 // ---- taps in the 3D world ----
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();let onTap=null;
 canvas.addEventListener('pointerup',e=>{if(!onTap)return;const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);onTap(ray,e);});
 function confetti(){const c=$('#confetti');c.innerHTML=Array.from({length:40},(_,i)=>`<i style="left:${50+(Math.random()-.5)*30}%;--dx:${(Math.random()-.5)*90}vw;--dy:${-30-Math.random()*50}vh;--r:${Math.random()*720}deg;background:hsl(${Math.random()*360},85%,60%);animation-delay:${Math.random()*.2}s"></i>`).join('');setTimeout(()=>c.innerHTML='',2600);}
 // ---- the chapters ----
 async function nightTrain(){
  sound?.ambience('dusk');sound?.music(true,{key:220,mood:'night'});
  world=await station(ctx);mark('station');post.uIris=0;post.uLetterbox=.06;post.uAperture=0;post.uBloom=.65;post.uWarm=1;post.uSat=1.08;post.uExposure=1.05;post.uGain.setRGB(1.04,1,.96);post.uLift.setRGB(.02,.01,.04);
  requestAnimationFrame(frame);
  // Iris opens on the sky.
  const s=world.shots;dir.play({dur:.1,from:s.sky,to:s.sky},performance.now());await irisOpen();
  const crane=dir.play({dur:9,from:s.sky,to:s.crane,ease:easeInOut,focusFrom:30,focusTo:8,aperture:.35},performance.now());
  await wait(1400);await say('st1');const lw=world.lampsWake(host);await crane;await lw;
  dir.play({dur:6,from:s.crane,to:s.two,ease:easeInOut,focusFrom:8,focusTo:4.2,aperture:.9},performance.now());await say('st2');world.guide&&world.guide.hop(.1);await say('st3');await say('st4');
  // The departures board: read it and tap the right line.
  await dir.play({dur:3.2,from:s.two,to:s.board,focusFrom:4.2,focusTo:4,aperture:.5},performance.now());
  await say('st5');mark('board');const rows=['1   FERN HOLLOW','2   MOONFERN MAZE','3   OLD QUARRY'];let misses=0;
  await new Promise(res=>{const pick=async row=>{if(row===world.boardAnswer){onTap=null;redraw(world.dep,rows,row,'#e8c75a');sound?.play('sparkle');res();return;}
    misses++;redraw(world.dep,rows,row,'#c0564a');sound?.play('soft');await say('stWrong');redraw(world.dep,rows,misses>=2?world.boardAnswer:-1,'#8ab8e8');};
   onTap=ray=>{const hit=ray.intersectObject(world.dep)[0];if(!hit)return;pick(Math.min(2,Math.floor((1-hit.uv.y)*3)));};
   if(AUTO)setTimeout(()=>pick(0),2500),setTimeout(()=>pick(1),9000);});
  mark('board-right');await say('stRight');
  // The night train arrives.
  const lowShot=dir.play({dur:4,from:s.board,to:s.low,ease:easeInOut,focusFrom:4,focusTo:14,aperture:.7},performance.now());
  const arrive=world.trainArrives(host);await say('st6');await lowShot;await arrive;
  dir.play({dur:5,from:s.low,to:s.wide,ease:easeInOut,focusFrom:14,focusTo:9,aperture:.25},performance.now());
  if(world.dad){world.dad.setPose('cheer');await say('st7');}
  // Everyone climbs aboard, the train pulls away; the iris closes on the lamp.
  const seats=world.train.seatsWorld();for(const [i,p] of [world.hero,world.guide,world.small].entries()){if(!p)continue;const to=seats[i%seats.length];p.root.visible=false;}
  sound?.play('whistle');dir.play({dur:6,from:s.wide,to:s.depart,ease:easeInOut},performance.now());await world.trainLeaves();await irisClose();
  // ---- the maze ----
  sound?.ambience('night');world=await maze(ctx);mark('maze');const m=world;post.uLetterbox=.0;post.uAperture=.45;post.uFocus=14;post.uWarm=0;post.uGain.setRGB(.96,1,1.08);post.uLift.setRGB(.01,.01,.05);post.uBloom=.8;post.uExposure=1.1;
  const over=dir.play({dur:.1,from:m.shots.over,to:m.shots.over},performance.now());await over;await irisOpen();
  const reveal=dir.play({dur:7,from:m.shots.over,to:m.shots.overEnd,ease:easeInOut,focusFrom:22,focusTo:16,aperture:.2},performance.now());await say('mz1');await reveal;
  m.snapCam();const fromS={pos:camera.position.toArray(),look:[0,0,0],fov:40};dir.setFollow(()=>{m.followCam();post.uFocus=lerp(post.uFocus,camera.position.distanceTo(m.hero.root.position),.1);});post.uAperture=.35;
  await say('mz2');mark('maze-play');
  // He leads: tap a spot on the paths; the friends follow. At the fork, a friend's bad idea meets a sign.
  let forkDone=false,noShown=false,atGoal=false;const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  const goTo=async cell=>{const pts=m.pathTo(cell);if(!pts.length)return;sound?.play('soft');const steps=setInterval(()=>sound?.play('step'),360);await m.hero.walkTo(pts,2.1);clearInterval(steps);};
  onTap=ray=>{if(!ray.ray.intersectPlane(plane,hit))return;const c=m.cellOf(hit);ring(hit);void goTo(c);};
  const noBtn=$('#no');
  const watch=setInterval(async()=>{const c=m.cellOf(m.hero.root.position);
   if(!forkDone&&c[0]===m.fork[0]&&c[1]===m.fork[1]){forkDone=true;const d=m.W(...m.dead);m.small?.walkTo([[lerp(m.small.root.position.x,d.x,.5),0,lerp(m.small.root.position.z,d.z,.5)]],1.8);m.small?.hop(.2);
    noShown=true;noBtn.hidden=false;mark('fork');await say('fork');}
   if(c[0]===m.dead[0]&&c[1]===m.dead[1]&&noShown){noShown=false;noBtn.hidden=true;mark('dead-end');await say('oops');}
   if(!atGoal&&c[0]===m.goal[0]&&c[1]===m.goal[1]){atGoal=true;}},200);
  noBtn.onclick=async()=>{if(!noShown)return;noShown=false;noBtn.hidden=true;sound?.play('no');mark('said-no');m.small?.hop(.25);await say('no');};
  if(AUTO){(async()=>{await goTo(m.fork);await wait(2600);noBtn.click();await wait(3500);await goTo(m.goal);})();}
  await new Promise(r=>{const f=()=>atGoal?r():setTimeout(f,150);f();});clearInterval(watch);onTap=null;noBtn.hidden=true;
  // Found it.
  mark('found');m.setFound(true);sound?.play('sparkle');dir.setFollow(null);m.hero.setPose('cheer');m.hero.hop(.3);
  await dir.play({dur:3.5,from:{pos:camera.position.toArray(),look:m.hero.root.position.toArray(),fov:40},to:m.shots.goal,ease:easeInOut,focusFrom:8,focusTo:3.4,aperture:.45},performance.now());
  await say('found');m.guide&&m.guide.setPose('happy');await say('big2');
  const rise=dir.play({dur:9,from:m.shots.goal,to:m.shots.rise,ease:easeInOut,focusFrom:3.6,focusTo:12,aperture:.3},performance.now());await say('end');await rise;
  sound?.music(false);await irisClose();mark('end');state.done=true;
 }
 async function bigKick(){
  sound?.ambience('dawn');sound?.music(true,{key:293.66,mood:'warm'});
  world=await pitch(ctx);mark('pitch');const s=world.shots;post.uIris=0;post.uLetterbox=0;post.uBloom=.45;post.uBloomT=.85;post.uWarm=.6;post.uSat=1.1;post.uExposure=1.02;post.uGain.setRGB(1.02,1.01,.97);
  requestAnimationFrame(frame);
  // Through the leaves (soft, out of focus) to the pitch.
  dir.play({dur:.1,from:s.leaves,to:s.leaves},performance.now());await irisOpen();
  const rv=dir.play({dur:8,from:s.leaves,to:s.reveal,ease:easeInOut,focusFrom:1.8,focusTo:13,aperture:.6,focusEase:t=>smooth(Math.min(1,t*1.6))},performance.now());await say('d1');const bird=world.flyerArrives(host);await rv;
  await dir.play({dur:3.5,from:s.reveal,to:s.crossbar,ease:easeInOut,focusFrom:12,focusTo:4.2,aperture:.8},performance.now());await bird;await say('d2');
  await dir.play({dur:3.5,from:s.crossbar,to:s.friends,ease:easeInOut,focusFrom:4.2,focusTo:5,aperture:.8},performance.now());world.friend?.setPose('happy');world.friend?.hop(.15);await say('d3');await say('d4');world.friend?.setPose('idle');
  // The balls with letters: kick the one that the story asks for.
  for(const b of world.balls){b.visible=true;}sound?.play('sparkle');
  await dir.play({dur:3,from:s.friends,to:s.kick,ease:easeInOut,focusFrom:5,focusTo:5,aperture:.4},performance.now());await say('d5');mark('kick');
  let misses=0;await new Promise(res=>{const pick=async b=>{if(b.userData.letter===(story.answer||'B')){onTap=null;await world.kick(b,host);res();return;}
    misses++;sound?.play('soft');const y0=b.position.y;b.position.y+=.2;setTimeout(()=>b.position.y=y0,220);await say('dWrong');if(misses>=2){const B=world.balls.find(x=>x.userData.letter===(story.answer||'B'));B.scale.setScalar(1.35);}};
   onTap=ray=>{const hit=ray.intersectObjects(world.balls)[0];if(hit)pick(hit.object);};
   if(AUTO)setTimeout(()=>pick(world.balls[0]),2500),setTimeout(()=>pick(world.balls[1]),8000);});
  mark('goal');await say('dGoal');world.pet?.hop(.3);await say('d6');
  const cr=dir.play({dur:9,from:s.kick,to:s.crane,ease:easeInOut,focusFrom:6,focusTo:14,aperture:.3},performance.now());await say('d7');await cr;
  sound?.music(false);await irisClose();mark('end');state.done=true;
 }
 function redraw(mesh,rows,hi,color){const c=mesh.userData.canvas,g=c.getContext('2d');const b=c.width*.035;g.fillStyle='#2e3b2a';g.fillRect(b,b,c.width-2*b,c.height-2*b);
  rows.forEach((l,i)=>{const y=c.height*(i+.5)/rows.length;if(i===hi){g.fillStyle=color;g.globalAlpha=.35;g.fillRect(b*1.6,y-c.height/rows.length*.4,c.width-b*3.2,c.height/rows.length*.8);g.globalAlpha=1;}g.fillStyle='#f6ecd2';g.font='700 54px Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(l,c.width/2,y);});
  mesh.userData.tex.needsUpdate=true;}
 function ring(p){const v=p.clone().project(camera),r=canvas.getBoundingClientRect();const el=document.createElement('i');el.className='ring';el.style.left=((v.x+1)/2*r.width)+'px';el.style.top=((1-v.y)/2*r.height)+'px';$('#overlay').append(el);setTimeout(()=>el.remove(),900);}
 function irisOpen(){post.uIris=0;return new Promise(r=>{const t=performance.now();const f=()=>{const k=clamp((performance.now()-t)/1600);post.uIris=easeInOut(k)*1.2;k<1?requestAnimationFrame(f):(post.uIris=2,r());};f();});}
 function irisClose(){post.uIris=1.2;return new Promise(r=>{const t=performance.now();const f=()=>{const k=clamp((performance.now()-t)/1600);post.uIris=(1-easeInOut(k))*1.2;k<1?requestAnimationFrame(f):r();};f();});}
 // ---- title card: the first tap starts the sound ----
 $('#title h1').textContent=story.title||'';$('#title p').textContent=story.kicker||'';
 const begin=async()=>{$('#title').hidden=true;await sound?.resume();mark('begin');try{await (story.scene==='station'?nightTrain():bigKick());}catch(e){console.error(e);mark('error:'+e.message);}};
 $('#begin').onclick=begin;mark('ready');if(AUTO)setTimeout(begin,400);
}
main();
