// Original quiet tabletop sounds. Created only after a gesture; never a voice.
export function createTableFeedback({createContext=()=>new (window.AudioContext||window.webkitAudioContext)()}={}) {
  let context=null, disposed=false;
  const notes=new Set();
  function stop() {
    for(const note of notes) { try { note.stop(); } catch {} }
    notes.clear();
  }
  function play({solved=false,enabled=true,speaking=false}={}) {
    if(disposed||!enabled||speaking)return;
    try {
      context ||= createContext();
      if(context.state==='suspended')void context.resume().catch(()=>{});
      stop();
      const now=context.currentTime, duration=solved ? .48 : .09;
      const note=context.createOscillator(), gain=context.createGain();
      note.type=solved?'triangle':'sine';
      note.frequency.setValueAtTime(solved?523.25:196,now);
      if(!solved)note.frequency.exponentialRampToValueAtTime(98,now+duration);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(solved ? .024 : .035,now+.006);
      gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      note.connect(gain);gain.connect(context.destination);notes.add(note);
      note.onended=()=>{notes.delete(note);note.disconnect();gain.disconnect();};
      note.start(now);note.stop(now+duration+.02);
    } catch {} // Sound failure never blocks a move or its save.
  }
  function dispose(){disposed=true;stop();if(context)void context.close().catch(()=>{});}
  return {play,stop,dispose};
}
