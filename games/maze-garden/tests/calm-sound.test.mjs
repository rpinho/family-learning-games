import test from 'node:test';
import assert from 'node:assert/strict';
import {calmSound} from '../public/calm-sound.mjs';
test('ambient sound is gesture-lazy, ducked across overlapping speech, muted and disposed',()=>{
 const old={Audio:globalThis.Audio,document:globalThis.document};let media,listener;
 globalThis.document={hidden:false,addEventListener(_,fn){listener=fn;},removeEventListener(_,fn){assert.equal(fn,listener);listener=null;}};
 globalThis.Audio=class{constructor(){media=this;this.volume=1;this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}};
 try{const s=calmSound('/test.m4a');assert.equal(media,undefined);s.start();assert.equal(media.paused,false);const a=s.duck(),b=s.duck();assert.equal(media.volume,.08);a();a();assert.equal(media.volume,.08);b();assert.equal(media.volume,.34);
 s.setEnabled(false);s.start();assert.equal(media.paused,true);s.setEnabled(true);assert.equal(media.paused,false);document.hidden=true;listener();assert.equal(media.paused,true);document.hidden=false;listener();assert.equal(media.paused,false);s.destroy();assert.equal(listener,null);assert.equal(media.paused,true);s.start();assert.equal(media.paused,true);
 }finally{globalThis.Audio=old.Audio;globalThis.document=old.document;}
});
