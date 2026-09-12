'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {nearPatternGap} from '@/lib/play-practice.mjs';
export function PatternRepair({q,disabled,result,onAnswer,report}:{q:any,disabled:boolean,result:any,onAnswer:(answer:string)=>void,report:(name:string,detail:string)=>void}){
 const [selected,setSelected]=useState<string|null>(null),[ghost,setGhost]=useState<{x:number,y:number,piece:string}|null>(null),[near,setNear]=useState(false);
 const [outside,setOutside]=useState(false);
 const target=useRef<HTMLButtonElement>(null),drag=useRef<any>(null),suppressClick=useRef(false);
 const record=(name:string,method:string,piece:string)=>{if(name==='released_outside'){setOutside(true);setSelected(piece);}else if(name==='selected'||name==='placed')setOutside(false);report(name,JSON.stringify({questionId:q.id,level:q.level,mode:q.mode,method,piece}));};
 const place=(piece:string,method:string)=>{if(disabled)return;record('placed',method,piece);setSelected(piece);onAnswer(piece);};
 const cancel=()=>{if(drag.current)record('cancelled','pointer',drag.current.piece);drag.current=null;setGhost(null);setNear(false);};
 return <section className="pattern-repair" aria-label="Repair the pattern">
 <div className="pattern repair-row">{q.sequence.map((piece:string|null,i:number)=>piece===null?<Button ref={target} key={i} className={'repair-gap '+(near?'near':'')} disabled={disabled||!selected} aria-label="Pattern gap. Place the selected picture here." onClick={()=>{if(selected)place(selected,'tap');}}>{result?result.answer:near?ghost?.piece:'?'}</Button>:<span key={i}>{piece}</span>)}</div>
 <p className="repair-directions">Drag a piece to the gap, or choose a piece and tap the gap.</p>
 <div className="repair-pieces">{q.options.map((piece:string)=><Button key={piece} variant="outline" aria-label={'Choose '+piece+' for the pattern gap'} aria-pressed={selected===piece} className={'repair-piece '+(selected===piece?'selected':'')} disabled={disabled} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setSelected(piece);record('selected','tap',piece);}}
 onPointerDown={e=>{if(disabled||drag.current)return;suppressClick.current=false;drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,piece};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId||disabled)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;setGhost({x:e.clientX,y:e.clientY,piece});const rect=target.current?.getBoundingClientRect();setNear(!!rect&&nearPatternGap(e.clientX,e.clientY,rect));}}
 onPointerUp={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const moved=Math.hypot(e.clientX-d.x,e.clientY-d.y)>=6,rect=target.current?.getBoundingClientRect();drag.current=null;setGhost(null);setNear(false);suppressClick.current=moved;if(!moved||disabled)return;if(rect&&nearPatternGap(e.clientX,e.clientY,rect))place(piece,'drag');else record('released_outside','drag',piece);}}
 onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}}>{piece}</Button>)}</div>
 {!result&&<p role="status" className={'repair-status'+(outside?' retry':'')}>{outside?'Not in the gap yet. Tap the ? to place your piece.':selected?'Piece selected. Tap the gap to place it.':'Which piece keeps the pattern going?'}</p>}
 {ghost&&<span aria-hidden="true" className="repair-ghost" style={{left:ghost.x,top:ghost.y}}>{ghost.piece}</span>}
 </section>;
}
