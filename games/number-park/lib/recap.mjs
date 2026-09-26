// End-of-round recap: one or two short sentences of what the child did, shown
// and spoken once when a six-question round finishes. Borrowed from Sage
// Teacher's session wrap-up, kept short on purpose (a parent turned that
// tutor's verbosity down). Every sentence comes from a finite list so the
// voice clips can be generated ahead of time.
const WORDS=['Zero','One','Two','Three','Four','Five','Six'];
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
// Main sentence per game. Explorer (older) games first, then the little games.
const MAIN={
 multiply:n=>`You solved ${plural(n,'times-table fact')}.`,
 factor:n=>`You found ${plural(n,'missing factor')}.`,
 sums:n=>`You solved ${plural(n,'sum')}.`,
 skip:n=>`You finished ${plural(n,'number jump')}.`,
 place:n=>`You built ${plural(n,'number')}.`,
 cookies:n=>`You solved ${plural(n,'cookie puzzle')}.`,
 mission:n=>`You solved ${plural(n,'math puzzle')}.`,
 mix:n=>`You solved ${plural(n,'little sum')}.`,
 line:n=>`You hopped to ${plural(n,'number')}.`,
 missing:n=>`You found ${plural(n,'missing piece')}.`,
 count:n=>`You counted ${plural(n,'group')}.`,
 addobjects:n=>`You put ${plural(n,'group')} together.`,
 subtract:n=>`You took away ${plural(n,'time')}.`,
 pattern:n=>`You finished ${plural(n,'pattern')}.`
};
export const RECAP_NONE='You finished a whole round.';
export const zerosLine=k=>`${WORDS[k]} had ${k===1?'a zero':'zeros'}.`;
export const ownLine=k=>`You did ${k} on your own.`;
export const RECAP_ALL_OWN='All on your own!';
// The quiet mastery check: five clean cookie rounds in a row on his own.
export const LEVEL_UP='Five in a row. New cookie level!';
// Calm wind-down after a long stretch of play (see rest.mjs).
export const WIND_DOWN_LINE='All done for today. See you next time!';
// A friendly bear who only ever gains: every correct answer is one berry.
export const FEEDER={name:'Bo',icon:'🐻',treat:'🍓'};
export const feedLine=n=>`${FEEDER.name} ate ${plural(n,'berry','berries')}!`;
export const feeds=player=>player!=='explorer';
const hasZero=q=>Array.isArray(q?.target)&&q.target.some((n,i)=>n===0&&q.target.slice(0,i).some(v=>v>0));
// entries: this round's history rows (one per finished question).
export function roundRecap({game,advanced,correct,independent,entries=[],player,levelUps=0,windDown=false}){
 const key=advanced&&game==='mix'?'mission':game;
 let main=correct>0&&MAIN[key]?MAIN[key](correct):RECAP_NONE;
 const builds=entries.filter(h=>h.ok&&h.question?.placeMode==='build');
 if(game==='place'&&builds.length!==correct)main=correct>0?`You solved ${plural(correct,'place value puzzle')}.`:RECAP_NONE;
 const lines=[main];
 const zeros=builds.filter(h=>hasZero(h.question)).length;
 if(feeds(player)){if(correct>0)lines.push(feedLine(correct));}
 else if(levelUps>0)lines.push(LEVEL_UP);
 else if(zeros>0)lines.push(zerosLine(Math.min(6,zeros)));
 else if(correct>0&&independent===correct)lines.push(RECAP_ALL_OWN);
 else if(independent>0)lines.push(ownLine(independent));
 if(windDown)lines.push(WIND_DOWN_LINE);
 return {lines,treats:feeds(player)?correct:0,...(windDown?{windDown:true}:{})};
}
export function recapVoiceLines(){
 const lines=new Set([RECAP_NONE,RECAP_ALL_OWN,LEVEL_UP,WIND_DOWN_LINE]);

 for(let n=1;n<=6;n++){
  for(const f of Object.values(MAIN))lines.add(f(n));
  lines.add(`You solved ${plural(n,'place value puzzle')}.`);
  lines.add(zerosLine(n));lines.add(ownLine(n));lines.add(feedLine(n));
 }
 return [...lines];
}
