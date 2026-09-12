import {useHint} from './hints.mjs';
// Story progress is independent of drill placement. Nothing here claims reading mastery.
export const STORY_CHAPTERS=[
 {theme:'forest',title:'The missing picnic',friend:'🦊',words:['sun','hat','cat'],intro:'The fox lost our picnic! Find the letter keys, then meet the fox at the flag.',win:'We found the picnic! I volunteer to inspect every sandwich.'},
 {theme:'harbor',title:'The sleepy lighthouse',friend:'🐧',words:['map','boat','moon'],intro:'The penguin needs a lighthouse. Find the letter keys and bring them to the flag.',win:'The lighthouse is awake! Unlike me before breakfast.'},
 {theme:'castle',title:'The robot parade',friend:'🤖',words:['gem','star','robot'],intro:'The robot forgot the parade password. Find the letter keys and reach the flag.',win:'The parade is saved! My victory dance is ninety percent eyebrows.'},
 {theme:'ice',title:'The snow train',friend:'🐻‍❄️',scenery:'❄️　🚂　❄️',words:['snow','sled','bell'],intro:'The bear missed the snow train. Collect the letter keys to ring the station bell!',win:'All aboard! I bought my mustache its own ticket.'},
 {theme:'desert',title:'The thirsty garden',friend:'🐪',scenery:'🌵　🏜️　🌴',words:['sand','seed','rain'],intro:'The camel has a tiny garden and a very empty watering can. Find the letter keys to bring the rain.',win:'The garden is growing! I planted a sandwich. No luck yet.'},
 {theme:'reef',title:'The coral concert',friend:'🐙',scenery:'🐠　🪸　🐚',words:['fish','shell','pearl'],intro:'The octopus lost the music for the coral concert. Collect the letter keys and meet the band!',win:'Eight arms, eight drums. I am officially outnumbered.'},
 {theme:'cloud',title:'The kite delivery',friend:'🦉',scenery:'☁️　🪁　☁️',words:['wind','kite','cloud'],intro:'The owl has a delivery above the clouds. Find the letter keys to launch the kite.',win:'Special delivery! My hair arrived three minutes before me.'},
 {theme:'volcano',title:'The dragon bakery',friend:'🐉',scenery:'🌋　🍞　🌋',words:['warm','bread','toast'],intro:'The dragon baked too much bread. Collect the letter keys and help deliver breakfast.',win:'Perfect toast! Next time, slightly less dragon breath.'},
 {theme:'space',title:'The moon garage',friend:'👽',scenery:'🪐　🚀　⭐',words:['ship','wheel','light'],intro:'Our space friend has a rocket with a loose wheel. Find the letter keys to open the moon garage.',win:'Ready for takeoff! Please keep all mustaches inside the rocket.'},
 {theme:'stadium',title:'The missing match ball',friend:'🐶',scenery:'⚽　🥅　🏆',words:['net','cup','hat'],intro:'The puppy goalkeeper lost the match ball! Collect the keys to open the equipment shed.',win:'Kickoff! I will guard the snacks. A very important position.'},
 {theme:'orchard',title:'The runaway jam cart',friend:'🐰',scenery:'🍎　🛒　🍓',words:['jam','pot','lid'],intro:'The rabbit’s jam cart rolled downhill. Find the keys before breakfast escapes!',win:'We caught the cart! My toast can finally relax.'},
 {theme:'canyon',title:'The echo bridge',friend:'🦅',scenery:'🏜️　🌉　🪨',words:['map','gap','peg'],intro:'The eagle needs a bridge across the canyon. Find the keys to connect the two sides.',win:'Bridge complete! Even my echo said thank you. Twice.'},
 {theme:'lagoon',title:'The upside-down boat',friend:'🦦',scenery:'🛶　🌊　🏝️',words:['log','oar','bag'],intro:'The otter’s boat is upside down. Find the keys and help launch it the right way up.',win:'It floats! Excellent. I was not dressed for swimming.'},
 {theme:'night',title:'The firefly lanterns',friend:'🦔',scenery:'🌙　🏮　✨',words:['bug','jar','sun'],intro:'The hedgehog needs lanterns for the night parade. Collect the keys and light the trail.',win:'What a glow! My mustache has never looked so mysterious.'},
 {theme:'candy',title:'The wobbly cake',friend:'🐼',scenery:'🍰　🎂　🍒',words:['pan','mix','top'],intro:'The panda’s cake is leaning sideways. Find the keys to rescue the birthday surprise!',win:'The cake is safe! I checked it with a very small bite.'},
 {theme:'garden',title:'The tiny umbrella',friend:'🐸',scenery:'🌷　☂️　🌧️',words:['wet','mat','cap'],intro:'The frog planned a picnic in the rain. Collect the keys and find a dry place for lunch.',win:'Dry sandwiches! A triumph of modern frog engineering.'},
 {theme:'workshop',title:'The sleepy clock',friend:'🦫',scenery:'⚙️　🕰️　🔧',words:['cog','pin','box'],intro:'The beaver’s clock stopped before snack time. Find the keys to get its gears turning.',win:'Tick tock! Just in time for my extremely scheduled biscuit.'},
 {theme:'snowglobe',title:'The lost mitten',friend:'🦭',scenery:'🧤　❄️　🛷',words:['red','zip','bed'],intro:'The seal lost a mitten in the snow. Collect the keys and follow the little tracks.',win:'A warm mitten! I still need about forty for my mustache.'},
 {theme:'aurora',title:'The sky picnic',friend:'🦄',scenery:'🌌　🧺　🌈',words:['rug','bun','mug'],intro:'The unicorn invited us to a picnic under the northern lights. Find the keys to reach the lookout.',win:'A sky full of colors and a mug full of cocoa. Perfect.'},
 {theme:'harvest',title:'The pumpkin train',friend:'🐿️',scenery:'🎃　🚂　🍂',words:['nut','hay','van'],intro:'The squirrel’s pumpkin train needs one last delivery. Collect the keys and clear the track.',win:'Delivery done! That pumpkin is an excellent passenger. Very quiet.'},
 {theme:'crystal',title:'The singing cave',friend:'🦇',scenery:'💎　🎵　🔮',words:['bat','hum','gem'],intro:'The bat’s cave has forgotten its song. Collect the keys to wake the crystal choir.',win:'Bravo! The cave wants an encore. My singing wants a lawyer.'}
];
export const STORY_RESCUES=STORY_CHAPTERS.length*3;
export const STORY_LINES={
 welcome:'You and me, a whole island, and absolutely no idea where I put the sandwiches.',
 move:'Tap a neighboring stone to move. Collect the letters in order, then reach the flag. Arrow keys work too.',
 wrong:'That letter comes later. We can walk past it and come back.',
 water:'That is water. My mustache is not a boat. Try a neighboring stone.',
 exit:'We need all the letter keys first. Our friend can wait.',
 hint:'Follow the glowing stones. I am on your team here. Reveals use a hint. Try the path yourself first.',
 collected:'A letter key! Into our extremely important adventure pockets.',
 finished:'You finished our story! Nine rescues, one excellent team. The sandwiches never stood a chance.'
};
export function storyState(p){return p.story||{chapter:0,position:15,collected:0,moves:0,mistakes:0,hints:0,guided:p.id==='beginner',done:false,history:[]};}
export function storyBoard(p){
 const s=storyState(p),chapter=s.chapter,local=chapter%STORY_RESCUES,voyage=Math.floor(chapter/STORY_RESCUES)+1,episode=STORY_CHAPTERS[Math.floor(local/3)],word=episode.words[(local+voyage-1)%3];
 let blocked=[6,8,11,13],positions=[[10,2,12,18,9],[17,9,1,12,5],[12,5,19,2,10]][chapter%3];
 // Never move the stones/keys in an existing original rescue. New voyages
 // revisit the written islands with different, deterministic connected routes.
 if(chapter>=9){
  let seed=(chapter+1)*7919;const roll=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  // Only interior cells may be water: the outside ring stays connected, and
  // every remaining interior stone touches that ring vertically.
  blocked=[[6,8,11,13],[6,7,12,13],[7,8,11,12],[6,8,12,13]][roll(4)];
  positions=Array.from({length:20},(_,i)=>i).filter(i=>i!==15&&i!==4&&!blocked.includes(i));
  for(let i=positions.length-1;i>0;i--){const j=roll(i+1);[positions[i],positions[j]]=[positions[j],positions[i]];}
 }
 return {episode,word,start:15,exit:4,blocked,letters:[...word].map((char,i)=>({char,position:positions[i],index:i})),chapter,local,voyage,total:STORY_RESCUES,finished:false};
}
const neighbors=pos=>[pos-5,pos+5,...(pos%5?[pos-1]:[]),...(pos%5<4?[pos+1]:[])].filter(n=>n>=0&&n<20);
export function storyRoute(p){
 const s=storyState(p),b=storyBoard(p),goal=b.letters[s.collected]?.position??b.exit;
 const queue=[[s.position]],seen=new Set([s.position]);
 while(queue.length){const route=queue.shift(),pos=route.at(-1);if(pos===goal)return route;for(const n of neighbors(pos))if(!b.blocked.includes(n)&&!seen.has(n)){seen.add(n);queue.push([...route,n]);}}
 return [];
}
export function storyAction(p,input){
 const current=storyState(p),s=p.story??={...current,history:[...current.history]},b=storyBoard(p);
 if(input.kind==='guide'){
  if(typeof input.guided!=='boolean')throw Error('Choose a story guide setting');
  s.guided=input.guided;p.revision++;return {kind:'guide'};
 }
 if(input.kind==='next'){
  if(!s.done||b.finished)throw Error('Finish this rescue first');
  s.chapter++;Object.assign(s,{position:15,collected:0,moves:0,mistakes:0,hints:0,done:false});p.revision++;return {kind:'next'};
 }
 if(b.finished||s.done)throw Error('This rescue is complete');
 if(input.kind==='hint'){if(!s.guided&&!s.hints)useHint(p,`story:${s.chapter}`);s.hints++;p.revision++;return {kind:'hint',line:STORY_LINES.hint};}
 if(input.kind!=='move'||!Number.isInteger(input.position)||input.position<0||input.position>=20)throw Error('Choose a neighboring stone');
 const pos=input.position;
 if(!neighbors(s.position).includes(pos)||b.blocked.includes(pos))return {kind:'blocked',line:STORY_LINES.water};
 s.position=pos;s.moves++;p.revision++;
 const letter=b.letters.find(l=>l.position===pos&&l.index>=s.collected);
 let result={kind:'move'};
 if(letter){
  if(letter.index===s.collected){s.collected++;result={kind:'collected',letter:letter.char,line:`The letter ${letter.char.toUpperCase()}.`};}
  else{s.mistakes++;result={kind:'wrong',line:STORY_LINES.wrong};}
 }
 if(pos===b.exit){
  if(s.collected===b.word.length){
   s.done=true;p.xp+=20;p.gems+=5;
   s.history.push({chapter:s.chapter,word:b.word,moves:s.moves,mistakes:s.mistakes,hints:s.hints,guided:s.guided,at:new Date().toISOString()});
   result={kind:'won',line:b.episode.win,xp:20,gems:5};
  }else{s.mistakes++;result={kind:'exit',line:STORY_LINES.exit};}
 }
 return result;
}
export function storyVoiceLines(){return [...Object.values(STORY_LINES),...STORY_CHAPTERS.flatMap(e=>[e.intro,e.win]),...['Explorer','Beginner','Admin','Explorer'].map(name=>`${name}, our adventure begins!`)]}
