// Letter Slalom's speed model and its timing budget, shared by the 3D scene and the tests (pure, no three.js).
// After a gate: short feedback (the word or letter), then the next row's question; both must fit before the next row.
// supportSpeed: the calmer cruise for rows after two misses in a row, whose question is the longer sound-out.
export const COURSE={first:58,spacing:62,finishAfter:46,stopAfter:30,piste:11.5,baseSpeed:8.6,supportSpeed:6.4,minSpeed:2.4,boostSpeed:15};
export const LOOK_SECONDS=2.2;            // after a question, time left to look before the row
export const FEEDBACK_SHARE=0.25;         // feedback may use at most this share of the time to the next row
export const CLIP_OVERHEAD=0.15;          // start latency of each clip in the browser (measured in play-throughs: ~0.05-0.15 s)
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Target speed while approaching a row. promptEnded: seconds since its question ended (undefined while not yet heard).
export function targetSpeed({dist,promptEnded,boost,base=COURSE.baseSpeed}){
 if(dist===undefined)return boost?COURSE.boostSpeed:base;                 // after the last row
 if(promptEnded===undefined)return clamp((dist-7)*0.42,COURSE.minSpeed,base); // glide until the question has been heard
 if(boost)return COURSE.boostSpeed;                                         // go faster only after the question
 const need=LOOK_SECONDS-promptEnded;return need>0?clamp(dist/need,COURSE.minSpeed,base):base;
}
export function nextSpeed(v,target,dt){
 const up=v<3?1.6:v>COURSE.baseSpeed-0.1?3.2:2.2;return v+clamp(target-v,-3.2*dt,up*dt);
}
// Simulate the stretch from passing a row (at speed v0) to the next row: feedback clip, then the next question.
// Returns the measured gaps and whether they fit the budget. Support rows (base=supportSpeed, allowSlow): the rider
// may ease off for the longer sound-out, as long as it is heard in full with time left to look.
export function gapAfterGate({feedback,prompt,v0,boost=false,base=COURSE.baseSpeed,allowSlow=false,spacing=COURSE.spacing,overhead=CLIP_OVERHEAD,dt=1/120}){
 const toRowAtPass=spacing/v0,fbStart=overhead,fbEnd=fbStart+feedback,pStart=fbEnd+overhead,pEnd=pStart+prompt;
 let t=0,d=spacing,v=v0,slowed=false,atPromptEnd=null;const floor=Math.min(v0,base)-0.05;
 while(d>0&&t<60){
  const ended=t>=pEnd?t-pEnd:undefined;v=nextSpeed(v,targetSpeed({dist:d,promptEnded:ended,boost,base}),dt);
  if(t<pEnd&&v<floor)slowed=true;
  if(atPromptEnd===null&&t>=pEnd)atPromptEnd={dist:d,v,secondsLeft:d/Math.max(v,0.1)};
  d-=v*dt;t+=dt;
 }
 const share=feedback/toRowAtPass,ok=share<=FEEDBACK_SHARE&&!!atPromptEnd&&atPromptEnd.secondsLeft>=LOOK_SECONDS&&(allowSlow||!slowed);
 return {ok,v0,feedback,prompt,toRowAtPass:+toRowAtPass.toFixed(2),feedbackShare:+share.toFixed(3),promptStartsAt:+pStart.toFixed(2),promptEndsAt:+pEnd.toFixed(2),
  secondsLeftAfterPrompt:atPromptEnd?+atPromptEnd.secondsLeft.toFixed(2):0,metresLeftAfterPrompt:atPromptEnd?+atPromptEnd.dist.toFixed(1):0,slowedForPrompt:slowed,rowReachedAt:+t.toFixed(2)};
}
