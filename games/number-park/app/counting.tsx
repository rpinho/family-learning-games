'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
export function Counting({q,disabled,speak}:{q:any,disabled:boolean,speak:(text:string)=>Promise<void>|void}){
 const [taps,setTaps]=useState<number[]>([]),[reminder,setReminder]=useState(false);
 const speaking=useRef(false);
 const items=q.items??Array.from({length:q.count},()=>({object:q.object,noun:'object'}));
 return <><p className="count-prompt">{q.mode==='only'?<>Count only the <strong>{q.object} {q.noun}</strong>.</>:'Tap each one. Then choose how many.'}</p>
 <div className={'count-field count-'+(q.mode??'scatter')}>
 {items.map((item:any,i:number)=><Button key={i} aria-label={item.noun+' '+(i+1)+(taps.includes(i)?', counted':'')} disabled={disabled} className={'token '+(taps.includes(i)?'counted':'')} style={q.mode==='scatter'?{marginTop:((i*7+(q.layoutSeed??0))%3)*8}:undefined} onClick={async()=>{
  if(speaking.current)return;
  if(q.mode==='only'&&item.object!==q.object){setReminder(true);return;}
  if(taps.includes(i))return;
  setReminder(false);setTaps(t=>t.includes(i)?t:[...t,i]);speaking.current=true;
  try{await speak(String(taps.length+1));}finally{speaking.current=false;}
 }}>{item.object}{taps.includes(i)&&<small>{taps.indexOf(i)+1}</small>}</Button>)}
 </div><p className="count-reminder" aria-live="polite">{reminder?`Just the ${q.noun} ${q.object}. Leave the others.`:'You can tap to keep track.'}</p></>;
}
