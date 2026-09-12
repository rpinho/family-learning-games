'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Counting} from './counting';
import {moveGroup,groupsNear} from '@/lib/grouping.mjs';
type Offset={x:number,y:number};
export function Grouping({q,disabled,speak,report}:{q:any,disabled:boolean,speak:(text:string)=>void,report:(name:string,detail:string)=>void}){
 const [joined,setJoined]=useState(false),[near,setNear]=useState(false),[offsets,setOffsets]=useState<Offset[]>([{x:0,y:0},{x:0,y:0}]);
 const board=useRef<HTMLDivElement>(null),cards=useRef<(HTMLButtonElement|null)[]>([]),drag=useRef<any>(null);
 const detail=(method:string)=>JSON.stringify({questionId:q.id,a:q.a,b:q.b,method});
 const join=(method:string)=>{if(disabled||joined)return;drag.current=null;setNear(false);setJoined(true);speak('Tap and count.');report('joined',detail(method));};
 const position=(e:React.PointerEvent)=>{const d=drag.current;return moveGroup(d.rect,d.board,e.clientX-d.x,e.clientY-d.y);};
 const update=(id:number,p:Offset)=>setOffsets(values=>values.map((v,i)=>i===id?p:v));
 const cancel=()=>{const d=drag.current;if(d){update(d.id,d.offset);report('drag_cancelled',detail('pointer'));}drag.current=null;setNear(false);};
 return <section className="grouping" aria-label="Put the groups together">
 {joined?<div className="joined-group"><p className="joined-title" role="status">Together! Count the whole group.</p><Counting q={{kind:'count',count:q.a+q.b,object:q.object}} disabled={disabled} speak={speak}/><Button variant="ghost" disabled={disabled} onClick={()=>{setJoined(false);setOffsets([{x:0,y:0},{x:0,y:0}]);report('separated',detail('button'));}}>↔ Separate again</Button></div>:<>
 <p>Drag either group onto the other.</p>
 <div className={'grouping-board '+(near?'join-ready':'')} ref={board}>
 <span className="group-plus" aria-hidden="true">+</span>
 {[q.a,q.b].map((count,i)=><Button key={i} ref={el=>{cards.current[i]=el;}} variant="outline" className={'group-pile pile-'+i} disabled={disabled} aria-label={`Group ${i+1}, ${count} objects. Drag onto the other group, or press Enter to combine.`} style={{left:i===0?'25%':'75%',transform:`translate(-50%,-50%) translate(${offsets[i].x}px,${offsets[i].y}px)`,zIndex:drag.current?.id===i?3:1}}
 onPointerDown={e=>{if(disabled||drag.current||!board.current)return;e.preventDefault();drag.current={id:i,pointer:e.pointerId,x:e.clientX,y:e.clientY,rect:e.currentTarget.getBoundingClientRect(),board:board.current.getBoundingClientRect(),offset:offsets[i]};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId||disabled)return;e.preventDefault();const p=position(e);update(i,{x:d.offset.x+p.x,y:d.offset.y+p.y});const other=cards.current[1-i]?.getBoundingClientRect();setNear(!!other&&groupsNear(p.rect,other));}}
 onPointerUp={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;e.preventDefault();if(disabled){cancel();return;}const p=position(e),other=cards.current[1-i]?.getBoundingClientRect(),moved=Math.hypot(e.clientX-d.x,e.clientY-d.y)>8;update(i,{x:d.offset.x+p.x,y:d.offset.y+p.y});drag.current=null;setNear(false);if(moved&&other&&groupsNear(p.rect,other))join('drag');else if(moved)report('drag_released',detail('not_near'));}}
 onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current?.id===i)cancel();}}
 onClick={e=>{if(e.detail===0)join('keyboard');}}>
 <span className="pile-objects">{Array.from({length:count},(_,j)=><span key={j}>{q.object}</span>)}</span><span className="pile-handle">↔ Drag me</span>
 </Button>)}
 </div><Button variant="ghost" disabled={disabled} onClick={()=>join('button')}>Put together →</Button>
 </>}
 </section>;
}
