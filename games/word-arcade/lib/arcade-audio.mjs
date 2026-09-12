// Original generated music loops and CC0 laser effects; see audio credits.
export const TRACKS=[
  {id:'off',name:'Off'},
  {id:'pixel',name:'Pixel Flight',file:'/audio/pixel.wav'},
  {id:'bubbles',name:'Bubble Steps',file:'/audio/bubbles.wav'},
  {id:'epic',name:'Star March',file:'/audio/epic.wav'},
  {id:'stardrift',name:'Moon Drift',file:'/audio/stardrift.wav'},
];
export const LASERS=[

  {id:'pulse',name:'Pulse',file:'/audio/laser-pulse-v2.wav'},
  {id:'retro',name:'Retro',file:'/audio/laser-retro-v2.wav'},
  {id:'plasma',name:'Plasma',file:'/audio/laser-plasma-v2.wav'},
];
const volume=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
export const audioPreferences=value=>({
  track:TRACKS.some(t=>t.id===value?.track)?value.track:'off',
  effects:value?.effects!==false,
  volume:volume(value?.volume,0.65),
  effectsVolume:volume(value?.effectsVolume,0.6),
  laser:LASERS.some(t=>t.id===value?.laser)?value.laser:'pulse',
});
export class ArcadeAudio {
  constructor({createContext=()=>new (window.AudioContext||window.webkitAudioContext)(),createPlayer=()=>{const p=document.createElement('audio');document.body.append(p);return p;},fetchAudio=(...args)=>fetch(...args),record=()=>{},notify=()=>{}}={}){
    Object.assign(this,{createContext,createPlayer,fetchAudio,record,notify});
    this.prefs=audioPreferences();this.nodes=new Set();this.buffers=new Map();this.loading=new Map();
    this.paused=false;this.ducked=false;this.disposed=false;this.generation=0;this.shotGeneration=0;
  }
  async unlock(){
    if(this.disposed)return false;
    try{
      if(!this.ctx){
        this.ctx=this.createContext();this.music=this.ctx.createGain();this.fx=this.ctx.createGain();
        this.music.connect(this.ctx.destination);this.fx.connect(this.ctx.destination);
        this.music.gain.setValueAtTime(0,this.ctx.currentTime);
        this.player=this.createPlayer();this.player.id='arcade-music';this.player.hidden=true;this.player.preload='none';this.player.loop=true;
        this.source=this.ctx.createMediaElementSource(this.player);this.source.connect(this.music);
        this.player.addEventListener('playing',()=>{if(!this.paused&&this.prefs.track!=='off'){this.notify('');this.record('music_start',{track:this.prefs.track,state:this.ctx.state});}});
        this.player.addEventListener('error',()=>{if(!this.disposed&&this.prefs.track!=='off'){this.record('audio_error',{reason:'music_file',track:this.prefs.track,code:this.player.error?.code});this.notify('Music could not load. Tap to retry.');}});
        this.ctx.onstatechange=()=>{if(this.ctx.state!=='running')this.stopMusic();else this.sync();};
      }
      if(this.ctx.state!=='running')await this.ctx.resume();
      if(this.disposed)return false;
      this.sync();void this.preloadLaser();return this.ctx.state==='running';
    }catch(e){this.record('audio_error',{reason:'unlock',message:e.message});this.notify('Tap a sound control to try audio again.');return false;}
  }
  configure(prefs){
    const next=audioPreferences(prefs),changed=next.track!==this.prefs.track;
    if(changed){this.stopMusic();this.trackLoaded=null;if(this.player){this.player.removeAttribute('src');this.player.load();}}
    this.prefs=next;
    if(!next.effects){this.shotGeneration++;this.stopNodes();}
    this.sync();if(this.ctx)void this.preloadLaser();
  }
  setPaused(value){this.paused=value;if(value){this.shotGeneration++;this.stopMusic();this.stopNodes();}this.sync();}
  duck(value){if(value!==this.ducked&&this.player&&!this.player.paused)this.record('music_duck',{speaking:value});this.ducked=value;this.updateGain();}
  updateGain(){
    if(!this.ctx)return;
    // Recorded songs are already mastered: no extra 0.22 attenuation from v1.
    const level=this.paused||this.prefs.track==='off'?0:this.prefs.volume*0.9*(this.ducked?0.22:1);
    this.music.gain.setTargetAtTime(level,this.ctx.currentTime,this.ducked?0.035:0.25);
    this.fx.gain.setTargetAtTime(this.prefs.effectsVolume*0.8,this.ctx.currentTime,0.02);
  }
  sync(){
    if(this.disposed)return;
    this.updateGain();
    if(this.paused||this.prefs.track==='off'){this.stopMusic();this.notify('');return;}
    if(this.ctx?.state!=='running'){this.notify('Tap here to start music.');return;}
    const track=TRACKS.find(t=>t.id===this.prefs.track);
    if(this.trackLoaded!==track.id){this.player.src=track.file;this.trackLoaded=track.id;}
    if(!this.player.paused||this.playPending)return;
    if(this.player.error)this.player.load();
    const generation=this.generation;
    this.notify('Loading music…');
    // Stream MP3s rather than decoding several minutes into Chromebook memory.
    this.playPending=Promise.resolve(this.player.play()).catch(e=>{
      if(generation===this.generation&&!this.disposed){this.record('audio_error',{reason:'music_play',message:e.message});this.notify('Music could not play. Tap to retry.');}
    }).finally(()=>{if(generation===this.generation)this.playPending=null;});
  }
  stopMusic(){
    this.generation++;this.playPending=null;
    if(this.player&&!this.player.paused){this.player.pause();this.record('music_stop',{track:this.prefs.track});}
  }
  async preloadLaser(){
    if(!this.ctx||this.disposed||!this.prefs.effects)return null;
    const {id,file}=LASERS.find(t=>t.id===this.prefs.laser);
    if(this.buffers.has(id))return this.buffers.get(id);
    if(this.loading.has(id))return this.loading.get(id);
    const task=(async()=>{try{
      const r=await this.fetchAudio(file);if(!r.ok)throw Error('Laser file unavailable');
      const buffer=await this.ctx.decodeAudioData(await r.arrayBuffer());
      if(!this.disposed){this.buffers.set(id,buffer);this.record('laser_ready',{laser:id,duration:buffer.duration});}return buffer;
    }catch(e){this.record('audio_error',{reason:'laser_file',message:e.message});return null;}finally{this.loading.delete(id);}})();
    this.loading.set(id,task);return task;
  }
  laser(){
    if(!this.prefs.effects||this.paused||this.disposed)return false;
    if(this.ctx?.state!=='running'){const generation=++this.shotGeneration;void this.unlock().then(ok=>{if(ok&&generation===this.shotGeneration)this.laser();});return false;}
    const buffer=this.buffers.get(this.prefs.laser);
    // Bound rapid repeated previews/shots, and never delay a shot for a download.
    this.stopNodes();
    if(buffer){
      const o=this.ctx.createBufferSource(),g=this.ctx.createGain();o.buffer=buffer;g.gain.setValueAtTime(LASERS.find(l=>l.id===this.prefs.laser).gain||1,this.ctx.currentTime);o.connect(g);g.connect(this.fx);this.nodes.add(o);
      o.onended=()=>{o.disconnect();g.disconnect();this.nodes.delete(o);};o.start();
    }else{
      void this.preloadLaser();
      this.tone({frequency:900,endFrequency:320,duration:0.12,gain:0.18});
    }
    this.record('laser',{state:this.ctx.state,laser:this.prefs.laser,recorded:!!buffer});return true;
  }
  tone({frequency,endFrequency,duration=0.2,gain=0.2,delay=0}){
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(),time=this.ctx.currentTime+delay;
    o.type='sine';o.frequency.setValueAtTime(frequency,time);o.frequency.exponentialRampToValueAtTime(endFrequency,time+duration);
    g.gain.setValueAtTime(0.0001,time);g.gain.exponentialRampToValueAtTime(gain,time+0.006);g.gain.exponentialRampToValueAtTime(0.0001,time+duration);
    o.connect(g);g.connect(this.fx);this.nodes.add(o);
    o.onended=()=>{o.disconnect();g.disconnect();this.nodes.delete(o);};o.start(time);o.stop(time+duration+0.01);
  }
  feedback(ok){if(this.prefs.effects&&!this.paused&&!this.disposed&&this.ctx?.state==='running'){if(ok){for(const [i,f] of [660,880,1320].entries())this.tone({frequency:f,endFrequency:f,duration:0.22,gain:0.36,delay:i*0.09});}else this.tone({frequency:180,endFrequency:110});this.record('answer_chime',{ok});}}
  stopNodes(){for(const o of this.nodes){try{o.stop();}catch{}o.disconnect();}this.nodes.clear();}
  dispose(){this.disposed=true;this.stopMusic();this.stopNodes();if(this.player){this.player.removeAttribute('src');this.player.load();this.player.remove();}this.source?.disconnect();if(this.ctx){this.ctx.onstatechange=null;void this.ctx.close().catch(()=>{});}}
}
