'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {GuidedTrace} from '@/lib/guided-trace.mjs';
import {SHAPES,nextShape,startingShape} from '@/lib/shapes.mjs';
import {numberPaths,nextTraceNumber,startingTraceNumber,TRACE_MAX} from '@/lib/number-trace.mjs';
import {safeInk,checkCopy} from '@/lib/copy-practice.mjs';
import {GuessDrawing,DrawingMissions} from './art';
import {useInkTools} from './ink-tools';
import {DRAWING_IDEAS,drawingModes,initialDrawingMode} from '@/lib/drawing-ideas.mjs';
type Point=[number,number];
type Practice='guided'|'copy';
export function Drawing({player,traceNext,shapeNext,saved,onSave,onTrace,onShape,onSpeak,report,busy,art,act}:{player:string,traceNext?:string,shapeNext?:string,saved?:Point[][],onSave:(ink:Point[][])=>Promise<void>,onTrace:(digit:string,ink:Point[][],practice:Practice)=>Promise<void>,onShape:(shape:string,ink:Point[][],practice:Practice)=>Promise<void>,onSpeak:(text:string)=>void,report:(name:string,detail:string)=>void,busy:boolean,art:any,act:(input:any)=>Promise<any>}){
 const [mode,setMode]=useState(()=>initialDrawingMode(player)),[shape,setShape]=useState(()=>startingShape(shapeNext)),[digit,setDigit]=useState(()=>startingTraceNumber(traceNext)),[idea,setIdea]=useState(-1);
 const [ink,setInk]=useState<Point[][]>(()=>safeInk(saved)),[draft,setDraft]=useState<Point[]>([]),[attempt,setAttempt]=useState<Point[][]>([]);
 const inkTools=useInkTools(ink,setInk);
 const [practice,setPractice]=useState<Practice>('guided'),[tick,setTick]=useState(0),[message,setMessage]=useState(''),[ready,setReady]=useState<string|null>(null),[visible,setVisible]=useState(true);
 const held=useRef<number|null>(null),draftRef=useRef<Point[]>([]),rail=useRef(new GuidedTrace(numberPaths(startingTraceNumber(traceNext))));
 const generation=useRef(0),saving=useRef(false);
 const guided=mode!=='free'&&practice==='guided',target=mode==='shapes'?shape:digit;
 const paths:Point[][]=mode==='shapes'?SHAPES[shape as keyof typeof SHAPES].paths as Point[][]:numberPaths(digit);
 const update=()=>setTick(t=>t+1);
 const clearDraft=()=>{draftRef.current=[];setDraft([]);held.current=null;};
 const reset=(d=digit,m=mode,sh=shape)=>{generation.current++;setReady(null);rail.current=new GuidedTrace(m==='shapes'?SHAPES[sh as keyof typeof SHAPES].paths:numberPaths(d));setAttempt([]);clearDraft();setMessage('');update();};
 useEffect(()=>{const update=()=>setVisible(document.visibilityState==='visible');update();document.addEventListener('visibilitychange',update);return()=>{generation.current++;document.removeEventListener('visibilitychange',update);};},[]);
 // Read pointer coordinates synchronously. React clears currentTarget after the
 // handler returns; reading it inside a deferred setState updater crashed ink.
 const point=(e:React.PointerEvent<SVGSVGElement>):Point=>{const r=e.currentTarget.getBoundingClientRect(),size=Math.min(r.width,r.height);return [Math.max(0,Math.min(100,(e.clientX-r.x-(r.width-size)/2)*100/size)),Math.max(0,Math.min(100,(e.clientY-r.y-(r.height-size)/2)*100/size))];};
 const completed=async(strokes:Point[][]=rail.current.completed as Point[][])=>{
  if(saving.current||busy||ready===target||mode==='free'||(guided&&!rail.current.done))return;
  if(!guided){const check=checkCopy(paths,strokes);report('copy_check',JSON.stringify({mode,target,...check}));if(!check.ok){setMessage(check.precision<.72?'Try following the pale shape. Undo a line or use the gold guide.':'Keep going—fill in the missing parts. Wobbles are okay.');return;}}
  const token=generation.current,completedMode=mode,completedTarget=target;saving.current=true;setMessage('Saving…');
  try{if(completedMode==='shapes')await onShape(completedTarget,strokes,practice);else await onTrace(completedTarget,strokes,practice);
   if(token!==generation.current)return;setMessage(completedMode==='shapes'?'Shape complete!':nextTraceNumber(completedTarget)?'Number complete!':`You reached ${TRACE_MAX}!`);setReady(completedTarget);
  }catch{if(token===generation.current)setMessage('Practice complete, but not saved yet. Try Save practice again.');}
  finally{saving.current=false;}
 };
 useEffect(()=>{
  if(mode==='free'||ready!==target||!visible||busy)return;
  const next=mode==='shapes'?nextShape(shape):nextTraceNumber(digit);if(next===null)return;
  const token=generation.current,timer=setTimeout(()=>{if(document.visibilityState!=='visible'||token!==generation.current)return;
   if(mode==='shapes'){setShape(next);reset(digit,mode,next);onSpeak('Trace a '+next+'.');}
   else{setDigit(next);reset(next);onSpeak(next);}
  },1000);return()=>clearTimeout(timer);
 },[ready,target,digit,shape,mode,visible,busy]);
 const chooseMode=(m:string)=>{inkTools.reset();setMode(m);reset(digit,m);report('mode',m);if(m==='shapes')onSpeak('Trace a '+shape+'.');else if(m==='trace')onSpeak(digit);};
 const switchPractice=(p:Practice)=>{setPractice(p);reset();report('support',JSON.stringify({mode,target,practice:p}));};
 const finishInk=(p?:Point)=>{
  const stroke=p?[...draftRef.current,p]:draftRef.current;clearDraft();if(!stroke.length)return;
  if(mode==='free'){setInk(i=>[...i,stroke]);setMessage('Not saved yet. Tap Save drawing.');}
  else{const strokes=[...attempt,stroke];setAttempt(strokes);void completed(strokes);}
 };
 const marks=guided?[...rail.current.completed,rail.current.ink]:[...(mode==='free'?ink:attempt),draft];
 const modePicker=<NativeSelect aria-label="Drawing mode" disabled={busy} value={mode} onChange={e=>chooseMode(e.target.value)}><NativeSelectOption value="trace">Numbers</NativeSelectOption><NativeSelectOption value="shapes">Shapes</NativeSelectOption><NativeSelectOption value="free">Free drawing · Guess my drawing</NativeSelectOption>{drawingModes(player).includes('missions')&&<NativeSelectOption value="missions">Drawing missions</NativeSelectOption>}</NativeSelect>;
 if(mode==='missions')return <section className="playboard drawing"><div className="draw-tools">{modePicker}</div><DrawingMissions art={art} act={act} busy={busy} onSpeak={onSpeak}/></section>;
 return <section className="playboard drawing">
 <div className="draw-tools">
  {modePicker}
  {mode==='trace'&&<><Button variant="outline" disabled={busy||digit==='0'} onClick={()=>{const previous=String(Number(digit)-1);setDigit(previous);reset(previous);onSpeak(previous);}}>← Easier</Button><strong>Number {digit}</strong></>}
  <Button variant="outline" disabled={busy} onClick={()=>mode!=='free'?reset():(setInk([]),clearDraft(),inkTools.reset(),setMessage('Cleared the pad. Save to keep it.'))}>↻ {mode==='free'?'Clear pad':'Try again'}</Button>
  {mode==='free'&&<>{inkTools.controls(busy)}<Button variant="outline" disabled={busy||!inkTools.canUndo} onClick={()=>{inkTools.undo();setMessage('Not saved yet. Tap Save drawing.');}}>Undo</Button><Button disabled={busy} onClick={async()=>{try{await onSave(ink);setMessage('Drawing saved.');}catch{setMessage('Could not save. Keep the pad open and tap Save drawing again.');}}}>Save drawing</Button></>}
 </div>
 {mode!=='free'&&<div className="draw-tools"><Button variant={guided?'default':'outline'} disabled={busy} onClick={()=>switchPractice('guided')}>Gold guide</Button><Button variant={!guided?'default':'outline'} disabled={busy} onClick={()=>switchPractice('copy')}>Draw it myself</Button>{!guided&&<Button variant="outline" disabled={busy||!attempt.length||!!ready} onClick={()=>{setAttempt(a=>a.slice(0,-1));setMessage('Try that line again.');}}>Undo line</Button>}<Button variant="outline" disabled={busy} aria-label="Hear drawing instruction again" onClick={()=>onSpeak(mode==='shapes'?'Trace a '+shape+'.':digit)}>🔊</Button></div>}
 {mode==='shapes'&&<div className="shape-choices">{Object.entries(SHAPES).map(([id,sh])=><Button key={id} variant={shape===id?'default':'outline'} disabled={busy} onClick={()=>{setShape(id);reset(digit,'shapes',id);onSpeak('Trace a '+id+'.');}}><svg width="40" height="32" viewBox="0 0 100 100" aria-hidden="true"><polyline points={sh.paths[0].map(v=>v.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round"/></svg>{sh.name}</Button>)}</div>}
 <h1>{mode==='free'?'Draw anything.':(guided?'Follow the ':'Draw the ')+target+'.'}</h1><p>{mode==='free'?'Trees, pictures, letters, numbers—your choice.':guided?'Drag the gold button. The ink stays on the track.':'Draw over the pale shape. Your own ink. Wobbles are okay.'}</p>
 {mode==='free'&&player==='beginner'&&<div className="draw-tools"><span>{idea>=0?DRAWING_IDEAS[idea]:'Your drawing. No right or wrong way.'}</span><Button variant="outline" disabled={busy} onClick={()=>{const next=(idea+1)%DRAWING_IDEAS.length;setIdea(next);onSpeak(DRAWING_IDEAS[next]);report('idea',String(next));}}>{idea<0?'Give me an idea':'Another idea'}</Button></div>}
 <svg data-tick={tick} className="draw-pad" viewBox="0 0 100 100" tabIndex={guided?0:undefined} role={guided?'slider':'img'} aria-label={guided?'Trace '+target+'. Drag the gold button or use arrow keys.':mode==='free'?'Free drawing pad':'Draw '+target+' yourself'} aria-valuemin={guided?0:undefined} aria-valuemax={guided?paths.length:undefined} aria-valuenow={guided?rail.current.stroke:undefined}
 onPointerDown={e=>{if(busy||ready||held.current!==null)return;e.preventDefault();const p=point(e);if(mode==='free'&&inkTools.erasing){inkTools.begin(p);setMessage('Not saved yet. Tap Save drawing.');}else if(guided){if(!rail.current.begin(p))return;}else{if((mode==='free'?ink:attempt).length>=150){setMessage('Pad full. Save or clear before drawing more.');return;}inkTools.penStarted();draftRef.current=[p];setDraft([p]);}held.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);update();}}
 onPointerMove={e=>{if(held.current!==e.pointerId||busy)return;e.preventDefault();const p=point(e);if(mode==='free'&&inkTools.erasing)inkTools.move(p);else if(guided){rail.current.move(p);update();}else if(draftRef.current.length<699){draftRef.current=[...draftRef.current,p];setDraft(draftRef.current);}}}
 onPointerUp={e=>{if(held.current!==e.pointerId)return;const p=point(e);if(mode==='free'&&inkTools.erasing){inkTools.move(p);inkTools.end();held.current=null;}else if(guided){held.current=null;rail.current.move(p);rail.current.release();update();void completed();}else finishInk(p);}}
 onPointerCancel={()=>{if(held.current===null)return;if(mode==='free'&&inkTools.erasing){held.current=null;inkTools.end();}else if(guided){held.current=null;rail.current.release();if(rail.current.done)void completed();}else finishInk();update();}}
 onKeyDown={e=>{if(!guided||busy||rail.current.done||!e.key.startsWith('Arrow'))return;e.preventDefault();rail.current.advance();update();void completed();}}>
 {mode!=='shapes'&&[15,50,85].map(y=><line key={y} x1="5" x2="95" y1={y} y2={y} stroke="#d5e7ec" strokeWidth=".4" strokeDasharray={y===50?'2 2':undefined}/>)}
 {mode!=='free'&&paths.map((p,i)=><polyline key={i} points={p.map(v=>v.join(',')).join(' ')} fill="none" stroke={guided&&i===rail.current.stroke?'#bde8e9':'#e6f1f3'} strokeWidth={guided?8:4} strokeLinecap="round" strokeLinejoin="round"/>)}
 {marks.filter(p=>p.length).map((p,i)=><polyline key={i} points={p.map((v:number[])=>v.join(',')).join(' ')} fill="none" stroke="#007e83" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>)}
 {guided&&rail.current.handle&&<g><circle cx={rail.current.handle[0]} cy={rail.current.handle[1]} r="6" fill="#ffbf35" stroke="#a67308" strokeWidth=".7"/><circle cx={rail.current.handle[0]} cy={rail.current.handle[1]} r="1.2" fill="#6d4700"/></g>}
 {mode==='free'&&inkTools.cursor}
 </svg>
 {mode==='free'&&<GuessDrawing ink={ink} art={art} act={act} busy={busy} onSpeak={onSpeak}/>}
 {mode==='trace'&&ready===String(TRACE_MAX)&&<Button onClick={()=>{setDigit('1');reset('1');onSpeak('1');}}>Trace again from 1 →</Button>}
 <p aria-live="polite">{message||(mode==='free'?'Your last saved drawing stays on the server.':'Finish to meet the next '+(mode==='shapes'?'shape':'number')+'. Lift your finger anytime.')}</p>
 {message.includes('not saved yet')&&mode!=='free'&&<Button disabled={busy} onClick={()=>void completed(guided?rail.current.completed as Point[][]:attempt)}>Save practice again</Button>}
 {mode!=='free'&&<small>{guided?'Guided practice—not a handwriting test.':'Copying practice—not a handwriting or memory test. Use Gold guide whenever you need it.'}</small>}
 </section>;
}
