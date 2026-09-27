'use client';
import {Button} from '@/components/ui/button';
import {Block} from './place-build';
import {WORTH_PLACES,formatWorth,worthUnits} from '@/lib/place-worth.mjs';

type Props={q:any;disabled:boolean;result:any;helped:boolean;onAnswer:(value:number)=>void};
const BLOCK=['ones','tens','hundreds','thousands'];

// Digit worth: the numeral with one digit lit (worth), or every digit tappable (which place).
// Place names appear under the digits after Help or an answer; a miss also shows the digit as blocks.
export function PlaceWorth({q,disabled,result,helped,onAnswer}:Props){
 const which=q.placeMode==='which',labels=helped||!!result,n=q.digits.length;
 const col=(i:number)=>BLOCK[n-1-i];
 return <section className="place-worth" aria-label={which?'Find the digit in the named place':'What is the lit digit worth?'}>
  <div className="pw-numeral">{q.digits.map((d:number,i:number)=>{
   const lit=!which&&i===q.lit,shown=result&&i===q.lit,picked=which&&result&&!result.ok&&i===result.picked;
   const cls='pw-digit pw-'+col(i)+(lit?' pw-lit':'')+(shown?' pw-answer':'')+(picked?' pw-picked':'');
   return <div key={i} className="pw-slot">
    {lit&&<span className="pw-arrow" aria-hidden="true">▼</span>}
    {which?<button type="button" className={cls} disabled={disabled||!!result} onClick={()=>onAnswer(i)} aria-label={`Digit ${d}`}>{d}</button>:<span className={cls}>{d}</span>}
    <small className={'pw-label'+(labels?'':' pw-hidden')}>{WORTH_PLACES[n-1-i]}</small>
   </div>;})}
  </div>
  {!which&&<div className="answers">{q.options.map((v:number)=><Button key={v} className={'answer pw-option '+(result&&result.answer===v?'correct':'')} disabled={disabled||!!result} onClick={()=>onAnswer(v)}>{formatWorth(v)}</Button>)}</div>}
  {result&&<div className={'pw-column pw-'+col(q.lit)} aria-label={`${worthUnits(q.digit,q.place)} is ${q.digit*10**q.place}`}>
   {!result.ok&&<div className="pw-blocks" aria-hidden="true">{Array.from({length:q.digit},(_,k)=><Block key={k} place={col(q.lit)}/>)}</div>}
   <p><strong>{worthUnits(q.digit,q.place)}</strong> = {formatWorth(q.digit*10**q.place)}</p>
  </div>}
 </section>;
}
