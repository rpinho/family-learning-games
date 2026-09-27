'use client';
// Letter Slalom: a calm downhill run through letter/word gates (3D, three.js, loaded on demand).
// Content prompts always speak on each gate approach; the how-to line once per browser session.
// No score, no streaks, no fail state: a missed gate names the right answer and the run continues.
import {useEffect,useRef,useState} from 'react';
import './slalom.css';
import {SLALOM_LINES,easeGate} from '../lib/slalom.mjs';
import {onceThisSession} from '../lib/word-break.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const qualityParam=()=>{try{return new URLSearchParams(location.search).get('slalomQuality');}catch{return null;}};
export default function Slalom({p,session,voice,soundRef,audio,paused,onPause,onHome,onAgain,submitGate,checkpoint,event}){
 const host=useRef(null),scene=useRef(null),gates=useRef(session.gates.map(g=>({...g}))),alive=useRef(true),chain=useRef(Promise.resolve()),pending=useRef([]);
 const startedAt=useRef(0),gateStart=useRef(0),lastResult=useRef(null),pausedRef=useRef(paused);
 // gates for rendering (a missed gate eases the next one); `gates` mirrors it for callbacks
 const [shown,setShown]=useState(()=>session.gates.map(g=>({...g})));
 const [phase,setPhase]=useState(session.phase==='complete'?'done':'loading'),[current,setCurrent]=useState(session.round),[passed,setPassed]=useState(session.round);
 const [live,setLive]=useState(false),[recapAt,setRecapAt]=useState(-1),[tilt,setTilt]=useState(false),[hint,setHint]=useState(true),[fallback,setFallback]=useState('');
 const track=session.track||session.gates[0]?.track||'letters';
 const log=(name,detail)=>{try{event('gameplay',name,typeof detail==='string'?detail:JSON.stringify(detail));}catch{}};
 // Speak a line and resolve when it has finished (or after a fair estimate if the browser could not play it).
 async function say(text){
  const v=voice.current;if(!v||!text)return sleep(1500);
  const played=await v.speak(text,true);
  if(!played){await sleep(700+text.length*70);return;}
  const player=v.player;
  await new Promise(res=>{let t=0;const done=()=>{clearTimeout(t);player.removeEventListener('ended',done);player.removeEventListener('error',done);player.removeEventListener('emptied',done);res();};
   t=setTimeout(done,Math.min(9000,1200+text.length*110));player.addEventListener('ended',done);player.addEventListener('error',done);player.addEventListener('emptied',done);if(player.ended)done();});
 }
 function ask(i){const g=gates.current[i];if(!g)return Promise.resolve();setCurrent(i);gateStart.current=performance.now();scene.current?.promptStarted(i);
  return say(g.prompt).then(()=>{scene.current?.promptEnded(i);});}
 const queue=fn=>{chain.current=chain.current.then(()=>alive.current?fn():null).catch(()=>{});return chain.current;};
 function passGate(i,answer){
  const g=gates.current[i];if(!g)return;const ok=answer===g.answer;
  setPassed(i+1);setHint(false);log('slalom_gate',{gate:i,kind:g.kind,answer:g.answer,chose:answer,ok,ms:Math.round(performance.now()-gateStart.current)});
  if(ok)audio.current?.feedback(true);
  pending.current.push(submitGate(g.id,answer,Math.min(86400000,Math.round(performance.now()-gateStart.current))).then(d=>{if(d?.result)lastResult.current=d.result;return d;}));
  const next=gates.current[i+1];
  if(!ok&&next){const eased=easeGate(next);gates.current[i+1]=eased;setShown([...gates.current]);scene.current?.replaceGate(i+1,eased);}
  // Words: every gate is sounded out afterwards ("m, a, t: mat"), right or wrong. Letters: a miss names the right
  // letter. Both are content, always spoken (Kokoro clips only). Then the next gate's question.
  queue(async()=>{if(g.after)await say(g.after);else if(!ok)await say(g.correction);else await sleep(450);if(next)await ask(i+1);});
 }
 async function finish(){
  await Promise.allSettled(pending.current);if(!alive.current)return;
  const d=scene.current?.stats();if(d)log('slalom_perf',{...d,runMs:Math.round(performance.now()-startedAt.current)});
  setPhase('recap');
  // the child's own toys (if this home has them) wait at the bottom and cheer
  void (async()=>{try{const r=await fetch(`/api/${p.id}/companions`,{cache:'no-store'});if(!r.ok)return;const {files=[]}=await r.json();const pick=[...files].sort(()=>Math.random()-0.5).slice(0,2);
   const n=await scene.current?.addCompanions(pick.map(f=>`/companion/${f}.glb`));if(n)log('slalom_companions',pick.join(','));}catch{}})();
  await queue(async()=>{
   await sleep(1200);
   await say(track==='letters'?SLALOM_LINES.recapLetters:SLALOM_LINES.recapWords);
   for(let k=0;k<gates.current.length&&alive.current;k++){setRecapAt(k);await say(gates.current[k].recap);await sleep(150);}
   setRecapAt(gates.current.length);
  });
  if(!alive.current)return;
  setPhase('break');await checkpoint('mission-complete');if(!alive.current)return;
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
    scene.current=mod.createSlalomScene(host.current,{gates:gates.current,startGate:session.round,forceQuality:qualityParam(),sound,
     onGate:(i,answer)=>passGate(i,answer),onFinish:()=>void finish(),onStats:s=>log('slalom_quality',s),onContextLost:()=>{log('slalom_error','context lost');setFallback('lost');}});
    window.__slalom=scene.current;setLive(true);
    setPhase('run');log('slalom_start',{gate:session.round,track,size:`${innerWidth}x${innerHeight}`});
    queue(async()=>{
     await sleep(400);
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
 // keyboard for grown-ups: arrows move one lane
 useEffect(()=>{const key=e=>{if(e.target.closest?.('input,select,textarea,summary'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();scene.current?.steer(e.key==='ArrowLeft'?-1:1);setHint(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 // tilt to steer (optional)
 useEffect(()=>{if(!tilt)return;const on=e=>{const angle=(screen.orientation?.angle??window.orientation??0)%360;let v=Math.abs(angle)===90?(angle===90?e.beta:-e.beta):angle===180?-e.gamma:e.gamma;if(!Number.isFinite(v))return;scene.current?.setTilt(Math.max(-1,Math.min(1,v/20)));};
  window.addEventListener('deviceorientation',on);return()=>{window.removeEventListener('deviceorientation',on);scene.current?.setTilt(null);};},[tilt]);
 async function toggleTilt(){if(tilt){setTilt(false);return;}try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission&&await DeviceOrientationEvent.requestPermission()!=='granted')return;}catch{return;}setTilt(true);log('slalom_tilt','on');}
 const canTilt=typeof window!=='undefined'&&'DeviceOrientationEvent' in window&&matchMedia('(pointer:coarse)').matches;
 const g=shown[Math.min(current,shown.length-1)];
 const hear=()=>{if(g&&phase==='run')void voice.current?.speak(g.prompt,true);log('slalom_hear',String(current));};
 // 2D quick version (no WebGL): same gates, tap the one you hear
 function tapGate(answer){if(passed>current||!g)return;passGate(current,answer);if(current+1>=gates.current.length)void finish();}
 const name=p.name;
 const finishCard=<section className={'complete slalom-finish'+(live?' over':'')} aria-live="polite">
  <span className="medal" aria-hidden="true">⛷️</span>
  <h2>What a run, {name}!</h2>
  <div className="slalom-recap-row">{shown.map((x,k)=><span key={k} className={'slalom-card '+x.kind}>{x.picture&&<i aria-hidden="true">{x.picture}</i>}{x.answer}</span>)}</div>
  <p>{track==='letters'?'Your letters from the mountain.':'Your words from the mountain.'}</p>
  <div className="slalom-finish-actions"><button className="primary" onClick={onAgain}>Ski again ⛷️</button><button onClick={onHome}>Choose another game</button></div>
 </section>;
 if(phase==='done'&&!live)return finishCard;
 return <div className={'slalom-root'+(paused?' is-paused':'')} ref={host} data-phase={phase}>
  {phase==='loading'&&<div className="slalom-loading"><span aria-hidden="true">⛷️</span><p>Waxing the skis…</p></div>}
  {fallback&&phase!=='recap'&&phase!=='break'&&g&&<div className="slalom-flat"><p>{fallback==='lost'?'The snow needs a rest on this screen. Here is the quick version.':'Here is the quick version of the slalom.'}</p><div className="slalom-flat-gates">{g.options.map(o=><button key={o} onClick={()=>tapGate(o)}>{o}</button>)}</div></div>}
  <div className="slalom-hud">
   <div className="slalom-top">
    <button className="slalom-btn" onClick={onHome} aria-label="Back to Arcade">←</button>
    <button className="slalom-btn" onClick={onPause} aria-label="Pause">Ⅱ</button>
    {phase==='run'&&g&&passed<shown.length?<div className="slalom-prompt" role="status">
     <button className="slalom-hear" onClick={hear} aria-label="Hear it again">🔊</button>
     {g.kind==='first-letter'&&<span className="slalom-picture" aria-hidden="true">{g.picture}</span>}
     {g.kind==='next-word'&&<span className="slalom-sentence">{g.before.join(' ')} <b>___</b></span>}
     {(g.kind==='find-letter'||g.kind==='read-word')&&<span className="slalom-listen">{g.kind==='find-letter'?'Which letter?':'Which word?'}</span>}
    </div>:<span/>}
    <div className="slalom-dots" aria-label={`Gate ${Math.min(passed+1,shown.length)} of ${shown.length}`}>{shown.map((_,k)=><i key={k} className={k<passed?'done':k===passed?'now':''}/>)}</div>
   </div>
   {phase==='run'&&!fallback&&<div className="slalom-bottom">{hint&&<span className="slalom-hint">👆 Slide your finger to steer</span>}{canTilt&&<button className={'slalom-btn tilt'+(tilt?' on':'')} onClick={toggleTilt} aria-pressed={tilt}>📱 Tilt</button>}</div>}
  </div>
  {phase==='done'&&finishCard}
  {(phase==='recap'||phase==='break')&&<div className="slalom-recap" aria-live="polite"><h2>{track==='letters'?'Your letters':'Your words'}</h2><div className="slalom-recap-row">{shown.map((x,k)=><span key={k} className={'slalom-card '+x.kind+(k===recapAt?' now':k<recapAt?' seen':'')}>{x.picture&&<i aria-hidden="true">{x.picture}</i>}{x.answer}</span>)}</div></div>}
 </div>;
}
