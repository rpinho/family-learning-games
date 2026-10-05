import {addReadingSupport,readingAudio} from './reading-support.mjs';
import './audio-scope.mjs';
import {mountQuestIntro} from './world-intro.mjs';
// The Book: today's chapter as a full-screen, narrated picture book, opened once a day before the games.
// Every page is a picture composed from the chapter's picture library; turning a page (tap anywhere,
// swipe, or on its own after the narration and a pause) plays that page's narration straight away.
// The first tap on the cover unlocks sound for the session; one <audio> element is reused for every line.
// Learning happens inside the story ("beats"): letter keys, stepping-stones, counting, magic words he
// reads to make things happen, spells, sharing, and the NO! beat where a friend wants to do something wrong.
import {graphOf,routePages,validChoices,pageLines,countLayout} from './book-adventure.mjs';
import {calmSound} from './calm-sound.mjs';
import {repeatOf,heard} from './repeats.mjs';
import {layoutTrain,composeScene,relHeight,sceneUnit,THING_PROPS,BACK_LIFT,zonesOnScreen,backgroundRect,TOP_ANCHORED} from './book-scene.mjs';
import {selectBackground,paintedTapRect,standingGround,standingClearance,standingWithUI} from './book-painted-layout.mjs';
import {foregroundRect,paintedStanding} from './book-foreground.mjs';
import {mountPond} from './pond/pond.mjs';
import {pondNarrator} from './pond/narration.mjs';
const STAND_IN_W=0.34,STAND_IN_AR=1.8;   // a stand-in goal: least width (share of the screen) and width:height; how far a painted goal may be brought nearer
// it was "too close"): its foot is STAND_IN_UP of the way from the friends' ground line to the floor's horizon
// (STAND_IN_HORIZON, a share of the screen height: the painted rooms' eye level), and the goal and its keeper are
// smaller by the same depth (on the horizon a thing would shrink to nothing). Kick-letter uses the same distance.
export const STAND_IN_HORIZON=0.38,STAND_IN_UP=0.45,STORY_GROUND=0.93;
const PIECE_POINTS={pawn:1,knight:3,bishop:3,rook:5,queen:9};
export function standInDepth(ground=STORY_GROUND,{up=STAND_IN_UP,horizon=STAND_IN_HORIZON}={}){const foot=ground-up*(ground-horizon);return {foot,scale:(foot-horizon)/(ground-horizon)};}
// The stand-in goal's size for a keeper of height kh (px) at that depth: he fills 90% of its height; a small goal's
// width:height. Never smaller than a readable goal.
export function standInSize(kh,W,H,{scale=standInDepth().scale}={}){const h=Math.max(kh*scale/0.9,H*0.11);return {h,w:Math.min(W*0.8,Math.max(h*1.9,W*0.16))};}
// The ball he kicks or throws: small next to the people (about a boy's knee height), still an easy flick.
const actionBall=(W,H)=>Math.max(48,Math.min(W,H)*0.12);   // a stand-in goal frame's width (share of the screen) when the painted goal is cropped away
import {IDLE_REPEAT_MS,IDLE_REPEATS,shuffle} from './word-break.mjs';
import {fetchJSON} from './save-request.mjs';
import {listenOnce,recognise,listenAvailable,checkMic,micState} from './listen.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const TABLE_BAND=[0.27,0.73],THROW_X=0.44,AUTO_ADVANCE_MS=2200,TAP_GUARD_MS=700,LINE_GAP_MS=320;
// A swipe back to the page behind is a finger drawn across the PICTURE, never a stroke that began on something he
// and the Book turned back to the page before, so he played it again.) Mostly sideways, at least 60 px.
export const PLAY_TARGETS='button,a,input,canvas,.bk-trace,.bk-ball,.bk-glyph,.bk-card';
// the leg, and 50% was already reached, so the page moved on mid-letter). The letter's ink is split into a 3x3 grid;
// each part holding ink needs at least a third of it touched. Still guided, not a perfection check.
const TRACE_PART=1/3;
export function traceDone(cells,share,part=TRACE_PART){if(!cells.length)return false;const hit=cells.filter(k=>k.hit).length;if(hit/cells.length<share)return false;
 const xs=cells.map(k=>k.x),ys=cells.map(k=>k.y),x0=Math.min(...xs),y0=Math.min(...ys),w=(Math.max(...xs)-x0)||1,h=(Math.max(...ys)-y0)||1,parts=new Map();
 for(const k of cells){const id=Math.min(2,Math.floor((k.x-x0)/w*3))+3*Math.min(2,Math.floor((k.y-y0)/h*3));const p=parts.get(id)||{n:0,hit:0};p.n++;if(k.hit)p.hit++;parts.set(id,p);}
 return [...parts.values()].every(p=>p.n<2||p.hit/p.n>=part);}
