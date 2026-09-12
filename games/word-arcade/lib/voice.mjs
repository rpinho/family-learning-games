export const briefLine=text=>text?.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()||text;
export const SHORT_FEEDBACK=['Nice!','Got it!','Well done!','Try again.'];
export class CoachVoice {
  constructor(notify=()=>{},record=()=>{}) {
    this.notify=notify;
    this.record=record;
    this.generation=0;this.mode=null;this.lastSpeech=-Infinity;this.lastFeedback=-Infinity;this.feedbackIndex=0;this.latestLetter=0;this.seenInstructions=new Set();
    this.tail=Promise.resolve();this.queued=false;this.cancelWait=null;
    this.player=document.createElement('audio');
    this.player.id='coach-audio';
    this.player.hidden=true;
    this.player.preload='auto';
    document.body.append(this.player);
    this.ready=this.load();
    for(const name of ['ended','error'])this.player.addEventListener(name,()=>{this.player.dataset.status=name;this.lastSpeech=Date.now();if(!this.queued)this.mode=null;});
  }
  async load(){
    try{
      const response=await fetch('/voice/manifest.json');
      if(!response.ok)throw Error('Voice not ready');
      this.manifest=await response.json();
      return this.manifest;
    }catch(e){this.record('voice_error',{reason:'manifest',message:e.message});return null;}
  }
  stop(){
    globalThis.speechSynthesis?.cancel();
    this.generation++;if(this.mode)this.lastSpeech=Date.now();this.mode=null;clearTimeout(this.promptTimer);this.promptTimer=null;
    this.cancelWait?.();this.cancelWait=null;
    this.tail=Promise.resolve();this.queued=false;
    this.player.pause();
    this.player.removeAttribute('src');
    this.player.load();
    this.player.dataset.status='stopped';
  }
  async speak(text){
    this.stop();this.mode='manual';
    return this.play(text,this.generation);
  }
  instruction(text,{key='',essential=true}={}){
    if(!text)return;
    if(!essential&&key&&this.seenInstructions.has(key)){this.record('voice_skip',{reason:'familiar_instruction'});return;}
    if(key)this.seenInstructions.add(key);
    this.stop();this.mode='instruction';this.essentialInstruction=essential;const generation=this.generation;
    // A small settling gap prevents clipped prompts when the child navigates quickly.
    this.promptTimer=setTimeout(()=>{this.promptTimer=null;void this.play(text,generation);},250);
  }
  feedback(ok=true){
    const now=Date.now();
    if(this.mode||this.queued||now-this.lastSpeech<3000||now-this.lastFeedback<15000){this.record('voice_skip',{reason:'breathing_room'});return;}
    this.lastFeedback=now;this.stop();this.mode='feedback';
    return this.play(ok?SHORT_FEEDBACK[this.feedbackIndex++%3]:SHORT_FEEDBACK[3],this.generation);
  }
  letter(text){
    if(this.mode==='instruction'&&this.essentialInstruction){this.record('voice_skip',{reason:'target_word_priority'});return Promise.resolve();}
    if(this.mode!=='letter')this.stop();
    const task=this.enqueue(text,{latest:true});this.mode='letter';return task;
  }
  enqueue(text,{latest=false}={}){
    if(!this.queued){this.stop();this.queued=true;}
    const generation=this.generation,letterToken=latest?++this.latestLetter:0;
    const task=this.tail.then(async()=>{
      if(generation!==this.generation||latest&&letterToken!==this.latestLetter){if(latest)this.record('voice_skip',{reason:'superseded_letter'});return;}
      if(!await this.play(text,generation)||generation!==this.generation)return;
      await new Promise(resolve=>{
        const done=()=>{clearTimeout(timer);this.player.removeEventListener('ended',done);this.player.removeEventListener('error',done);if(this.cancelWait===done)this.cancelWait=null;resolve();};
        const timer=setTimeout(done,20000);
        this.cancelWait=done;this.player.addEventListener('ended',done);this.player.addEventListener('error',done);
        if(this.player.ended)done();
      });
    });
    const tail=task.catch(()=>{});this.tail=tail;
    void tail.then(()=>{if(this.tail===tail){this.queued=false;this.mode=null;}});
    return tail;
  }
  async play(text,generation){
    let manifest=await this.ready;
    if(!manifest){this.ready=this.load();manifest=await this.ready;}
    if(generation!==this.generation)return;
    let clip=manifest?.clips[text];
    // A new deployment can add clips while an older tab still holds its manifest.
    if(!clip&&manifest){this.ready=this.load();manifest=await this.ready;clip=manifest?.clips[text];}
    if(generation!==this.generation)return;

    if(!clip){
      if(!globalThis.speechSynthesis){this.mode=null;this.notify('Speech is unavailable on this device. Read the instruction together.');return;}
      const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.9;
      const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang==='en-US')||null;
      await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);this.cancelWait=null;resolve();};const timer=setTimeout(finish,20000);this.cancelWait=finish;u.onend=finish;u.onerror=finish;speechSynthesis.speak(u);});
      if(generation===this.generation){this.mode=null;this.lastSpeech=Date.now();}return false;
    }

    this.lastSpeech=Date.now();
    this.player.src=clip;
    this.player.dataset.voice=manifest.voice;
    this.player.dataset.status='loading';
    try{
      await this.player.play();
      if(generation!==this.generation)return;
      this.player.dataset.status='playing';
      this.record('voice_play',{voice:manifest.voice,clip,text,mode:this.mode});
      return true;
    }catch(e){
      if(generation!==this.generation||e.name==='AbortError')return;
      this.mode=null;this.player.dataset.status='error';
      this.record('voice_error',{voice:manifest.voice,clip,reason:e.name,message:e.message,code:this.player.error?.code||0});
      this.notify('Tap the speaker to hear Nova. Check the device volume if needed.');
    }
  }
}
