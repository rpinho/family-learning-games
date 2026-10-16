// How long the quest audit waits for a browser condition. Every wait is by the clock: the draft runs as a background
// process on the efficiency cores, and 180 polls (about 13.5 s) failed correct quests three times on 2026-10-16 (a room
// load; the math card's Next after a deliberate wrong answer). A broken step still fails, about 30 s later.
export const STEP_MS=45e3;
// A room load is a full page navigation (world page, art, voice warm-up) and,
// at background priority while a draft narrates, takes 5-7 s and sometimes 20+ s (2026-10-16: pirate shore 23 s).
// A fixed 180-poll wait failed a correct quest on a slow room load, so room loads wait by the clock instead.
export const ROOM_LOAD_MS=60e3;
// One DevTools command (a tap, an evaluation that waits for animations) gets 60 s. The draft runs as a background
// process limited to the efficiency cores; with other background jobs running, a tap took over 20 s twice on
// 2026-10-16 and the old 20-s limit failed two correct quests. A slow command still fails, just later.
export const CDP_COMMAND_MS=60e3;
export async function waitFor(check,{ms=null,tries=180,gap=75,sleep=t=>new Promise(r=>setTimeout(r,t)),now=Date.now}={}){
 const end=ms==null?null:now()+ms;
 for(let i=0;end==null?i<tries:i===0||now()<end;i++){if(await check())return true;await sleep(gap);}
 return false;
}
