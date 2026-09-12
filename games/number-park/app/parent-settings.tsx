'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import './parent-settings.css';
const names:Record<string,string>={beginner:'Beginner',explorer:'Explorer',admin:'Admin · Admin'};
export function ParentSettings({player,open,onOpenChange,busy,onChoose}:{player:string,open:boolean,onOpenChange:(v:boolean)=>void,busy:boolean,onChoose:(id:string)=>boolean}){
 const [choice,setChoice]=useState(player),[error,setError]=useState('');
 return <><Button variant="ghost" className="parent-entry" disabled={busy} onClick={()=>{setChoice(player);setError('');onOpenChange(true);}}>Parent settings</Button>
 <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="parent-settings"><DialogTitle>Parent settings</DialogTitle><DialogDescription>Choose who uses Number Park on this device. Each child keeps their own progress.</DialogDescription>
 <label htmlFor="device-player">Player on this device</label><NativeSelect id="device-player" value={choice} disabled={busy} onChange={e=>setChoice(e.target.value)}>{Object.entries(names).map(([id,name])=><NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}</NativeSelect>
 <p>This choice stays on this device, even if an older shortcut names someone else. Change it here whenever needed.</p>
 <Button disabled={busy||choice===player} onClick={()=>{try{if(onChoose(choice))onOpenChange(false);}catch{setError('Could not remember the player on this device. Please allow site storage in Chrome and try again.');}}}>Use {names[choice]}</Button>
 {error&&<p role="alert">{error}</p>}<small>For avoiding accidental switches—not a password lock.</small></DialogContent></Dialog></>;
}
