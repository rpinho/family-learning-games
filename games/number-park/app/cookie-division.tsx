'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';

type Props={q:any;draft:(number|null)[];disabled:boolean;result:any;message?:string;helped:boolean;place:(draft:(number|null)[])=>void;check:()=>void;report:(name:string,detail:string)=>void};

export function CookieDivision({q,draft,disabled,result,message,helped,place,check,report}:Props){
 const [selected,setSelected]=useState<number|null>(null);
 const [drag,setDrag]=useState<{id:number;x:number;y:number}|null>(null);
 const moved=useRef(false);
 const spots=Array.isArray(draft)&&draft.length===q.total?draft:Array(q.total).fill(null);
 const remaining=spots.filter(v=>v===null).length;
 const counts=Array.from({length:q.plates},(_,i)=>spots.filter(v=>v===i).length);
 const full=remaining===0,equal=full&&counts.every(n=>n===counts[0]);
 const put=(id:number,plate:number|null)=>{if(disabled||result)return;const next=[...spots];next[id]=plate;setSelected(null);place(next);report('place',`${plate===null?'back':plate}: ${next.filter(v=>v!==null).length}/${q.total}`);};
 const targetPlate=(x:number,y:number)=>{const hit=document.elementFromPoint(x,y)?.closest('[data-cookie-plate]');return hit?Number(hit.getAttribute('data-cookie-plate')):null;};
 const finishDrag=(e:React.PointerEvent<HTMLButtonElement>,id:number)=>{
  if(!drag||drag.id!==id)return;
  const destination=targetPlate(e.clientX,e.clientY);
  if(destination!==null)put(id,destination);
  else if(!moved.current)setSelected(id);
  setDrag(null);moved.current=false;
 };
 return <section className="cookie-game" aria-label="Share the cookies equally">
  <div className="cookie-count"><span className="cookie-mark" aria-hidden="true">🍪</span><strong>{q.total}</strong><span>cookies</span><span className="cookie-divider">÷</span><strong>{q.plates}</strong><span>plates</span></div>
  <div className="cookie-plates" aria-label="Plates">
   {counts.map((count,plate)=><button type="button" key={plate} data-cookie-plate={plate} className={'cookie-plate '+(full&&!equal&&count!==Math.min(...counts)?'cookie-plate-more ':'')+(result?'cookie-plate-done':'')} disabled={disabled||!!result} aria-label={`Plate ${plate+1}, ${count} cookies. Tap to place a cookie.`} onClick={()=>{const id=selected!==null&&spots[selected]===null?selected:spots.indexOf(null);if(id>=0)put(id,plate)}}>
    <span className="cookie-plate-label">PLATE {plate+1}</span><span className="cookie-plate-bowl">{spots.map((at,id)=>at===plate?<span className="cookie-shape" aria-hidden="true" key={id}/>:null)}</span><span className="cookie-plate-count">{count}</span>
   </button>)}
  </div>
  <div className="cookie-tray"><div className="cookie-tray-top"><strong>Cookie tray</strong><span>{remaining} left · tap or drag to a plate</span></div><div className="cookie-tray-pieces">{spots.map((at,id)=>at===null?<button type="button" key={id} className={'cookie-piece '+(selected===id?'cookie-selected':'')} disabled={disabled||!!result} aria-label={`Cookie ${id+1}, tap then choose a plate or drag it`} onClick={()=>{if(!moved.current)setSelected(id)}} onPointerDown={e=>{if(disabled||result)return;moved.current=false;setDrag({id,x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag?.id!==id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)moved.current=true;setDrag({id,x:e.clientX,y:e.clientY})}} onPointerUp={e=>finishDrag(e,id)} onPointerCancel={()=>{setDrag(null);moved.current=false}}><span className="cookie-shape" aria-hidden="true"/></button>:null)}</div></div>
  <p className="cookie-tip">{selected!==null?'Now tap a plate.':helped?'One on each plate. Go around again.':'Tap a plate to deal the next cookie, or drag one from the tray.'}</p>
  {spots.some(v=>v!==null)&&!result&&<div className="cookie-return">{counts.map((count,plate)=>count?<button type="button" key={plate} disabled={disabled} onClick={()=>put(spots.lastIndexOf(plate),null)}>↶ Take one back from plate {plate+1}</button>:null)}</div>}
  <div className="cookie-check"><Button className="big-play" disabled={disabled||!!result||!full} onClick={()=>{report('check',equal?'equal':'uneven');check()}}>Check my sharing →</Button><span role="status" aria-live="polite">{message||(remaining?`${remaining} cookies still in the tray.`:'Look at every plate. Are they equal?')}</span></div>
  {result&&<div className="cookie-equation" aria-label={`${q.total} divided by ${q.plates} equals ${counts[0]}`}>{q.total} ÷ {q.plates} = {counts[0]}</div>}
  {drag&&moved.current&&<span className="cookie-drag-ghost" style={{left:drag.x,top:drag.y}} aria-hidden="true"><span className="cookie-shape"/></span>}
 </section>;
}
