// Calm wind-down (from Sage Teacher's session timers, without a timer on
// screen). Play time is tracked from saved actions. After WIND_DOWN_MS of
// continuous play, the round that is finishing becomes the last one for now:
// the finish screen says "All done for today" and new rounds wait REST_MS.
// A pause of BREAK_MS starts a fresh stretch. Nothing is ever cut off mid-round.
// Longest continuous stretches in the Sep 14-26 logs were ~12 minutes, so 20
// minutes (Sage's middle option) only catches unusually long runs.
export const BREAK_MS=10*60*1000;
export const WIND_DOWN_MS=20*60*1000;
export const REST_MS=60*60*1000;
export function trackPlay(p,now){
 const play=p.play??={};
 if(!Number.isFinite(play.last)||now-play.last>BREAK_MS||now<play.last)play.since=now;
 play.last=now;
 // After a rest, a new stretch begins.
 if(Number.isFinite(play.restUntil)&&play.restUntil<=now){delete play.restUntil;play.since=now;}

 return play;
}
export const windDownDue=(p,now)=>!!p.play&&Number.isFinite(p.play.since)&&now-p.play.since>=WIND_DOWN_MS;
export const resting=(p,now)=>Number.isFinite(p.play?.restUntil)&&p.play.restUntil>now;
