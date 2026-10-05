// Sound for the living book, all synthesised (no files): a soft ambience per scene (wind, crickets at dusk,
// birds in the morning), a music-box pad under the story, and small effects (the whistle, steam, lamps, steps,
// wings, a kick, the net, a sparkle). Quiet by design: the narration is always on top.
export function createSound(){
 const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return null;
 const ctx=new AC(),master=ctx.createGain();master.gain.value=.9;master.connect(ctx.destination);
 const fx=ctx.createGain();fx.gain.value=.55;fx.connect(master);const amb=ctx.createGain();amb.gain.value=0;amb.connect(master);const mus=ctx.createGain();mus.gain.value=0;mus.connect(master);
 // A small room reverb (generated impulse) for warmth.
 const verb=ctx.createConvolver();{const len=ctx.sampleRate*2.2,b=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);}verb.buffer=b;}
 const wet=ctx.createGain();wet.gain.value=.25;verb.connect(wet);wet.connect(master);mus.connect(verb);fx.connect(verb);
 const noiseBuf=(()=>{const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=w*.5+last*3;}return b;})();
 const now=()=>ctx.currentTime;
 function noise(dur,{type='lowpass',f=800,q=.7,gain=.3,attack=.01,release=.2,to=fx,f2}={}){const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;const flt=ctx.createBiquadFilter();flt.type=type;flt.frequency.value=f;flt.Q.value=q;
  if(f2)flt.frequency.linearRampToValueAtTime(f2,now()+dur);const g=ctx.createGain();g.gain.setValueAtTime(0,now());g.gain.linearRampToValueAtTime(gain,now()+attack);g.gain.setValueAtTime(gain,now()+Math.max(attack,dur-release));g.gain.linearRampToValueAtTime(0,now()+dur);
  s.connect(flt);flt.connect(g);g.connect(to);s.start();s.stop(now()+dur+.05);}
 function tone(freq,dur,{type='sine',gain=.2,attack=.01,release=.3,to=fx,slide=0,vib=0,at=0}={}){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;const t0=now()+at;o.frequency.setValueAtTime(freq,t0);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t0+dur);
  if(vib){const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=5.5;lg.gain.value=freq*vib;l.connect(lg);lg.connect(o.frequency);l.start(t0);l.stop(t0+dur);}
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(gain,t0+attack);g.gain.exponentialRampToValueAtTime(.0005,t0+dur);o.connect(g);g.connect(to);o.start(t0);o.stop(t0+dur+.05);}
 const effects={
  lamp(){tone(1320,.6,{gain:.05,type:'triangle'});tone(1980,.5,{gain:.025,at:.03});},
  whistle(){for(const [f,g] of [[587,.09],[740,.07],[880,.04]]){tone(f,1.6,{type:'sawtooth',gain:g*.5,attack:.08,vib:.008});}noise(1.6,{type:'bandpass',f:1800,q:2,gain:.05});},
  hiss(){noise(1.4,{type:'highpass',f:2500,gain:.12,attack:.02,release:1.1});},
  chug(){noise(.18,{type:'lowpass',f:500,gain:.12});},
  step(){noise(.08,{type:'bandpass',f:1200+Math.random()*500,q:1.5,gain:.05});},
  flap(){for(let i=0;i<6;i++)setTimeout(()=>noise(.09,{type:'bandpass',f:700,q:1,gain:.07}),i*140);},
  squawk(){tone(900,.25,{type:'square',gain:.04,slide:1.6});tone(1200,.3,{type:'square',gain:.03,slide:.6,at:.22});},
  kick(){tone(140,.25,{gain:.35,slide:.4});noise(.06,{type:'lowpass',f:2000,gain:.12});},
  net(){noise(.7,{type:'bandpass',f:3000,q:.6,gain:.08,release:.5,f2:1200});},
  sparkle(){[1568,2093,2637,3136].forEach((f,i)=>tone(f,.9,{type:'sine',gain:.035,at:i*.07}));},
  soft(){tone(660,.4,{type:'triangle',gain:.04});},
  cheer(){[523,659,784,1047].forEach((f,i)=>tone(f,.5,{type:'triangle',gain:.05,at:i*.08}));},
  no(){tone(392,.18,{type:'triangle',gain:.07});tone(330,.25,{type:'triangle',gain:.06,at:.12});},
 };
 // Ambience: a looping bed with occasional sounds on top.
 let ambTimer=null;
 function ambience(kind){clearInterval(ambTimer);amb.gain.cancelScheduledValues(now());amb.gain.linearRampToValueAtTime(.9,now()+3);
  const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=kind==='dawn'?600:380;const g=ctx.createGain();g.gain.value=kind==='night'?.05:.07;
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.07;lg.gain.value=.03;lfo.connect(lg);lg.connect(g.gain);lfo.start();s.connect(f);f.connect(g);g.connect(amb);s.start();
  ambTimer=setInterval(()=>{if(kind==='dusk'||kind==='night'){for(let i=0;i<3+Math.random()*3;i++)tone(4200+Math.random()*300,.04,{gain:.012,to:amb,at:i*.07});}
   else{const f0=2200+Math.random()*1400;tone(f0,.12,{gain:.02,to:amb,slide:1.3});tone(f0*1.2,.1,{gain:.015,to:amb,slide:.8,at:.14});}},kind==='dawn'?1700:900);}
 // A music-box pad: slow notes of a pentatonic scale, soft and warm.
 let musTimer=null;
 function music(on,{key=261.63,mood='warm'}={}){clearInterval(musTimer);mus.gain.cancelScheduledValues(now());mus.gain.linearRampToValueAtTime(on?.55:0,now()+2.5);if(!on)return;
  const sc=mood==='night'?[0,3,5,7,10,12]:[0,2,4,7,9,12];let i=0;
  musTimer=setInterval(()=>{const n=sc[(i*3+Math.floor(i/4))%sc.length]+(i%8<4?0:-12);const f=key*Math.pow(2,n/12);tone(f,2.8,{type:'sine',gain:.035,to:mus,attack:.02});tone(f*2,1.4,{type:'triangle',gain:.008,to:mus});i++;},mood==='night'?1100:850);}
 return {ctx,resume:()=>ctx.resume(),play:k=>effects[k]?.(),ambience,music,duck(v){mus.gain.linearRampToValueAtTime(v,now()+.4);},stop(){clearInterval(ambTimer);clearInterval(musTimer);amb.gain.linearRampToValueAtTime(0,now()+1);mus.gain.linearRampToValueAtTime(0,now()+1);}};
}
