// Local, quiet synthesized effects. No downloaded recordings or microphone.
export function createSoccerAudio(report=()=>{}){
 let ctx;const active=new Set();
 function stop(){for(const n of active){try{n.stop();}catch{}}active.clear();}
 async function play(kind){
  try{
   ctx??=new AudioContext();await ctx.resume();stop();const at=ctx.currentTime;
   const tone=(frequency,start,duration,volume,type='sine',end=frequency)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,at+start);o.frequency.linearRampToValueAtTime(end,at+start+duration);g.gain.setValueAtTime(0,at+start);g.gain.linearRampToValueAtTime(volume,at+start+.015);g.gain.setValueAtTime(volume,at+start+Math.max(.02,duration-.04));g.gain.linearRampToValueAtTime(0,at+start+duration);o.connect(g);g.connect(ctx.destination);o.start(at+start);o.stop(at+start+duration);active.add(o);o.onended=()=>{active.delete(o);o.disconnect();g.disconnect();};
   };
   if(kind==='whistle'){for(const t of [0,.24]){tone(2250,t,.17,.035,'sine',2470);tone(2900,t,.17,.013,'sine',2800);}}
   else if(kind==='kick'){tone(155,0,.12,.11,'sine',48);}
   else if(kind==='goal'){[523,659,784,1047].forEach((f,i)=>tone(f,i*.09,.27,.04,'triangle'));}
   else if(kind==='save'){tone(220,0,.12,.045,'triangle',140);}
   report('action',{action:'soccer:'+kind});
  }catch(e){report('voice_error',{reason:'soccer_effect',message:e.message});}
 }
 return {play,stop};
}
