'use client';
// Letter Slalom: a calm downhill run through letter/word gates (3D, three.js, loaded on demand).
// Content prompts always speak on each gate approach; the how-to line once per browser session.
// No score, no streaks, no fail state: a missed gate names the right answer and the run continues.
import {useEffect,useRef,useState} from 'react';
import './slalom.css';
import {SLALOM_LINES,afterGate,slalomChoice,trickyWords,familyBreakItem,soundOutLine,wordPicture} from '../lib/slalom.mjs';
import {onceThisSession,DEFAULT_TRACK} from '../lib/word-break.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const qualityParam=()=>{try{return new URLSearchParams(location.search).get('slalomQuality');}catch{return null;}};
// Start screen: two big picture buttons (skis / snowboard). One tap starts the run; the last choice is remembered in
// the player's save on the server and shows a ring.
// Letters or words (not for a letters-only player): the remembered choice, else letters until two word runs were read
// over 70% on his own; then words, and a star offers them. A tap is remembered in the save when the run starts.
export function SlalomStart({p,busy,onStart,onBack}){
 const ride=p.slalom?.ride||'ski',choice=slalomChoice(p.id,p.slalom,DEFAULT_TRACK[p.id]||'mixed');
 const [track,setTrack]=useState(choice.track),[touched,setTouched]=useState(false);
 const pickTrack=t=>{setTrack(t);setTouched(true);};
 return <section className="slalom-start" aria-label="Letter Slalom">
  <h1>Letter Slalom</h1>
  {choice.toggle&&<div className="slalom-modes" role="group" aria-label="Letters or words">{[['letters','A b','Letters'],['words','cat','Words']].map(([id,sample,label])=><button key={id} className={'slalom-mode'+(track===id?' chosen':'')} aria-pressed={track===id} disabled={busy} onClick={()=>pickTrack(id)}><span aria-hidden="true">{sample}</span><strong>{label}</strong>{id==='words'&&choice.ready&&track!=='words'&&<em className="slalom-ready" aria-label="Ready for words">⭐</em>}</button>)}</div>}
  <p>Skis or snowboard?</p>
  <div className="slalom-rides">{[['ski','⛷️','Skis'],['board','🏂','Snowboard']].map(([id,icon,label])=><button key={id} className={'slalom-ride'+(ride===id?' chosen':'')} disabled={busy} onClick={()=>onStart(id,touched?track:undefined)} aria-label={label}><span aria-hidden="true">{icon}</span><strong>{label}</strong></button>)}</div>
  <button className="slalom-start-back" onClick={onBack}>← Back</button>
 </section>;
}
// One warm-up word: picture, then its letters light up with the sound-out clip ("m... a... t... mat"). Letter onsets
// follow scripts/soundout.py (lead 0.12 s, held sounds ~0.55-0.6 s, stops short, 0.30 s gaps, 0.42 s before the word).
const STOPS='bcdgkpt',VOWELS='aeiou';
function onsets(word){const out=[];let t=0.12;for(const c of word){out.push(t);t+=(STOPS.includes(c)?0.22:VOWELS.includes(c)?0.55:0.6)+0.30;}return {letters:out,word:t-0.30+0.42};}
function WarmWord({word,active,at}){
 const [step,setStep]=useState({at:null,lit:0}),lit=active?(step.at===at?step.lit:0):word.length+1;
 useEffect(()=>{if(!active)return;const {letters,word:w}=onsets(word),start=at||performance.now(),wait=t=>Math.max(0,t*1000-(performance.now()-start));
  const timers=[...letters.map((t,k)=>setTimeout(()=>setStep({at,lit:k+1}),wait(t))),setTimeout(()=>setStep({at,lit:word.length+1}),wait(w))];return()=>timers.forEach(clearTimeout);},[word,active,at]);
 const picture=wordPicture(word);
 return <div className={'slalom-warm-word'+(active?' now':'')}>{picture?<i aria-hidden="true">{picture}</i>:<i className="blank" aria-hidden="true"/>}<b aria-label={word}>{[...word].map((c,k)=><span key={k} className={lit>word.length?'whole':k<lit?(k===lit-1?'on':'was'):''}>{c}</span>)}</b></div>;
}
export default function Slalom({p,session,voice,soundRef,audio,paused,onPause,onHome,onAgain,submitGate,checkpoint,event}){
 const host=useRef(null),scene=useRef(null),gates=useRef(session.gates.map(g=>({...g}))),alive=useRef(true),chain=useRef(Promise.resolve()),pending=useRef([]);
 const outcomes=useRef([]),adapt=useRef({support:!!session.support,missRun:session.missRun||0}),startedAt=useRef(0),gateStart=useRef(0),lastResult=useRef(null),pausedRef=useRef(paused);
 // gates for rendering (a missed gate eases the next one); `gates` mirrors it for callbacks
 const [shown,setShown]=useState(()=>session.gates.map(g=>({...g})));
 const [phase,setPhase]=useState(session.phase==='complete'?'done':'loading'),[current,setCurrent]=useState(session.round),[passed,setPassed]=useState(session.round);
 const [live,setLive]=useState(false),[recapAt,setRecapAt]=useState(-1),[recapWords,setRecapWords]=useState(null),[warm,setWarm]=useState(null),[support,setSupport]=useState(!!session.support),[tilt,setTilt]=useState(false),[hint,setHint]=useState(true),[fallback,setFallback]=useState('');
 const track=session.track||session.gates[0]?.track||'letters';
 const log=(name,detail)=>{try{event('gameplay',name,typeof detail==='string'?detail:JSON.stringify(detail));}catch{}};
 // Speak a line and resolve when it has finished (or after a fair estimate if the browser could not play it).
 async function say(text){
  const v=voice.current;if(!v||!text)return sleep(1500);
  const played=await v.speak(text,true);
  if(!played){await sleep(700+text.length*70);return;}
  const player=v.player;
  await new Promise(res=>{let t=0;const done=()=>{clearTimeout(t);player.removeEventListener('ended',done);player.removeEventListener('error',done);player.removeEventListener('emptied',done);res();};
   // bounded by the clip's real length, so a missed 'ended' event never delays the next question
   const left=Number.isFinite(player.duration)&&player.duration>0?(player.duration-player.currentTime)*1000+150:Math.min(9000,1200+text.length*110);
   t=setTimeout(done,Math.max(200,left));player.addEventListener('ended',done);player.addEventListener('error',done);player.addEventListener('emptied',done);if(player.ended)done();});
 }
 function ask(i){const g=gates.current[i];if(!g)return Promise.resolve();setCurrent(i);gateStart.current=performance.now();scene.current?.promptStarted(i);
  return say(g.prompt).then(()=>{scene.current?.promptEnded(i);});}
 const queue=fn=>{chain.current=chain.current.then(()=>alive.current?fn():null).catch(()=>{});return chain.current;};
 function passGate(i,answer,hinted=false){
  const g=gates.current[i];if(!g)return;const ok=answer===g.answer;
  setPassed(i+1);setHint(false);log('slalom_gate',{gate:i,kind:g.kind,answer:g.answer,chose:answer,ok,hinted,ms:Math.round(performance.now()-gateStart.current)});
  if(ok)audio.current?.feedback(true);
  pending.current.push(submitGate(g.id,answer,Math.min(86400000,Math.round(performance.now()-gateStart.current)),hinted).then(d=>{if(d?.result)lastResult.current=d.result;return d;}));
  // after a miss the next row eases; after two misses in a row (words) every row left becomes a pair with a sound-out
  // question and a calmer cruise (same pure rule as the server: afterGate in lib/slalom.mjs)
  const before=gates.current,a=afterGate(before,i,ok,adapt.current);adapt.current={support:a.support,missRun:a.missRun};
  gates.current=a.gates;a.gates.forEach((x,k)=>{if(k>i&&x!==before[k])scene.current?.replaceGate(k,x);});if(a.gates.some((x,k)=>x!==before[k]))setShown([...a.gates]);
  if(a.started){setSupport(true);log('slalom_support',{from:i+1,family:session.family});}
  const next=gates.current[i+1];
  // After a gate only a short line, then the next question (timing budget: lib/slalom-timing.mjs): the word or letter
  // ("mat!", "F!") or, on a miss, "It's mat." Content, always spoken (Kokoro clips only). Sound-outs wait for the recap.
  outcomes.current[i]={ok,hinted};
  queue(async()=>{await say(ok?g.praise:g.correction);if(next)await ask(i+1);});
 }
 async function finish(){
  await Promise.allSettled(pending.current);if(!alive.current)return;
  scene.current?.boost(false);
  const d=scene.current?.stats();if(d){log('slalom_perf',{...d,runMs:Math.round(performance.now()-startedAt.current)});log('slalom_boost',d.boost);}
  setPhase('recap');
  // the child's own toys were preloaded during the run; they all appear now
  {const n=scene.current?.showFriends();if(n)log('slalom_companions',String(n));}
  await queue(async()=>{
   await sleep(1200);
   if(track==='letters'){
    await say(SLALOM_LINES.recapLetters);
    for(let k=0;k<gates.current.length&&alive.current;k++){setRecapAt(k);await say(gates.current[k].recap);await sleep(150);}
    setRecapAt(gates.current.length);return;
   }
   // words: only the missed ones (a wrong gate or the glow), each sounded out once with its picture
   const tricky=trickyWords(gates.current,outcomes.current);setRecapWords(tricky);log('slalom_recap',{family:session.family,tricky});
   await say(tricky.length?SLALOM_LINES.recapTricky:SLALOM_LINES.recapAllRead);
   for(let k=0;k<tricky.length&&alive.current;k++){setRecapAt(k);await say(soundOutLine(tricky[k]));await sleep(250);}
   setRecapAt(tricky.length);
  });
  if(!alive.current)return;
  // the word break after the finish line stays in the run's word family
  const item=session.family?familyBreakItem(session.family,{tricky:trickyWords(gates.current,outcomes.current),targets:session.targets||[]}):null;
  setPhase('break');await checkpoint('mission-complete',item||undefined);if(!alive.current)return;
  setPhase('done');
 }
 // mount: load the 3D scene (or a simple 2D version if this device has no WebGL)
 useEffect(()=>{
  alive.current=true;if(session.phase==='complete')return()=>{alive.current=false;};
  let cancelled=false;const coach=voice.current;startedAt.current=gateStart.current=performance.now();
  (async()=>{
   try{
    const mod=await import('./slalom-scene.mjs');if(cancelled)return;
    const sound={get ctx(){return audio.current?.ctx;},get destination(){return audio.current?.fx;},enabled:()=>!!audio.current?.prefs?.effects&&!pausedRef.current};
    scene.current=mod.createSlalomScene(host.current,{gates:gates.current,startGate:session.round,forceQuality:qualityParam(),sound,ride:session.ride||'ski',
     onGate:(i,answer,lane,hinted)=>passGate(i,answer,hinted),onFinish:()=>void finish(),onStats:s=>log('slalom_quality',s),onContextLost:()=>{log('slalom_error','context lost');setFallback('lost');}});
    window.__slalom=scene.current;setLive(true);
    // friends for the finish line: queued now, loaded one per gate during the run (never a pop-in at the finish)
    void fetch(`/api/${p.id}/companions`,{cache:'no-store'}).then(r=>r.ok?r.json():{friends:[]}).then(({friends=[]})=>scene.current?.queueFriends(friends.map(f=>({...f,url:new URL(f.url,location.href).href})))) // page-relative: works inside the hub's /g/<game>/<player>/ too.catch(()=>{});
    const warmFirst=track==='words'&&session.round===0&&!!session.targets?.length;setPhase(warmFirst?'warmup':'run');log('slalom_start',{gate:session.round,track,size:`${innerWidth}x${innerHeight}`});
    queue(async()=>{
     await sleep(400);
     // words: teach before testing. The run's words, one by one: picture, slow sound-out ("m... a... t... mat").
     if(warmFirst){
log('slalom_warmup',{family:session.family,targets:session.targets,easy:!!session.easy});const t0=performance.now();
      setWarm({k:-1});await say(SLALOM_LINES.warmup);
      for(let k=0;k<session.targets.length&&alive.current;k++){setWarm({k,at:performance.now()});await say(soundOutLine(session.targets[k]));await sleep(300);}
      setWarm({k:session.targets.length});await say(SLALOM_LINES.warmupGo);setWarm(null);if(!alive.current)return;setPhase('run');
      log('slalom_warmup_done',String(Math.round(performance.now()-t0)));
     }
     if(soundRef.current&&onceThisSession('word-arcade:slalom:how')){const how=say(track==='letters'?SLALOM_LINES.howLetters:SLALOM_LINES.howWords);await sleep(1600);scene.current?.go();await how;}
     else{scene.current?.go();await sleep(500);}
     await ask(session.round);
    });
   }catch(e){log('slalom_error',e.message);if(!cancelled){setFallback('no-webgl');setPhase('run');queue(()=>ask(session.round));}}
  })();
  return()=>{cancelled=true;alive.current=false;coach?.stop();scene.current?.dispose();scene.current=null;if(window.__slalom)delete window.__slalom;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 // pause: freeze the run; on resume, say the current question again
 useEffect(()=>{pausedRef.current=paused;scene.current?.setPaused(paused);if(!paused&&phase==='run'&&scene.current){const st=scene.current.state();if(!st.finished&&st.next<gates.current.length)queue(()=>ask(st.next));}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[paused]);
 // keyboard for grown-ups: arrows move one lane; Up/Space held = go faster (children hold the rider or drag up)
 useEffect(()=>{const key=e=>{if(e.target.closest?.('input,select,textarea,summary'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();scene.current?.steer(e.key==='ArrowLeft'?-1:1);setHint(false);}
   if(e.key==='ArrowUp'||e.code==='Space'){e.preventDefault();if(!e.repeat)scene.current?.boost(true);}};
  const up=e=>{if(e.key==='ArrowUp'||e.code==='Space')scene.current?.boost(false);};
  window.addEventListener('keydown',key);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);};},[]);
 // tilt to steer (optional)
 useEffect(()=>{if(!tilt)return;const on=e=>{const angle=(screen.orientation?.angle??window.orientation??0)%360;let v=Math.abs(angle)===90?(angle===90?e.beta:-e.beta):angle===180?-e.gamma:e.gamma;if(!Number.isFinite(v))return;scene.current?.setTilt(Math.max(-1,Math.min(1,v/20)));};
  window.addEventListener('deviceorientation',on);return()=>{window.removeEventListener('deviceorientation',on);scene.current?.setTilt(null);};},[tilt]);
 async function toggleTilt(){if(tilt){setTilt(false);return;}try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission&&await DeviceOrientationEvent.requestPermission()!=='granted')return;}catch{return;}setTilt(true);log('slalom_tilt','on');}
 const canTilt=typeof window!=='undefined'&&'DeviceOrientationEvent' in window&&matchMedia('(pointer:coarse)').matches;
 const g=shown[Math.min(current,shown.length-1)];
 const hear=()=>{if(g&&phase==='run')void voice.current?.speak(g.prompt,true);log('slalom_hear',String(current));};
 // 2D quick version (no WebGL): same gates, tap the one you hear
 function tapGate(answer){if(passed>current||!g)return;passGate(current,answer);if(current+1>=gates.current.length)void finish();}
 const name=p.name,words=[...new Set(shown.filter(x=>x.track==='words').map(x=>x.answer))];
 const finishCard=<section className={'complete slalom-finish'+(live?' over':'')} aria-live="polite">
  <span className="medal" aria-hidden="true">⛷️</span>
  <h2>What a run, {name}!</h2>
  <div className="slalom-recap-row">{(track==='words'?words.map(w=>({answer:w,kind:'read-word',picture:wordPicture(w)})):shown).map((x,k)=><span key={k} className={'slalom-card '+x.kind}>{x.picture&&<i aria-hidden="true">{x.picture}</i>}{x.answer}</span>)}</div>
  <p>{track==='letters'?'Your letters from the mountain.':'Your words from the mountain.'}</p>
  <div className="slalom-finish-actions"><button className="primary" onClick={onAgain}>Ski again ⛷️</button><button onClick={onHome}>Choose another game</button></div>
 </section>;
 if(phase==='done'&&!live)return finishCard;
 return <div className={'slalom-root'+(paused?' is-paused':'')+(support?' is-support':'')} ref={host} data-phase={phase}>
  {phase==='loading'&&<div className="slalom-loading"><span aria-hidden="true">⛷️</span><p>Waxing the skis…</p></div>}
  {fallback&&phase!=='recap'&&phase!=='break'&&g&&<div className="slalom-flat"><p>{fallback==='lost'?'The snow needs a rest on this screen. Here is the quick version.':'Here is the quick version of the slalom.'}</p><div className="slalom-flat-gates">{g.options.map(o=><button key={o} onClick={()=>tapGate(o)}>{o}</button>)}</div></div>}
  <div className="slalom-hud">
   <div className="slalom-top">
    <button className="slalom-btn" onClick={onHome} aria-label="Back to Arcade">←</button>
    <button className="slalom-btn" onClick={onPause} aria-label="Pause">Ⅱ</button>
    {phase==='run'&&g&&passed<shown.length?<div className="slalom-prompt" role="status">
     <button className="slalom-hear" onClick={hear} aria-label="Hear it again">🔊</button>
     {(g.kind==='first-letter'||g.picture)&&g.picture&&<span className="slalom-picture" aria-hidden="true">{g.picture}</span>}
     {(g.kind==='find-letter'||g.kind==='read-word')&&<span className="slalom-listen">{g.kind==='find-letter'?'Which letter?':g.support?'Sound it out':'Which word?'}</span>}
    </div>:<span/>}
    <div className="slalom-dots" aria-label={`Gate ${Math.min(passed+1,shown.length)} of ${shown.length}`}>{shown.map((_,k)=><i key={k} className={k<passed?'done':k===passed?'now':''}/>)}</div>
   </div>
   {phase==='run'&&!fallback&&<div className="slalom-bottom">{hint&&<span className="slalom-hint">👆 Slide your finger to steer</span>}{canTilt&&<button className={'slalom-btn tilt'+(tilt?' on':'')} onClick={toggleTilt} aria-pressed={tilt}>📱 Tilt</button>}</div>}
  </div>
  {phase==='done'&&finishCard}
  {phase==='warmup'&&warm&&<div className="slalom-warmup" aria-live="polite"><h2>Today&apos;s words</h2><div className="slalom-warm-row">{session.targets.map((w,k)=><WarmWord key={w} word={w} active={k===warm.k} at={k===warm.k?warm.at:0}/>)}</div></div>}
  {(phase==='recap'||phase==='break')&&track==='letters'&&<div className="slalom-recap" aria-live="polite"><h2>Your letters</h2><div className="slalom-recap-row">{shown.map((x,k)=><span key={k} className={'slalom-card '+x.kind+(k===recapAt?' now':k<recapAt?' seen':'')}>{x.picture&&<i aria-hidden="true">{x.picture}</i>}{x.answer}</span>)}</div></div>}
  {(phase==='recap'||phase==='break')&&track!=='letters'&&recapWords&&<div className="slalom-recap" aria-live="polite"><h2>{recapWords.length?'The tricky ones':'You read every word!'}</h2><div className="slalom-warm-row">{(recapWords.length?recapWords:words).map((w,k)=><WarmWord key={w} word={w} active={recapWords.length>0&&k===recapAt} at={0}/>)}</div></div>}
 </div>;
}
