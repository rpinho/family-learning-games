'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import './parent-settings.css';
const names:Record<string,string>={beginner:'Beginner',explorer:'Explorer',admin:'Admin · Admin'};
const STAGES:Record<string,string>={show:'counts shown',hide:'counts hidden (Help shows them)',own:'says the answer first'};
// Today's summary for the grown-ups: read-only, from this child's own saves.
function Today({player,open}:{player:string,open:boolean}){
 const [s,setS]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{if(!open)return;let live=true;setS(null);setError('');fetch('/api/'+player+'/summary').then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(live)setS(d)}).catch(()=>{if(live)setError('Today’s summary is not available right now.')});return()=>{live=false};},[player,open]);
 if(error)return <p className="today-empty">{error}</p>;
 if(!s)return <p className="today-empty">Loading today…</p>;
 if(!s.played)return <p className="today-empty">No play yet today.</p>;
 const c=s.levels?.cookies;
 return <div className="today"><p><strong>About {s.minutes} min</strong> ({s.stretches.map((x:any)=>`${x.start}–${x.end}`).join(', ')}) · {s.correct}/{s.questions} solved, {s.independent} on their own</p>
  {s.games.length>0&&<ul>{s.games.map((g:any)=><li key={g.id}>{g.title}: {g.correct}/{g.questions}{g.helped?`, ${g.helped} with help`:''}</li>)}</ul>}
  {(s.other.reading||s.other.planning||s.other.drawing)?<p>Also: {[s.other.reading&&`${s.other.reading} reading answers`,s.other.planning&&`${s.other.planning} Plan & Play goals`,s.other.drawing&&`${s.other.drawing} drawing moments`].filter(Boolean).join(' · ')}</p>:null}
  {c&&<p>Cookie division: level {c.level}, {STAGES[c.stage]||c.stage}{c.toMastery!==undefined?` · ${c.toMastery} more clean in a row to move up`:''}</p>}
  {s.stuck.length>0&&<><p><strong>Worth a look</strong></p><ul>{s.stuck.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></>}
  {s.story.length>0&&<><p><strong>Story so far today</strong></p><ul>{s.story.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></>}
 </div>;
}
export function ParentSettings({player,open,onOpenChange,busy,onChoose,resting,onRestClear}:{player:string,open:boolean,onOpenChange:(v:boolean)=>void,busy:boolean,onChoose:(id:string)=>boolean,resting?:boolean,onRestClear?:()=>void}){
 const [choice,setChoice]=useState(player),[error,setError]=useState('');
 return <><Button variant="ghost" className="parent-entry" disabled={busy} onClick={()=>{setChoice(player);setError('');onOpenChange(true);}}>Parent settings</Button>
 <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="parent-settings"><DialogTitle>Parent settings</DialogTitle><DialogDescription>Choose who uses Number Park on this device. Each child keeps their own progress.</DialogDescription>
 <label htmlFor="device-player">Player on this device</label><NativeSelect id="device-player" value={choice} disabled={busy} onChange={e=>setChoice(e.target.value)}>{Object.entries(names).map(([id,name])=><NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}</NativeSelect>
 <p>This choice stays on this device, even if an older shortcut names someone else. Change it here whenever needed.</p>
 <Button disabled={busy||choice===player} onClick={()=>{try{if(onChoose(choice))onOpenChange(false);}catch{setError('Could not remember the player on this device. Please allow site storage in Chrome and try again.');}}}>Use {names[choice]}</Button>
 {error&&<p role="alert">{error}</p>}<small>For avoiding accidental switches—not a password lock.</small>
 <h3 className="today-title">Today · {names[player]}</h3><Today player={player} open={open}/>
 {resting&&<div className="today-rest"><p>Resting after a long stretch of play (about 20 minutes). New rounds come back in an hour.</p><Button variant="outline" disabled={busy} onClick={()=>onRestClear?.()}>Let them keep playing</Button></div>}
 </DialogContent></Dialog></>;
}
