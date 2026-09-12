'use client';
import {useRef,useState} from 'react';
import {Eraser,Pencil} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {eraseInk} from '@/lib/ink-eraser.mjs';
type Point=[number,number];
export function useInkTools(ink:Point[][],setInk:React.Dispatch<React.SetStateAction<Point[][]>>){
 const [erasing,setErasing]=useState(false),[tip,setTip]=useState<Point|null>(null),[undoInk,setUndoInk]=useState<Point[][]|null>(null);
 const last=useRef<Point|null>(null),current=useRef(ink);current.current=ink;
 const move=(p:Point)=>{const from=last.current||p;last.current=p;setTip(p);setInk(i=>eraseInk(i,from,p));};
 return {erasing,tip,canUndo:!!undoInk||ink.length>0,
  begin:(p:Point)=>{setUndoInk(current.current);last.current=p;move(p);},move,
  end:()=>{last.current=null;setTip(null);},
  penStarted:()=>setUndoInk(null),
  undo:()=>{if(undoInk){setInk(undoInk);setUndoInk(null);}else setInk(i=>i.slice(0,-1));},
  reset:()=>{last.current=null;setTip(null);setUndoInk(null);setErasing(false);},
  controls:(busy:boolean)=><><Button className="h-11 w-11 shrink-0" variant={!erasing?'default':'outline'} size="icon" disabled={busy} aria-label="Pencil" title="Pencil" aria-pressed={!erasing} onClick={()=>setErasing(false)}><Pencil size={19}/></Button><Button className="h-11 w-11 shrink-0" variant={erasing?'default':'outline'} size="icon" disabled={busy} aria-label="Eraser" title="Eraser — drag over a mistake" aria-pressed={erasing} onClick={()=>setErasing(true)}><Eraser size={19}/></Button></>,
  cursor:tip?<circle cx={tip[0]} cy={tip[1]} r="3.5" fill="#ffffff88" stroke="#6b7280" strokeWidth=".5" pointerEvents="none"/>:null,
 };
}
