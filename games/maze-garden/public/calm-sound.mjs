// Original water bed is fetched only after a gesture. One context for quiet harp feedback.
export function calmSound(url){
 let audio=null,context=null,enabled=true,disposed=false,ducks=0,started=false;
 const volume=()=>{if(audio)audio.volume=ducks?0.08:0.34;};
 function pause(){audio?.pause();void context?.suspend();}
 function start(){if(disposed||!enabled||document.hidden)return;started=true;if(!audio){audio=new Audio(url);audio.loop=true;audio.preload='none';}volume();void audio.play().catch(()=>{});void context?.resume();}
 function visible(){if(document.hidden)pause();else if(started)start();}
 document.addEventListener('visibilitychange',visible);
 return {start,setEnabled(v){enabled=!!v;if(enabled&&started)start();else if(!enabled)pause();},duck(){ducks++;volume();let done=false;return()=>{if(done)return;done=true;ducks=Math.max(0,ducks-1);volume();};},pluck(n=0){if(!enabled||disposed||document.hidden)return;try{context??=new AudioContext();void context.resume();const now=context.currentTime;for(const [multiple,gain] of [[1,.07],[2,.02],[3,.008]]){const o=context.createOscillator(),g=context.createGain();o.frequency.value=[261.63,293.66,329.63,392,440][Math.abs(n)%5]*multiple;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+.8);o.connect(g);g.connect(context.destination);o.start();o.stop(now+.82);o.onended=()=>{o.disconnect();g.disconnect();};}}catch{}},destroy(){disposed=true;pause();audio?.removeAttribute('src');audio?.load();void context?.close();document.removeEventListener('visibilitychange',visible);}};
}
