'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {isDragCookie,askLine,predictLine} from '@/lib/cookie-division.mjs';

type Props={q:any;draft:(number|null)[];disabled:boolean;result:any;message?:string;helped:boolean;place:(draft:(number|null)[])=>void;check:(guess?:{perPlate:number;leftover:number})=>void;report:(name:string,detail:string)=>void;ask?:{options:number[];tries:number;predict?:boolean}|null;answer?:(value:number)=>void;predicted?:number};

function CookieBuddy({happy,shared}:{happy:boolean;shared:number}){
 const furBody='M32 97 15 91 24 83 9 73 25 70 16 58 33 60 27 45 44 51 46 33 56 43 66 25 73 39 86 28 92 41 108 26 111 43 127 37 123 54 143 52 136 67 156 72 141 82 159 93 139 98 143 118 124 111 116 131 103 117 90 137 79 118 64 130 60 112 41 120Z';
 return <div className={'cookie-buddy '+(happy?'cookie-buddy-happy':'')} aria-label={happy?"Cookie Buddy cheers for fair sharing":"Cookie Buddy holds a cookie"}>
  <svg key={shared} className="cookie-buddy-art" viewBox="0 0 180 142" role="img" aria-label="An original orange Cookie Buddy holding a cookie">
   <defs><radialGradient id="monster-fur"><stop stopColor="#ffd18a"/><stop offset=".58" stopColor="#e98348"/><stop offset="1" stopColor="#b65934"/></radialGradient><radialGradient id="monster-cookie"><stop stopColor="#f5c16e"/><stop offset="1" stopColor="#cb7f35"/></radialGradient><clipPath id="monster-fur-clip"><path d={furBody}/></clipPath><filter id="monster-fur-texture"><feTurbulence type="fractalNoise" baseFrequency=".075" numOctaves="2" seed="7" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="4"/></filter></defs>
   <path d={furBody} fill="url(#monster-fur)" stroke="#9d4b31" strokeWidth="3" strokeLinejoin="round" filter="url(#monster-fur-texture)"/>
   <g clipPath="url(#monster-fur-clip)" opacity=".64">{Array.from({length:75},(_,i)=>{const x=22+(i*53%127),y=37+(i*37%88);return <path key={i} d={`M${x} ${y} q${i%2?4:-3} -5 ${i%2?8:2} -8`} fill="none" stroke={i%3?'#ffdb9b':'#ab5832'} strokeWidth={i%4===0?2:1.1} strokeLinecap="round"/>})}</g>
   <path className="cookie-buddy-arm" d="M38 103 7 108 26 114 14 120 41 122" fill="#e47b45" stroke="#9d4b31" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
   <path className="cookie-buddy-arm" d="M128 104l38 1-23 10 18 8-36-2" fill="#e47b45" stroke="#9d4b31" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
   <ellipse cx="72" cy="55" rx="21" ry="25" fill="white" stroke="#a25338" strokeWidth="3"/><ellipse cx="105" cy="53" rx="21" ry="25" fill="white" stroke="#a25338" strokeWidth="3"/>
   <circle className="cookie-buddy-pupil" cx="80" cy="59" r="6" fill="#181b24"/><circle className="cookie-buddy-pupil" cx="98" cy="57" r="6" fill="#181b24"/>
   <path className="cookie-buddy-mouth" d="M49 81 Q89 73 131 81 Q119 121 89 122 Q61 119 49 81Z" fill="#171c25" stroke="#a14e32" strokeWidth="4"/>
   <g className="cookie-buddy-cookie"><circle cx="133" cy="107" r="18" fill="url(#monster-cookie)" stroke="#965624" strokeWidth="3"/><circle cx="124" cy="102" r="3.2" fill="#733b24"/><circle cx="139" cy="101" r="3.2" fill="#733b24"/><circle cx="132" cy="115" r="3" fill="#733b24"/></g>
  </svg>
  <span className="cookie-buddy-name">Cookie Buddy</span>
 </div>;
}

