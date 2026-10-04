// Installed before any game audio. A navigation barrier cancels media and WebAudio,
// including pending decodes; only a new user gesture may begin another interaction.
(()=>{
 if(!globalThis.document||globalThis.familyAudio)return;
 const media=new Set(),sources=new Set(),contexts=new Set();let blocked=false,epoch=0;
 const stop=()=>{blocked=true;epoch++;for(const a of media){try{a.pause();a.removeAttribute('src');a.load();}catch{}}for(const s of sources){try{s.stop();s.disconnect();}catch{}}sources.clear();for(const c of contexts){if(c.state==='closed'){contexts.delete(c);continue;}try{Promise.resolve(c.suspend()).catch(()=>{if(c.state==='closed')contexts.delete(c);});}catch{if(c.state==='closed')contexts.delete(c);}}try{globalThis.speechSynthesis?.cancel();}catch{}globalThis.dispatchEvent(new Event('family-audio-stop'));};
 globalThis.familyAudio={stop,get epoch(){return epoch;},get blocked(){return blocked;}};
 if(globalThis.speechSynthesis){const speak=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=utterance=>{if(!blocked&&!document.hidden)return speak(utterance);};}
 if(globalThis.HTMLMediaElement){const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){media.add(this);if(blocked||document.hidden)return Promise.resolve();return play.call(this);};}
 for(const name of ['AudioBufferSourceNode','OscillatorNode']){const P=globalThis[name]?.prototype;if(!P)continue;const start=P.start;P.start=function(...args){if(blocked||document.hidden)return;contexts.add(this.context);sources.add(this);this.addEventListener('ended',()=>sources.delete(this),{once:true});return start.apply(this,args);};}
 const feedback=e=>{const b=e.target.closest?.('button');if(!b)return;b.classList.add('family-tap');setTimeout(()=>b.classList.remove('family-tap'),180);};document.addEventListener('pointerdown',feedback,true);document.addEventListener('click',feedback,true);
 document.addEventListener('pointerdown',()=>{if(!document.hidden)blocked=false;},true);
 document.addEventListener('keydown',()=>{if(!document.hidden)blocked=false;},true);
 // click also covers keyboard buttons and programmatic accessible activation.
 document.addEventListener('click',()=>{if(!document.hidden)blocked=false;},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 addEventListener('pagehide',stop);addEventListener('popstate',stop);addEventListener('hashchange',stop);
 addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='family-audio-stop')stop();});
})();
