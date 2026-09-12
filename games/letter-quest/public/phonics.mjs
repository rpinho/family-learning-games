// Deliberately small, regular short-a set. Sound clips use explicit phonemes
// in the local voice builder, never text-to-speech letter-name guessing.
export const PHONEMES={a:'æ',b:'b',c:'k',h:'h',m:'m',p:'p',r:'ɹ',t:'t'};
export const BLEND_WORDS=['cat','hat','map','cap','tap','bat','rat'];
export const soundLine=letter=>`Sound ${letter.toLowerCase()}.`;
export const BLEND_PROMPT='Tap each sound. Slide to join them.';
export const READ_PROMPT='Read the word. Choose its picture.';
export function phonicsVoiceLines(){return [BLEND_PROMPT,READ_PROMPT,...Object.keys(PHONEMES).map(soundLine)];}
export const blendProgress=(x,left,width)=>Math.max(0,Math.min(1,(x-left)/Math.max(1,width)));
