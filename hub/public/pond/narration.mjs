export function pondNarrator(){
 let audio=null,finish=null,epoch=0,manifest=null;
 const ready=()=>manifest??=fetch('/chess-voice/manifest.json').then(r=>r.json()).catch(()=>({clips:{}}));
 function stop(){epoch++;audio?.pause();finish?.();audio=null;finish=null;}
 return {ready,stop,async speak(text){stop();const my=epoch,m=await ready();if(my!==epoch||!m.clips?.[text])return;
  return new Promise(resolve=>{const a=new Audio(m.clips[text]);audio=a;const t=setTimeout(done,14000);function done(){clearTimeout(t);if(audio===a){audio=null;finish=null;}a.pause();resolve();}finish=done;a.onended=done;a.onerror=done;void a.play().catch(done);});}};
}
