import {calmSound} from './calm-sound.mjs';
let sound;
export function calmAudio(){if(!sound){sound=calmSound('/audio/calm-water.m4a');sound.setEnabled(false);}return sound;}
export function calmAmbience(on){calmAudio().setEnabled(on);if(on)calmAudio().start();}
export function calmPluck(){// The existing caller owns the effects preference.
 const s=calmAudio();s.pluck();
}
