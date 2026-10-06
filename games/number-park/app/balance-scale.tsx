'use client';
import {useEffect,useRef,useState} from 'react';
import {useScaleMotion} from './use-scale-motion';
import {animalAngle} from '@/lib/balance-physics.mjs';
import {NumberBalance} from './balance-weights';
import type {CSSProperties,PointerEvent,ComponentProps} from 'react';
import {Button} from '@/components/ui/button';
import {ANIMALS,balanceTilt,expressionText,balanceExplanation} from '@/lib/balance.mjs';
export function ClassicBalanceScale({q,result,disabled,answer,answerDisabled=false,experiment,onExperiment}:{q:any,result:any,disabled:boolean,answer:(n:number)=>void,answerDisabled?:boolean,experiment?:{slots:(number|null)[],guess:number|null,weighed:boolean},onExperiment?:(e:{slots:(number|null)[],guess:number|null,weighed:boolean})=>void}){
 const animals=q.mode==='animals';
 // Prediction and placement are saved separately from the learning answer.
 const [slots,setSlots]=useState<(number|null)[]>(experiment?.slots||(result?[0,1]:[null,null]));
 const [guess,setGuess]=useState<number|null>(experiment?.guess??null),[weighed,setWeighed]=useState(!!result||!!experiment?.weighed);
 useEffect(()=>{if(experiment){setSlots(experiment.slots);setGuess(experiment.guess);setWeighed(experiment.weighed||!!result);}},[experiment,result]);
 const [drag,setDrag]=useState<{index:number,x:number,y:number}|null>(null);
 const gesture=useRef<{index:number,x:number,y:number,moved:boolean}|null>(null),stage=useRef<HTMLDivElement>(null),skipClick=useRef(false);
 const placed=result?slots.map((n,i)=>n??i):slots,ready=placed.every(n=>n!==null);
 const kg=(i:number|null)=>i===null?0:([q.left,q.right][i].kg??ANIMALS.find((a:any)=>a.name===[q.left,q.right][i].name)?.kg??0);
 const target=animals?animalAngle(kg(placed[0]),kg(placed[1])):balanceTilt(q,result);
 const angle=useScaleMotion(target),dy=-Math.sin(angle*Math.PI/180)*205;
 const shift=205*(1-Math.cos(angle*Math.PI/180));
 const save=(nextSlots:(number|null)[],nextGuess=guess,nextWeighed=weighed)=>onExperiment?.({slots:nextSlots,guess:nextGuess,weighed:nextWeighed});
 const motion={'--tip':`${angle}deg`,'--needle':`${angle*4.5}deg`} as CSSProperties;
 const place=(index:number,side:number)=>{
  if(disabled||result||weighed||slots[side]!==null)return;
  const next=slots.map((n,i)=>i===side?index:n===index?null:n);setSlots(next);save(next);
 };
 const down=(e:PointerEvent<HTMLButtonElement>,index:number)=>{
  skipClick.current=false;
  if(disabled||result||weighed||placed.includes(index))return;
  gesture.current={index,x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current,box=stage.current?.getBoundingClientRect();if(!g||!box)return;
  if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)g.moved=true;
  if(g.moved)setDrag({index:g.index,x:(e.clientX-box.left)/box.width*600,y:(e.clientY-box.top)/box.height*420});
 };
 const up=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current,box=stage.current?.getBoundingClientRect();gesture.current=null;setDrag(null);if(!g||!box)return;
  if(g.moved){skipClick.current=true;const x=(e.clientX-box.left)/box.width*600,y=(e.clientY-box.top)/box.height*420;
   const side=x<300?0:1;if(Math.abs(x-(side===0?95:505))<95&&y>85&&y<275)place(g.index,side);
  }
 };
 const pan=(side:'left'|'right',index:number)=>{
  const item=q[side],x=index===0?95:505;
  const text=q.mode==='complete'&&side==='right'?`${item.a} + ${result?(result.picked??result.answer):'?'}`:expressionText(item);
  return <g className="balance-pan" style={{transform:`translate(${index===0?shift:-shift}px,${index===0?dy:-dy}px)`}}>
   <path d={`M ${x} 110 L ${x-80} 244 M ${x} 110 L ${x+80} 244`} fill="none" stroke="#ad8c60" strokeWidth="3"/>
   {!animals&&<><rect x={x-78} y="139" width="156" height="102" rx="20" fill="#fffdf8" stroke="#d6c3a3" strokeWidth="2"/><text x={x} y="203" textAnchor="middle" className="balance-expression">{text}</text></>}
   <ellipse cx={x} cy="243" rx="88" ry="14" fill="url(#pan-depth)" stroke="#987044" strokeWidth="3"/>
   <path d={`M ${x-88} 243 Q ${x} 283 ${x+88} 243 L ${x+88} 251 Q ${x} 292 ${x-88} 251 Z`} fill="url(#balance-wood)" stroke="#987044" strokeWidth="3"/>
   {animals&&!result&&placed[index]===null&&<path d={`M ${x-14} 214 H ${x+14} M ${x} 200 V 228`} stroke="#90734d" strokeWidth="3" strokeLinecap="round"/>}
   {weighed&&animals&&<text x={x} y="305" textAnchor="middle" className="balance-weight">{kg(placed[index])} kg</text>}
  </g>;
 };
 return <section className="balance-game" aria-label="Balance scale puzzle" data-answered={!!result} data-angle={target} data-motion-angle={angle} data-weighed={weighed} data-ready={ready} style={motion}>
  <div className="balance-stage" ref={stage}>
   <svg className="balance-scene" viewBox="0 0 600 420" role="img" aria-label={weighed||result?(angle===0?'The scale is balanced.':angle<0?'The left pan is lower.':'The right pan is lower.'):'Place the animals, then release the scale to weigh them.'}>
    <defs><linearGradient id="balance-sky" x2="0" y2="1"><stop stopColor="#d8edf0"/><stop offset="1" stopColor="#f4f4df"/></linearGradient><linearGradient id="balance-wood" x2="0" y2="1"><stop stopColor="#cba574"/><stop offset=".5" stopColor="#b48b59"/><stop offset="1" stopColor="#a67c4c"/></linearGradient><radialGradient id="pan-depth" cx="40%" cy="30%"><stop stopColor="#fff1cc"/><stop offset=".65" stopColor="#d8b680"/><stop offset="1" stopColor="#9b7445"/></radialGradient><clipPath id="balance-window"><path d="M 34 269 V 130 A 266 115 0 0 1 566 130 V 269 Z"/></clipPath></defs>
    <rect width="600" height="420" rx="28" fill="#f1e9d8"/>
    <path d="M 34 269 V 130 A 266 115 0 0 1 566 130 V 269 Z" fill="url(#balance-sky)" stroke="#dfd1b5" strokeWidth="12"/>
    <g clipPath="url(#balance-window)"><path d="M 20 225 Q 145 156 306 232 Q 456 162 585 208 V 280 H 20 Z" fill="#c0d5b0"/><path d="M 20 252 Q 196 194 358 252 Q 470 215 585 237 V 282 H 20 Z" fill="#a9c69e"/><path d="M 95 72 Q 102 49 122 61 Q 138 40 156 66 Q 180 66 180 81 H 97 Z M 407 98 Q 414 80 429 86 Q 445 65 465 93 Q 487 92 487 109 H 408 Z" fill="#fffdf5" opacity=".8"/></g>
    <path d="M 0 275 Q 300 260 600 275 V 420 H 0 Z" fill="#e7d7bb"/>
    <ellipse cx="300" cy="355" rx="275" ry="58" fill="#e6cfa7" stroke="#cfb78e" strokeWidth="3"/>
    <ellipse cx="300" cy="355" rx="256" ry="49" fill="none" stroke="#f3e4c7" strokeWidth="3"/><ellipse cx="300" cy="355" rx="234" ry="40" fill="none" stroke="#d8be96" strokeWidth="2"/>
    {[0,1].map(i=><ellipse key={i} className="scale-shadow" cx={i===0?95+shift:505-shift} cy="332" rx={75+(i===0?dy:-dy)*.35} ry={9+(i===0?dy:-dy)*.035} fill="#70552a" opacity={.12+(i===0?dy:-dy)*.0015}/>)}
    <ellipse cx="300" cy="321" rx="96" ry="14" fill="#ad9a74" opacity=".25"/>
    <path d="M 243 309 L 251 160 Q 250 95 300 94 Q 350 95 349 160 L 357 309 Z" fill="url(#balance-wood)" stroke="#967147" strokeWidth="3"/><path d="M 349 160 L 357 309 L 369 300 L 361 159 Q 358 105 321 98 Q 351 115 349 160 Z" fill="#80603e"/>
    <path d="M 263 300 L 269 166 Q 268 121 300 121 Q 332 121 331 166 L 337 300 Z" fill="#e6edda" stroke="#aa8758" strokeWidth="3"/>
    <path d="M 247 154 Q 242 230 252 293 M 344 171 Q 349 224 344 288" fill="none" stroke="#dfbd8b" strokeWidth="2" opacity=".65"/>
    <rect x="218" y="307" width="164" height="17" rx="8" fill="#ac8659" stroke="#967147" strokeWidth="3"/>
    <g className="balance-beam"><path d="M 95 110 L 505 110" stroke="#957046" strokeWidth="15" strokeLinecap="round"/><path d="M 95 107 L 505 107" stroke="#d0ae7b" strokeWidth="6" strokeLinecap="round"/><circle cx="95" cy="110" r="7" fill="#ecd7ae"/><circle cx="505" cy="110" r="7" fill="#ecd7ae"/></g>
    {pan('left',0)}{pan('right',1)}
    <circle cx="300" cy="110" r="16" fill="#fff5da" stroke="#987044" strokeWidth="4"/>
    <path d="M 300 137 Q 280 144 300 163 Q 319 141 300 137 M 300 143 V 170" fill="#73977a" stroke="#52795f" strokeWidth="2"/>
    <g className="balance-dial"><path d="M 264 247 A 36 36 0 0 1 336 247" fill="none" stroke="#cad8bf" strokeWidth="2"/>{Array.from({length:9},(_,i)=>{const a=Math.PI+i*Math.PI/8;return <circle key={i} cx={300+36*Math.cos(a)} cy={247+36*Math.sin(a)} r="3.2" fill="#64856b"/>;})}<path className="balance-needle" d="M 300 248 L 296 216 L 300 207 L 304 216 Z" fill="#52795f"/><circle cx="300" cy="248" r="8" fill="#fff5da" stroke="#987044" strokeWidth="3"/></g>
   </svg>
   {animals&&[q.left,q.right].map((a:any,i:number)=>{
    const side=placed.indexOf(i),onPan=side!==-1,x=onPan?(side===0?95+shift:505-shift):(i===0?112:488),drop=onPan?(side===0?dy:-dy):0;
    const floating=drag?.index===i,style={left:`${(floating?drag.x:x)/6}%`,top:`${(floating?drag.y-57:onPan?127:294)/4.2}%`,'--card-drop':`${drop/6}cqw`} as CSSProperties;
    return <button key={i} type="button" className={'balance-animal-card '+(onPan?'on-pan':'on-ground')+(a.name.length>10?' long-name':'')+(floating?' dragging':'')+(result?.answer===i?' balance-correct':'')} style={style} data-animal={i} data-pan={side} disabled={disabled||!!result||onPan&&(!weighed||answerDisabled)} aria-label={onPan?`Choose ${a.name}`:`Place ${a.name} on a pan`} onKeyDown={()=>{skipClick.current=false;}} onPointerDown={e=>down(e,i)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;skipClick.current=true;setDrag(null);}} onClick={()=>{if(skipClick.current){skipClick.current=false;return;}if(onPan){if(weighed)answer(i);}else place(i,slots[i]===null?i:1-i);}}><span aria-hidden="true">{a.emoji}</span><strong>{a.name}</strong></button>;
   })}
  </div>
  {animals?<div className="animal-controls">
   {!weighed&&<><div className="animal-guess" role="group" aria-label="Optional guess: which pan will go down?">
    <span>Guess if you like: which pan will go down?</span>
    {[0,1].map(side=><button key={side} type="button" aria-pressed={guess===side} disabled={disabled} onClick={()=>{setGuess(side);save(slots,side,false);}}>{side===0?'← Left pan':'Right pan →'}</button>)}
   </div><Button className="animal-weigh" disabled={disabled||!ready} onClick={()=>{setWeighed(true);save(slots,guess,true);}}>Weigh them ⚖️</Button></>}
   <p className="balance-placement" role="status">{result?'':weighed?`${q.kinderBalance?'Who weighs more?':q.prompt} Tap the animal on its pan.`:ready?'Ready to weigh. You can guess or just watch.':'Drag an animal onto each pan, or tap the animals.'}</p>
   {weighed&&guess!==null&&<small>{guess===(kg(placed[0])>kg(placed[1])?0:1)?'Your guess matched the scale.':'Watch what happened: the heavier pan went down.'}</small>}
  </div>:<div className="balance-choices">{q.options.map((n:number)=><Button key={n} className={'balance-choice '+(result?.answer===n?'balance-correct':'')} disabled={disabled||!!result} onClick={()=>answer(n)}>{q.mode==='compare'?['← Left','Balanced','Right →'][n]:n}</Button>)}</div>}
  {result&&<p className="balance-explanation" aria-live="polite">{balanceExplanation(q,result)}{animals&&<small>Approximate adult weights. Individual animals vary.</small>}{q.mode==='complete'&&!result.ok&&<small>Choose {result.answer} to make both sides equal.</small>}</p>}
 </section>;
}

export function BalanceScale(props:ComponentProps<typeof ClassicBalanceScale>&{session?:any,draft?:number[],place:(draft:number[])=>void}){
 return props.q.weights?<NumberBalance {...props}/>:<ClassicBalanceScale {...props}/>;
}
