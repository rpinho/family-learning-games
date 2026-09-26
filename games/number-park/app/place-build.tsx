'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {PLACES,BUILD_MAX_PER_PLACE,placeName,buildValue} from '@/lib/place-build.mjs';

type Part={key:string;have:number;need:number;ok:boolean};
type Props={q:any;disabled:boolean;result:any;message?:string;parts?:Part[];check:(counts:number[])=>void;report:(name:string,detail:string)=>void};

function Block({place}:{place:string}){
 if(place==='hundreds')return <span className="pb-flat" aria-hidden="true">{Array.from({length:100},(_,i)=><i key={i}/>)}</span>;
 if(place==='tens')return <span className="pb-rod" aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i}/>)}</span>;
 return <span className="pb-unit" aria-hidden="true"/>;
}

export function PlaceBuild({q,disabled,result,message,parts,check,report}:Props){
 const [counts,setCounts]=useState<number[]>(()=>result?.ok?[...q.target]:[0,0,0]);
 const [edited,setEdited]=useState(false);
 useEffect(()=>setEdited(false),[parts]);
 const shown=result?.ok?q.target:counts;
 const used=q.target[0]>0?PLACES:PLACES.slice(1);
 const offset=PLACES.length-used.length;
 const change=(i:number,delta:number)=>{
  if(disabled||result)return;
  setEdited(true);setCounts(prev=>{const next=[...prev];next[i]=Math.max(0,Math.min(BUILD_MAX_PER_PLACE,next[i]+delta));return next[i]===prev[i]?prev:next;});
  report(delta>0?'add':'remove',PLACES[i].key);
 };
 const status=(key:string)=>result||edited?null:parts?.find(p=>p.key===key);
 return <section className="place-build" aria-label="Build the number with blocks">
  <div className="pb-target" aria-label={q.show==='words'?'Build '+q.target.map((n:number,i:number)=>n?`${n} ${placeName(i,n)}`:'').filter(Boolean).join(' '):'Build the number '+q.total}>
   {q.show==='words'?PLACES.map((place,i)=>q.target[i]>0&&<span key={place.key} className={'pb-chip pb-'+place.key}><strong>{q.target[i]}</strong> {placeName(i,q.target[i])}</span>):<span className="pb-numeral">{q.total}</span>}
  </div>
  <div className="pb-mat">
   {used.map((place,j)=>{const i=j+offset,st=status(place.key);return <div key={place.key} className={'pb-col pb-'+place.key+(st?st.ok?' pb-col-ok':' pb-col-off':'')}>
    <div className="pb-col-head"><span>{place.many.toUpperCase()}</span>{st&&<b className="pb-col-status">{st.ok?'✓':st.have>st.need?'too many':'too few'}</b>}</div>
    <div className="pb-pile">{Array.from({length:shown[i]},(_,k)=><button type="button" key={k} className="pb-block" disabled={disabled||!!result} aria-label={`Remove one ${place.one}`} onClick={()=>change(i,-1)}><Block place={place.key}/></button>)}</div>
    {!result&&<Button type="button" className="pb-add" disabled={disabled||counts[i]>=BUILD_MAX_PER_PLACE} onClick={()=>change(i,1)} aria-label={`Add one ${place.one}`}><Block place={place.key}/> + {place.one}</Button>}
   </div>})}
  </div>
  {!result&&<p className="pb-tip">Tap + to add a block. Tap a block on the mat to take it back.</p>}
  {!result&&<div className="cookie-check"><Button className="big-play" disabled={disabled||counts.every(n=>n===0)} onClick={()=>{report('check',counts.join(','));check(counts)}}>Check my build →</Button><span role="status" aria-live="polite">{(!edited&&message)||'Build it, then check.'}</span></div>}
  {result?.ok&&<div className="cookie-equation pb-equation" aria-label={`${q.total}`}>{used.map((place,j)=>{const i=j+offset;return <span key={place.key} className={'pb-eq-'+place.key}>{q.target[i]} {placeName(i,q.target[i])} </span>})}= <span>{buildValue(q.target)}</span></div>}
 </section>;
}
