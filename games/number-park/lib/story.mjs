// The baker's journey: a running story that stars the child (a small first
// step toward the Primer in The Diamond Age, where the book's story starred
// its reader and bent to what she did). Every finished round adds one short
// line about what he actually did, at the next stop of the journey. It only
// ever grows and never gates anything. Lines come from a finite list so the
// voice clips exist ahead of time.
export const HERO='the baker';
export const STORY_OPENING=`The baker set off on a journey.`;
export const tellsStory=p=>p.id==='explorer';
export const PLACES=[
 {icon:'🏠',where:'In the little bakery'},
 {icon:'🧺',where:'At the village market'},
 {icon:'🌉',where:'On the old stone bridge'},
 {icon:'🌾',where:'By the windmill'},
 {icon:'⛵',where:'In the harbour town'},
 {icon:'⛰️',where:'At the mountain inn'},
 {icon:'🏰',where:'In the castle kitchen'},
 {icon:'🎪',where:'At the royal fair'}
];
// What he did, by game (cookie rounds by their main kind of sharing).
export const DEEDS={
 share:'shared the cookies fairly',
 rows:'baked cookies in neat rows',
 bags:'packed the cookies into bags',
 fix:'fixed the messy plates',
 leftover:'gave the extra cookies to Cookie Buddy',
 multiply:'counted the trays with times tables',
 factor:'found the missing number in a recipe',
 sums:'added up the flour sacks',
 skip:'hopped across in equal jumps',
 place:'built a new oven from blocks',
 mission:'solved the baker’s puzzles'
};
export const storyLine=(place,deed)=>`${PLACES[place].where}, ${HERO} ${DEEDS[deed]}.`;
function deedFor(game,entries){
 if(game!=='cookies')return DEEDS[game]?game:'mission';
 const tally={};
 for(const h of entries){const m=h.question?.mode;const k=m==='mixed'?'fix':m;if(DEEDS[k])tally[k]=(tally[k]||0)+1;}
 // The rarest kind is the one worth telling ("gave the extras to Cookie Buddy").
 const order=['leftover','fix','bags','rows','share'];
 return order.find(k=>tally[k])||'share';
}
// Adds the next beat and returns what the finish screen shows and speaks.
export function addStoryBeat(p,game,entries,now){
 const story=p.story??={count:0,beats:[]};
 const place=story.count%PLACES.length,deed=deedFor(game,entries),line=storyLine(place,deed);
 const opening=story.count===0;
 story.beats=[...story.beats,{at:new Date(now).toISOString(),game,place,deed,line}].slice(-60);
 story.count++;
 return {lines:opening?[STORY_OPENING,line]:[line],icon:PLACES[place].icon,recent:story.beats.slice(-3).map(b=>({line:b.line,icon:PLACES[b.place].icon}))};
}
export function storyVoiceLines(){
 const lines=[STORY_OPENING];
 for(let place=0;place<PLACES.length;place++)for(const deed of Object.keys(DEEDS))lines.push(storyLine(place,deed));
 return lines;
}
