'use client';
import './planning.css';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogTrigger,DialogClose} from '@/components/ui/dialog';
import {PLAN_GOALS,PLAN_CARDS,PLAN_LINES,planSteps,planChoices} from '@/lib/planning.mjs';
import {say,stopVoice,chime} from '@/lib/audio';

export function Planning({planning:a,player,act,busy,sound,active,error,report}:{planning:any,player:string,act:(v:any)=>Promise<any>,busy:boolean,sound:boolean,active:boolean,error:string,report:(n:string,d:string)=>void}){
 const s=a?.session,g=PLAN_GOALS.find(g=>g.id===s?.goal),[visible,setVisible]=useState(true),[menu,setMenu]=useState(false),[speaking,setSpeaking]=useState(false);
 const latest=useRef<any>(null),lastVoice=useRef(''),sent=useRef('');latest.current={s,busy,active,error,visible,menu};
 const voiceToken=useRef(0);
 const speak=(text:string)=>{const token=++voiceToken.current;setSpeaking(true);void say(text,e=>{report('voice',JSON.stringify({text,event:e}));if(voiceToken.current===token)setSpeaking(e==='play_started');});};
 const send=(kind:string,extra:any={})=>act({kind,planId:s?.id,...extra});
 useEffect(()=>{const update=()=>{setVisible(document.visibilityState==='visible');if(document.visibilityState!=='visible')stopVoice();};document.addEventListener('visibilitychange',update);return()=>{document.removeEventListener('visibilitychange',update);stopVoice();};},[]);
 useEffect(()=>{
  if(!active||!visible||!sound||menu||s?.paused){voiceToken.current++;stopVoice();setSpeaking(false);}
 },[active,visible,sound,menu,s?.paused]);
 useEffect(()=>{
  if(!active||!visible||!sound||menu||s?.paused)return;
  const key=[s?.id,s?.phase,s?.cursor,s?.line].join(':');if(key===lastVoice.current)return;lastVoice.current=key;
  if(s?.phase==='plan'&&s.plan.length>0&&s.line===PLAN_LINES.plan)return;
  speak(s?.line||PLAN_LINES.choose);
  if(s?.phase==='success')chime();
 },[s?.id,s?.phase,s?.cursor,s?.line,active,visible,sound,menu,s?.paused]);
 useEffect(()=>{
  if(!s||s.phase!=='running'||s.paused||!active||!visible||busy||error||menu||speaking)return;
  const token=s.id+':'+s.tries+':'+s.cursor;
  const timer=setTimeout(()=>{const v=latest.current;if(v.busy||v.error||!v.active||!v.visible||v.menu||v.s?.paused||v.s?.id!==s.id||v.s.cursor!==s.cursor||sent.current===token)return;sent.current=token;void send('plan_step',{step:s.cursor}).catch(()=>{}).finally(()=>{sent.current='';});},1100);
  return()=>clearTimeout(timer);
 },[s?.id,s?.phase,s?.tries,s?.cursor,s?.paused,active,visible,busy,error,menu,speaking]);
 const choose=(goal:string)=>{stopVoice();void act({kind:'plan_start',goal}).catch(()=>{});};
 if(!s)return <section className="playboard planning-home"><p className="eyebrow">YOUR IDEA · YOUR PLAN</p><h1>{player==='beginner'?"Beginner’s":player==='admin'?"Admin’s":"Explorer’s"} Plan & Play</h1><p>Choose a goal. Make a plan. Watch Rook try it.</p><div className="plan-goals">{PLAN_GOALS.map(goal=><Button key={goal.id} className={'plan-goal '+goal.id} variant="outline" disabled={busy} onClick={()=>choose(goal.id)}><span>{goal.icon}</span><strong>{goal.title}</strong><small>Make my plan →</small></Button>)}</div><p>🏅 {a?.badges||0} plans that worked</p><small>You can change your plan. There is no timer.</small></section>;
 const cards=PLAN_CARDS as Record<string,any>,editing=['plan','review'].includes(s.phase)&&!s.paused,disabled=busy||!editing,w=s.world,theme=['meadow','sunset','night'][s.serial%3];
 const edit=(next:string[])=>{stopVoice();void send('plan_cards',{cards:next}).catch(()=>{});};
 const add=(card:string)=>{if(disabled||s.plan.includes(card)||s.plan.length>=planSteps(s).length)return;if(sound)speak(cards[card].line);void send('plan_cards',{cards:[...s.plan,card]}).catch(()=>{});};
 const actorX=s.goal==='bridge'?(w.actor==='finish'?84:w.actor==='river'?38:15):s.goal==='garden'?(w.actor==='soil'?55:17):w.actor==='friend'?76:w.actor==='picnic'?53:15;
 return <section className="playboard planning-play"><div className="plan-heading"><Dialog open={menu} onOpenChange={v=>{setMenu(v);stopVoice();}}><DialogTrigger render={<Button variant="outline" aria-label="Open planning menu">☰</Button>}/><DialogContent><DialogTitle>Your plan is saved</DialogTitle><DialogClose render={<Button>Keep planning</Button>}/><Button variant="outline" disabled={busy} onClick={()=>{void send(s.paused?'plan_resume':'plan_pause');setMenu(false);}}>{s.paused?'Resume plan':'Take a break'}</Button><Button variant="outline" disabled={busy} onClick={()=>{void send('plan_leave');setMenu(false);}}>Choose another goal</Button><p>Earned badges stay yours.</p></DialogContent></Dialog><h1>{g?.title}</h1><Button variant="outline" aria-label="Hear plan instruction" onClick={()=>speak(s.line||g!.prompt)}>🔊</Button></div>
 <p className="plan-caption">{planSteps(s).length} picture steps · 🏅 {a.badges} plans</p>
 <div className={'plan-stage '+s.goal+' '+theme} role="img" aria-label={`${g?.title}. ${s.line}`}>
  {s.goal==='bridge'?<><div className="plan-river"/><span className="plan-location wood">{w.wood?'🪵':'🪵 ?'}</span>{w.bridge&&<span className="plan-bridge">🌉</span>}<span className="plan-destination">{['🐢','🦊','🐧'][s.serial%3]}</span></>:s.goal==='garden'?<><span className="plan-location soil">{w.flower?'🌷':w.seed?'🌱':w.hole?'🕳️':'🟫'}</span>{s.events.at(-1)?.card==='water'&&<span className="plan-water" key={s.tries+':'+s.cursor}>💧</span>}</>:<><span className={'plan-location picnic-blanket '+(w.blanket?'laid':'')}>{w.blanket?'▦':'·'}</span>{w.food&&<span className="plan-food">🧺 🍎</span>}<span className={'plan-guest '+(w.guest?'arrived':'')}>🐰</span></>}
  <img className={'plan-rook '+(s.phase==='running'?'moving':'')+(w.wave?' waving':'')} src="/rook.svg" alt="" style={{left:actorX+'%'}}/>
  {s.phase==='success'&&<span className="plan-sparkles" aria-hidden="true">✨ 🎉 ✨</span>}
 </div>
 <p className={'plan-narration '+(s.phase==='review'?'try-again':'')} role="status" aria-live="polite">{s.paused?PLAN_LINES.pause:s.line}</p>
 <div className="plan-slots" aria-label="Your plan">{Array.from({length:planSteps(s).length},(_,i)=>{const card=s.plan[i],event=s.events[i];return <div className={'plan-slot '+(s.phase==='running'&&s.cursor===i?'current':'')} key={i}><span className="plan-order">{i+1}</span><Button variant="outline" disabled={disabled||!card} aria-label={card?`Remove step ${i+1}: ${cards[card].name}`:`Step ${i+1}: choose a picture`} onClick={()=>edit(s.plan.filter((_:string,j:number)=>j!==i))}><span>{card?cards[card].icon:'?'}</span><strong>{card?cards[card].name:'Choose a picture'}</strong>{event&&<small>{event.ok?'✓':'Try another order'}</small>}</Button>{editing&&card&&i>0&&<Button variant="ghost" disabled={busy} aria-label={`Move step ${i+1} earlier`} onClick={()=>{const next=[...s.plan];[next[i-1],next[i]]=[next[i],next[i-1]];edit(next);}}>← Earlier</Button>}</div>;})}</div>
 {s.paused?<Button className="big-play" disabled={busy} onClick={()=>void send('plan_resume')}>▶ Resume my plan</Button>:s.phase==='success'?<><p className="plan-success">Your plan worked! 🏅</p><p>You chose the steps. Rook tried your idea.</p><div className="plan-next">{PLAN_GOALS.map(goal=><Button key={goal.id} variant="outline" disabled={busy} onClick={()=>choose(goal.id)}>{goal.icon} {goal.title}</Button>)}</div></>:<>
 {editing&&<><p>Tap pictures to add steps. Tap a step to remove it.</p><div className="plan-bank">{planChoices(s).map(card=><Button className="plan-card" key={card} variant="outline" disabled={disabled||s.plan.includes(card)||s.plan.length===planSteps(s).length} onClick={()=>add(card)}><span>{cards[card].icon}</span><strong>{cards[card].name}</strong></Button>)}</div><Button className="big-play" disabled={disabled||s.plan.length!==planSteps(s).length} onClick={()=>{stopVoice();void send('plan_run');}}>▶ {s.phase==='review'?'Try my plan again':'Try my plan'}</Button><Button variant="ghost" disabled={busy} onClick={()=>void send('plan_help')}>💡 Help me think</Button></>}
 {s.phase==='running'&&<p>Rook is trying step {Math.min(s.cursor+1,s.plan.length)}…</p>}
 {s.phase==='review'&&<p>No points lost. Change a step above, then try your idea.</p>}
 </>}
 </section>;
}