export function swipeBack({dx=0,dy=0,onPlay=false}={}){return !onPlay&&dx>60&&Math.abs(dx)>Math.abs(dy)*1.5;}
export {REPEAT_MS,cries,repeatOf} from './repeats.mjs';
// heard "Goal!" then "Goal! Off we go!").
export const saysGoal=lines=>(lines||[]).some(l=>/\bgoal\b/i.test(String(l?.text||'')));
// No dead ends: a beat with no progress for RESCUE_MS shows its answer and lets him go on (checked every RESCUE_TICK_MS).
// A test harness may shorten both (globalThis.__bookFast).
const FAST=globalThis.__bookFast||1;export const RESCUE_MS=75000/FAST,RESCUE_TICK_MS=5000/FAST;
export async function loadBook(player,{preview=false,date='',review=false}={}){try{return await fetchJSON(`/api/book${preview?'/preview':''}?player=${encodeURIComponent(player)}${date?'&date='+date:''}${review?'&review=1':''}`,{},6000);}catch{return null;}}
export {lastPlace,rememberPlace} from './places.mjs';
// Narration travels as Opus (WebM) where the browser plays it: the same clip at a fifth of the bytes (parity-checked:
// hub/scripts/check-aac-parity.py); elsewhere the WAV. (AAC was tried and added ~35 ms of padding: not used.)
export const OPUS=(()=>{try{return !!globalThis.document?.createElement('audio').canPlayType('audio/webm; codecs="opus"');}catch{return false;}})();
export const voiceFile=f=>OPUS?String(f).replace(/\.wav$/,'.webm'):f;
function post(player,body,keepalive=false){return fetch('/api/book?player='+encodeURIComponent(player),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive}).then(r=>r.ok?r.json():null).catch(()=>null);}
// Test hook: every play() attempt is recorded (clip, page, whether the browser allowed it).
const audit=globalThis.__bookAudio||(globalThis.__bookAudio=[]);
export function mountBook(main,{player,book,event=()=>{},onDone=()=>{},preview=false,startPage=0,onExit=null,pathChoices=null}){
 if(book.chapter?.episode)return mountQuestIntro(main,{player,book,preview,onExit,onDone});
 const ch=book.chapter,date=book.date,art=ch.art||{actors:{},props:{},backgrounds:{}},early=ch.level==='early';
 const adventure=!!graphOf(ch),routeChoices=validChoices(ch,preview?(pathChoices||{}):(book.progress?.choices||{}));
 // a page with ifChoice is shown only when that option was picked at the fork (before a pick: the first option's way).
 const picked={};const forkPick=()=>picked.fork||ch.pages.find(p=>p.beat?.kind==='fork')?.beat.options?.[0]?.id;
 const branchy=ch.pages.some(p=>p.ifChoice);
 const route=()=>routePages(ch,routeChoices).filter(i=>!ch.pages[i]?.ifChoice||ch.pages[i].ifChoice===forkPick());
 const pageBackgrounds=new WeakMap();
 const backgroundFor=p=>{const width=root.clientWidth||innerWidth,height=root.clientHeight||innerHeight,key=`${width}:${height}`,painted=p.kind==='beat'&&!!p.beat?.painted;const prev=pageBackgrounds.get(p);if(prev?.viewSize!==key)pageBackgrounds.set(p,{...selectBackground(art.backgrounds[p.scene.bg],{width,height,painted}),viewSize:key,foregroundBeat:painted});return pageBackgrounds.get(p);};
 const keys=new Set(book.collection?.keys||[]),keysAtStart=new Set(keys);
 // The key ring (a letters book with a key goal): goal slots, his keys on them; today's key slides on at the end.
 const ring=ch.keyring||null;
 function keyringHTML({slide=null}={}){if(!ring)return '';const have=[...keys].filter(k=>/^[A-Z]$/.test(k)),goal=Math.max(ring.goal,have.length);
  return `<div class="bk-keyring" role="img" aria-label="${have.length} of ${goal} keys">${Array.from({length:goal},(_,i)=>{const k=have[i];return k?`<b class="${k===slide?'new':''}">🔑<i>${esc(k)}</i></b>`:'<b class="empty">🔑</b>';}).join('')}<em>${have.length} of ${goal} keys</em></div>`;}
 // Quest items in his spellbook (a quest-style book): [{id,name,emoji}].
 const items=[...(book.collection?.items||[])];
 // (how to read out loud is explained once per chapter; after that the page just asks)
 let toldListen=false;
 let page=preview?0:Math.min(Math.max(0,book.progress?.page||0),ch.pages.length-1),alive=true,finished=false,turn=0,timers=[],shownAt=0,canNext=false,autoTimer=null;
 const later=(fn,ms)=>{const t=setTimeout(()=>{if(alive)fn();},ms);timers.push(t);return t;};
 let pondPage=null,pondVoice=null;
 const clearPond=()=>{if(pondPage)snd.mute(false);pondPage?.destroy();pondPage=null;pondVoice?.stop();pondVoice=null;};
 const clearTimers=()=>{timers.forEach(clearTimeout);timers=[];};
 const root=document.createElement('section');root.className=`bk${adventure?' bk-adventure':''} bk-${ch.level}${ch.theme?` bk-theme-${ch.theme}`:''}${ch.keyStyle?` bk-keys-${ch.keyStyle}`:''}`;root.setAttribute('aria-label',`${ch.name}'s book`);
 root.innerHTML=`<div class="bk-view"></div><div class="bk-chrome"><button class="bk-exit" type="button" aria-label="Back to the games">✕</button><button class="bk-hear" type="button" aria-label="Hear it again">🔊</button>${early?'<div class="bk-keys" aria-hidden="true"></div>':''}<div class="bk-dots" aria-hidden="true"></div><div class="bk-tapnext" aria-hidden="true">👉</div>${preview?'<div class="bk-preview-bar">PREVIEW · nothing is saved</div>':''}</div>`;
 main.innerHTML='';main.append(root);
 const view=root.querySelector('.bk-view'),dots=root.querySelector('.bk-dots'),tapnext=root.querySelector('.bk-tapnext');
 // ---- listening: is there a recogniser on this machine, and is the microphone allowed? (never asks here) ----
 let canListen=false;void listenAvailable({warm:!preview}).then(v=>{canListen=v;});void checkMic();
 // ---- sound: one element, reused (unlocked by the first tap on the cover) ----
 const audio=new Audio();audio.preload='auto';let current=null;
 // The Book keeps only a soft mistake tone; the close and hand-over use speech alone.
 const snd=calmSound();
 const phonics=readingAudio({player,onHelp:()=>teleHint(1),enabled:()=>alive});

 let masteredWords=new Set();void fetch('/api/reading-support?player='+encodeURIComponent(player)).then(r=>r.json()).then(l=>{masteredWords=new Set(l.wordsMastered||[]);}).catch(()=>{});
 const support=(btn,w)=>addReadingSupport(btn,w,{letter:phonics.letter,blend:phonics.word});
 // The calm voice (chapter.calm, book/calm-lines.mjs): a greeting, one instruction then the hand-over, specific praise,
 // warm resets after a mistake (each used once), and the easier-or-harder offer at the end.
 const calm=ch.calm||null;let resetI=0;const nextReset=()=>calm?.resets?.[resetI++];
 const calmBeat=(pg,i)=>{const o=calm?.pages?.[i];if(!o)return pg.beat;return {...pg.beat,...(o.ask?{spoken:o.ask}:{}),...(o.praise?{done:o.praise}:{})};};
 // Every line is spoken by its own clip, made by the household's voice engine. A line with no clip is rendered by
 // the server now (and kept); if that fails, or the clip cannot play, the words show on screen and the book stays
 // silent. The device's own (robotic) voice is never used.
 const words=document.createElement('div');words.className='bk-words';words.hidden=true;root.append(words);
 function showWords(text,ms){words.textContent=String(text).replace(/\[\[[^\]]*\]\]/g,'').replace(/\s+/g,' ').trim();words.hidden=false;clearTimeout(showWords.t);showWords.t=setTimeout(()=>{words.hidden=true;},ms);}
 async function renderClip(line){return line.clip||null;}
 function stopSound(){try{audio.pause();}catch{}current?.();current=null;}
 // Each line is said ONCE per page: a prompt, a "try again", a reminder is never repeated (a repeated instruction
 // sounds anxious). A reminder that would repeat becomes a gentle pulse on the things to tap instead. Only an
 // explicit replay (the hear-again button, a tap on the caption) or the model answer after two misses says a line again.
 let saidTurn=-1;const said=new Set();
 // (never on something already done or listening: a letter he has traced or said does not move again)
 function pulse(){const t=view.querySelector('.bk-page:last-child')?.querySelectorAll('.bk-play .bk-btn:not(.right):not(.used),.bk-glyph:not(.tapped):not(.listening):not(.thinking):not(.traced),.bk-magic:not(.listening),.bk-ball,.bk-thing,.bk-pizza,.bk-box,.bk-trace');t?.forEach(x=>{x.classList.remove('bk-nudge');void x.offsetWidth;x.classList.add('bk-nudge');});}
 let lastLine=null,prevLine=null;
 function speak(line,{again=false}={}){
  return new Promise(async resolve=>{
   if(!alive||document.hidden||globalThis.familyAudio?.blocked||!line?.text)return resolve();
   if(saidTurn!==turn){saidTurn=turn;said.clear();}
   if(said.has(line.text)&&!again){audit.push({clip:line.clip||null,page,turn,skipped:'said'});pulse();return resolve();}
   const rep=!again&&repeatOf(line,prevLine);
   if(rep){audit.push({clip:line.clip||null,page,turn,skipped:rep});if(rep==='same-friend')showWords(line.shown||line.text,Math.max(1500,line.text.length*70));return resolve();}
   said.add(line.text);lastLine=line;prevLine=heard(line);
   stopSound();let done=false;const my=turn,est=Math.max(1500,line.text.length*70)/FAST;
   const fin=()=>{if(done)return;done=true;clearTimeout(t);talking(null);if(current===fin)current=null;if(prevLine?.text===line.text)prevLine.at=Date.now();resolve();};
   current=fin;talking(line.who);
   const t=setTimeout(fin,Math.max(4000,line.text.length*140)/FAST);
   const silent=why=>{if(done)return;audit.push({clip:line.clip||null,page,turn:my,ok:false,err:why});showWords(line.shown||line.text,est);setTimeout(fin,est);};
   if(!line.clip&&!await renderClip(line))return silent('no-clip');
   if(done||!alive||my!==turn||document.hidden)return fin();
   audio.onended=fin;audio.onerror=()=>silent('load');
   audio.src=clipURL(line.clip);
   let p;try{p=audio.play();}catch(e){p=Promise.reject(e);}
   // Interrupted by the next line (AbortError) just ends this one; a refusal shows the words, silently.
   Promise.resolve(p).then(()=>audit.push({clip:line.clip,page,turn:my,ok:true,at:Date.now()}),e=>{const err=String(e?.name||e);if(done)return;if(err==='AbortError'){audit.push({clip:line.clip,page,turn:my,ok:false,err});fin();}else silent(err);});
  });
 }
 // A short breath between lines, like a person reading aloud.
 async function speakAll(lines,my,opts={}){let first=true;for(const l of lines||[]){if(!alive||my!==turn)return false;if(!first)await new Promise(r=>later(r,LINE_GAP_MS));first=false;if(!alive||my!==turn)return false;await speak(l,opts);}return alive&&my===turn;}
 // The short interface lines (well done, say it, try again, numbers) are needed at once when they come: fetched
 // once when the book opens, so the praise after a trace or a tap is not waiting for the network.
 // Clips are held IN MEMORY once fetched (a blob URL): on a phone over a slow link the audio element re-requests
 // a file even when it was preloaded, so the praise after a trace waited ~1 s for the network (2026-09-28).
 const blobs=new Map(),MAX_BLOBS=80;
 function holdClip(f){if(!f||blobs.has(f))return;blobs.set(f,null);
  fetch(clipURL(f)).then(r=>r.ok?r.blob():null).then(b=>{if(!b||!alive){blobs.delete(f);return;}blobs.set(f,URL.createObjectURL(b));
   while(blobs.size>MAX_BLOBS){const [k,u]=blobs.entries().next().value;if(ui.has(k))break;blobs.delete(k);if(u)URL.revokeObjectURL(u);}}).catch(()=>blobs.delete(f));}
 // (?r= the newest letter-sound re-render: a re-made clip keeps its name, so the URL changes instead)
 const vq=book.voiceRev?'?r='+encodeURIComponent(book.voiceRev):'';
 // (the same clip as Opus where the browser plays it; the server falls back to the WAV bytes)
 const clipURL=f=>blobs.get(f)||(/^\/chess-voice\/[a-f0-9]{16}\.wav$/.test(f)?f:'/book-voice/'+voiceFile(f)+vq);
 const ui=new Set();let uiLoaded=false;function preloadUi(){if(uiLoaded)return;uiLoaded=true;const w=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(w);if(v.clip)ui.add(v.clip);for(const x of Object.values(v))if(x&&typeof x==='object')w(x);};w(ch.ui);w(ch.keysLine);
  for(const f of ui)holdClip(f);}
 function preload(i){preloadUi();const p=ch.pages[i];if(!p)return;const files=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(v.clip)files.add(v.clip);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};walk(p);
  for(const f of files)holdClip(f);const b=art.backgrounds[p.scene?.bg];if(b){const im=new Image();im.src=b.url;}}
 function talking(who){view.querySelectorAll('.bk-actor').forEach(a=>a.classList.toggle('talking',!!who&&a.dataset.id===who));}
 // ---- pictures ----
 // People and props: one row on one ground line, sized from one unit (book-scene.mjs composeScene). The sky above
 // them is remembered for the effects.
 let sky=0.3,trainBand=null;
 // him on any page that mentions it (or a scene that lists wear:["cape"]). Things the narrator names are on screen.
 const CAPE_SVG='<svg class="bk-cape" viewBox="0 0 140 130" aria-hidden="true"><defs><linearGradient id="bkcape" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#f5b82e"/><stop offset="1" stop-color="#c7860e"/></linearGradient></defs><path d="M52 6 Q70 14 88 6 Q112 40 136 112 Q118 124 100 116 Q86 126 70 118 Q54 126 40 116 Q22 124 4 112 Q28 40 52 6 Z" fill="url(#bkcape)" stroke="#9e680a" stroke-width="2.5"/><path d="M70 16 L70 116 M58 16 Q44 70 26 114 M82 16 Q96 70 114 114" stroke="#d6961a" stroke-width="2" fill="none" opacity=".55"/></svg>';
 function wearsCape(scene){const pg=ch.pages[page];return (scene?.wear||[]).includes('cape')||/\bcape\b/i.test(JSON.stringify([pg?.say,pg?.after,pg?.beat?.spoken,pg?.action?.after]||''));}
 function actorsHTML(scene,{ground=0.93,scale=1,maxHeight=1,avoid=null,beat=false,play=false,keeper=null,keepOut=[],drive=false,oneRow=false,minHeight=0,backLift=BACK_LIFT}={}){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight;
  // A train in the picture always carries the friends (all aboard!).
  if((scene.ride||scene.props.some(p=>p.id==='train'))&&(art.props.train?.seats||art.props.train?.cars)){
   // (other props stand beside the train, never in front of it)
   const train=trainHTML(scene,W,H,{ground,maxHeight,beat,keepOut,drive}),L=composeScene({actors:[],props:scene.props},art,{width:W,height:H,ground,maxHeight,beat,playBall:play,avoid:trainBand,keepOut});
   return train+propHTML(L.props);}
  // Authored action poses describe the shot, never the keeper's entrance.
  if(play)scene={...scene,actors:scene.actors.map(a=>({...a,pose:a.id===keeper?keeperPose(a.id):ballFreePose(a.id,a.pose)}))};
  const L=composeScene(scene,art,{width:W,height:H,ground,maxHeight,avoid,beat,playBall:play,aside:keeper,keepOut,oneRow,minHeight,backLift});sky=L.sky;
  return propHTML(L.props)+L.actors.map((a,i)=>{const P=art.actors[a.id].poses[a.pose]||art.actors[a.id].poses.idle;
   // Tiny single-row groups can exhaust the minimum gaps beside the controls; keep the final friend inside the screen.
   const left=oneRow?Math.min(.99-a.width,Math.max(.01,a.left)):a.left;
   return `<div class="bk-actor${P.fly||a.pose==='fly'?' fly':''}${a.depth?' back':''}" data-id="${esc(a.id)}" data-pose="${esc(a.pose)}"${a.depth?` data-depth="${a.depth}"`:''} style="left:${(left*100).toFixed(2)}%;width:${(a.width*100).toFixed(2)}%;height:${(a.height*100).toFixed(2)}%;bottom:${(a.bottom*100).toFixed(2)}%;--from:${left+a.width/2<0.5?-40:40}vw;animation-delay:${i*0.15}s"><div style="animation-delay:${-i*0.7}s;animation-duration:${(2.2+i*0.37).toFixed(2)}s">${a.id===player&&wearsCape(scene)?CAPE_SVG:''}<img src="${esc(P.url)}" alt="${esc(art.actors[a.id].name)}"></div></div>`;}).join('');
 }
 function propHTML(list){return list.map(r=>{const P=art.props[r.id];return P?`<div class="bk-prop" data-id="${esc(r.id)}" style="left:${(r.left*100).toFixed(2)}%;width:${(r.width*100).toFixed(2)}%;height:${(r.height*100).toFixed(2)}%;bottom:${(r.bottom*100).toFixed(2)}%"><img src="${esc(P.url)}" alt=""></div>`:'';}).join('');}
 function trainHTML(scene,W,H,{ground=0.93,maxHeight=1,beat=false,keepOut=[],drive=false}={}){
  // The train is sized from the same unit as everyone (about Dad's height), so a scene with a train
  // reads the same turned either way; riders keep the family's relative heights (Dad > Mom > the boys > the toys).
  const U=sceneUnit({width:W,height:H,beat,maxHeight,tallest:1}),rel={...art,actors:Object.fromEntries(Object.entries(art.actors).map(([k,A])=>[k,{...A,h:relHeight(k,A)}]))};
  const T=art.props.train,L=layoutTrain(scene.actors,rel,{width:W,height:H,bottom:1-ground+0.02,maxHeight:Math.min(0.5,maxHeight*0.75,U*0.95/H),keepOut,preferRight:drive});sky=Math.max(0,1-(1-ground+0.02)-(L?.train.height||0)*1.4);
  if(L){
   // Wagons repeat so every friend has his own; each is drawn after its rider (the front wall hides only his legs).
   const t=L.train,pc=v=>(v*100).toFixed(3)+'%';trainBand=[t.left-0.02,t.left+t.width+0.02];
   const piece=p=>{const span=p.src[1]-p.src[0];return `<div class="bk-car ${p.kind}" style="left:${pc((p.left-t.left)/t.width)};width:${pc(p.width/t.width)}"><img src="${esc(T.url)}" alt="" style="width:${pc(1/span)};margin-left:${pc(-p.src[0]/span)}"></div>`;};
   const rider=r=>{const P=art.actors[r.id].poses[r.pose]||Object.values(art.actors[r.id].poses)[0];
    return `<div class="bk-actor rider" data-id="${esc(r.id)}" data-pose="${esc(r.pose)}" style="left:${pc((r.left-t.left)/t.width)};width:${pc(r.width/t.width)};height:${pc(r.height/t.height)};bottom:${pc((r.bottom-t.bottom)/t.height)}"><div><img src="${esc(P.url)}" alt="${esc(art.actors[r.id].name)}"></div></div>`;};
   const inner=L.parts.map(p=>p.kind==='wagon'?(L.riders.find(r=>r.wagon===p.i)?rider(L.riders.find(r=>r.wagon===p.i)):'')+piece(p):piece(p)).join('');
   return `<div class="bk-prop train cars" style="left:${pc(t.left)};width:${pc(t.width)};height:${pc(t.height)};bottom:${pc(t.bottom)}">${inner}</div>`;
  }
  const h=Math.min(T.h*1.2,0.4),w=h*T.ar*H/W,left=(1-w)/2,bottom=0.06;trainBand=[left-0.02,left+w+0.02];
  const seats=T.seats||[[.5,.4]];
  const riders=scene.actors.slice(0,seats.length).map((a,i)=>{const P=art.actors[a.id].poses[a.pose]||Object.values(art.actors[a.id].poses)[0];const rh=h*0.8*Math.min(1,(art.actors[a.id].h||0.4)/0.6),rw=rh*P.ar*H/W,[sx,sy]=seats[i];
   return `<div class="bk-actor" data-id="${esc(a.id)}" style="left:${((left+sx*w-rw/2)*100).toFixed(2)}%;width:${(rw*100).toFixed(2)}%;height:${(rh*100).toFixed(2)}%;bottom:${((bottom+h*(1-sy))*100).toFixed(2)}%"><div><img src="${esc(P.url)}" alt=""></div></div>`;}).join('');
  return riders+`<div class="bk-prop train" style="left:${(left*100).toFixed(2)}%;width:${(w*100).toFixed(2)}%;height:${(h*100).toFixed(2)}%;bottom:${(bottom*100).toFixed(2)}%"><img src="${esc(T.url)}" alt="the train"></div>`;
 }
 function propsHTML(){return '';}   // props are placed with the people (composeScene)
 function fxHTML(fx,burst=false){
  const set={sparkles:'✨',stars:'⭐',confetti:'🎉',hearts:'💛',bubbles:'🫧'}[fx];if(!set)return '<div class="bk-fx"></div>';
  // Effects stay in the sky above everyone's heads (never over a face or a body).
  const H=root.clientHeight||innerHeight,top=Math.max(0,(sky*H-64)/H*100-4),n=burst?18:top<3?0:10;return `<div class="bk-fx${burst?' burst':''}">${Array.from({length:n},(_,i)=>`<i style="left:${burst?50:(8+Math.random()*84).toFixed(1)}%;top:${burst?Math.min(12,top).toFixed(1):(4+Math.random()*top).toFixed(1)}%;font-size:${(18+Math.random()*26).toFixed(0)}px;animation-delay:${(Math.random()*(burst?0.2:2.4)).toFixed(2)}s;--dx:${((Math.random()-.5)*80).toFixed(0)}vw;--dy:${burst?(-Math.min(12,top)+Math.random()*Math.max(0,sky*100-12)).toFixed(0):((Math.random()-.5)*70).toFixed(0)}vh">${set}</i>`).join('')}</div>`;
 }
 // (calm: a slow glint, never confetti; visual feedback with spoken praise)
 function burst(fx='sparkles'){if(fx==='confetti')fx='sparkles';view.querySelector('.bk-page')?.insertAdjacentHTML('beforeend',fxHTML(fx,true));view.querySelectorAll('.bk-actor').forEach(a=>{if(a.classList.contains('keeper-ready'))return;a.classList.remove('hop');void a.offsetWidth;a.classList.add('hop');});}
 function cheer(){const pg=ch.pages[page];if(!pg)return;for(const el of view.querySelectorAll('.bk-actor')){const A=art.actors[el.dataset.id];const P=A?.poses.cheer||A?.poses.happy;if(P)el.querySelector('img').src=P.url;}}
 function renderDots(){dots.innerHTML=route().map(i=>`<i class="${i<page?'done':i===page?'now':''}"></i>`).join('');const k=root.querySelector('.bk-keys');if(k)k.innerHTML=[...keys].map(l=>`<b>🔑${esc(l)}</b>`).join('');}
 function setNext(on){canNext=on;tapnext.classList.toggle('on',on);}
 // The no-dead-ends guard for a page: while it is not finished, a quiet stretch with no progress (no tap, nothing
 // finished) lets him go on: onRescue (e.g. show the answer), then "tap to go on".
 let lastInput=Date.now();root.addEventListener('pointerdown',()=>{lastInput=Date.now();},{passive:true});
 function guard(my,finished,onRescue=()=>{}){lastInput=Date.now();const watch=()=>later(()=>{if(my!==turn||finished()||canNext)return;
  if(Date.now()-lastInput<RESCUE_MS)return watch();onRescue();setNext(true);},RESCUE_TICK_MS);watch();}
 // What "Hear it again" says while a beat waits: the beat's own question (the NO! beat: the claim and the begging).
 function promptOf(b){if(b.kind==='no')return [b.claim,b.ask].filter(Boolean);if(b.kind==='teach-letter')return (b.lines||[]).slice(-1);
  return [b.ask&&b.kind!=='count'?b.ask:null,b.spoken].filter(Boolean).slice(0,1);}
 // ---- navigation: tap anywhere / swipe; each turn speaks the new page at once ----
 // Where the finger went down decides: a stroke that began on a play thing (the trace layer, the ball) belongs to the
 // play thing, even when that thing is gone by the time the finger lifts (an accepted trace removes its layer).
 let touch=null;
 root.addEventListener('pointerdown',e=>{touch={x:e.clientX,y:e.clientY,onPlay:!!e.target.closest?.(PLAY_TARGETS)};},{passive:true});
 root.addEventListener('pointerup',e=>{
  const t=touch;touch=null;
  if(!t||t.onPlay||e.target.closest('button'))return;
  if(Date.now()-shownAt<TAP_GUARD_MS||page<0)return;
  if(page>0&&swipeBack({dx:e.clientX-t.x,dy:e.clientY-t.y})){go(page-1,{back:true});return;}
  if(canNext)go(page+1);
 });
 root.addEventListener('pointercancel',()=>{touch=null;},{passive:true});
 root.querySelector('.bk-exit').onclick=()=>{globalThis.familyAudio?.stop();if(onExit)onExit();else document.getElementById('home')?.click();};
 root.querySelector('.bk-hear').onclick=()=>{if(page>=0){if(tele)tele.replays++;replay();}};
 // Parallax: the picture and the characters shift a little, in opposite directions, with the finger or the tilt.
 const parallax=(x,y)=>{const pg=view.querySelector('.bk-page:last-child');if(!pg||matchMedia('(prefers-reduced-motion: reduce)').matches)return;pg.style.setProperty('--px',x.toFixed(3));pg.style.setProperty('--py',y.toFixed(3));};
 root.addEventListener('pointermove',e=>parallax(e.clientX/innerWidth-.5,e.clientY/innerHeight-.5),{passive:true});
 const tilt=e=>{if(e.gamma!=null)parallax(Math.max(-1,Math.min(1,e.gamma/30))/2,Math.max(-1,Math.min(1,(e.beta-45)/30))/2);};addEventListener('deviceorientation',tilt);
 function page_(){const p=ch.pages[page];return p?{...p,say:pageLines(p,routeChoices,ch),...(p.action?{action:{...p.action,after:pageLines({say:p.action.after},routeChoices,ch)}}:{}),...(p.magic?{magic:{...p.magic,after:pageLines({say:p.magic.after},routeChoices,ch)}}:{})}:p;}
 // Where the characters may stand on this page so the page's words, buttons and play things never cover them.
 function stage(p,beat){
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight,wide=W>H*1.05,kind=p.beat?.kind;
  // A game page: the friends stand above the answers (on a wide screen the answers sit lower, so the friends can be as
  // big as on a story page: the play band's buttons start near 68% of the height).
  // Counted and dealt objects need ground in front of the family as well as under its feet.
  const tablePlay=beat&&!p.beat?.painted&&['count','share','remainder'].includes(kind);
  let ground=standingGround(backgroundFor(p),{width:W,height:H,backLift:BACK_LIFT,ground:tablePlay?(wide?0.93:0.64):backgroundFor(p)?.ground??(beat?(wide?0.66:0.64):0.93)}),scale=beat?0.72:1;
  // The top band belongs to the page's words: a beat's board, letter or pizza (28-30%), a magic word (34%), a caption (14%).
  // (a board puzzle's board fills the top third of a tall screen: the friends stand smaller below it, room for a back
  // row too, so nobody is pushed to the edges)
  const big=beat&&kind==='puzzle'&&['chess','maze'].includes(p.beat?.variant);
  let maxHeight=ground-(beat?(wide?0.25:big?0.41:0.30):p.magic?0.34:p.caption?0.15:0.05);
  const BG=backgroundFor(p),oneRow=beat&&!!BG?.oneRow;
  if(Number.isFinite(BG?.foreground)&&BG.foreground>0&&BG.foreground<1){const rect=backgroundRect(BG,{width:W,height:H}),floor=(rect.y+BG.foreground*rect.h)/H;maxHeight=Math.min(maxHeight,Math.max(.08,BG.size?(ground-floor-12/H)/1.15:ground-floor));}
  // Bands the characters step out of: the goal (keeper) and the ball's column, the things he counts or shares,
  // the big letter a friend teaches, and the spot where he holds the ball to throw.
  const ball=actionBall(W,H)/W,mid=(a,b)=>[a,b],S=Math.min(W,H);let avoid=null;

  if(p.action?.kind==='kick'||kind==='kick-letter'){if(wide){const g=backgroundFor(p)?.goal;
   // (no painted goal: the stand-in frame's column, sized for the keeper at his own height, see goalRect)
   let a,b;if(g){const r=foregroundRect(backgroundFor(p),g,{width:W,height:H});a=r.x/W;b=(r.x+r.w)/W;}else{const kp=keeperFor(null,p),KA=kp&&art.actors[kp],kh0=KA?relHeight(kp,KA)*sceneUnit({width:W,height:H,maxHeight}):0,half=beat?Math.min(0.46,Math.max(STAND_IN_W,kh0*keeperDepth(p)/0.9*STAND_IN_AR/W))/2:Math.min(0.46,standInSize(kh0,W,H).w/W)/2;a=0.5-half;b=0.5+half;}
   avoid=[Math.min(a,0.5-ball)-0.04,Math.max(b,0.5+ball)+0.04];}else{
   // Tall screen: the ball's column; on a kick-letter page whose goal stands on the friends' ground line (the painted
   // goal is cropped away, see goalRect), the goal's band too. A kick page's goal is up in the field, above everyone.
   const g=backgroundFor(p)?.goal||[0.38,0.3,0.24,0.17],vis=(W/H)/(1600/1067),cropped=g[0]<0.5-vis/2||g[0]+g[2]>0.5+vis/2;
   // (the keeper in a painted goal stands in the middle too: his column stays clear)
   const kp=keeperFor(null,p),KA=kp&&art.actors[kp],KP=KA&&(KA.poses.idle||Object.values(KA.poses)[0]),kw=KP?relHeight(kp,KA)*sceneUnit({width:W,height:H,maxHeight:0.9})*KP.ar/W:0;
   // (a stand-in goal on a kick-letter page stands up in the field, above everyone: nothing to keep clear)
   const half=kind==='kick-letter'&&cropped?0:Math.max(ball*0.75,kw*0.7+0.03);avoid=half?mid(0.5-half,0.5+half):null;}}
  // (on a tall screen the ball waits just above everyone's heads, so the row keeps its whole width)
  else if(p.action?.kind==='throw'&&wide)avoid=[THROW_X-ball*0.6,THROW_X+ball*0.6];
  else if(!p.beat?.painted&&wide&&(['count','share','remainder'].includes(kind)||(kind==='puzzle'&&p.beat?.variant==='captures')))avoid=[TABLE_BAND[0]-0.01,TABLE_BAND[1]+0.01];
  else if(wide&&kind==='teach-letter')avoid=[0.5-Math.min(W,H)*0.13/W,0.5+Math.min(W,H)*0.13/W];
  // For scenes containing a soccer goal, actors stay clear so the goal remains
  // in sight on every page there (2026-09-29: only the cones and the ball bag showed; Mom stood over the goal).
  const G=backgroundFor(p)?.goal;
  if(G&&!(p.action?.kind==='kick'||kind==='kick-letter')){const r=foregroundRect(backgroundFor(p),G,{width:W,height:H}),goalBottom=(r.y+r.h)/H;
   const top=ground-sceneUnit({width:W,height:H,maxHeight})/H-BACK_LIFT;
   // (only the part of the goal that is on screen: turned tall, a goal at the picture's side is cropped away)
   let a=Math.max(0,r.x/W),b=Math.min(1,(r.x+r.w)/W);
   if(top<goalBottom&&b-a>0.04){a-=0.02;b+=0.02;if(b-a>0.3){const c=(a+b)/2;a=c-0.12;b=c+0.12;}
    avoid=avoid?[Math.min(avoid[0],a),Math.max(avoid[1],b)]:[a,b];}}
  // the game's own buttons or board, measured once they are on screen (clearOfUI): the friends step aside
  // The background's painted objects (its keep-out zones: the tetherball, the brain, the bar): nobody stands on them,
  // at rest or as they move (book-scene.mjs zonesOnScreen, composeScene, layoutTrain).
  // (a picture with zones is held still while shown: pageFrame)
  const keepOut=zonesOnScreen(backgroundFor(p),{width:W,height:H,top:TOP_ANCHORED.has(p.scene.bg),still:true});
  if(Number.isFinite(BG?.groundStart))maxHeight=standingClearance(keepOut,{ground,maxHeight,height:H,backLift:BACK_LIFT});
  ({maxHeight,avoid}=standingWithUI(BG,{width:W,height:H,ground,maxHeight,avoid,
   // (buttons raised above everyone's heads: the family stands across the whole width under them, not squeezed into
   ui:uiAvoid&&uiPage===page&&playHighPage!==page?{x0:uiAvoid[0],x1:uiAvoid[1],y1:uiBottom}:null}));
  const painted=BG?.realForeground?paintedStanding(BG,{width:W,height:H,beat,uiBottom:uiAvoid&&uiPage===page&&!uiSideRoom()?uiBottom:0}):{ground,maxHeight,minHeight:0,backLift:BACK_LIFT};
  ({ground,maxHeight}=painted);
  // screenshots: "small people", tiny figures squeezed under the 9/10/11 and NO!/Okay buttons in a corner).
  const minHeight=beat?(adventure&&tablePlay?.28:BG?.realForeground&&!tablePlay&&p.beat?.variant!=='captures'?(W>=H?.30:.26):p.beat?.variant==='captures'?.28:0):painted.minHeight,backLift=beat&&p.beat?.variant==='captures'&&W<H?.10:p.choice&&W<H&&uiPage===page?Math.max(BACK_LIFT,Math.min(painted.backLift,ground-uiBottom-.35-.03)):painted.backLift;
  return {minHeight,backLift,keepOut,drive:p.action?.kind==='drive',ground,scale,maxHeight,avoid,beat,oneRow,play:!!p.action||kind==='kick-letter',keeper:p.action?.kind==='kick'||kind==='kick-letter'?keeperFor(null,p):null};
 }
 function paintBackground(el,b){
  const img=el.querySelector('.bk-bg');if(!img||!b)return;
  if(img.getAttribute('src')!==b.url)img.src=b.url;
  img.style.objectFit='cover';img.style.objectPosition=(b.focal||[.5,.5]).map(v=>`${v*100}%`).join(' ');
  img.style.animation='none';img.style.translate='none';
 }
 function pageFrame(p,{beat=false}={}){
  uiAvoid=null;uiBottom=0;snd.page({page,background:p.scene.bg});snd.pageTurn();
  const b=backgroundFor(p);
  const st=stage(p,beat),{ground,scale}=st;
  const cap=p.caption&&!p.magic&&!(p.beat&&['teach-letter'].includes(p.beat.kind))?`<button class="bk-caption" type="button">${esc(p.caption)}</button>`:'';
  const old=view.querySelector('.bk-page:last-child');
  const sceneChanged=old?.dataset.scene!==p.scene.bg;
  old?.classList.add('out');
  if(old)setTimeout(()=>old.remove(),350);
  const el=document.createElement('div');el.className=`bk-page${sceneChanged?' scene-change':''}`;
  el.dataset.scene=p.scene.bg;el.dataset.node=p.node||'';el.dataset.page=String(page);el.dataset.beat=p.beat?.variant||p.beat?.kind||'';
  // (no floating travel caption: "↗ past the big old oak" pointed at nothing on the page; the narration tells the way.
  el.innerHTML=`${b?`<img class="bk-bg" src="${esc(b.url)}" alt="">`:''}<div class="bk-layer">${propsHTML(p.scene,{ground,play:!!p.action||p.beat?.kind==='kick-letter'})}${actorsHTML(p.scene,st)}</div>${fxHTML(p.scene.fx)}${cap}<div class="bk-play"></div>`;
  if(p.scene.fx==='gate-open')setTimeout(()=>{if(el.isConnected)gateOpen(el,p);},500);
  // A picture with painted objects to keep clear is held still (no drift, no parallax), so they stay where the friends
  // were placed beside them (stage: zonesOnScreen still).
  if(b?.keepOut?.length){const img=el.querySelector('.bk-bg');if(img){img.style.animation='none';img.style.translate='none';}}
  // Set the ready pose and goal position before the page can paint or narration can await.
  if(st.keeper){const ready=()=>{if(el.dataset.shot==='taken')return;const g=goalRect(p,el);goalFrame(el,g);placeKeeper(el,p,g);};ready();el.querySelector('.bk-bg')?.addEventListener('load',ready,{once:true});}
  if(b?.focal){el.querySelector('.bk-bg')?.style.setProperty('object-position',`${b.focal[0]*100}% ${b.focal[1]*100}%`);}
  paintBackground(el,b);
  view.append(el);
  el.querySelector('.bk-caption')?.addEventListener('click',()=>{const l=(p.say||[]).find(x=>(x.shown||x.text).toLowerCase().includes(p.caption.toLowerCase()));if(l)void speak(l,{again:true});});
  return el;
 }
 // "Hear it again" never cancels what is going on (it used to start a new turn, which silently disabled the beat's
 // restarts the current line; while a beat waits for him it says the beat's question again; otherwise the page again.
 let intro=false,beatPrompt=null;
 function replay(){const p=page_();if(intro)return void speak(lastLine,{again:true});
  if(beatPrompt)return void speakAll(beatPrompt,turn,{again:true});
  void speakAll(p.say,turn,{again:true});}
 function cover(){
  page=-1;const p=ch.pages[0],b=art.backgrounds[ch.cover?.scene?.bg||p.scene.bg];
  const hero=p.scene.actors.find(a=>a.id===player)||p.scene.actors[0];const H=hero&&art.actors[hero.id]?.poses[hero.pose];
  view.innerHTML=`<div class="bk-page">${b?`<img class="bk-bg" src="${esc(b.url)}" alt="">`:''}<div class="bk-cover"><div class="card"><div class="kicker">${esc(ch.name)}'s ${ch.theme==='spellbook'?'Spellbook':'Book'} · Chapter ${esc(ch.number)}</div><h1>${esc(ch.title)}</h1>${keyringHTML()}${H?`<img src="${esc(H.url)}" alt="" style="height:min(22vh,180px)">`:''}<br><button class="bk-open" type="button" aria-label="Open the book">📖</button></div></div></div>`;
  dots.innerHTML='';renderDots();
  view.querySelector('.bk-open').onclick=async e=>{
   e.currentTarget.disabled=true;if(!preview)event('book_open',`${date}:${page}`);
   // This tap is the user gesture that unlocks sound for the whole session.
   const start=preview?Math.min(Math.max(0,startPage|0),ch.pages.length-1):book.progress?.page?Math.min(book.progress.page,ch.pages.length-1):0;
   snd.unlock();if(calm?.greet)await speak(calm.greet);
   if(alive)await speak(ch.cover?.line);if(alive&&ch.keysLine)await speak(ch.keysLine);if(alive)go(adventure?(route().includes(start)?start:route()[0]):start);
  };
  preload(0);snd.prefetch();
 }
 // ---- turning the phone (or resizing the window): the current page is laid out again in place ----
 // The scene (background, friends, props, the train) is rebuilt for the new shape with everyone's current pose; the
 // pieces placed in pixels (the goal, the keeper, the balls) are moved to the same spots in the new shape; a page
 // still sliding out is dropped. What is being said and where he is in the game stay exactly as they were.
 let poseNow={},laidOut=`${root.clientWidth}x${root.clientHeight}`,relayoutTimer=null;
 // The game's buttons, board and things must never cover a friend. They appear while the beat runs, so they are
 // measured once on screen; if one covers a friend, the friends step aside (left and right of the game) and glide
 // there (the same elements move: poses and the talking friend are kept).
 let uiAvoid=null,uiPage=-1,uiBottom=0,playHighPage=-1;
 // (room beside the game's buttons for the family to stand at a real size: then they step aside, never shrink under it)
 function uiSideRoom(){if(!uiAvoid)return true;return Math.max(uiAvoid[0]-0.03,0.97-uiAvoid[1])>=0.22;}
 function clearOfUI(){if(!alive||page<0||finished)return;const p=page_(),el=view.querySelector('.bk-page:last-child'),layer=el?.querySelector('.bk-layer');if(!p||!layer)return;
  const R=root.getBoundingClientRect(),W=R.width,H=R.height,box=e=>e.getBoundingClientRect();
  const people=[...layer.querySelectorAll('.bk-actor:not(.keeper-ready)')].map(box);if(!people.length)return;
  // (a game's things resting on the grass in front of the friends' feet are in front of them, not over them: they
  // count only when they reach into a body, above its lowest tenth)
  const pad=H*0.015,near=(u,q,thing)=>u.left<q.right&&q.left<u.right&&(thing?u.top<q.bottom-q.height*0.1&&q.top<u.bottom:u.top<q.bottom+pad&&q.top<u.bottom+pad);
  const ui=[...el.querySelectorAll('.bk-play > *, .bk-board, .bk-slots, .bk-table > *, .bk-capture-groups')].map(e=>{const r=box(e);r.thing=!!e.parentElement?.classList.contains('bk-table');return r;}).filter(u=>u.width&&u.height&&(p.choice||people.some(q=>near(u,q,u.thing))));
  if(!ui.length)return;
  const x0=(Math.min(...ui.map(u=>u.left))-R.left)/W-0.02,x1=(Math.max(...ui.map(u=>u.right))-R.left)/W+0.02;
  const next=uiAvoid&&uiPage===page?[Math.min(uiAvoid[0],x0),Math.max(uiAvoid[1],x1)]:[x0,x1];
  const bottom=Math.max(uiPage===page?uiBottom:0,(Math.max(...ui.map(u=>u.bottom))-R.top)/H+pad/H);
  if(uiAvoid&&uiPage===page&&Math.abs(next[0]-uiAvoid[0])<0.01&&Math.abs(next[1]-uiAvoid[1])<0.01&&Math.abs(bottom-uiBottom)<0.01)return;
  uiAvoid=next;uiBottom=bottom;uiPage=page;
  // No room beside the game's buttons (a tall screen): the buttons rise to sit just above the family, who keep their
  if(!uiSideRoom()&&backgroundFor(p)?.realForeground&&bottom>0.6&&!el.classList.contains('bk-play-high')){el.classList.add('bk-play-high');playHighPage=page;uiAvoid=null;uiBottom=0;uiPage=-1;setTimeout(clearOfUI,80);return;}
  const t=document.createElement('div');t.innerHTML=actorsHTML(p.scene,stage(p,p.kind==='beat'));
  // Same rows (who stands in front, who a step back)? The friends glide to their new places. A friend changing
  // rows needs the new drawing order: the layer is redrawn (poses and the talking friend are kept).
  const kid=p.action?.kind==='kick'||p.beat?.kind==='kick-letter'?keeperFor(null,p):null;
  const olds=[...layer.children].filter(o=>o.dataset.id!==kid),news=[...t.children].filter(n=>n.dataset.id!==kid);
  const same=news.length===olds.length&&news.every((n,i)=>(olds[i].dataset.id||'')===(n.dataset.id||'')&&(olds[i].dataset.depth||'')===(n.dataset.depth||''));
  // A friend whose glide would carry him across a painted object (keep-out zone) does not walk over it: he fades out
  // where he stands and fades in at his new place (2026-10-01: the friends slid across the tetherball).
  const zones=stage(p,p.kind==='beat').keepOut,pct=v=>parseFloat(v)/100;
  const across=(o,n)=>{const a=pct(o.style.left),b=pct(n.style.left),w=Math.max(pct(o.style.width),pct(n.style.width)),x0=Math.min(a,b),x1=Math.max(a,b)+w,top=1-Math.max(pct(o.style.bottom)+pct(o.style.height),pct(n.style.bottom)+pct(n.style.height));
   return zones.some(z=>z.y1>top&&x0<z.x1&&z.x0<x1&&!(a+pct(o.style.width)<=z.x0&&b+pct(n.style.width)<=z.x0)&&!(a>=z.x1&&b>=z.x1));};
  if(same)for(const n of news){const o=layer.querySelector(`${n.classList.contains('bk-actor')?'.bk-actor':'.bk-prop'}[data-id="${CSS.escape(n.dataset.id||'')}"]:not(.keeper-ready)`);if(!o)continue;
   if([n.style.left,n.style.width,n.style.bottom,n.style.height,o.style.left,o.style.width,o.style.bottom,o.style.height].every(v=>v.endsWith('%'))&&across(o,n)){
    o.style.transition='none';o.style.opacity='0';for(const k of ['left','width','height','bottom'])o.style[k]=n.style[k];
    o.animate([{opacity:0},{opacity:1}],{duration:320,delay:60,easing:'ease-out',fill:'forwards'}).finished.then(()=>{o.style.opacity='';},()=>{});continue;}
   o.style.transition='left .35s ease,bottom .35s ease,width .35s ease,height .35s ease';for(const k of ['left','width','height','bottom'])o.style[k]=n.style[k];}
  else{const talkingId=el.querySelector('.bk-actor.talking')?.dataset.id;layer.innerHTML=t.innerHTML;layer.querySelectorAll('.bk-actor,.bk-prop').forEach(a=>{a.style.animation='none';});
   for(const [id,pose] of Object.entries(poseNow))setPose(el,id,pose);if(talkingId)talking(talkingId);
   if(p.action?.kind==='kick'||p.beat?.kind==='kick-letter')placeKeeper(el,p,goalRect(p));}
  const fx=el.querySelector('.bk-fx:not(.burst)');if(fx&&p.scene.fx)fx.outerHTML=fxHTML(p.scene.fx);}
 let uiTimer=0;const uiWatch=new MutationObserver(recs=>{if(recs.every(r=>r.target.closest?.('.bk-layer')))return;clearTimeout(uiTimer);uiTimer=setTimeout(clearOfUI,150);});
 uiWatch.observe(view,{childList:true,subtree:true});
 function relayout(){const size=`${root.clientWidth}x${root.clientHeight}`;if(!alive||size===laidOut)return;laidOut=size;
  uiAvoid=null;uiBottom=0;setTimeout(clearOfUI,120);
  view.querySelectorAll('.bk-page.out').forEach(x=>x.remove());
  if(page<0||finished)return;
  const p=page_(),el=view.querySelector('.bk-page:last-child');if(!p||!el)return;
  paintBackground(el,backgroundFor(p));
  const st=stage(p,p.kind==='beat'),layer=el.querySelector('.bk-layer');
  if(layer){const talkingId=el.querySelector('.bk-actor.talking')?.dataset.id;
   layer.innerHTML=propsHTML(p.scene,{ground:st.ground,play:!!p.action||p.beat?.kind==='kick-letter'})+actorsHTML(p.scene,st);
   layer.querySelectorAll('.bk-actor,.bk-prop').forEach(a=>{a.style.animation='none';});
   for(const [id,pose] of Object.entries(poseNow))setPose(el,id,pose);if(talkingId)talking(talkingId);}
  // the sky moved with the people: the stars move with it
  const fx=el.querySelector('.bk-fx:not(.burst)');if(fx&&p.scene.fx)fx.outerHTML=fxHTML(p.scene.fx);
  const W=root.clientWidth,H=root.clientHeight;
  el.__table?.();el.__board?.();
  for(const b of el.querySelectorAll('.bk-ball')){if(b.dataset.held&&b.classList.contains('pulse')){const h=heldAt(el,W,H);Object.assign(b.style,{left:`${h.x-h.size/2}px`,top:`${h.y-h.size/2}px`,width:`${h.size}px`,height:`${h.size}px`});b.style.setProperty('--s',`${h.size}px`);continue;}
   const size=Number(b.dataset.fs)*Math.min(W,H),x=Number(b.dataset.fx)*W,y=Number(b.dataset.fy)*H;if(!Number.isFinite(size))continue;
   b.style.left=`${x-size/2}px`;b.style.top=`${y-size/2}px`;b.style.width=b.style.height=`${size}px`;b.style.setProperty('--s',`${size}px`);}
  // (a picture with its own goal drawn in has no goal frame, but its keeper still stands in that goal)
  if(p.action?.kind==='kick'||p.beat?.kind==='kick-letter'){const g=goalRect(p);
   // turned, the painted goal may come into view (no frame) or be cropped away (a frame stands in for it)
   if(g.drawn)el.querySelectorAll('.bk-goal').forEach(n=>n.remove());else if(!el.querySelector('.bk-goal'))goalFrame(el,g);
   for(const n of el.querySelectorAll('.bk-goal,.bk-net'))Object.assign(n.style,{left:`${g.x}px`,top:`${g.y}px`,width:`${g.w}px`,height:`${g.h}px`});
   if(!el.querySelector('.bk-actor.keeper'))placeKeeper(el,p,g);}
 }
 const onResize=()=>{clearTimeout(relayoutTimer);relayoutTimer=setTimeout(relayout,160);};
 addEventListener('resize',onResize);addEventListener('orientationchange',onResize);globalThis.visualViewport?.addEventListener('resize',onResize);
 function go(n,{back=false}={}){phonics.stop();
  if(!alive)return;globalThis.familyAudio?.stop();clearPond();clearTimers();stopSound();snd.cancel();setNext(false);
  if(adventure||branchy){const pages=route();if(back)n=pages.findLast(i=>i<=n)??pages[0];else n=pages.find(i=>i>=n)??ch.pages.length;}
  if(n>=ch.pages.length)return void ending();
  if(!preview&&page>=0&&page!==n)void post(player,{type:'dwell',date,page,ms:Date.now()-pageShownAt});pageShownAt=Date.now();tele=null;
  page=Math.max(0,n);if(!preview&&!back)void post(player,{type:'page',date,page});
  renderDots();shownAt=Date.now();phonics.stop();const my=++turn;intro=false;beatPrompt=null;poseNow={};laidOut=`${root.clientWidth}x${root.clientHeight}`;audit.push({page,shown:shownAt});
  const p=page_();preload(page);preload(page+1);
  if(p.kind==='beat')return void runBeat(p,my);
  const el=pageFrame(p);
  (async()=>{
   intro=true;const ok=await speakAll(p.say,my);if(my===turn)intro=false;if(!ok)return;
   if(p.choice)return void adventureChoice(el,p,my);
   if(p.action||p.magic)guard(my,()=>false,()=>event('book_rescue',p.action?.kind||'magic'));
   if(p.action){await act(el,p,my);if(my!==turn)return;}
   if(p.magic){await magic(el,p,my);if(my!==turn)return;}
   setNext(true);if(!globalThis.familyAudio?.blocked)later(()=>{if(my===turn&&canNext)go(page+1);},AUTO_ADVANCE_MS);
  })();
 }
 // Picture choices wait for a real tap. They are never rescued by choosing on his behalf.
 // He picked the somersault: his own picture rolls a full turn with a hop and a slide-whistle "wheee" (2026-10-02,
 function somersault(el){
  const me=el.querySelector(`.bk-actor[data-id="${CSS.escape(player)}"]`)||el.querySelector('.bk-actor:not([data-depth])');
  if(me&&!matchMedia('(prefers-reduced-motion: reduce)').matches){me.classList.remove('bk-roll');void me.offsetWidth;me.classList.add('bk-roll');setTimeout(()=>me.classList.remove('bk-roll'),1300);}
  try{const A=new (window.AudioContext||window.webkitAudioContext)(),t=A.currentTime,o=A.createOscillator(),g=A.createGain();o.type='sine';
   o.frequency.setValueAtTime(380,t);o.frequency.exponentialRampToValueAtTime(1500,t+.45);o.frequency.exponentialRampToValueAtTime(260,t+1.05);
   g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.22,t+.05);g.gain.setValueAtTime(0.22,t+.9);g.gain.exponentialRampToValueAtTime(0.0001,t+1.15);
   o.connect(g).connect(A.destination);o.start(t);o.stop(t+1.2);o.onended=()=>A.close();}catch{}
 }
 async function adventureChoice(el,p,my){
  const play=el.querySelector('.bk-play');play.classList.add('bk-adventure-choice');
  const prompt=document.createElement('h2');prompt.textContent=p.choice.prompt.shown||p.choice.prompt.text;play.append(prompt);
  const buttons=document.createElement('div');buttons.className='bk-route-buttons';play.append(buttons);
  for(const o of p.choice.options){const btn=document.createElement('button');btn.type='button';btn.className='bk-btn bk-route';btn.dataset.choice=o.id;
   const scenePic=art.backgrounds[o.picture],symbol=art.props[o.pictureProp]||art.actors[o.pictureActor]?.poses?.idle,pic=scenePic||symbol;btn.innerHTML=`${pic?`<img class="${symbol?'symbol':''}" src="${esc(pic.url)}" alt="">`:`<span class="pic">${esc(o.emoji)}</span>`}<span>${esc(o.label)}</span>`;
   if(routeChoices[p.node]&&routeChoices[p.node]!==o.id)btn.disabled=true;
   btn.onclick=async()=>{if(my!==turn)return;buttons.querySelectorAll('button').forEach(b=>b.disabled=true);
    if(!preview){const saved=await post(player,{type:'choice',date,page,node:p.node,option:o.id});if(!saved){btn.disabled=false;showWords('Tap your choice again to continue.',4000);return;}}
    routeChoices[p.node]=o.id;renderDots();if(o.act==='somersault'||/somersault|forward roll/i.test(o.label||''))somersault(el);await speak(o.reply);if(my!==turn)return;go(page+1);
   };buttons.append(btn);
  }
  clearOfUI();beatPrompt=[p.choice.prompt];await speak(p.choice.prompt);
 }
 // ---- he plays: actions that move the story; the narration reacts only after he acts ----
 function ballFreePose(id,pose){return ['kick','throw'].includes(pose)?(art.actors[id]?.poses.idle?'idle':keeperPose(id)):pose;}
 function setPose(el,id,pose){if(page_()?.action||page_()?.beat?.kind==='kick-letter')pose=ballFreePose(id,pose);const a=el.querySelector(`.bk-actor[data-id="${CSS.escape(id)}"]`),P=art.actors[id]?.poses[pose];if(a&&P){a.querySelector('img').src=P.url;a.dataset.pose=pose;poseNow[id]=pose;}return a;}
 // A rep's pose: his own painted strong pose (flex) when the library has one, else arms up (cheer).
 function repPose(id){const P=art.actors[id]?.poses||{};return ['flex','cheer'].find(k=>P[k])||null;}
 // Change a friend's pose where he stands: same height, same feet, same middle; only the width follows the new
 // drawing (a wider pose in the old box would shrink him).
 function poseInPlace(el,id,pose){const a=el.querySelector(`.bk-actor[data-id="${CSS.escape(id)}"]`),P=art.actors[id]?.poses[pose];if(!a||!P)return a;
  const W=root.clientWidth||innerWidth,r=a.getBoundingClientRect(),R=root.getBoundingClientRect(),h=r.height,w=h*P.ar,cx=r.left-R.left+r.width/2;
  if(h>0){a.style.width=`${(w/W*100).toFixed(2)}%`;a.style.left=`${((cx-w/2)/W*100).toFixed(2)}%`;}return setPose(el,id,pose);}
 function rectOf(node){const r=node.getBoundingClientRect(),R=root.getBoundingClientRect();return {x:r.left-R.left,y:r.top-R.top,w:r.width,h:r.height};}
 // Where the goal is on screen: the picture's own goal (fractions of the image, which is drawn "cover").
 // A picture without a painted goal gets a stand-in goal frame standing on the floor, up the field behind the ball,
 // sized for its keeper; it is never placed by guessed picture fractions and the picture is never zoomed for it
 // (2026-09-30: on the brain-room picture the frame hung on the back wall over the feelings faces, and the room grew
 // a quarter bigger around it while the friends stayed the same size).
 function goalRect(p,el=view.querySelector('.bk-page:last-child')){const BG=backgroundFor(p),painted=BG?.goal,img=el?.querySelector('.bk-bg');
  const W=root.clientWidth,H=root.clientHeight;
  const kid=el?.querySelector(`.bk-actor[data-id="${CSS.escape(player)}"]`),kidH=kid?(kid.style.height.endsWith('%')?parseFloat(kid.style.height)*H/100:parseFloat(kid.style.height)):0;
  // Big enough for its keeper at his own height (the family's relative heights, a little smaller for being up the
  // field) and readable next to the boy.
  const depth=keeperDepth(p),minH=Math.max(kidH*0.68,keeperHeight(el,p)*depth)/0.9;
  // Story and kick-letter goals share a mid-field ground line, behind the ball and letter controls.
  const story=p.kind!=='beat',far=standInDepth(stage(p,false).ground);
  const standIn=()=>{const st=stage(p,!story);let h,w,foot;
   ({h,w}=standInSize(keeperHeight(el,p),W,H,{scale:far.scale}));foot=Math.min(far.foot,st.ground-Math.max(0.1,1.4*actionBall(W,H)/H))*H;
   // A tall screen has no room beside the goal: it stands further up the same ground, above the friends' heads.
   // (only friends standing in the goal's column: one beside it may stand in front of a post)
   if(W<=H*1.05){const kp=keeperFor(el,p),pc=v=>parseFloat(v)/100,placed=[...(el?.querySelectorAll('.bk-actor')||[])].filter(a=>a.dataset.id!==kp&&[a.style.left,a.style.width,a.style.bottom,a.style.height].every(v=>v.endsWith('%')));
    // a friend standing beside it at the same height: the goal is narrower, so its net never covers him
    const narrow=()=>{for(const a of placed){const l=pc(a.style.left)*W,r=l+pc(a.style.width)*W,top=H*(1-pc(a.style.bottom)-pc(a.style.height)),bot=H*(1-pc(a.style.bottom));
     if(top<foot&&bot>foot-h){const gap=l>W/2?l-W/2:W/2-r;if(gap>0&&gap<w/2)w=Math.max(W*0.3,2*gap-W*0.03);}}};
    // (narrowed first: a friend beside the narrower goal is not in its column, and does not send it up the field;
    // (someone in the narrower goal's column: it stands up the field above the heads in its full column, as before)
    const w0=w,inColumn=()=>placed.filter(a=>Math.abs((pc(a.style.left)+pc(a.style.width)/2)*W-W/2)<w/2).map(a=>H*(1-pc(a.style.bottom)-pc(a.style.height)));
    narrow();if(inColumn().length){w=w0;const tops=inColumn();foot=Math.min(foot,Math.min(...tops)-H*0.02);narrow();}}
   return {x:(W-w)/2,y:foot-h,w,h,drawn:false};};
  let r;
  if(!painted)r=standIn();
  else{const nw=img?.naturalWidth||1600,nh=img?.naturalHeight||1067,k=Math.max(W/nw,H/nh),dw=nw*k,dh=nh*k;
   r={...foregroundRect(BG,painted,{width:W,height:H,nw,nh}),drawn:true};
   // A painted goal cropped away on a tall screen: the stand-in frame instead.
   if(r.x<0||r.x+r.w>W)r=standIn();
   // Bring the painted goal nearer with its keeper. Fix the background during play so its mouth never drifts.
   else{const zoom=1,cx=r.x+r.w/2,foot=r.y+r.h;
    if(img){img.style.animation='none';img.style.translate='none';img.style.transformOrigin=`${cx}px ${foot}px`;img.style.transform=`scale(${zoom})`;}
    r.x=cx-r.w*zoom/2;r.y=foot-r.h*zoom;r.w*=zoom;r.h*=zoom;}}
  if(el)el.dataset.goal=JSON.stringify(r);return r;}
 // ---- a game's things in the picture: DRAWN, resting on the ground, never over a friend ----
 // (2026-09-29: plates drawn as plain white circles and an emoji drumstick floated over Mom.) What he counts, the
 // plates and the basket are library pictures (book-scene.mjs beatProps). On a wide screen they rest on the friends'
 // ground line in the column the friends step out of (stage: TABLE_BAND), rows behind a little higher and smaller (further
 // back on the grass); on a tall screen they rest on the grass just in front of the friends' feet, across the width.
 // (a chapter written before 2026-09-29 names its things by emoji: the household library's drawings stand in)
 const LIB_THINGS={plate:1.325,'snack-basket':0.81,'chicken-nugget':0.753,cookie:0.962,grape:0.775,'pizza-slice':0.832,star:0.922};
 const drawn=id=>{const k=art.props[id]?id:THING_PROPS[id]||id;return art.props[k]||(LIB_THINGS[k]?{url:`/book-art/props/${k}.webp`,ar:LIB_THINGS[k]}:null)||Object.values(art.props).find(P=>P&&P.url)||{url:'',ar:1};};
 // shrink: how small the things may get (a share of their first size) to stay in ONE row before a second row starts;
 // the plates of a share stay side by side (2026-10-01: three plates of cookies stood one behind the other, hiding
 // what was on them).
 function table(el,{shrink=1}={}){const tb=document.createElement('div');tb.className='bk-table';el.append(tb);let items=[];
  const lay=()=>{const W=root.clientWidth,H=root.clientHeight,wide=W>H*1.05,st=stage(page_(),true),feet=st.ground*H,[a,b]=wide?TABLE_BAND:[0.04,0.96],bw=(b-a)*W;
   if(adventure&&['count','share','remainder'].includes(page_()?.beat?.kind)){const boxes=countLayout(items.length,{width:W,height:H,kind:page_()?.beat?.kind});items.forEach((i,k)=>Object.assign(i.node.style,{left:boxes[k].left+'px',top:boxes[k].top+'px',width:boxes[k].width+'px',height:boxes[k].height+'px',zIndex:'20'}));return;}
   const gap=0.12,unit=i=>(i.real||i.scale||1)*Math.max(1,(i.P?.ar||1)),n=items.length;
   let s=Math.min(W,H)*(wide?0.13:0.12),cols,rows;
   // Props with relative-size metadata are drawn at that scale beside actors
   // on this page, at the same scale as they are drawn (never blown up to a pizza's size).
   if(items.some(i=>i.P?.rel>0)){const p=page_();let U=0;try{U=composeScene(p.scene,art,{width:W,height:H,ground:st.ground,maxHeight:st.maxHeight,avoid:st.avoid,beat:true,keepOut:st.keepOut}).unit;}catch{}
    U=U||sceneUnit({width:W,height:H,maxHeight:st.maxHeight});for(const i of items)if(i.P?.rel>0)i.real=i.P.rel*U/s;}
   const s0=s;for(;;){cols=1;let w=0;for(const i of items){w+=unit(i)*s*(1+gap);}rows=Math.max(1,Math.ceil(w/bw));cols=Math.ceil(n/rows);if((rows<=(wide?3:2)&&(rows===1||s<=s0*shrink))||s<=40)break;s*=0.92;}
   let k=0;for(let r=0;r<rows;r++){const row=items.slice(k,k+cols);k+=cols;const sr=wide?s*(1-0.1*r):s*(1+0.08*r);
    const ws=row.map(i=>unit(i)*sr),total=ws.reduce((x,y)=>x+y,0)+gap*sr*(row.length-1);let x=(a+b)/2*W-total/2;
    // wide: back rows higher on the grass; tall: rows toward the viewer, below the feet (never over anyone)
    // Every back-row centre stays exposed for a real tap, even with thirteen counted objects.
    const bottom=wide?feet-r*sr*0.85:Math.min(H*.99,feet+H*0.02+(r+1)*sr*1.02);
    row.forEach((i,j)=>{const ar=i.P?.ar||1,w=ws[j],h=ar>=1?w/ar:sr*(i.real||i.scale||1),iw=ar>=1?w:h*ar;Object.assign(i.node.style,{left:`${x+(w-iw)/2}px`,top:`${bottom-h}px`,width:`${iw}px`,height:`${h}px`,zIndex:String(wide?20-r:20+r)});x+=w+gap*sr;});}};
  el.__table=lay;
  return {set(list){items=list;tb.replaceChildren(...list.map(i=>i.node));lay();},lay};}
 function ballEl(el,{x,y,size,label}){const B=art.props.ball;const b=document.createElement('button');b.type='button';b.className='bk-ball';b.style.cssText=`left:${x-size/2}px;top:${y-size/2}px;width:${size}px;height:${size}px;--s:${size}px`;
  b.innerHTML=`${B?`<img src="${esc(B.url)}" alt="">`:'<span>⚽</span>'}${label?`<b>${esc(label)}</b>`:''}`;b.dataset.fx=x/(root.clientWidth||1);b.dataset.fy=y/(root.clientHeight||1);b.dataset.fs=size/Math.max(1,Math.min(root.clientWidth,root.clientHeight));el.append(b);return b;}
 function flyTo(node,to,{ms=700,spin=720,scale=0.4,arc=0}={}){node.classList.add('flying');const f=rectOf(node),dx=to.x-(f.x+f.w/2),dy=to.y-(f.y+f.h/2);
  const anim=node.animate([{transform:'translate(0,0) rotate(0) scale(1)'},{transform:`translate(${dx/2}px,${dy/2-arc}px) rotate(${spin/2}deg) scale(${(1+scale)/2})`,offset:.5},{transform:`translate(${dx}px,${dy}px) rotate(${spin}deg) scale(${scale})`}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:ms,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});return anim.finished.catch(()=>{});}
 // Swipe or tap: resolves with the point he aimed at (a tap on the ball aims at the middle of the goal).
 function flick(node,my){return new Promise(res=>{let s=null;node.onpointerdown=e=>{s={x:e.clientX,y:e.clientY};node.setPointerCapture?.(e.pointerId);};
  node.onpointerup=e=>{if(my!==turn)return;const R=root.getBoundingClientRect();const d=s?{x:e.clientX-s.x,y:e.clientY-s.y}:{x:0,y:0};node.onpointerdown=node.onpointerup=null;res({dx:d.x,dy:d.y,x:e.clientX-R.left,y:e.clientY-R.top});};});}
 // The keeper is whoever the page's words put in goal ("Kick past these hands!" said by Dad, "Past Dad's hands!"):
 // 2026-10-02 the words said Dad and Birdie stood in goal. Otherwise a friend who can dive, else not Dad.
 function keeperFor(el,p){const ids=p.scene.actors.map(a=>a.id).filter(id=>id!==player);
  const named=keeperNamed(p,ids);if(named)return named;
  return ids.find(id=>art.actors[id]?.poses.dive)||ids.find(id=>id!=='dad')||ids[0];}
 function keeperNamed(p,ids){const lines=[...(p.say||[]),...(p.action?.after||[]),...(p.beat?.done?[p.beat.done]:[])].map(l=>Array.isArray(l)?{who:l[0],text:l[1]}:l||{});
  const goalie=/\b(hands?|gloves?|goal|keeper|save[sd]?|dives?|blocks?)\b/i,names=id=>[id==='dad'?'Dad':id==='mom'?'Mom':null,...(ch.cast||[]).filter(c=>c.id===id).map(c=>c.name),id].filter(Boolean);
  for(const l of lines){const t=String(l.text||'');if(!goalie.test(t))continue;
   const hit=ids.find(id=>names(id).some(n=>new RegExp(`\\b${String(n).split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:'s)?\\b`,'i').test(t)));if(hit)return hit;
   if(/\b(these|my) (hands?|gloves?)\b/i.test(t)&&ids.includes(l.who))return l.who;}
  return null;}
 function keeperPose(id){const poses=art.actors[id]?.poses||{};return ['idle','ready','happy'].find(p=>poses[p])||Object.keys(poses).find(p=>p!=='dive');}
 // The keeper keeps his own height: the layout's, from the family's relative heights. He is never resized to fill a
 // Story and activity keepers share the same field perspective.
 function keeperDepth(p,standIn=false){return standIn?standInDepth().scale:0.85;}
 function keeperHeight(el,p){const kp=keeperFor(el,p),k=kp&&el?.querySelector(`.bk-actor[data-id="${CSS.escape(kp)}"]`),H=root.clientHeight;if(!k)return 0;
  if(k.style.height.endsWith('%'))k.dataset.lh=String(parseFloat(k.style.height)/100);
  const f=Number(k.dataset.lh);return f>0?f*H:parseFloat(k.style.height)||0;}
 // The keeper stands in the goal, ready (a friend who can dive, else any friend but Dad).
 function placeKeeper(el,p,g){const kp=keeperFor(el,p),k=kp&&el.querySelector(`.bk-actor[data-id="${CSS.escape(kp)}"]`);if(!k)return;
  const own=keeperHeight(el,p);
  k.getAnimations().forEach(a=>a.cancel());k.classList.remove('keeper','hop');
  setPose(el,kp,keeperPose(kp));const P=art.actors[kp].poses[k.dataset.pose];
  // His own height (a little smaller up the field), feet on the goal line; only a goal too small for him, e.g. a far
  // painted one, makes him smaller.
  const h=Math.min(own?own*keeperDepth(p,!g.drawn):g.h*0.9,g.h*0.9,g.w*0.7/P.ar),w=h*P.ar,H=root.clientHeight;
  k.style.cssText+=`;left:${g.x+g.w/2-w/2}px;width:${w}px;height:${h}px;bottom:${H-(g.y+g.h)}px;animation:none`;k.classList.add('keeper-ready');
  // the keeper stands up in the field, maybe in the sky band: no star over him
  const kx=g.x+g.w/2-w/2,ky=g.y+g.h-h;for(const i of el.querySelectorAll('.bk-fx:not(.burst) i'))if(i.offsetLeft<kx+w&&kx<i.offsetLeft+i.offsetWidth&&i.offsetTop<ky+h&&ky<i.offsetTop+i.offsetHeight)i.remove();}
 function goalFrame(el,g){if(g.drawn){el.querySelector('.bk-goal')?.remove();return;}const frame=el.querySelector('.bk-goal');if(frame){Object.assign(frame.style,{left:`${g.x}px`,top:`${g.y}px`,width:`${g.w}px`,height:`${g.h}px`});return;}// behind the friends: the keeper stands in front of his net, not inside a mesh drawn over him
  (el.querySelector('.bk-actor')?.parentElement||el).insertAdjacentHTML('afterbegin',`<div class="bk-goal" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"></div>`);}
 // A dive picture is wide: stretched out he is about as long as he is tall standing, so his box becomes that long
 // (in his standing box the dive was drawn at less than half his size), centred in the goal, inside its mouth.
 function diveBox(k,id,g){const D=art.actors[id]?.poses[k.dataset.pose];if(!D?.ar)return;const stand=parseFloat(k.style.height)||k.getBoundingClientRect().height;
  let w=Math.min(g.w*0.95,stand*1.1),h=w/D.ar;if(h>g.h*0.95){h=g.h*0.95;w=h*D.ar;}
  Object.assign(k.style,{width:`${w}px`,height:`${h}px`,left:`${g.x+g.w/2-w/2}px`});}
 async function shoot(el,p,my,ball,aim,{quiet=false}={}){
  const g=goalRect(p),keeperId=keeperFor(el,p),kp=keeperId&&el.querySelector(`.bk-actor[data-id="${CSS.escape(keeperId)}"]`);
  setPose(el,player,'kick');
  const side=aim&&Math.abs(aim.dx)>30?Math.sign(aim.dx):(Math.random()<.5?-1:1),tx=g.x+g.w/2+side*g.w*0.28,ty=g.y+g.h*0.55;
  // The keeper dives inside his goal: a short leap (a fifth of his own width, with a tilt; stage() keeps that much room clear beside him), never across the picture onto
  el.dataset.shot='taken';
  if(kp){kp.classList.add('keeper');setPose(el,keeperId,'dive');diveBox(kp,keeperId,g);const reach=Math.min(g.w*0.35,kp.getBoundingClientRect().width*0.2);kp.animate([{transform:'translateX(0) rotate(0)'},{transform:`translateX(${-side*reach}px) rotate(${-side*20}deg)`}],{duration:550,fill:'forwards',easing:'ease-out'});}
  await flyTo(ball,{x:tx,y:ty},{ms:650,scale:0.35,arc:40});if(my!==turn)return;
  el.insertAdjacentHTML('beforeend',`<div class="bk-net" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"></div><div class="bk-goaltext">GOAL!</div>`);
  if(kp)placeKeeper(el,p,g);
  burst('confetti');setPose(el,player,'cheer');for(const a of p.scene.actors)if(a.id!==keeperId)setPose(el,a.id,art.actors[a.id]?.poses.cheer?'cheer':art.actors[a.id]?.poses.happy?'happy':a.pose);
  if(!quiet)await speak(ch.ui.goal);
 }
 // where the ball waits to be thrown: in his hands (the middle of his picture), a third of his height across
 function heldAt(el,W,H){const me=el.querySelector(`.bk-actor[data-id="${CSS.escape(player)}"]`);const r=me?rectOf(me.querySelector('img')||me):{x:W*THROW_X-20,y:H*0.6,w:40,h:H*0.3};
  const size=Math.max(44,Math.min(actionBall(W,H)*0.7,r.h*0.34));return {x:r.x+r.w/2,y:r.y+r.h*0.52,size};}
 async function act(el,p,my){
  const a=p.action,W=root.clientWidth,H=root.clientHeight,size=actionBall(W,H),started=Date.now();
  if(a.kind==='kick'){
   const g=goalRect(p);goalFrame(el,g);placeKeeper(el,p,g);
   // the ball rests on the grass, on the friends' ground line (never hanging in the air)
   const ball=ballEl(el,{x:W/2,y:Math.min(H*0.9,stage(p,false).ground*H-size*0.5),size});ball.classList.add('pulse');
   const aim=await flick(ball,my);if(my!==turn)return;ball.classList.remove('pulse');
   await shoot(el,p,my,ball,aim,{quiet:saysGoal(a.after)});
  }else if(a.kind==='throw'){
   const fetcher=a.fetcher||p.scene.actors.map(x=>x.id).find(id=>id!==player&&id!=='dad');const f=fetcher&&el.querySelector(`.bk-actor[data-id="${CSS.escape(fetcher)}"]`);
   // the ball waits in his hands (never floating in the air): flick it to throw
   const hold=heldAt(el,W,H),ball=ballEl(el,{x:hold.x,y:hold.y,size:hold.size});ball.dataset.throw='1';ball.dataset.held=player;ball.classList.add('pulse');
   const aim=await flick(ball,my);if(my!==turn)return;ball.classList.remove('pulse');setPose(el,player,'throw');void speak(ch.ui.fetch);
   // The ball flies to the friend who fetches it, into his hands where he stands (2026-09-29: running across the
   // picture to the ball put him over Mom and left him there).
   const fr=f?rectOf(f):null,to=fr?{x:fr.x+fr.w/2,y:fr.y+fr.h*0.45}:{x:Math.min(W*0.9,Math.max(W*0.55,W*0.75+aim.dx*0.3)),y:H*0.8};
   await flyTo(ball,to,{ms:900,scale:0.6,arc:H*0.35,spin:540});if(my!==turn)return;
   if(f){ball.remove();setPose(el,fetcher,art.actors[fetcher].poses.happy?'happy':'idle');f.classList.add('hop');}
   burst('hearts');setPose(el,player,'cheer');
  }else if(a.kind==='drive'){
   const lever=document.createElement('button');lever.type='button';lever.className='bk-btn go';lever.textContent='Off we go';el.append(lever);
   await new Promise(res=>{lever.onclick=()=>{lever.remove();res();};});if(my!==turn)return;void speak(ch.ui.go);
   const train=el.querySelectorAll('.bk-prop.train, .bk-layer > .bk-actor');const dx=W*0.9;
   el.insertAdjacentHTML('beforeend','<div class="bk-puffs"><i></i><i></i><i></i></div>');
   // A painted object ahead of the train (a keep-out zone it could not stand clear of): it fades away before it gets
   // there, never drives across it. (The offsets are in the animation's progress, which is also the distance covered.)
   const R=root.getBoundingClientRect(),zones=stage(p,false).keepOut,tn=el.querySelector('.bk-prop.train'),tb=tn&&[tn,...tn.querySelectorAll('.bk-actor.rider img')].map(n=>n.getBoundingClientRect()).reduce((a,r)=>({top:Math.min(a.top,r.top),bottom:Math.max(a.bottom,r.bottom),right:Math.max(a.right,r.right)})),
    ahead=tb?zones.filter(z=>z.y1*H>tb.top-R.top&&z.y0*H<tb.bottom-R.top&&z.x0*W>=tb.right-R.left-1).map(z=>z.x0*W-(tb.right-R.left)):[],
    fadeAt=ahead.length?Math.max(0.05,Math.min(1,Math.max(0,Math.min(...ahead))/dx)):null;
   const frames=fadeAt==null?[{translate:'0 0'},{translate:`${dx}px 0`}]:[{translate:'0 0',opacity:1},{opacity:1,offset:Math.max(0,fadeAt-0.18)},{opacity:0,offset:fadeAt},{translate:`${dx}px 0`,opacity:0}];
   await Promise.all([...train].map(n=>n.animate(frames,{duration:2600,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{})));
  }
  if(my!==turn)return;if(!preview)event('book_action',`${a.kind}:${Date.now()-started}`);
  await speakAll(a.after,my);
 }
 // ---- telemetry: what he did on each beat (taps with time and correctness, hints, replays, the microphone) ----
 let tele=null,pageShownAt=Date.now();
 function teleStart(kind,{target=null,options=null}={}){tele={kind,target:target==null?null:String(target).slice(0,24),options:options?options.map(String).slice(0,8):null,shownAt:Date.now(),firstTap:null,taps:[],hint:0,replays:0,mic:[]};}
 function teleTap(v,ok){if(!tele)return;const t=Date.now()-(tele.readyAt||tele.shownAt);if(tele.firstTap==null)tele.firstTap=t;tele.taps.push([String(v).slice(0,12),ok?1:0,t]);if(tele.taps.length>40)tele.taps.shift();}
 function teleHint(l){if(tele)tele.hint=Math.max(tele.hint,l);}
 function teleOut(){if(!tele)return null;const d={target:tele.target,options:tele.options,taps:tele.taps,firstTap:tele.firstTap,hint:tele.hint,replays:tele.replays,mic:tele.mic};tele=null;return d;}
 // Per beat, for grown-ups: how many tries, whether the first was right, and how fast (under 1.5 s after the
 // choices appear is a guess, not reading).
 const GUESS_MS=1500;const teleSummary=d=>d&&d.taps.length?{attempts:d.taps.length,correct:d.taps[0][1]===1,firstTapMs:d.firstTap,guess:d.firstTap!=null&&d.firstTap<GUESS_MS}:{};
 // ---- trace the letter: he draws over the big letter with a finger; most of its ink touched = drawn ----
 // (never stuck: three taps without tracing, or the nudges running out, also move on)
 // While drawing, 60% of the letter's ink touched is drawn; when the finger (or mouse) lifts, half is enough: the shape
 // was made, not coloured in (guided tracing, never a perfection check).
// finish mid-stroke at 60% covered. Now nearly the whole letter, every part of it,; the reach stays a child's finger wide.)
const TRACE_LIFT=0.8,TRACE_LIVE=0.97,TRACE_LIVE_PART=0.85,TRACE_LIFT_PART=0.75;
 function traceLetter(g,letter,my){return new Promise(res=>{
  const tn=g.firstChild,range=document.createRange();range.setStart(tn,0);range.setEnd(tn,1);const cr=range.getBoundingClientRect(),R=root.getBoundingClientRect(),gr=g.getBoundingClientRect();
  const W=Math.max(40,Math.round(gr.width)),H=Math.max(40,Math.round(gr.height)),cv=document.createElement('canvas');cv.className='bk-trace';cv.width=W;cv.height=H;
  cv.style.cssText=`left:${gr.left-R.left}px;top:${gr.top-R.top}px;width:${W}px;height:${H}px`;root.querySelector('.bk-page:last-child')?.append(cv);
  const off=document.createElement('canvas');off.width=W;off.height=H;const o=off.getContext('2d'),cs=getComputedStyle(g);
  // The ink he must cover is the letter he SEES: drawn on its real baseline (read from the page), never from the text
  // box's top. A canvas "top" baseline is the font's em box, not the line box: with this font on a wide screen the
  // reference letter sat ~40 px above the visible one and a careful trace of the visible B never reached 60%
  // (2026-09-30: on the computer his B was never accepted and the page moved on only after the reminders ran out).
  const probe=document.createElement('span');probe.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';tn.after(probe);const baseY=probe.getBoundingClientRect().top;probe.remove();
  o.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;o.textBaseline='alphabetic';o.lineWidth=10;o.fillText(letter,cr.left-gr.left,baseY-gr.top);o.strokeText(letter,cr.left-gr.left,baseY-gr.top);
  const px=o.getImageData(0,0,W,H).data,step=Math.max(8,Math.round(Math.min(W,H)/18)),cells=[];
  for(let y=step/2;y<H;y+=step)for(let x=step/2;x<W;x+=step)if(px[(Math.floor(y)*W+Math.floor(x))*4+3]>60)cells.push({x,y,hit:false});
  const c=cv.getContext('2d');c.fillStyle='rgba(255,226,122,.9)';let down=false,taps=0,done=false,moved=0,n=0;
  const finish=()=>{if(done)return;done=true;cv.remove();res();};
  const at=e=>{const b=cv.getBoundingClientRect();return {x:(e.clientX-b.left)*W/b.width,y:(e.clientY-b.top)*H/b.height};};
  cv.onpointerdown=e=>{if(my!==turn)return finish();down=true;moved=0;cv.setPointerCapture?.(e.pointerId);if(tele&&tele.firstTap==null)tele.firstTap=Date.now()-tele.shownAt;};
  const t0=performance.now();let strokes=0;
  const accept=()=>{if(done)return;teleTap('trace',true);if(tele)tele.trace={ms:Math.round(performance.now()-t0),strokes:Math.max(1,strokes)};g.classList.remove('bk-nudge');g.classList.add('traced');g.dataset.tracedAt=String(performance.now());burst('sparkles');void speak(calm?.pages?.[page]?.praise||ch.ui.traced);finish();};
  cv.onpointermove=e=>{if(!down||done)return;const p=at(e);c.beginPath();c.arc(p.x,p.y,step*.55,0,Math.PI*2);c.fill();moved++;
   for(const k of cells)if(!k.hit&&Math.hypot(k.x-p.x,k.y-p.y)<step*1.1){k.hit=true;n++;}
   if(traceDone(cells,TRACE_LIVE,TRACE_LIVE_PART))accept();};
  cv.onpointerup=()=>{down=false;if(moved>=3)strokes++;if(traceDone(cells,TRACE_LIFT,TRACE_LIFT_PART))return accept();if(moved<3&&++taps>=3){teleTap('trace-tap',false);finish();}};
  void speak(ch.ui.traceIt);let reps=0;const nudge=()=>later(()=>{if(done||my!==turn)return finish();if(reps++>=IDLE_REPEATS){teleHint(1);return finish();}void speak(ch.ui.traceIt);nudge();},IDLE_REPEAT_MS);nudge();
  if(!cells.length)finish();
 });}
 // ---- say it aloud (push-to-talk) ----
 // Tap the word (or the letter), say it, and the world responds. One miss: the word glows and the narrator says it
 // (warm help, once); then whatever he says counts (he is echoing her). Never a scolding, never three tries.
 // No recogniser, or the microphone blocked: the tap itself counts (and a blocked microphone shows a card once).
 const micUsable=()=>canListen&&!micState().blocked;let cardShown=false;
 function micCard(why){
  cardShown=true;const c=document.createElement('div');c.className='bk-card';
  const head=why==='no-mic'?"There's no microphone here.":why==='insecure'?'The microphone needs the secure address.':'Ask a grown-up to turn on the microphone.';
  c.innerHTML=`<div class="bk-card-in"><div class="bk-card-mic">🎤</div><h2>${esc(head)}</h2>
   <p class="grown">For grown-ups: in Chrome tap the icon left of the address, then <b>Permissions → Microphone → Allow</b> (or ⋮ → Settings → Site settings → Microphone). In the installed app: long-press its icon → <b>App info → Permissions → Microphone → Allow</b>. On a Chromebook: the icon in the address bar, or Settings → Privacy and security → Site settings → Microphone. Everything he says stays on this home computer and is never recorded.</p>
   <div class="bk-card-btns"><button class="bk-btn" type="button" data-a="tap">Tap instead 👆</button><button class="bk-btn" type="button" data-a="retry">Try again 🎤</button></div></div>`;
  view.querySelector('.bk-page:last-child')?.append(c);if(why!=='insecure'&&why!=='no-mic')void speak(ch.ui.askGrownUp);
  return new Promise(res=>c.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();c.remove();res(b.dataset.a);}));
 }
 function sayIt(btn,{target,kind,my,help=[],onDone}){
  let attempts=0,misses=0,busy=false,done=false,quiet=0;
  const badge=document.createElement('span');badge.className='bk-mic-badge';badge.setAttribute('aria-hidden','true');btn.append(badge);
  const tapAnswer=document.createElement('button');tapAnswer.type='button';tapAnswer.className='bk-tap-answer bk-btn';tapAnswer.textContent='👆 ✓';tapAnswer.setAttribute('aria-label','Answer by tap');tapAnswer.dataset.speechTap='true';btn.insertAdjacentElement('afterend',tapAnswer);tapAnswer.onclick=e=>{e.stopPropagation();if(!done&&my===turn){stopSound();finish('tap');}};
  // With a microphone: 🎤. Without one (or when it cannot be used): 👆, tapping the letter is the way on.
  const paint=()=>{badge.textContent=micUsable()?'🎤':'👆';};paint();const paintTimer=setInterval(()=>{if(!alive||done)clearInterval(paintTimer);else paint();},1000);
  const finish=via=>{done=true;clearInterval(paintTimer);badge.remove();tapAnswer.remove();btn.classList.remove('listening','thinking');onDone({via,misses,attempts});};
  btn.onclick=e=>{e?.stopPropagation?.();if(done||busy||my!==turn)return;
   if(!micUsable()){
    if(canListen&&micState().blocked&&!cardShown){void micCard(micState().why).then(a=>{if(a==='tap'&&my===turn)finish('tap');});return;}
    return finish('tap');}
   busy=true;stopSound();attempts++;btn.classList.add('listening');
   // Called inside the tap: this is when the browser shows its permission prompt the first time.
   listenOnce({onLevel:v=>btn.style.setProperty('--lvl',v.toFixed(2))}).then(async({pcm,speech})=>{
    btn.classList.remove('listening');if(my!==turn||done)return void(busy=false);
    // Nothing heard twice: the microphone is not working well here; the tap counts.
    if(!speech){busy=false;if(++quiet>=2)return finish('tap');await speak(ch.ui.listenNothing);return;}
    btn.classList.add('thinking');let r=null;try{r=await recognise({player,target,kind,attempt:attempts,preview,pcm});}catch{}
    btn.classList.remove('thinking');busy=false;if(my!==turn||done)return;
    if(preview&&r){el_heard(btn,r);}
    // If the recogniser is having a bad moment, he is never stuck: it counts.
    if(tele)tele.mic.push([r?.match?1:-1,r&&!r.match?'uncertain':String(r?.how||'').slice(0,10),r?.ms||0]);
    if(!r)return finish('tap');
    if(r.match)return finish('voice');
    // Recognition uncertainty gives help, never a wrong answer. The tap remains available.
    btn.classList.add('glow');await speakAll(help,turn,{again:true});
   },async err=>{btn.classList.remove('listening');busy=false;paint();if(my!==turn||done)return;
    const a=await micCard(micState().why||(err?.name==='NotFoundError'?'no-mic':'denied'));paint();if(a==='tap'&&my===turn)finish('tap');});
  };
  return {nudge:()=>micUsable()&&!done};
 }
 // Grown-ups' preview: show what the recogniser heard, to try it out.
 function el_heard(btn,r){const b=document.createElement('div');b.className='bk-heard';b.textContent=`heard: “${r.heard||'…'}” ${r.match?'✓':'✗'} (${r.ms} ms)`;btn.parentElement?.append(b);setTimeout(()=>b.remove(),4000);}
 // The word card never covers what the page is about (2026-10-02: it sat on the chessboard): it takes the first place,
 // sky first, that clears the picture's painted objects (its keep-out zones) and everyone's faces.
 function placeMagic(el,btn,p){
  const E=el.getBoundingClientRect(),b=btn.getBoundingClientRect(),W=E.width||root.clientWidth||innerWidth,H=E.height||root.clientHeight||innerHeight;if(!b.width||!b.height)return;
  const zones=zonesOnScreen(backgroundFor(p),{width:W,height:H,top:TOP_ANCHORED.has(p.scene.bg),still:true}).map(z=>({x0:z.x0*W,x1:z.x1*W,y0:z.y0*H,y1:z.y1*H}));
  const faces=[...el.querySelectorAll('.bk-actor')].map(a=>{const r=a.getBoundingClientRect();return {x0:r.left-E.left,x1:r.right-E.left,y0:r.top-E.top,y1:r.top-E.top+r.height*.45};});
  // (a big painted object may leave no clear place: then the place that covers the least of it and of the faces)
  const covered=(x,y)=>[...zones,...faces].reduce((t,z)=>t+Math.max(0,Math.min(x+b.width,z.x1)-Math.max(x,z.x0))*Math.max(0,Math.min(y+b.height,z.y1)-Math.max(y,z.y0)),0);
  let best=null;for(const y of [Math.max(56,.05*H),.14*H,.24*H,.34*H])for(const c of [.5,.22,.78]){const x=Math.max(8,Math.min(W-b.width-8,c*W-b.width/2)),v=covered(x,y);
   if(!best||v<best.v-1){best={x,y,v,c};if(!v)break;}}
  // (anchored on its own side, so a card that grows once its tap badge is added grows inward, never off the screen)
  if(best&&(best.c!==.5||best.y!==.14*H))Object.assign(btn.style,best.c<.5?{left:best.x+'px',right:'auto',top:best.y+'px',translate:'0 0'}:best.c>.5?{left:'auto',right:(W-best.x-b.width)+'px',top:best.y+'px',translate:'0 0'}:{top:best.y+'px'});
 }

 // that swing open in 3D after every key has flown from the key bar into the door; warm light, then the presents.
 function gateOpen(el,p){
  const BG=backgroundFor(p),door=BG?.door,img=el.querySelector('.bk-bg');if(!door||!img)return;
  const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight,R=backgroundRect(BG,{width:W,height:H,nw:img.naturalWidth||1536,nh:img.naturalHeight||1024});
  const d={x:R.x+door[0]*R.w,y:R.y+door[1]*R.h,w:door[2]*R.w,h:door[3]*R.h};
  const g=document.createElement('div');g.className='bk-gate';Object.assign(g.style,{left:d.x+'px',top:d.y+'px',width:d.w+'px',height:d.h+'px'});
  const half=side=>`<div class="bk-door ${side}" style="background-image:url('${img.src}');background-size:${R.w}px ${R.h}px;background-position:${-(d.x-R.x)-(side==='r'?d.w/2:0)}px ${-(d.y-R.y)}px"></div>`;
  const P=art.props?.[p.gateReveal||(art.props?.['treasure-chest']?'treasure-chest':'presents')];
  g.innerHTML=`<div class="bk-gate-in">${P?`<img class="bk-gate-gift" src="${esc(P.url)}" alt="">`:''}</div>${half('l')}${half('r')}`;
  const layer=el.querySelector('.bk-layer');if(layer)layer.before(g);else el.append(g);
  const E=el.getBoundingClientRect(),bar=root.querySelector('.bk-keys')?.getBoundingClientRect(),from={x:(bar&&bar.width?bar.left+bar.width/2:W-60)-E.left,y:(bar&&bar.height?bar.top+bar.height/2:40)-E.top};
  const N=Math.max(1,Number(p.gateKeys)||7);let i=0;
  const open=()=>{el.querySelectorAll('.bk-gate-key').forEach(k=>k.classList.add('gone'));g.classList.add('open');setTimeout(()=>{if(el.isConnected){burst('confetti');cheer();}},1100);};
  const fly=()=>{if(!el.isConnected)return;if(i>=N){setTimeout(open,450);return;}const t=(i+.5)/N,k=document.createElement('div');k.className='bk-gate-key';k.textContent='\u{1F5DD}️';
   const to={x:d.x+d.w*(.18+.64*t),y:d.y+d.h*(.62-.1*Math.sin(Math.PI*t))};Object.assign(k.style,{left:from.x+'px',top:from.y+'px'});el.append(k);
   requestAnimationFrame(()=>requestAnimationFrame(()=>{k.style.transform=`translate(${to.x-from.x}px,${to.y-from.y}px) translate(-50%,-50%) rotate(${-25+50*t}deg)`;}));
   setTimeout(()=>k.classList.add('in'),700);i++;setTimeout(fly,360);};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){g.classList.add('open','still');return;}
  setTimeout(fly,400);
 }
 // A magic word: the narrator goes quiet, the word glows on something in the picture, he reads it.
 function magic(el,p,my){
  return new Promise(resolve=>{
   const btn=document.createElement('button');btn.type='button';btn.className='bk-magic';btn.innerHTML=`<small>${esc(p.magic.object||'magic word')}</small>${esc(p.magic.word)}`;el.append(btn);
   placeMagic(el,btn,p);support(btn,p.magic.word);

   const started=Date.now();let repeats=0,done=false;teleStart('magic',{target:p.magic.word});if(!masteredWords.has(p.magic.word))void phonics.word(p.magic.word);
   // The reminder only comes after real silence: every tap (an attempt) restarts the wait.
   let lastTry=0;btn.addEventListener('click',()=>{lastTry=Date.now();},true);
   const nudge=()=>later(()=>{if(done||my!==turn||repeats>=IDLE_REPEATS)return;if(Date.now()-lastTry<IDLE_REPEAT_MS||btn.classList.contains('listening')||btn.classList.contains('thinking'))return nudge();repeats++;teleHint(1);btn.classList.remove('bk-nudge');void btn.offsetWidth;btn.classList.add('bk-nudge');nudge();},IDLE_REPEAT_MS); // a soft glow, never a spoken "Can you read it?" (Alex 2026-10-02: stressful)
   // The page has usually just asked "can you read it?": then it is not asked again.
   const asked=/read it\??/i.test((p.say||[]).map(l=>l.text).join(' ').slice(-80));
   // With a microphone, the word itself is the button he taps to read it aloud.
   Promise.resolve(asked).then(async()=>{if(micUsable()&&!done&&my===turn&&!toldListen){toldListen=true;await speak(ch.ui.listenTap);}nudge();});
   const respond=async({via,misses})=>{if(done)return;done=true;btn.classList.add('read');burst('sparkles');cheer();
    if(!preview){void post(player,{type:'result',date,page,result:{kind:'magic',misses,ms:Date.now()-started,via,...(via!=='echo'?{earned:{word:p.magic.word}}:{}),detail:teleOut()}});event('book_magic',`${p.magic.word}:${via}`);}
    // After the echo the narrator has just said the word: straight on to what happens.
    // ...and not when the next line opens with the word itself ("Hug!" then "Hug! Pip squeezes everyone": hug, hug).
    const opensWithWord=new RegExp('^\\W*'+String(p.magic.word).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(String((p.magic.after||[])[0]?.shown||(p.magic.after||[])[0]?.text||''));
    if(via!=='echo'&&!opensWithWord)await speak(p.magic.read);if(my!==turn)return resolve();await speakAll(p.magic.after,my);resolve();};
   sayIt(btn,{target:{kind:'word',word:p.magic.word},kind:'magic',my,help:[p.magic.read],onDone:respond});
  });
 }
 // Saying "done" (the calm hand-over): while the Done medallion waits, and only if this device already allows the
 // microphone (never a prompt here), each thing he says goes to this machine's recogniser; "done", "I'm done",
 // "finished" or "ready" counts as the tap. Anything else is ignored and the medallion keeps waiting.
 async function listenForDone(my,isDone,onDone,btn){
  if(!canListen)return;try{const q=await navigator.permissions?.query({name:'microphone'});if(q?.state!=='granted')return;}catch{return;}
  btn?.classList.add('listening');
  try{while(alive&&my===turn&&!isDone()){let r;try{r=await listenOnce({});}catch{return;}
   if(!alive||my!==turn||isDone())return;if(!r?.pcm)continue;
   let m=null;try{m=await recognise({player,target:{kind:'word',word:'done',also:['finished','ready']},kind:'done',attempt:1,preview,pcm:r.pcm});}catch{return;}
   if(m?.match&&!isDone()){onDone();return;}}}
  finally{btn?.classList.remove('listening');}
 }
 function finishBeat(p,my,result){
  if(!preview){const tr=tele?.trace;const detail=teleOut();void post(player,{type:'result',date,page,result:{kind:p.beat.kind,beat:p.beat.id||null,misses:result.misses||0,ms:result.ms||0,...(result.via?{via:result.via}:{}),...(result.earned?{earned:result.earned}:{}),...(result.choice?{choice:result.choice}:{}),...(tr?{trace:tr}:{}),...teleSummary(detail),detail}});event('book_beat',`${p.beat.kind}:${result.misses||0}`);}
  setNext(true);later(()=>{if(my===turn&&canNext)go(page+1);},1600);
 }
 // Buttons with the usual rules: wrong wiggles and says try again; two misses glow the right one.
 // before(v): something to say first on every tap (a friend sounds out the tapped word), right or wrong.
 function choices(play,values,{cls='',answer,onRight,onWrong,label=v=>v,html=null,spokenWrong,prompt,my,before=null}){
  play.innerHTML='';let misses=0,done=false,repeats=0,busy=false;if(tele)tele.readyAt=Date.now();
  const nudge=()=>later(()=>{if(done||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(prompt);nudge();},IDLE_REPEAT_MS);nudge();
  for(const v of values){const b=document.createElement('button');b.type='button';b.className=`bk-btn ${cls}`;if(html)b.innerHTML=html(v);else b.textContent=label(v);b.dataset.v=v;
   b.onclick=async()=>{if(done||busy||my!==turn)return;
    teleTap(v,String(v)===String(answer));
    // Each word choice is blended after its tap. Separate sound controls are help before an answer.
    if(String(v)===String(answer)){if(before){busy=true;await before(v);busy=false;if(my!==turn)return;}done=true;b.classList.add('right');onRight(misses);return;}
    if(before){busy=true;b.classList.add('pressed');await before(v);b.classList.remove('pressed');busy=false;if(done||my!==turn)return;}
    misses++;snd.soft();b.classList.remove('wiggle');void b.offsetWidth;b.classList.add('wiggle');onWrong?.(misses);
    if(misses>=4){const r=play.querySelector(`[data-v="${CSS.escape(String(answer))}"]`);done=true;teleHint(3);r?.classList.add('right');onRight(misses);return;}
    if(misses>=2){teleHint(2);play.querySelector(`[data-v="${CSS.escape(String(answer))}"]`)?.classList.add('glow');void speak(nextReset()||prompt);}else void speak(spokenWrong||nextReset()||ch.ui.tryAgain);};
   if(cls.includes('word'))support(b,String(v));
   play.append(b);}
 }
 // ---- board puzzles: a small wooden chessboard with the painted pieces, or a pencil labyrinth on paper ----
 // Sized from the screen: on a tall screen the top third (the friends stand smaller below it); on a wide one a big
 // square the friends step aside from (clearOfUI). Answers are the beat's options: a piece kind, or a colour.
 const COLORS={blue:'#2f6fd6',green:'#2e9a4f',red:'#d8433a'};
 const PIECE_H={king:0.94,queen:0.86,rook:0.7,bishop:0.78,knight:0.72,pawn:0.56};
 const pieceImg=(c,t)=>{const P=art.props[`chess-${c==='w'?'white':'black'}-${t}`];return P?`<img class="pc" src="${esc(P.url)}" alt="${c==='w'?'white':'black'} ${t}" style="height:${PIECE_H[t]*100}%">`:`<b class="pc">${t[0].toUpperCase()}</b>`;};
 function boardPuzzle(el,b){
  const node=document.createElement('div');node.className=`bk-board bk-${b.variant}`;el.append(node);
  const sz=()=>{const W=root.clientWidth,H=root.clientHeight,wide=W>H*1.05;const s=Math.round(Math.min(wide?H*0.42:H*0.27,wide?W*0.4:W*0.86));node.style.width=node.style.height=`${s}px`;node.style.setProperty('--n',String(b.n||b.w||5));};
  el.__board=sz;sz();
  if(b.variant==='chess'){const n=b.n||5,cells=[];
   for(let r=n-1;r>=0;r--)for(let f=0;f<n;f++){const sq='abcdefgh'[f]+(r+1),pc=b.pieces.find(x=>x.sq===sq),dot=Object.entries(b.dots||{}).find(([,s])=>s===sq)?.[0];
    cells.push(`<div class="sq ${(f+r)%2?'light':'dark'}${b.target===sq?' target':''}" data-sq="${sq}">${pc?`<span class="piece ${pc.c}" data-t="${pc.t}" data-c="${pc.c}">${pieceImg(pc.c,pc.t)}</span>`:''}${dot?`<button type="button" class="dot" data-v="${dot}" style="--c:${COLORS[dot]}" aria-label="${dot} square"></button>`:''}</div>`);}
   node.innerHTML=`<div class="grid">${cells.join('')}</div>`;
   const at=sq=>node.querySelector(`[data-sq="${sq}"]`);
   return {label:v=>b.mode==='capture'?`${pieceImg('w',v)}<small>${esc(v)}</small>`:`<i class="swatch" style="--c:${COLORS[v]}"></i><small>${esc(v)}</small>`,
    link(play){node.querySelectorAll(b.mode==='capture'?'.piece.w':'.dot').forEach(x=>{x.style.cursor='pointer';x.addEventListener('click',e=>{e.stopPropagation();play.querySelector(`[data-v="${CSS.escape(x.dataset.v||x.dataset.t)}"]`)?.click();});});},
    async play(v,my){const right=String(v)===String(b.answer);
     // the piece he chose (or the knight, to the dot he chose) moves; a wrong move slides back
     const from=right?b.move.from:b.mode==='capture'?b.pieces.find(x=>x.c==='w'&&x.t===v)?.sq:b.move.from,to=right?b.move.to:b.mode==='capture'?b.target:b.dots[v];
     const pc=at(from)?.querySelector('.piece'),dest=at(to);if(!pc||!dest)return;
     const a=pc.getBoundingClientRect(),d=dest.getBoundingClientRect(),dx=d.left-a.left,dy=d.top-a.top;
     if(!right&&b.mode==='capture'){await pc.animate([{transform:'none'},{transform:`translate(${dx*0.35}px,${dy*0.35}px)`},{transform:'none'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:520,easing:'ease-in-out'}).finished.catch(()=>{});return;}
     await pc.animate([{transform:'none'},{transform:`translate(${dx}px,${dy}px)`}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:560,easing:'cubic-bezier(.3,.7,.3,1)',fill:'forwards'}).finished.catch(()=>{});
     if(my!==turn)return;
     if(right){dest.querySelector('.piece')?.remove();pc.getAnimations().forEach(x=>x.cancel());dest.querySelector('.dot')?.remove();dest.append(pc);dest.classList.add('won');
      if(b.mode==='fork')for(const t of b.pieces.filter(x=>x.c==='b'))at(t.sq)?.classList.add('hit');}
     else{dest.classList.add('miss');await new Promise(r=>later(r,420));pc.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:400,easing:'ease-in-out',fill:'forwards'}).finished.then(()=>pc.getAnimations().forEach(x=>x.cancel())).catch(()=>{});dest.classList.remove('miss');}}};
  }
  // the labyrinth: pencil walls on paper, three coloured doors on the left, the star on the right
  const w=b.w,h=b.h,walls=b.walls.map(r=>[...r].map(c=>parseInt(c,16))),doorRows=Object.values(b.doors).map(d=>d[1]),L=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=walls[y][x];
   if(v&1)L.push([x,y,x+1,y]);if(v&8&&!(x===0&&doorRows.includes(y)))L.push([x,y,x,y+1]);
   if(y===h-1&&v&4)L.push([x,y+1,x+1,y+1]);if(x===w-1&&v&2&&!(y===b.exit[1]))L.push([x+1,y,x+1,y+1]);}
  const star=(cx,cy,r)=>Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*0.45:r;return `${(cx+q*Math.cos(a)).toFixed(3)},${(cy+q*Math.sin(a)).toFixed(3)}`;}).join(' ');
  node.innerHTML=`<svg viewBox="-1.25 -0.35 ${w+2.5} ${h+0.7}" preserveAspectRatio="xMidYMid meet" aria-label="a labyrinth"><g class="walls">${L.map(([a,c,d,e])=>`<line x1="${a}" y1="${c}" x2="${d}" y2="${e}"/>`).join('')}</g><g class="paths"></g>
   ${Object.entries(b.doors).map(([k,[,y]])=>`<g class="door" data-v="${k}" style="--c:${COLORS[k]}"><circle cx="-0.62" cy="${y+0.5}" r="0.42"/><path d="M-0.2 ${y+0.5} l0.32 0" /></g>`).join('')}
   <polygon class="star" points="${star(w+0.62,b.exit[1]+0.5,0.46)}"/></svg>`;
  const g=node.querySelector('.paths');
  return {label:v=>`<i class="swatch" style="--c:${COLORS[v]}"></i><small>${esc(v)}</small>`,
   link(play){node.querySelectorAll('.door').forEach(x=>{x.style.cursor='pointer';x.addEventListener('click',e=>{e.stopPropagation();play.querySelector(`[data-v="${CSS.escape(x.dataset.v)}"]`)?.click();});});},
   async play(v,my){const right=String(v)===String(b.answer),pts=[[-0.2,b.doors[v][1]+0.5],...b.paths[v].map(([x,y])=>[x+0.5,y+0.5]),...(right?[[w+0.2,b.exit[1]+0.5]]:[])];
    const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points',pts.map(q=>q.join(',')).join(' '));pl.style.setProperty('--c',COLORS[v]);g.append(pl);
    const len=pts.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);pl.style.strokeDasharray=String(len);
    await pl.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(2200,260+len*120),easing:'linear',fill:'forwards'}).finished.catch(()=>{});
    if(my!==turn)return;
    if(right){node.querySelector('.star')?.classList.add('won');return;}
    // a dead end: a small cross where the path stops, then the pencil line fades
    const [ex,ey]=pts.at(-1),x=document.createElementNS('http://www.w3.org/2000/svg','path');x.setAttribute('d',`M${ex-0.22} ${ey-0.22}L${ex+0.22} ${ey+0.22}M${ex+0.22} ${ey-0.22}L${ex-0.22} ${ey+0.22}`);x.setAttribute('class','end');g.append(x);
    await new Promise(r=>later(r,700));pl.classList.add('gone');x.classList.add('gone');later(()=>{pl.remove();x.remove();},600);}};
 }
 async function runBeat(p,my){
  if(p.beat.kind==='pond'){
   const el=pageFrame(p,{beat:true});el.classList.add('bk-pond');
   if(!document.querySelector('link[data-pond]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/pond/pond.css';css.dataset.pond='true';document.head.append(css);}
   // Pond pages in the Book have no ambient water.
   snd.mute(true);pondVoice=pondNarrator();
   pondPage=mountPond(el,{ambient:false,mode:p.beat.mode,companion:p.beat.companion,speak:t=>pondVoice?.speak(t),stopSpeech:()=>pondVoice?.stop(),onContinue:r=>{if(my!==turn)return;if(!preview)void post(player,{type:'result',date,page,result:{kind:'pond',...r}});go(page+1);}});
   globalThis.__pondReview=pondPage;void pondPage.start();return;
  }
  const el=pageFrame(p,{beat:true}),b=calmBeat(p,page),play=el.querySelector('.bk-play'),started=Date.now();
  teleStart(b.kind,{target:b.answer??b.letter??b.target??b.right??(b.kind==='order'?'1-5':null),options:b.options||b.balls||b.stones||b.tiles||null});
  intro=true;beatPrompt=null;const ok=await speakAll(p.say,my);if(my===turn)intro=false;if(!ok)return;
  beatPrompt=promptOf(b);
  // No dead ends: whatever he does (or does not do), the page can always be finished. If the beat has not finished
  // after a quiet stretch, the answer is shown and "tap to go on" appears; the result is kept as rescued.
  let beatDone=false;
  guard(my,()=>beatDone,()=>{const ans=b.answer??b.right??b.target;if(ans!=null)play.querySelector(`[data-v="${CSS.escape(String(ans))}"]`)?.classList.add('glow');
   if(!preview)void post(player,{type:'result',date,page,result:{kind:b.kind,beat:b.id||null,misses:0,ms:Date.now()-started,rescued:true}});event('book_rescue',b.kind);});
  const done=r=>{if(beatDone)return;beatDone=true;beatPrompt=null;finishBeat(p,my,{ms:Date.now()-started,...r});};
  switch(b.kind){
   case 'teach-letter':{
    // The letter can be tapped at any moment; the friend finishes showing it first.
    const g=document.createElement('button');g.type='button';g.className='bk-glyph';g.textContent=b.letter;g.insertAdjacentHTML('beforeend',`<small class="lc">${esc(b.letter.toLowerCase())}</small>`);g.setAttribute('aria-label',`The letter ${b.letter}`);el.append(g);
    let tapped=false,shown=false;
    // After the echo the narrator has just said the letter: it is not said again straight away.
    const finish=async(r={misses:0})=>{g.classList.add('tapped');burst('sparkles');if(r.via!=='echo')await speak(b.tap);if(my===turn)done({misses:r.misses||0,...(r.via?{via:r.via}:{})});};
    g.onclick=()=>{if(tapped||my!==turn)return;tapped=true;if(shown)void finish();else g.classList.add('tapped');};
    if(!await speakAll(b.lines,my))return;shown=true;
    // Its shape too: he traces the big letter with his finger before he says it.
    if(ch.ui.traceIt){await traceLetter(g,b.letter,my);if(my!==turn)return;if(!micUsable())return void finish();}
    // With a microphone he says it: its sound, its name, or the friend's name ("Lll!", "L!", "Lulu!").
    if(micUsable()){g.classList.remove('tapped');let said=false;
     sayIt(g,{target:{kind:'letter',letter:b.letter,names:[b.ownerName||art.actors[b.owner]?.name].filter(Boolean)},kind:'letter',my,help:[b.lines.at(-1)],onDone:r=>{said=true;void finish(r);}});
     await speak(ch.ui.sayLetter);
     // The reminder only comes after real silence: every tap on the letter restarts the wait.
     let n=0,lastTry=Date.now();g.addEventListener('click',()=>{lastTry=Date.now();},true);
     const again=()=>later(()=>{if(said||my!==turn||n>=IDLE_REPEATS)return;if(Date.now()-lastTry<IDLE_REPEAT_MS||g.classList.contains('listening')||g.classList.contains('thinking'))return again();n++;void speak(ch.ui.sayLetter);again();},IDLE_REPEAT_MS);again();return;}
    if(tapped)return void finish();
    let repeats=0;const nudge=()=>later(()=>{if(tapped||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(b.tap);nudge();},IDLE_REPEAT_MS);nudge();
    return;}
   case 'stones':{
    await speak(b.spoken);if(my!==turn)return;
    play.innerHTML='';let found=0,misses=0,repeats=0;const nudge=()=>later(()=>{if(found>=b.need||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(b.spoken);nudge();},IDLE_REPEAT_MS);nudge();
    b.stones.forEach((l,i)=>{const s=document.createElement('button');s.type='button';s.className='bk-btn stone';s.textContent=l;s.style.transform=`translateY(${(i%2?-1:1)*1.5}vmin) rotate(${(i%3-1)*4}deg)`;
     s.onclick=async()=>{if(s.classList.contains('lit')||found>=b.need||my!==turn)return;teleTap(l,l===b.letter);
      if(l===b.letter){s.classList.add('lit');found++;view.querySelector('.bk-actor')?.classList.add('hop');void speak(b.tap);
       if(found>=b.need){await new Promise(r=>later(r,900));if(my!==turn)return;burst('stars');await speak(b.done);if(my!==turn)return;
        const earned=b.letter;keys.add(earned);renderDots();el.insertAdjacentHTML('beforeend',`<div class="bk-key-fly">${ch.keyStyle==='golden'?'🗝️':'🔑'}</div>`);done({misses,earned:{key:earned}});}}
      else{misses++;s.classList.remove('wiggle');void s.offsetWidth;s.classList.add('wiggle');void speak(b.notIt);if(misses>=2)[...play.children].find(x=>x.textContent===b.letter&&!x.classList.contains('lit'))?.classList.add('glow');}};
     play.append(s);});
    return;}
   case 'kick-letter':{
    const g=goalRect(p);goalFrame(el,g);placeKeeper(el,p,g);
    await speak(b.spoken);if(my!==turn)return;
    // One playable ball: the flat letter tiles change its letter before he kicks it.
    const W=root.clientWidth,H=root.clientHeight,size=actionBall(W,H);let misses=0,done_=false,repeats=0;
    const nudge=()=>later(()=>{if(done_||my!==turn||repeats>=IDLE_REPEATS)return;repeats++;void speak(b.spoken);nudge();},IDLE_REPEAT_MS);nudge();
    const bl=ballEl(el,{x:W/2,y:H*0.78,size,label:b.balls[0]});bl.dataset.v=b.balls[0];
    play.classList.add('bk-kick-letters');
    const picks=b.balls.map(l=>{const btn=document.createElement('button');btn.type='button';btn.className='bk-btn bk-letter-pick';btn.dataset.v=l;btn.textContent=l;
     btn.onclick=()=>{if(done_)return;bl.dataset.v=l;bl.querySelector('b').textContent=l;picks.forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));};play.append(btn);return btn;});
    picks.forEach((x,i)=>x.setAttribute('aria-pressed',String(i===0)));
    await new Promise(res=>{let st=null;
     bl.onpointerdown=e=>{st={x:e.clientX,y:e.clientY};bl.setPointerCapture?.(e.pointerId);};
     bl.onpointerup=async e=>{if(done_||my!==turn)return;teleTap(bl.dataset.v,bl.dataset.v===b.letter);const aim={dx:st?e.clientX-st.x:0,dy:st?e.clientY-st.y:0};st=null;
      if(bl.dataset.v!==b.letter){misses++;void speak(b.notIt);if(misses>=2)picks.find(x=>x.dataset.v===b.letter)?.classList.add('glow');return;}
      done_=true;picks.forEach(x=>x.disabled=true);await shoot(el,p,my,bl,aim,{quiet:saysGoal([b.done])});res();};});
    if(my!==turn)return;await speak(b.done);if(my!==turn)return;
    keys.add(b.letter);renderDots();el.insertAdjacentHTML('beforeend',`<div class="bk-key-fly">${ch.keyStyle==='golden'?'🗝️':'🔑'}</div>`);done({misses,earned:{key:b.letter}});
    return;}
   case 'count':{
    if(b.painted)return void paintedBeat(el,p,b,my,done);
    await speak(b.spoken);if(my!==turn)return;
    // What he counts: drawn things resting on the ground (table), never emoji in the sky.
    const P=drawn(b.thing);let counted=0;const tb=table(el);
    // The calm voice hands the counting over ("tell me when you're done"): he says when he is done with the Done
    // medallion (it shows after his first tap); counted them all and did not say? The question comes anyway.
    let asked=false,doneBtn=null,listening=false;
    const ask=async()=>{if(asked||my!==turn)return;asked=true;doneBtn?.remove();await speak(b.ask);if(my!==turn)return;
     choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.ask,my,onRight:async m=>{burst('confetti');await speak(b.done);if(my===turn)done({misses:m});}});};
    if(calm?.pages?.[page]?.done){doneBtn=document.createElement('button');doneBtn.type='button';doneBtn.className='bk-calm-done';doneBtn.textContent='Done';doneBtn.hidden=true;
     doneBtn.onclick=()=>{teleTap('done',counted===b.n);void ask();};el.append(doneBtn);}
    const things=Array.from({length:b.n},()=>{const t=document.createElement('button');t.type='button';t.className=`bk-thing${P.rel>0&&!adventure?' real':''}`;t.innerHTML=`<img class="art" src="${esc(P.url)}" alt="">`;
     t.onclick=async()=>{if(t.dataset.n||my!==turn)return;counted++;teleTap('thing',true);t.dataset.n=counted;t.insertAdjacentHTML('beforeend',`<b>${counted}</b>`);t.classList.add('counted');if(doneBtn){doneBtn.hidden=false;if(!listening){listening=true;void listenForDone(my,()=>asked,()=>{teleTap('done-voice',counted===b.n);void ask();},doneBtn);}}await speak(ch.ui.numbers[String(counted)]);
      if(counted===b.n&&my===turn){if(doneBtn){doneBtn.classList.add('glow');later(()=>{if(my===turn)void ask();},6000);}else void ask();}};
     return {node:t,P};});
    tb.set(shuffle(things));
    return;}
   case 'signs':{
    await speak(b.spoken);if(my!==turn)return;
    choices(play,b.options,{cls:'sign word',answer:b.target,prompt:b.spoken,spokenWrong:b.notIt,my,before:b.sounds?v=>speak(b.sounds[String(v).toLowerCase()],{again:true}):null,onRight:async m=>{burst('sparkles');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
    return;}
   case 'spell':{
    await speak(b.spoken);if(my!==turn)return;
    const slots=document.createElement('div');slots.className='bk-slots';slots.innerHTML=b.answer.map(()=>'<span>&nbsp;</span>').join('')+`<em>${esc(b.mark)}</em>`;el.append(slots);
    play.innerHTML='';let step=0,misses=0,here=0;if(tele)tele.readyAt=Date.now();
    for(const w of b.tiles){const t=document.createElement('button');t.type='button';t.className='bk-btn word';t.textContent=w;t.dataset.word=w;
     t.onclick=async()=>{if(step>=b.answer.length||t.classList.contains('used')||my!==turn||t.dataset.busy)return;teleTap(w,w===b.answer[step]);
      // Blend a word after each try; the letter controls offer help before choosing it.
      // A single-letter tile (spelling a name: M, O, M) says its sound on EVERY tap, right or wrong, again and again
      // just gives the sound again, never a fail).
      const letter=String(w).length===1,so=b.sounds?.[w.toLowerCase()];if(so){t.dataset.busy='1';await speak(so,letter?{again:true}:{});delete t.dataset.busy;if(my!==turn||step>=b.answer.length)return;}
      if(w!==b.answer[step]){misses++;here++;t.classList.remove('wiggle');void t.offsetWidth;t.classList.add('wiggle');void speak(ch.ui.tryAgain);
       if(here>=2)[...play.children].find(x=>x.dataset.word===b.answer[step]&&!x.classList.contains('used'))?.classList.add('glow');return;}
      t.classList.add('used');[...play.children].forEach(x=>x.classList.remove('glow'));slots.children[step].textContent=w;step++;here=0;
      if(step===b.answer.length){burst('sparkles');cheer();await speak(b.done);if(my===turn)done({misses});}};
     support(t,w);play.append(t);}
    return;}
   case 'share':{
    await speak(b.spoken);if(my!==turn)return;
    // The pizza and the plates are drawn, on the ground; each tap deals one slice onto every plate (fair sharing, the
    // way children do it).
    // (a fair share from the basket: what he deals is the beat's own drawn thing, e.g. cookies; older chapters: pizza)
    const own=!!b.prop,Pz=drawn(own?(b.basket||'snack-basket'):'pizza'),Sl=drawn(own?b.prop:'pizza-slice'),Pl=drawn('plate');const tb=table(el,{shrink:0.55});
    const pz=document.createElement('button');pz.type='button';pz.className=own?'bk-box bk-share-basket':'bk-pizza';pz.innerHTML=`<img class="art" src="${esc(Pz.url)}" alt="${own?'the basket':'the pizza'}">${own?`<div class="food">${Array.from({length:Math.min(6,b.total)},()=>`<img src="${esc(Sl.url)}" alt="">`).join('')}</div>`:''}<b>${b.total}</b>`;
    const plates=Array.from({length:b.groups},()=>{const d=document.createElement('div');d.className='bk-plate';d.innerHTML=`<img class="art" src="${esc(Pl.url)}" alt=""><div class="food"></div>`;return {node:d,P:Pl,scale:1.15};});
    tb.set([{node:pz,P:Pz,scale:1.2},...plates]);
    let dealt=0;pz.onclick=async()=>{if(dealt>=b.total||my!==turn)return;for(const {node} of plates){if(dealt>=b.total)break;node.querySelector('.food').insertAdjacentHTML('beforeend',`<img src="${esc(Sl.url)}" alt="">`);dealt++;}pz.querySelector('b').textContent=b.total-dealt;if(own){const f=pz.querySelector('.food');if(f)f.innerHTML=Array.from({length:Math.min(6,b.total-dealt)},()=>`<img src="${esc(Sl.url)}" alt="">`).join('');}
     if(dealt===b.total){pz.classList.add('empty');await speak(b.ask);if(my!==turn)return;
      choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.ask,my,onRight:async m=>{burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});}};
    return;}
   case 'score':{
    const board=document.createElement('div');board.className='bk-board';board.textContent=`${b.display} = ?`;if(board)el.append(board);
    await speak(b.spoken);if(my!==turn)return;
    choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.spoken,my,onRight:async m=>{board.textContent=`${b.display} = ${b.answer}`;burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
    return;}
   case 'puzzle':{
    if(b.painted)return void paintedBeat(el,p,b,my,done);
    // A board puzzle (chess, a labyrinth): the board is drawn by the game; he taps a piece, a dot or a door on the board
    // or its button below. Every tap plays out on the board (the path is walked, the piece moves) before right or wrong.
    // Captures are the visual evidence for the arithmetic: two large, labelled groups.
    // have the points displayed somewhere"): he adds what he sees instead of waiting for the narrator to say it.
    if(b.variant==='captures'){await speak(b.spoken);if(my!==turn)return;
     const groups=document.createElement('div');groups.className='bk-capture-groups';
     groups.innerHTML=[['Your captures','black',b.captures?.hero||[]],["Dad's captures",'white',b.captures?.dad||[]]].map(([label,c,ts])=>`<section><b>${esc(label)}</b><div>${ts.map(t=>`<figure class="bk-piece"><img class="bk-captured-piece" src="${esc(drawn(`chess-${c}-${t}`).url)}" alt="${esc(c+' '+t)}">${PIECE_POINTS[t]?`<figcaption>${PIECE_POINTS[t]}</figcaption>`:''}</figure>`).join('')||'<span>None</span>'}</div></section>`).join('');el.append(groups);
     choices(play,b.options,{cls:'ball board captures',answer:b.answer,prompt:b.hint||b.spoken,my,html:v=>{const [w,n]=String(v).split(':');return `<b>+${esc(n)}</b><small>${w==='me'?'You':'Dad'}</small>`;},onRight:async m=>{
      burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
     // the buttons are drawn, the captures rise until they clear every button.
     requestAnimationFrame(()=>{const g0=groups.getBoundingClientRect(),E=el.getBoundingClientRect(),g={top:g0.top,height:g0.height,bottom:Math.max(g0.bottom,...[...groups.querySelectorAll('figcaption')].map(f=>f.getBoundingClientRect().bottom))};
      const top=Math.min(...[...play.children].map(x=>x.getBoundingClientRect().top).filter(Number.isFinite));
      if(g.height&&top<g.bottom+8)groups.style.top=Math.max(8,g.top-E.top-(g.bottom+8-top))+'px';});
     return;}
    if(b.variant==='chess'||b.variant==='maze'){const bd=boardPuzzle(el,b);await speak(b.spoken);if(my!==turn)return;
     choices(play,b.options,{cls:`ball board ${b.variant}${b.mode?' '+b.mode:''}`,answer:b.answer,prompt:b.hint||b.spoken,my,html:v=>bd.label(v),before:v=>bd.play(v,my),onRight:async m=>{
      burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
     bd.link(play);return;}
    // A maths or logic puzzle at his level: the board shows it in numbers and symbols (anything to read stays
    // decodable; clues are spoken). Two misses: the hint, and the answer glows.
    const board=b.display?document.createElement('div'):null;if(board)board.className=`bk-board bk-puzzle ${b.variant||''}`;
    if(board)board.innerHTML=b.lines?`<small>${esc(b.display)}</small>${b.lines.map(l=>`<div>${esc(l)}</div>`).join('')}`:`${esc(b.display)}${/[?]/.test(b.display)?'':' = ?'}`;if(board)el.append(board);
    await speak(b.spoken);if(my!==turn)return;
    choices(play,b.options,{cls:b.labels?'ball route':'ball',answer:b.answer,prompt:b.hint||b.spoken,my,label:v=>b.labels?.[v]||v,onRight:async m=>{
     if(board&&!b.lines)board.textContent=/[?]/.test(b.display)?b.display.replace('?',b.answer):`${b.display} = ${b.answer}`;else if(board){const key=b.labels?.[b.answer]??(b.ahead?(b.ahead==='cream'?'⚪':'⚫'):null);board.querySelectorAll('div').forEach(d=>d.classList.toggle('won',!!key&&d.textContent.startsWith(key)));}
     burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});
    return;}
   case 'remainder':{
    // Remainders with drawn things: the basket and the plates rest on the ground; each tap deals one onto every plate;
    // what cannot go round stays in the basket.
    await speak(b.spoken);if(my!==turn)return;
    const T=drawn(b.prop||b.thing),Bk=drawn('snack-basket'),Pl=drawn('plate');const tb=table(el,{shrink:0.55});
    const box=document.createElement('button');box.type='button';box.className='bk-box';box.innerHTML=`<img class="art" src="${esc(Bk.url)}" alt="the basket"><div class="food"></div><b>${b.total}</b>`;
    const plates=Array.from({length:b.groups},()=>{const d=document.createElement('div');d.className='bk-plate';d.innerHTML=`<img class="art" src="${esc(Pl.url)}" alt=""><div class="food"></div>`;return {node:d,P:Pl,scale:1.15};});
    tb.set([{node:box,P:Bk,scale:1.2},...plates]);
    let left=b.total;box.onclick=async()=>{if(left<b.groups||my!==turn)return;for(const {node} of plates){node.querySelector('.food').insertAdjacentHTML('beforeend',`<img src="${esc(T.url)}" alt="">`);left--;}box.querySelector('b').textContent=left<b.groups?'?':left;
     if(left<b.groups){box.classList.add('left');box.querySelector('.food').innerHTML=Array.from({length:left},()=>`<img src="${esc(T.url)}" alt="">`).join('');await speak(b.ask);if(my!==turn)return;
      choices(play,b.options,{cls:'ball',answer:b.answer,prompt:b.ask,my,onRight:async m=>{burst('confetti');cheer();await speak(b.done);if(my===turn)done({misses:m});}});}};
    return;}
   case 'fork':{
    // A choice that matters: two ways on, both fine; the way he picks gives the chapter's treasure.
    await speak(b.spoken);if(my!==turn)return;
    play.innerHTML='';if(tele)tele.readyAt=Date.now();
    for(const o of b.options){const btn=document.createElement('button');btn.type='button';btn.className='bk-btn fork';btn.dataset.v=o.id;btn.innerHTML=`<span class="pic">${esc(o.emoji)}</span><small>${esc(o.label)}</small>`;
     btn.onclick=async()=>{if(my!==turn||play.dataset.chosen)return;play.dataset.chosen=o.id;picked.fork=o.id;renderDots();teleTap(o.id,true);btn.classList.add('right');
      [...play.children].forEach(x=>{if(x!==btn)x.classList.add('used');});
      await speak(o.reply);if(my!==turn)return;
      if(!items.some(i=>i.id===o.item.id))items.push(o.item);
      el.insertAdjacentHTML('beforeend',`<div class="bk-key-fly bk-item-fly">${esc(o.item.emoji)}</div>`);await speak(o.got);
      if(my===turn)done({misses:0,earned:{item:o.item.id},choice:o.id});};
     play.append(btn);}
    return;}
   case 'order':{
    if(b.painted)return void paintedBeat(el,p,b,my,done);
    // Numbers in order: tap 1, then 2, ... A wrong tile wiggles; two misses make the next one glow.
    await speak(b.spoken);if(my!==turn)return;
    const row=document.createElement('div');row.className='bk-slots';row.innerHTML=(b.numbers||[1,2,3,4,5]).map(()=>'<span>&nbsp;</span>').join('');el.append(row);
    play.innerHTML='';let next=1,here=0,misses=0;const N=(b.numbers||[1,2,3,4,5]).length;
    for(const v of b.tiles){const t=document.createElement('button');t.type='button';t.className='bk-btn ball';t.textContent=v;t.dataset.v=v;
     t.onclick=async()=>{if(next>N||t.classList.contains('used')||my!==turn)return;const ok=Number(v)===next;teleTap(v,ok);
      if(!ok){misses++;here++;snd.soft();t.classList.remove('wiggle');void t.offsetWidth;t.classList.add('wiggle');void speak(here>=2&&nextReset()||ch.ui.tryAgain);if(here>=2){teleHint(2);play.querySelector(`[data-v="${next}"]`)?.classList.add('glow');}return;}
      t.classList.add('used');[...play.children].forEach(x=>x.classList.remove('glow'));row.children[next-1].textContent=v;void speak(ch.ui.numbers?.[String(next)]);next++;here=0;
      // Reps (a workout chapter): the hero does each one with his own painted arms-up pose, then rests.
      if(b.reps){const up=repPose(player);if(up){const a=poseInPlace(el,player,up);a?.classList.remove('hop');void a?.offsetWidth;a?.classList.add('hop');if(next<=N)later(()=>{if(my===turn&&next<=N)poseInPlace(el,player,'idle');},560);}}
      if(next>N){burst('stars');cheer();await speak(b.done);if(my===turn)done({misses});}};
     play.append(t);}
    return;}
   case 'no':return void noBeat(el,p,my,done);
  }
  done({misses:0});
 }
 // Existing count/order/choice interactions on painted objects, using transparent hit areas.
 async function paintedBeat(el,p,b,my,done){
  await speak(b.spoken);if(my!==turn)return;
  const targets=backgroundFor(p)?.targets?.[b.painted]||[];
  const changed=b.kind==='count'?Number(b.answer)!==targets.length:b.kind==='order'&&b.numbers?.length!==targets.length;
  if(changed)b={...b,...(b.kind==='count'?{n:targets.length,answer:String(targets.length),options:[targets.length-1,targets.length,targets.length+1].map(String)}:{}),done:ch.ui.yes};
  if(!targets.length){await speak(b.hint||b.spoken);if(my===turn)done({misses:0,rescued:true});return;}
  let count=0,next=1,misses=0,busy=false,finished=false;
  const buttons=targets.map((target,i)=>{const t=document.createElement('button');t.type='button';t.className='bk-painted-target';t.dataset.v=target.id||String(i+1);t.setAttribute('aria-label',target.label||`Stepping stone ${i+1}`);
   // The tap area stays finger-sized (MIN_PAINTED_TAP); the ring he sees hugs the painted stone itself (2026-10-03,
   const ring=document.createElement('span');ring.className='bk-target-ring';t.append(ring);
   const place=()=>{const W=root.clientWidth,H=root.clientHeight,bg=backgroundFor(p),r0=foregroundRect(bg,bg.targets[b.painted][i].r,{width:W,height:H}),r=paintedTapRect(r0,{width:W,height:H});
    Object.assign(t.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});Object.assign(ring.style,{left:`${r0.x-r.x}px`,top:`${r0.y-r.y}px`,width:`${r0.w}px`,height:`${r0.h}px`});};place();
   t.onclick=async()=>{if(finished||busy||my!==turn||t.classList.contains('used'))return;const ok=b.kind==='count'||(b.kind==='order'?i+1===next:t.dataset.v===b.answer);teleTap(t.dataset.v,ok);
    if(!ok){misses++;t.classList.add('wiggle');await speak(b.hint||ch.ui.tryAgain);t.classList.remove('wiggle');if(misses>=2)buttons[b.kind==='order'?next-1:targets.findIndex(x=>x.id===b.answer)]?.classList.add('glow');return;}
    busy=true;t.classList.add('used');buttons.forEach(x=>x.classList.remove('glow'));
    if(b.kind==='puzzle'){finished=true;await speak(b.done);if(my===turn)done({misses});return;}
    count++;next++;await speak(ch.ui.numbers[String(count)]);busy=false;
    if(count===targets.length){finished=true;if(b.kind==='count'){await speak(b.ask);if(my!==turn)return;choices(el.querySelector('.bk-play'),b.options,{cls:'ball',answer:b.answer,prompt:b.ask,my,onRight:async m=>{await speak(b.done);if(my===turn)done({misses:m});}});}else{await speak(b.done);if(my===turn)done({misses});}}
   };el.append(t);return t;});
  // Re-map the same painted targets when the device turns, without resetting progress.
  // Overlapping generous boxes resolve to the nearest painted object, not DOM order.
  el.addEventListener('click',e=>{if(!e.target.closest('.bk-painted-target')||e.detail===0)return;const W=root.clientWidth,H=root.clientHeight,bg=backgroundFor(p),bounds=root.getBoundingClientRect(),x=e.clientX-bounds.x,y=e.clientY-bounds.y;
   const nearest=targets.map((_,i)=>{const r=foregroundRect(bg,bg.targets[b.painted][i].r,{width:W,height:H});return {i,d:Math.hypot(x-r.x-r.w/2,y-r.y-r.h/2)};}).sort((a,b)=>a.d-b.d)[0];e.stopImmediatePropagation();void buttons[nearest.i].onclick();},true);
  const ro=new ResizeObserver(()=>{const W=root.clientWidth,H=root.clientHeight,bg=backgroundFor(p);buttons.forEach((t,i)=>{const r=paintedTapRect(foregroundRect(bg,bg.targets[b.painted][i].r,{width:W,height:H}),{width:W,height:H});Object.assign(t.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});});});ro.observe(root);
  const disconnected=new MutationObserver(()=>{if(!el.isConnected){ro.disconnect();disconnected.disconnect();}});disconnected.observe(view,{childList:true});
 }
 // The NO! beat: a friend insists on something wrong and begs to do it. He says NO!, then fixes it.
 async function noBeat(el,p,my,done){
  const b=p.beat,play=el.querySelector('.bk-play');
  const board=document.createElement('div');board.className='bk-board';
  // Place value ("The 4 in 45 is worth 4!"): the number with that digit marked, and what the friend says it is worth.
  const pvm=b.pv||(String(b.display||'').match(/^(\d) in (\d+) = (\d+)$/)||[]).slice(1).reduce((o,x,i)=>({...o,[['digit','n','claimed'][i]]:Number(x)}),null);
  const pvHTML=v=>{const s=String(pvm.n),i=s.indexOf(String(pvm.digit));return `<span>${esc(s.slice(0,i))}<u class="pv">${esc(s[i])}</u>${esc(s.slice(i+1))}</span><span>→</span><span>${esc(v)}</span>`;};
  board.innerHTML=early?`<span>${esc(b.claim.text.replace(/!$/,''))}</span>`:pvm?.n?pvHTML(pvm.claimed):`<span>${esc(b.display)}</span>`;
  if(early){const w=b.claim.text.split(' ')[0];board.innerHTML=`<span class="pic">${esc(w)}</span><span>→</span><span>${esc(b.wrong)}</span>`;}
  el.append(board);
  const who=el.querySelector(`.bk-actor[data-id="${CSS.escape(b.who||'')}"]`);
  await speak(b.claim);if(my!==turn)return;await speak(b.ask);if(my!==turn)return;
  let okays=0;
  const offer=async()=>{
   play.innerHTML='';const no=document.createElement('button');no.type='button';no.className='bk-btn no';no.textContent='NO!';
   const ok=document.createElement('button');ok.type='button';ok.className='bk-btn ok';ok.textContent='Okay…';play.append(no,ok);
   void speak(ch.ui.noPrompt);
   ok.onclick=async()=>{if(my!==turn)return;teleTap('okay',false);okays++;play.innerHTML='';board.classList.add('buzz');await speak(b.ifYes);board.classList.remove('buzz');if(my!==turn)return;
    // Twice "okay": the book helps (the scoreboard buzzed, so it was wrong) and goes on to the fix.
    if(okays>=2)return no.onclick();await speak(b.ask);if(my===turn)offer();};
   no.onclick=async()=>{if(my!==turn||no.dataset.used)return;no.dataset.used='1';teleTap('NO',okays===0);play.innerHTML='';burst('confetti');who?.classList.add('hop');await speak(b.caught);if(my!==turn)return;await speak(b.fixSpoken);if(my!==turn)return;
    choices(play,b.options,{cls:early?'key':'ball',answer:b.right,prompt:b.fixSpoken,my,onWrong:m=>{if(m===2)void speak(b.hint);},onRight:async m=>{
     board.innerHTML=early?`<span class="pic">${esc(b.claim.text.split(' ')[0])}</span><span>→</span><span>${esc(b.right)}</span>`:pvm?.n?pvHTML(b.right):`<span>${esc(b.display.replace(/=.*$/,'= '+b.right))}</span>`;
     burst('stars');await speak(ch.ui.yes);if(my===turn)done({misses:m});}});};
  };
  offer();
 }
 const silence=()=>{phonics.stop();turn++;clearTimers();stopSound();snd.cancel();pondVoice?.stop();};
 addEventListener('family-audio-stop',silence);
 async function ending(){
  phonics.stop();const my=++turn;finished=true;setNext(false);snd.stop();
  if(!preview){void post(player,{type:'finish',date,page:ch.pages.length});event('book_finish',date);}
  const el=view.querySelector('.bk-page')||view;
  const q=ch.quest;
  // Every book ENDS with the Letter Hunt: one clean card, the day's letter, one big button to start it there (the
  // hunt has the hints and the grown-up's "We found them!" count). The letter is the one the Letter Hunt screen opens
  // on (the server's dayHunt, in letter mode: book.hunt); a letters book's letter leads that hunt anyway.
  const early=ch.level==='early',huntL=(early?(ch.letter||ch.pages.find(x=>x.beat?.kind==='teach-letter')?.beat?.letter):null)||book.hunt?.letter||'';
  if(huntL&&!preview){el.insertAdjacentHTML('beforeend',`<div class="bk-quest bk-hunt-end">${keyringHTML({slide:[...keys].find(k=>!keysAtStart.has(k))||null})}<div class="bk-hunt-letter">${esc(huntL)}<small>${esc(huntL.toLowerCase())}</small></div><h2>Letter hunt</h2><p>Find things at home that start with <b>${esc(huntL)}</b>.</p><div class="bk-end-btns"><a class="bk-btn bk-hunt big" href="#hunt">Start the letter hunt</a><button class="bk-btn bk-done" type="button">Play games →</button></div></div>`);}
  else
  el.insertAdjacentHTML('beforeend',`<div class="bk-quest">${q?`<h2>${esc((q.text.match(/^A quest for you and ([^:]+):/)||[,'Dad'])[1]).replace(/^/,'A quest for you and ')}</h2><p>${esc(q.text.replace(/^A quest for you and [^:]+:\s*/,''))}</p>${q.hints?.length?`<div class="bk-hint"></div><button class="bk-btn bk-hintbtn" type="button">A hint, please</button>`:''}${q.dad?`<p class="bk-dadnote">${esc(q.dad)}</p>`:''}`:'<h2>The end, for today</h2>'}${preview?'':'<a class="bk-btn bk-hunt" href="#hunt">Want to go hunting?</a> '}<button class="bk-btn bk-done" type="button">${preview?'Close':'Play games →'}</button></div>`);
  if(ch.style==='quest'&&items.length)el.querySelector('.bk-quest')?.insertAdjacentHTML('afterbegin',`<div class="bk-spellbook" aria-label="Your spellbook">${items.slice(-8).map(i=>`<span title="${esc(i.name)}">${esc(i.emoji)}</span>`).join('')}</div>`);
  el.querySelector('.bk-quest .bk-done').onclick=()=>{stop();onDone({finished:true});};
  // The calm close: speech alone, then "easier or harder next time?" (two medallions; remembered for his next chapters).
  if(calm?.offer){const card=el.querySelector('.bk-quest');card?.querySelector('.bk-end-btns,.bk-done')?.insertAdjacentHTML('beforebegin',`<div class="bk-calm-pick" role="group" aria-label="Next time"><button type="button" data-v="easier"><svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="#2f4a33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 28V14"/><path d="M16 17c-1-5-5-8-10-8 0 5 4 9 10 8z" fill="#9fbf86"/><path d="M16 14c1-5 5-8 10-8 0 5-4 9-10 8z" fill="#b9d49e"/><path d="M10 28h12" stroke="#b88a3a"/></svg>easier</button><button type="button" data-v="harder"><svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="#2f4a33" stroke-width="2" stroke-linejoin="round"><path d="M3 27l9-15 5 8 4-5 8 12z" fill="#c9b48a"/><path d="M12 12l2.5 4.2L12 15l-2 2" stroke="#fffaf0"/><path d="M3 27h26" stroke="#b88a3a"/></svg>harder</button></div>`);
   for(const b of card?.querySelectorAll('.bk-calm-pick button')||[])b.onclick=async()=>{const v=b.dataset.v;card.querySelectorAll('.bk-calm-pick button').forEach(x=>{x.classList.toggle('picked',x===b);x.disabled=true;});
    if(!preview)void post(player,{type:'difficulty',date,value:v});event('book_difficulty',v);await speak(calm[v]);};}
  // The card is a LETTER hunt: the hunt screen opens in letter mode (a remembered word mode would show a word).
  const hl=el.querySelector('.bk-hunt');if(hl)hl.onclick=async e=>{e.preventDefault();stop();if(huntL)await post(player,{type:'huntMode',mode:'letter'}).catch(()=>null);location.hash='hunt';};
  // Came back empty-handed? One hint picture at a time (things most homes have).
  let hint=0;const hb=el.querySelector('.bk-hintbtn');
  if(hb)hb.onclick=async()=>{const h=q.hints[hint++];if(!h)return;el.querySelector('.bk-hint').innerHTML=`<span class="pic">${esc(h.emoji)}</span><b>${esc(h.word)}</b>`;if(hint>=q.hints.length)hb.remove();if(!preview)event('book_hint',`${date}:${hint}`);await speak(h.line);};
  // A reader's book speaks its hunt's own opening line (his friend, the letter's sound); a letters book its quest.
  const closing=huntL&&!preview&&!early&&book.hunt?.intro?.clip?book.hunt.intro:ch.quest;
  if(closing)await speak(closing);if(my===turn)await speak(calm?.offer||ch.ui.nextTime);
 }
 function stop(){phonics.stop();removeEventListener('family-audio-stop',silence);snd.stop();clearPond();alive=false;clearTimers();uiWatch.disconnect();clearTimeout(uiTimer);stopSound();for(const u of blobs.values())if(u)URL.revokeObjectURL(u);blobs.clear();removeEventListener('deviceorientation',tilt);removeEventListener('resize',onResize);removeEventListener('orientationchange',onResize);globalThis.visualViewport?.removeEventListener('resize',onResize);try{audio.removeAttribute('src');audio.load();}catch{}}
 if(!preview)void post(player,{type:'open',date,page});
 // Grown-ups' preview only: checks and dad can jump to a page.
 if(preview)globalThis.__bookGo=n=>go(n);
 cover();
 const dispose=()=>{if(!alive)return;if(!finished&&!preview){void post(player,{type:'leave',date,page:Math.max(0,page)},true);event('book_leave',`${date}:${page}`);}stop();root.remove();};
 dispose.book=true;
 return dispose;
}
