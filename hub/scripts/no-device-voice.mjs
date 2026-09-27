// For every browser check: the device's own voice (speechSynthesis) must never make a sound. Chrome's
// --mute-audio does not silence it on macOS (the OS speech service plays it out loud), so it is replaced before any
// page script runs, and every call is recorded in __deviceVoice (a check fails if that is not empty).
export const NO_DEVICE_VOICE=`(()=>{const calls=[];globalThis.__deviceVoice=calls;try{const ss=globalThis.speechSynthesis;if(ss){ss.speak=u=>{calls.push(String(u&&u.text||'').slice(0,120));try{u&&u.onend&&u.onend(new Event('end'));}catch{}};ss.cancel=()=>{};}}catch{}})();`;
