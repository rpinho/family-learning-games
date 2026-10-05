'use client';
// Letter Slalom as its own small app (no Word Arcade shell): player banner, snowy loading screen, skis/snowboard start
// screen, the run (Slalom.jsx) and the finish. Same saves, API, voice and word break as inside Word Arcade.
import {useEffect,useRef,useState} from 'react';
import './player-banner.css';
import './slalom.css';
import Slalom,{SlalomStart} from './Slalom';
import {CoachVoice} from '../lib/voice.mjs';
import {ArcadeAudio,audioPreferences} from '../lib/arcade-audio.mjs';
import {wordBreak,fetchWordLevel,DEFAULT_TRACK} from '../lib/word-break.mjs';
const PLAYERS={includes:id=>/^(?:(?:beginner|explorer)(?:_[1-9]\d{0,3})?|admin)$/.test(id)};
function Boot({text}){return <section className="slalom-boot" aria-live="polite"><div className="slalom-boot-hill" aria-hidden="true"><span>⛷️</span><span>🏂</span></div><h1>Letter Slalom</h1><p>{text}</p></section>;}
export default function SlalomApp(){
 const [p,setP]=useState(null),[id,setId]=useState(null),[phase,setPhase]=useState('boot'),[busy,setBusy]=useState(false),[paused,setPaused]=useState(false),[error,setError]=useState('');
 const current=useRef(null),voice=useRef(null),audio=useRef(null),soundRef=useRef(true),lock=useRef(false),gateQueue=useRef(Promise.resolve());
 const event=async(kind,name='',detail='')=>{const who=current.current?.id||id||new URLSearchParams(location.search).get('player');if(!PLAYERS.includes(who))return;try{await fetch(`/api/${who}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[{kind,name,detail,game:'slalom'}]})});}catch{}};
 async function action(input){if(lock.current||!current.current)return null;lock.current=true;setBusy(true);
  try{const old=current.current,r=await fetch(`/api/${old.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,questionId:input.questionId??old.session?.q?.id,revision:old.revision})}),d=await r.json();
   if(!r.ok){if(d.profile){current.current=d.profile;setP(d.profile);}throw Error(d.error);}current.current=d.profile;setP(d.profile);return d;}
  catch(e){void event('error','request',e.message);return null;}finally{lock.current=false;setBusy(false);}}
 function submitGate(questionId,answer,durationMs,hinted=false){const task=gateQueue.current.then(async()=>{for(let i=0;i<6;i++){for(let w=0;w<60&&lock.current;w++)await new Promise(r=>setTimeout(r,100));const res=await action({kind:'answer',gate:true,questionId,answer,durationMs,...(hinted?{hinted:true}:{})});if(res)return res;if(current.current?.session?.q?.id!==questionId)return null;await new Promise(r=>setTimeout(r,700*(i+1)));}return null;});gateQueue.current=task.catch(()=>{});return task;}
 async function checkpoint(reason,item){voice.current?.stop();try{const who=current.current.id,lvl=await fetchWordLevel(`/api/${who}/word-break`,DEFAULT_TRACK[who]);await wordBreak({player:who,level:lvl,effects:()=>!!audio.current?.prefs?.effects,speak:(line,essential)=>{if(soundRef.current||essential)return voice.current?.speakToEnd(line,essential);},log:r=>void event('word-break',reason,JSON.stringify(r)),reason,...(item?{item}:{})});}catch(e){void event('error','word-break',e.message);}}
 // leaving goes back to the Games home screen when inside the hub
 function exit(){voice.current?.stop();try{if(window.parent!==window){window.parent.location.hash='';return;}}catch{}setPhase('start');}
 async function start(ride,track){voice.current?.stop();void audio.current?.unlock();const d=await action({kind:'start',game:'slalom',...(ride?{ride}:{}),...(track?{track}:{})});if(d){setPaused(false);setPhase('run');void event('button','slalom_start',[ride||'',track||''].join(' ').trim());}}
 useEffect(()=>{
  const q=new URLSearchParams(location.search).get('player'),who=PLAYERS.includes(q)?q:'explorer';
  voice.current=new CoachVoice(setError,(kind,detail)=>void event('voice',kind,JSON.stringify(detail)));
  audio.current=new ArcadeAudio({record:(name,detail)=>void event('audio',name,JSON.stringify(detail))});
  let prefs=audioPreferences();try{prefs=audioPreferences(JSON.parse(localStorage.getItem(`word-arcade-audio-v1:${who}`)));}catch{}
  // the calm slalom: a snowy valley's soft wind unless a grown-up chose another bed or music
  if(prefs.track==='calm-night'||prefs.track==='calm-meadow')prefs={...prefs,track:'calm-snow'};audio.current.configure(prefs);
  (async()=>{try{const r=await fetch(`/api/${who}`),d=await r.json();if(!r.ok)throw Error(d.error);current.current=d.profile;setId(who);setP(d.profile);setPhase('start');void event('open','slalom',`${innerWidth}×${innerHeight}`);
    // while the child chooses skis or snowboard: the voice list and the 3D code arrive in the background
    void voice.current.ready;void import('./slalom-scene.mjs');}
   catch(e){setId(who);setError(e.message||'Could not load');}})();
  const hidden=()=>{if(document.hidden){voice.current?.stop();setPaused(true);}};document.addEventListener('visibilitychange',hidden);
  return()=>{document.removeEventListener('visibilitychange',hidden);voice.current?.stop();voice.current?.player?.remove();audio.current?.dispose();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const name=id==='admin'?'Admin · Alex':p?.name||'';
 return <div className="slalom-app" onPointerDownCapture={()=>void audio.current?.unlock()}>
  {id&&<div className="active-player-banner" data-player={id} aria-label="Active player">{name}</div>}
  {(phase==='boot'||!p)&&<Boot text={error?`${error} Tap Games and try again.`:'Waxing the skis…'}/>}
  {p&&phase==='start'&&<SlalomStart p={p} busy={busy} onStart={(ride,track)=>void start(ride,track)} onBack={exit}/>}
  {p&&phase==='run'&&p.session?.game==='slalom'&&<Slalom key={p.session.run} p={p} session={p.session} voice={voice} soundRef={soundRef} audio={audio} paused={paused} onPause={()=>{voice.current?.stop();setPaused(true);}} onHome={exit} onAgain={()=>void start()} submitGate={submitGate} checkpoint={checkpoint} event={event}/>}
  {paused&&phase==='run'&&<div className="overlay"><section role="dialog" aria-modal="true" aria-label="Paused"><h2>Take your time.</h2><button className="primary" onClick={()=>setPaused(false)}>Continue →</button><button onClick={exit}>Back to Games</button></section></div>}
 </div>;
}
