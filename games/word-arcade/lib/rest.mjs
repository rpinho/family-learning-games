// Calm wind-down (same rule as Letter Quest and Number Park, from Sage Teacher's session timers, without a timer on
// screen). Play time is tracked from saved actions. After WIND_DOWN_MS of continuous play, the mission or ski run that
// is finishing becomes the last one for now: the finish screen says "All done for today" and new missions wait
// REST_MS. A pause of BREAK_MS starts a fresh stretch. Nothing is ever cut off in the middle. Per game, not across
// games. The Admin test profile is never put to rest.
export const BREAK_MS=10*60*1000;
export const WIND_DOWN_MS=20*60*1000;
export const REST_MS=60*60*1000;
export const REST_LINE='All done for today, see you next time!';
export const REST_COACH='Great work today, time for a rest.';
export function trackPlay(p,now){
 const play=p.play??={};
 if(!Number.isFinite(play.last)||now-play.last>BREAK_MS||now<play.last)play.since=now;
 play.last=now;
 if(Number.isFinite(play.restUntil)&&play.restUntil<=now){delete play.restUntil;play.since=now;}
 return play;
}
export const windDownDue=(p,now)=>p.id!=='admin'&&Number.isFinite(p.play?.since)&&now-p.play.since>=WIND_DOWN_MS;
export function startRest(p,now){p.play??={};p.play.restUntil=now+REST_MS;}
export const resting=(p,now)=>p?.id!=='admin'&&Number.isFinite(p?.play?.restUntil)&&p.play.restUntil>now;
export function clearRest(p,now){if(p.play){delete p.play.restUntil;p.play.since=now;p.play.last=now;}}
