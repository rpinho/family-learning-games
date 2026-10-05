// Brief action feedback only; background ambience is removed.
export const BED={base:0,duck:0,fadeIn:0,fadeOut:0,duckDown:0,release:0,hold:0};
export function calmSound(){
 let context=null,enabled=true,disposed=false;
 return {start(){},setEnabled(v){enabled=!!v;},duck(){return()=>{};},level:()=>0,
  pluck(n=0){if(!enabled||disposed||document.hidden)return;try{context??=new AudioContext();void context.resume();const now=context.currentTime;for(const [multiple,gain] of [[1,.07],[2,.02],[3,.008]]){const o=context.createOscillator(),g=context.createGain();o.frequency.value=[261.63,293.66,329.63,392,440][Math.abs(n)%5]*multiple;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+.8);o.connect(g);g.connect(context.destination);o.start();o.stop(now+.82);o.onended=()=>{o.disconnect();g.disconnect();};}}catch{}},
  destroy(){disposed=true;void context?.close();context=null;}};
}
