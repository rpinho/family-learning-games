// How long the quest audit waits for a browser condition.
// Most checks keep the original 180 polls. A room load is a full page navigation (world page, art, voice warm-up) and,
// at background priority while a draft narrates, takes 5-7 s and sometimes 20+ s (2026-10-16: pirate shore 23 s).
// A fixed 180-poll wait failed a correct quest on a slow room load, so room loads wait by the clock instead.
export const ROOM_LOAD_MS=60e3;
export async function waitFor(check,{ms=null,tries=180,gap=75,sleep=t=>new Promise(r=>setTimeout(r,t)),now=Date.now}={}){
 const end=ms==null?null:now()+ms;
 for(let i=0;end==null?i<tries:i===0||now()<end;i++){if(await check())return true;await sleep(gap);}
 return false;
}