export function CookieDivision({q,draft,disabled,result,message,helped,place,check,report,ask,answer,predicted}:Props){
 const [selected,setSelected]=useState<number|null>(null);
 const [drag,setDrag]=useState<{id:number;x:number;y:number}|null>(null);
 const [guessEach,setGuessEach]=useState<number|null>(null);
 const [guessLeft,setGuessLeft]=useState<number|null>(null);
 const moved=useRef(false);
 const spots=Array.isArray(draft)&&draft.length===q.total?draft:Array(q.total).fill(null);
 const remaining=spots.filter(v=>v===null).length;
 const counts=Array.from({length:q.plates},(_,i)=>spots.filter(v=>v===i).length);
 const leftover=q.mode==='leftover',monster=leftover?spots.filter(v=>v===q.plates).length:0;
 const full=remaining===0,equal=full&&counts.every(n=>n===counts[0]);
 const put=(id:number,plate:number|null)=>{if(disabled||result||ask)return;if(bags&&plate!==null&&spots.filter(v=>v===plate).length>=q.bagSize)return;const next=[...spots];next[id]=plate;setSelected(null);place(next);report('place',`${plate===null?'back':plate===q.plates&&leftover?'monster':plate}: ${next.filter(v=>v!==null).length}/${q.total}`);};
 const tapSlot=(slot:number)=>{const id=selected!==null&&spots[selected]!==slot?selected:spots.indexOf(null);if(id>=0)put(id,slot)};
 const targetPlate=(x:number,y:number)=>{const hit=document.elementFromPoint(x,y)?.closest('[data-cookie-plate]');return hit?Number(hit.getAttribute('data-cookie-plate')):null;};
 const finishDrag=(e:React.PointerEvent<HTMLElement>,id:number)=>{
  if(!drag||drag.id!==id)return;
  const destination=targetPlate(e.clientX,e.clientY);
  if(destination!==null&&destination!==spots[id])put(id,destination);
  else if(!moved.current)setSelected(selected===id?null:id);
  setDrag(null);moved.current=false;
 };
 const grab=(id:number)=>({
  onPointerDown:(e:React.PointerEvent<HTMLElement>)=>{if(disabled||result)return;e.stopPropagation();moved.current=false;setDrag({id,x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId)},
  onPointerMove:(e:React.PointerEvent<HTMLElement>)=>{if(drag?.id!==id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)moved.current=true;setDrag({id,x:e.clientX,y:e.clientY})},
  onPointerUp:(e:React.PointerEvent<HTMLElement>)=>finishDrag(e,id),
  onPointerCancel:()=>{setDrag(null);moved.current=false},
  onClick:(e:React.MouseEvent)=>e.stopPropagation()
 });
 const bags=q.mode==='bags',rows=q.mode==='rows';
 // Fading help: at 'hide' and 'own' the plate numbers are hidden until he
 // presses the existing Help button; he counts the cookies himself.
 const fade=q.fade||'show',faded=fade!=='show'&&!helped;
 const fixing=q.mode==='fix'||q.mode==='mixed',hide=(!!q.hideCounts||!!ask||faded)&&!result;
 const quietTips=fixing||faded;
 // Bags: show every bag that has cookies plus ONE empty bag, so the screen never
 // reveals how many bags are needed.
 const lastUsed=counts.reduce((m,c,i)=>c?i:m,-1),lastFull=lastUsed>=0&&counts[lastUsed]>=q.bagSize;
 const visible=bags?Array.from({length:Math.min(q.plates,lastUsed<0?1:lastUsed+1+(lastFull&&spots.some(v=>v===null)?1:0))},(_,i)=>i):counts.map((_,i)=>i);
 const filled=counts.filter(n=>n>0).length;
 const tilt=(id:number)=>({transform:`rotate(${(id*47)%31-15}deg) translate(${(id*13)%5-2}px,${(id*7)%5-2}px)`});
 const tip=selected!==null?`Now tap the ${bags?'bag':rows?'row':leftover?'plate or Cookie Buddy':'plate'} it should go to.`:ask?.predict?'Think first. Then share the cookies to check.':faded?(leftover?'Share them fairly. Extras go to Cookie Buddy.':'Share them fairly. Count carefully.'):leftover?(helped?'One on each plate. When a round will not go all the way, the rest go to Cookie Buddy.':'Deal cookies onto the plates. Cookies that cannot be shared go to Cookie Buddy.'):rows?(helped?'One in each row. Go around again.':'Tap a row to add the next cookie, or drag one from the tray.'):bags?(helped?'Fill one bag until it is full. Then start the next bag.':'Drag cookies into the bag. When it is full, a new bag appears.'):helped?(q.mode==='fix'?'Find the fullest plate. Move one cookie to the plate with the fewest.':q.mode==='mixed'?'Tray cookies go to the smallest plates first.':'One on each plate. Go around again.'):fixing?(q.mode==='fix'?'Drag a cookie from one plate to another, or tap a cookie then a plate.':'Drag cookies from the tray or between plates. The plates hide their numbers.'):'Tap a plate to deal the next cookie, or drag one from the tray.';
 if(!isDragCookie(q))return <section className="cookie-game cookie-plan" aria-label="Solve the cookie sharing challenge">
  <div className={'cookie-scene '+(q.mode==='snack'?'cookie-scene-snack':'')}><CookieBuddy shared={result?1:0} happy={!!result}/><div className="cookie-story">
   {q.mode==='snack'?<><div className="cookie-story-stage"><span className="cookie-story-chip">🍪 <strong>{q.baked}</strong> baked</span><span className="cookie-story-op">−</span><span className="cookie-story-chip cookie-story-snack">🍪 <strong>{q.eaten}</strong> eaten</span><span className="cookie-story-op">= ?</span></div><div className="cookie-story-stage"><span className="cookie-story-op">? ÷</span><span className="cookie-story-chip">{q.plates} friends</span></div></>:<><span className="cookie-story-chip">🍪 <strong>{q.total}</strong> cookies</span><span className="cookie-story-op">÷</span><span className="cookie-story-chip">{q.plates} friends</span></>}
  </div></div>
  <p className="cookie-plan-cue">{q.mode==='snack'?'Buddy ate some. Share what remains.':'Share fairly. Keep the extras.'}</p>
  <div className="cookie-plan-plates" aria-label="Friends' plates">{Array.from({length:q.plates},(_,plate)=><div className="cookie-plan-plate" key={plate}><span className={'cookie-friend cookie-friend-'+plate%5} aria-hidden="true"><i/><i/><b/></span><span className="cookie-plan-bowl">{guessEach===null?'?':<>🍪 <strong>× {result?q.answer:guessEach}</strong></>}</span></div>)}</div>
  <div className="cookie-plan-answers"><div><h2>🍪 On each plate</h2><div className="cookie-choice-grid">{Array.from({length:10},(_,i)=>i+1).map(n=><button type="button" key={n} className={guessEach===n?'chosen':''} disabled={disabled||!!result} onClick={()=>setGuessEach(n)} aria-pressed={guessEach===n}>{n}</button>)}</div></div><div><h2>🍪 Left over</h2><div className="cookie-choice-grid cookie-left-choices">{Array.from({length:q.plates},(_,n)=><button type="button" key={n} className={guessLeft===n?'chosen':''} disabled={disabled||!!result} onClick={()=>setGuessLeft(n)} aria-pressed={guessLeft===n}>{n}</button>)}</div></div></div>
  <div className="cookie-check"><Button className="big-play" disabled={disabled||!!result||guessEach===null||guessLeft===null} onClick={()=>{report('check',`plan ${guessEach} each, ${guessLeft} left`);check({perPlate:guessEach!,leftover:guessLeft!})}}>Check my plan →</Button><span role="status" aria-live="polite">{message||'How many for each friend? How many extra?'}</span></div>
  {result&&<div className="cookie-equation" aria-label={`${q.total} divided by ${q.plates} equals ${q.answer} with ${q.leftover} left over`}>{q.mode==='snack'&&<span>{q.baked} − {q.eaten} = {q.total} · </span>}{q.total} ÷ {q.plates} = {q.answer} <small>left over {q.leftover}</small></div>}
 </section>;
 const predictPanel=ask?.predict&&!result&&<div className="cookie-ask cookie-predict" role="group" aria-label={predictLine(q)}><h2>{predictLine(q)}</h2><div className="cookie-ask-choices">{ask.options.map(v=><button type="button" key={v} disabled={disabled} className="eq-answer" onClick={()=>{report('predict',String(v));answer?.(v)}}>{v}</button>)}</div></div>;
 return <section className={"cookie-game"+(fixing?" cookie-game-fix":"")+(leftover?" cookie-game-leftover":"")} aria-label="Share the cookies equally">
  <div className={'cookie-scene'+(fixing||leftover?' cookie-scene-fix':'')}>{leftover?<button type="button" data-cookie-plate={q.plates} className={'cookie-buddy-spot'+(selected!==null&&spots[selected]!==q.plates?' cookie-plate-target':'')} disabled={disabled||!!result} aria-label={`Cookie Buddy has ${monster} extra ${monster===1?'cookie':'cookies'}. Tap to give him one.`} onClick={()=>tapSlot(q.plates)}><CookieBuddy shared={monster} happy={!!result}/><span className="cookie-buddy-stash" aria-hidden="true">{spots.map((at,id)=>at===q.plates?<span key={id} role="button" aria-label="Take a cookie back from Cookie Buddy" className={'cookie-on-plate'+(selected===id?' cookie-selected':'')+(drag?.id===id&&moved.current?' cookie-lifted':'')} {...grab(id)}><span className="cookie-shape"/></span>:null)}</span></button>:<CookieBuddy shared={q.total-remaining} happy={!!result}/>}{fixing&&!result&&<p className="cookie-bubble">{q.mode==='fix'?'Oops! I piled them up wrong. Can you make it fair?':'I dropped some! Count carefully and make it fair.'}</p>}{leftover&&!result&&<p className="cookie-bubble">Extras for me, please!</p>}{!fixing&&!leftover&&!result&&<p className="cookie-bubble">{bags?'Fill each bag, please!':rows?'Neat rows, please!':ask?.predict?'Hmm… how many each?':'Share them fairly!'}</p>}{result&&<p className="cookie-bubble cookie-bubble-happy">{leftover?'Yum! Thank you!':'So fair! Yum!'}</p>}
{bags?<div className="cookie-count"><span className="cookie-mark" aria-hidden="true">🍪</span><strong className="eq-total">{q.total}</strong><span>cookies</span><span className="cookie-divider">·</span><strong className="eq-size">{q.bagSize}</strong><span>in each bag</span></div>:<div className="cookie-count"><span className="cookie-mark" aria-hidden="true">🍪</span><strong className="eq-total">{q.total}</strong><span>cookies</span><span className="cookie-divider">÷</span><strong className="eq-size">{q.plates}</strong><span>{rows?'rows':fixing||leftover||q.mode==='share'?'friends':'plates'}</span>
</div>}</div>
  {predictPanel}
  {rows?<div className="cookie-rows" aria-label="Baking tray rows">
   {counts.map((count,row)=><button type="button" key={row} data-cookie-plate={row} className={'cookie-row'+(result?' cookie-row-done':'')+(full&&!equal&&helped&&count!==Math.min(...counts)?' cookie-row-more':'')+(selected!==null&&spots[selected]!==row?' cookie-plate-target':'')} disabled={disabled||!!result} aria-label={hide?`Row ${row+1}. Count the cookies.`:`Row ${row+1}, ${count} ${count===1?'cookie':'cookies'}. Tap to add a cookie.`} onClick={()=>{const id=selected!==null&&spots[selected]!==row?selected:spots.indexOf(null);if(id>=0)put(id,row)}}>
    <span className="cookie-row-label">ROW {row+1}</span><span className="cookie-row-line">{spots.map((at,id)=>at===row?<span key={id} role="button" aria-label={`Move a cookie from row ${row+1}`} className={'cookie-on-plate'+(selected===id?' cookie-selected':'')+(drag?.id===id&&moved.current?' cookie-lifted':'')} {...grab(id)}><span className="cookie-shape"/></span>:null)}</span><span className={'cookie-plate-count eq-each'+(hide?' cookie-plate-count-hidden':'')}>{hide?'?':count}</span>
   </button>)}
  </div>:<div className="cookie-plates" aria-label="Plates">
   {visible.map(plate=>{const count=counts[plate];return <button type="button" key={plate} data-cookie-plate={plate} className={(bags?'cookie-bag ':'')+(bags&&count===q.bagSize?'cookie-bag-full ':'')+'cookie-plate '+(!bags&&full&&!equal&&(!quietTips||helped)&&count!==Math.min(...counts)?'cookie-plate-more ':'')+(result?'cookie-plate-done':'')+(selected!==null&&spots[selected]!==plate?' cookie-plate-target':'')} disabled={disabled||!!result} aria-label={bags?`Bag ${plate+1}, ${count} of ${q.bagSize} cookies`:hide?`Friend ${plate+1}'s plate. Count the cookies.`:`Friend ${plate+1}'s plate, ${count} ${count===1?'cookie':'cookies'}. Tap to place a cookie.`} onClick={()=>{const id=selected!==null&&spots[selected]!==plate?selected:spots.indexOf(null);if(id>=0)put(id,plate)}}>
    <span className="cookie-plate-label">{bags?<span className="cookie-bag-tag" aria-hidden="true">🛍️</span>:<span className={'cookie-friend cookie-friend-'+plate%5} aria-hidden="true"><i/><i/><b/></span>}{bags?`BAG ${plate+1}`:`FRIEND ${plate+1}`}</span><span className="cookie-plate-bowl">{spots.map((at,id)=>at===plate?<span key={id} role="button" aria-label={`Move a cookie from friend ${plate+1}`} className={'cookie-on-plate'+(selected===id?' cookie-selected':'')+(drag?.id===id&&moved.current?' cookie-lifted':'')} {...grab(id)}><span className="cookie-shape" style={fixing?tilt(id):undefined}/></span>:null)}</span>{bags?<span className="cookie-bag-slots" aria-hidden="true">{Array.from({length:q.bagSize},(_,i)=><i key={i} className={i<count&&!faded?'on':''}/>)}</span>:<span className={'cookie-plate-count eq-each'+(hide?' cookie-plate-count-hidden':'')}>{hide?'?':count}</span>}
   </button>})}
  </div>}
  {((q.mode!=='fix'&&!bags)||remaining>0)&&<div className="cookie-tray"><div className="cookie-tray-top"><strong>Cookie tray</strong><span>{remaining} left · tap or drag to a {bags?'bag':rows?'row':'plate'}</span></div><div className="cookie-tray-pieces">{spots.map((at,id)=>at===null?<button type="button" key={id} className={'cookie-piece '+(selected===id?'cookie-selected':'')} disabled={disabled||!!result} aria-label={`Cookie ${id+1}, tap then choose a plate or drag it`} {...grab(id)}><span className="cookie-shape" aria-hidden="true"/></button>:null)}</div></div>}
  <p className="cookie-tip">{tip}</p>
  {!fixing&&!ask&&spots.some(v=>v!==null)&&!result&&<div className="cookie-return">{counts.map((count,plate)=>count?<button type="button" key={plate} disabled={disabled} onClick={()=>put(spots.lastIndexOf(plate),null)}>↶ Take one back from {bags?'bag':rows?'row':'plate'} {plate+1}</button>:null)}{monster>0&&<button type="button" disabled={disabled} onClick={()=>put(spots.lastIndexOf(q.plates),null)}>↶ Take one back from Cookie Buddy</button>}</div>}
  {predicted!==undefined&&predicted!==null&&!result&&!ask&&<p className="cookie-guess">Your guess: <strong className="eq-each">{predicted}</strong>{bags?' bags':rows?' in each row':' each'}. Share them to check!</p>}
  {ask&&!ask.predict&&!result&&<div className="cookie-ask" role="group" aria-label={askLine(q)}><h2>{askLine(q)}</h2><div className="cookie-ask-choices">{ask.options.map(v=><button type="button" key={v} disabled={disabled} className="eq-answer" onClick={()=>{report('ask',String(v));answer?.(v)}}>{v}</button>)}</div></div>}
  {!ask&&<div className="cookie-check"><Button className="big-play" disabled={disabled||!!result||!full} onClick={()=>{report('check',bags?'bags':equal?'equal':'uneven');check()}}>{bags?'Check my bags →':rows?'Check my rows →':'Check my sharing →'}</Button><span role="status" aria-live="polite">{message||(remaining?`${remaining} cookies still in the tray.`:bags?'Is every bag full?':rows?'Look at every row. Are they equal?':'Look at every plate. Are they equal?')}</span></div>}
  {ask&&!result&&message&&<p className="cookie-ask-msg" role="status" aria-live="polite">{message}</p>}
  {result&&rows&&<div className="cookie-equation cookie-equation-rows" aria-label={`${q.total} divided by ${q.plates} equals ${counts[0]}. ${q.plates} rows of ${counts[0]} make ${q.total}`}><span><span className="eq-total">{q.total}</span> ÷ <span className="eq-size">{q.plates}</span> = <span className="eq-each">{counts[0]}</span></span><small><span className="eq-size">{q.plates}</span> rows × <span className="eq-each">{counts[0]}</span> = <span className="eq-total">{q.total}</span></small></div>}
  {result&&leftover&&<div className="cookie-equation" aria-label={`${q.total} divided by ${q.plates} equals ${counts[0]} remainder ${monster}`}><span className="eq-total">{q.total}</span> ÷ <span className="eq-size">{q.plates}</span> = <span className="eq-each">{counts[0]}</span> <span className="eq-rest">r {monster}</span></div>}
  {result&&!rows&&!leftover&&(bags?
<div className="cookie-equation" aria-label={`${q.total} divided by ${q.bagSize} equals ${filled} bags`}><span className="eq-total">{q.total}</span> ÷ <span className="eq-size">{q.bagSize}</span> = <span className="eq-each">{filled}</span> <small>bags</small></div>:<div className="cookie-equation" aria-label={`${q.total} divided by ${q.plates} equals ${counts[0]}`}><span className="eq-total">{q.total}</span> ÷ <span className="eq-size">{q.plates}</span> = <span className="eq-each">{counts[0]}</span></div>)}
  {result&&<div className="cookie-crumbs" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%7)*60}ms`}}/>)}</div>}
  {drag&&moved.current&&<span className="cookie-drag-ghost" style={{left:drag.x,top:drag.y}} aria-hidden="true"><span className="cookie-shape"/></span>}
 </section>;
}
