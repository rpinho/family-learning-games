import {pageSeconds} from './lint.mjs';
// The Book: the fallback chapter, used when no language model is reachable or its chapter fails the lint
// twice. Deterministic, built from the same beats and picture library; always passes the lint (tested).
// (The Book says "Goal!" itself after every score: an after line never says it again, 2026-10-01.)
const list=names=>names.length<2?names.join(''):names.slice(0,-1).join(', ')+' and '+names.at(-1);
const bg=(lib,...prefs)=>prefs.find(p=>lib.backgrounds[p])||Object.keys(lib.backgrounds)[0];
const idsOf=(plan,lib)=>plan.actorIds||{hero:lib.actors[plan.player]?plan.player:'hero',dad:lib.actors.dad?'dad':'grown-up'};
const pose=(lib,id,p)=>lib.actors[id]?.poses[p]?`${id}:${p}`:id;
// Every friend in the cast is named at least once: the ones the pages do not name come along on page 1 (a second,
// quiet friend such as Picos is told by the narrator, never given lines).
const along=(cast,named)=>{const rest=cast.filter(x=>!named.some(n=>n?.id===x.id));return rest.length?` ${list(rest.map(x=>x.name))} come${rest.length>1?'':'s'} along.`:'';};
// 2-4 places, each with a real share of the chapter: today's place first (the scenario's), then distinct places not
// used in his last three chapters (plan.avoidBgs) when the library has them.
function places(plan,lib,...prefs){const avoid=new Set(plan.avoidBgs||[]),used=new Set(),all=Object.keys(lib.backgrounds);
 const first=plan.scenario?.place&&lib.backgrounds[plan.scenario.place]?plan.scenario.place:null;
 return prefs.map((pr,i)=>{const c=[...(i===0&&first?[first]:[]),...pr].filter(x=>lib.backgrounds[x]&&!used.has(x));
  const pick=c.find(x=>!avoid.has(x)||x===first)||all.find(x=>!avoid.has(x)&&!used.has(x))||c[0]||all.find(x=>!used.has(x))||all[0];used.add(pick);return pick;});}
// (a friend with a reaction voice is named on one page at a time: page 1 names everyone, so page 2 does not)
function early(plan,lib){
 const {name}=plan,ids=idsOf(plan,lib),cast=plan.cast,[b1,b2,b3,b4,b5]=['b1','b2','b3','b4','b5'].map(id=>plan.beats.find(b=>b.id===id));
 const owner=cast.find(c=>c.id===b1.owner)||cast[0],noWho=cast.find(c=>c.id===b4.who)||cast[0],others=cast.filter(c=>c.id!==owner.id).slice(0,2);
 const A=(...xs)=>xs.filter(Boolean).filter((x,i,a)=>lib.actors[x.split(':')[0]]&&a.indexOf(x)===i).slice(0,4);
 const H=ids.hero,D=ids.dad,[P1,P2,P3]=places(plan,lib,['soccer-pitch','garden','pitch'],['castle-gate','castle-forest','castle'],['train-valley','dino-land','river-bridge','meadow']);
 const mom=(plan.grownups||[]).find(g=>g.id!==(plan.lead||{id:'dad'}).id&&lib.actors[g.id])?.id;
 // (a scenario's own beats happen at today's place: counting the home gym's dumbbells in the home gym)
 const at=b=>b?.at&&lib.backgrounds[b.at]?b.at:null;
 return {title:`${name} and the ${b1.letter} Key`,pages:[
  {scene:P1,actors:A(H,D,owner.id,mom||others[0]?.id),action:'kick',say:[['narrator',`Good morning, ${name}! ${list([owner.name,...others.map(o=>o.name)])} are here to play.`],['dad','Your turn! Kick the ball!']],after:[['narrator','You scored! Off we go!']]},
  {beat:'b1',scene:P2,actors:A(H,owner.id),fx:'sparkles',caption:b1.letter,say:[['narrator','A big door has a lock with a funny shape.'],['narrator',/reactions/i.test(String(owner.voice||''))?'A friend has a secret.':`${owner.name} has a secret.`]]},
  {scene:P2,actors:A(pose(lib,H,'cheer'),owner.id,D),fx:'stars',say:[['narrator',`${name} has the ${b1.letter} key! Click! The door swings open.`]]},
  {beat:'b2',scene:P2,actors:A(H,others[0]?.id||owner.id),say:[['narrator','Only some stones are strong enough to hop on.']]},
  {scene:P3,actors:A(H,D,owner.id),props:['train'],action:'drive',say:[['dad',`All aboard! You drive, ${name}! Pull the lever!`]],after:[['narrator','Chug! Off to a new place.']]},
  {beat:'b3',scene:at(b3)||P3,actors:A(H,others[1]?.id||owner.id),say:[['narrator','Everyone wants to know how many there are.']]},
  {beat:'b4',scene:b5&&!at(b5)?P1:P3,actors:A(H,noWho.id),say:[['narrator',`${noWho.name} has a very cheeky idea.`]]},
  ...(b5?[{beat:'b5',scene:at(b5)||P3,actors:A(H,owner.id,others[0]?.id),say:[['narrator',b5.reps?'Time for some reps. Ready?':'Let us line up the tickets, one to five.']]}]:[]),
  {scene:P1,actors:A(pose(lib,H,'cheer'),pose(lib,D,'cheer'),noWho.id,owner.id),fx:'confetti',say:[['narrator',`${noWho.name} laughs. What a silly idea!`],['dad',`${name}, you are a great helper.`]]},
  {scene:P1,actors:A(H,D,owner.id,mom),fx:'stars',say:[['narrator',`${name} holds the ${b1.letter} key tight.`],['narrator','Far away, another door is waiting. Who has the next key?']]}
 ],summary:`${name} got the ${b1.letter} key from ${owner.name}, crossed the river on the ${b1.letter} stones and counted with his friends.`,hook:'Another locked door is waiting for the next key.'};
}
function reader(plan,lib){
 const {name}=plan,ids=idsOf(plan,lib),cast=plan.cast,[b1,b2,b3,b4]=plan.beats,m=plan.magic;
 const c=cast[0],d=cast[1]||cast[0],noWho=cast.find(x=>x.id===b4.who)||d,H=ids.hero,D=ids.dad;
 const A=(...xs)=>xs.filter(Boolean).filter((x,i,a)=>lib.actors[x.split(':')[0]]&&a.indexOf(x)===i).slice(0,4);
 const magic=(i,object,after)=>m[i]?{magic:{word:m[i],object,after:[['narrator',after]]}}:{};
 const [P1,P2,P3,P4]=places(plan,lib,['treehouse-town','garden','meadow'],['train-valley','dino-land','forest-path','forest'],['castle-gate','castle-forest','chess-courtyard','castle'],['soccer-pitch','pizza-party','pitch']);
 const mom=(plan.grownups||[]).find(g=>g.id!==(plan.lead||{id:'dad'}).id&&lib.actors[g.id])?.id;
 return {title:`${name} and the Lost Map`,pages:[
  {scene:P1,actors:A(H,D,c.id,mom||d.id),fx:'sparkles',say:[['narrator',`${name} finds an old map.${along(cast,[c,noWho])}`],['dad','A treasure map! Shall we follow it?'],['narrator','A word is painted on it.']],...magic(0,'the old map','A dotted path appears!')},
  {beat:'b1',scene:P1,actors:A(H,c.id),props:['train'],say:[['narrator','Three trains are ready to go.'],['narrator',`${c.name} yawns. Which one is ours?`]]},
  {scene:P2,actors:A(pose(lib,H,'cheer'),d.id,D),fx:'stars',say:[['narrator','A tall sign stands by the track.']],...magic(1,'the tall sign','A secret path opens!')},
  {beat:'b2',scene:P2,actors:A(H,d.id,c.id),say:[['narrator','A gate blocks the path. Its spell has fallen to pieces!']]},
  {scene:P3,actors:A(pose(lib,H,'cheer'),c.id,D),fx:'sparkles',say:[['narrator','The gate creaks open. A chest has a word on its lid.']],...magic(2,'the chest lid','Inside is the next piece of the map!')},
  {beat:'b3',scene:P3,actors:A(H,c.id,d.id,D),say:[['narrator','Snack time! Everyone gets the same.']]},
  {beat:'b4',scene:P4,actors:A(H,noWho.id),props:['ball'],say:[['narrator',`${noWho.name} runs to the scoreboard with a big grin.`]]},
  {scene:P4,actors:A(H,D,noWho.id),action:'kick',say:[['dad',`You were right, ${name}! Now shoot!`]],after:[['narrator','You scored!']]},
  {scene:P1,actors:A(H,D,c.id,mom||d.id),fx:'stars',say:[['narrator',`${name} rolls up the map. One more stop.`],['narrator','A word shines on the map.']],...magic(3,'the map','Tomorrow, the train goes somewhere new!')}
 ],summary:`${name} followed the lost map by train with ${list(cast.map(x=>x.name))} and Dad, reading signs and fixing a spell.`,hook:'The map has one more stop.'};
}
// A quest-style reader chapter (beats: signs, puzzle, spell, fork, puzzle, no): same reading, game-like middle.
function quest(plan,lib){
 const {name}=plan,ids=idsOf(plan,lib),cast=plan.cast,B=Object.fromEntries(plan.beats.map(b=>[b.id,b])),m=plan.magic;
 const c=cast[0],d=cast[1]||cast[0],no=plan.beats.find(b=>b.kind==='no'),noWho=cast.find(x=>x.id===no?.who)||d,H=ids.hero,D=ids.dad;
 const other=(plan.grownups||[]).find(g=>g.id!==(plan.lead||{id:'dad'}).id&&lib.actors[g.id])?.id;
 const A=(...xs)=>xs.filter(Boolean).filter((x,i,a)=>lib.actors[x.split(':')[0]]&&a.indexOf(x)===i).slice(0,4);
 const magic=(i,object,after)=>m[i]?{magic:{word:m[i],object,after:[['narrator',after]]}}:{};
 const [P1,P2,P3,P4]=places(plan,lib,['treehouse-town','garden','meadow'],['train-valley','dino-land','forest-path','forest'],['chess-courtyard','castle-gate','castle-forest','castle'],['soccer-pitch','pizza-party','pitch']);
 // (each set-up said once: a second riddle gets its own line)
 const setUp={puzzle:['A riddle is carved into the stone.','Another riddle glows on a door.'],remainder:['Snack time! Fair for everyone.','A picnic! Fair shares for all.'],share:['Snack time! Fair for everyone.','A picnic! Fair shares for all.'],fork:['The path splits in two.','Two paths wait ahead.']},used={};
 const beatPage=(id,scene,actors)=>{const k=B[id].kind,n=used[k]=(used[k]||0)+1,o=setUp[k];return {beat:id,scene,actors,say:[['narrator',o?o[Math.min(n,o.length)-1]:n>1?'Something else blocks the way.':'Something blocks the way.']]};};
 return {title:`${name} and the Wizard's Map`,pages:[
  {scene:P1,actors:A(H,D,c.id,other),fx:'sparkles',say:[['narrator',`${name} opens his spellbook. An old map falls out.${along(cast,[c,noWho])}`],['narrator','A word glows on it.']],...magic(0,'the old map','A dotted path appears!')},
  {beat:'b1',scene:P1,actors:A(H,c.id),props:['train'],say:[['narrator','Three trains are ready to go. Which one is ours?']]},
  beatPage('b2',P2,A(H,c.id,D)),
  {scene:P2,actors:A(pose(lib,H,'cheer'),d.id,D),fx:'stars',say:[['narrator','Solved! A tall sign stands by the track.']],...magic(1,'the tall sign','A secret path opens!')},
  {beat:'b3',scene:P3,actors:A(H,d.id,c.id),say:[['narrator','A gate spell has fallen to pieces!']]},
  beatPage('b4',P3,A(H,c.id,D)),
  {scene:P3,actors:A(pose(lib,H,'cheer'),c.id,D),fx:'sparkles',say:[['narrator','Both ways meet at a chest with a word on its lid.']],...magic(2,'the chest lid','Inside is the next piece of the map!')},
  beatPage('b5',P4,A(H,c.id,d.id,other)),
  {beat:'b6',scene:P4,actors:A(H,noWho.id),props:['ball'],say:[['narrator',`${noWho.name} runs to the scoreboard with a big grin.`]]},
  {scene:P4,actors:A(H,D,noWho.id),action:'kick',say:[['dad',`You were right, ${name}! Now shoot!`]],after:[['narrator','You scored!']]},
  {scene:P1,actors:A(H,D,c.id,other),fx:'stars',say:[['narrator',`${name} puts the treasure in his spellbook.`],['narrator','A word shines on the map.']],...magic(3,'the map','Tomorrow, the quest goes somewhere new!')}
 ],summary:`${name} followed the wizard map with ${list(cast.map(x=>x.name))}, solving riddles, choosing his way and reading signs and spells.`,hook:'The map has one more stop.'};
}
// A quest chapter whose scenario has its own puzzles (chess, labyrinths, mental maths: book/scenarios.mjs): those two
// happen first at today's place, then signs and the middle beat at a second place, the fork and the NO! at a third
// (the same shape the brief gives the model, book/prompt.mjs placeShape).
const SET_UP={chess:'The chessboard is ready. Dad makes his move.',maze:'A new labyrinth, fresh from his pencil.',points:'The game is over. Time to count the captures.',captures:'The captured pieces stand beside the board.',ahead:'Dad and Mom look at the board. Who is winning?',route:'A new labyrinth, fresh from his pencil.',divide:'The baker needs the rolls packed.',times:'The trays come out of the oven.',
 share:'Snack time! Fair for everyone.',spell:'A gate spell has fallen to pieces!',signs:'Three signs point three ways. Which one is ours?',fork:'The path splits in two.'};
function questScenario(plan,lib){
 const {name}=plan,ids=idsOf(plan,lib),cast=plan.cast,m=plan.magic,s=plan.scenario,T=s.place;
 const c=cast[0],d=cast[1]||cast[0],no=plan.beats.find(b=>b.kind==='no'),noWho=cast.find(x=>x.id===no?.who)||d,H=ids.hero,D=ids.dad;
 const other=(plan.grownups||[]).find(g=>g.id!==(plan.lead||{id:'dad'}).id&&lib.actors[g.id])?.id;
 const A=(...xs)=>xs.filter(Boolean).filter((x,i,a)=>lib.actors[x.split(':')[0]]&&a.indexOf(x)===i).slice(0,4);
 const magic=(i,object,after)=>m[i]?{magic:{word:m[i],object,after:[['narrator',after]]}}:{};
 const [,P2,P3]=places(plan,lib,[T],['treehouse-town','garden','forest-path','river-bridge','meadow'],['soccer-pitch','garden','castle-gate','pitch']);
 const [b1,b2,b3,b4,b5,b6]=plan.beats,quiet=cast.filter(x=>x.quiet).map(x=>x.id);   // (a quiet friend is in the picture often)
 // (each set-up said once: a second puzzle of the same kind gets its own line)
 const said=new Set(),page=(b,scene,actors)=>{let t=SET_UP[b.variant]||SET_UP[b.kind]||'Something blocks the way.';if(said.has(t))t=b.kind==='puzzle'?(b.variant==='route'?'Then he draws an even trickier one.':'Here comes another puzzle.'):'Something else blocks the way.';said.add(t);return {beat:b.id,scene,actors,say:[['narrator',t]]};};
 const opening={'chess-home':`${name} sets up the chessboard. Dad sits down to play.`,'giant-chess':`${name} and Dad step onto a giant chessboard.`,'labyrinth-maker':`${name} draws a labyrinth for his friends.`,'bakery-math':`${name} and Dad walk into the bakery.`}[s.id]||{chess:`${name} sets up the chessboard. Dad sits down to play.`,maze:`${name} draws a labyrinth for his friends.`,divide:`${name} and Dad walk into the bakery.`}[b1.variant]||`${name} starts a new adventure.`;
 return {title:s.title||`${name}'s Quest`,pages:[
  {scene:T,actors:A(H,D,c.id,other,...cast.slice(1).filter(x=>x.id!==noWho.id).map(x=>x.id)),fx:'sparkles',say:[['narrator',opening+along(cast,[c,noWho])],['narrator','A word is written on a card.']],...magic(0,'the card','Everyone smiles. Let us begin!')},
  page(b1,T,A(H,D,c.id)),
  page(b2,T,A(H,c.id,other)),
  {scene:T,actors:A(pose(lib,H,'cheer'),D,other,...quiet),fx:'stars',say:[['narrator','Well thought out! A note is tucked under the board.']],...magic(1,'the note','It shows the way to the next stop!')},
  page(b3,P2,A(H,c.id,D)),
  page(b4,P2,A(H,c.id,other)),
  {scene:P2,actors:A(pose(lib,H,'cheer'),c.id,D,...quiet),fx:'sparkles',say:[['narrator','A chest has a word on its lid.']],...magic(2,'the chest lid','Inside is the next piece of the map!')},
  page(b5,P3,A(H,c.id,D)),
  {beat:b6.id,scene:P3,actors:A(H,noWho.id),say:[['narrator',`${noWho.name} has a cheeky idea.`]]},
  {scene:P3,actors:A(H,D,noWho.id),action:'kick',say:[['dad',`You thought it through, ${name}! Now shoot!`]],after:[['narrator','You scored!']]},
  {scene:P3,actors:A(H,D,c.id,other),fx:'stars',say:[['narrator',`${name} puts the treasure in his spellbook.`],['narrator','A word shines on the map.']],...magic(3,'the map','Tomorrow, the quest goes somewhere new!')}
 ],summary:`${name} solved his own puzzles with ${list(cast.map(x=>x.name))} and Dad, chose his way and read the signs.`,hook:'The map has one more stop.'};
}
export function templateChapter(plan,library){
 const story=plan.level==='early'?early(plan,library):plan.style==='quest'?(plan.scenario?.quest&&plan.beats.some(b=>b.at)?questScenario(plan,library):quest(plan,library)):reader(plan,library);
 if(plan.scenario?.paintedScene){
  const s=plan.scenario,ids=idsOf(plan,library),first=story.pages[0];
  first.scene=s.place;delete first.action;delete first.after;first.props=[];
  first.say=[['narrator',`${plan.name} explores with Dad${plan.level==='early'?`, Mom${plan.sibling?`, ${plan.sibling}`:''} and Rook`:''}.`],['narrator',s.opening]];
  const extraActors=[ids.hero,ids.dad,...(plan.level==='early'?['mom']:[]),...(plan.grownups||[]).map(g=>g.id),plan.sibling?.toLowerCase(),...(plan.level==='early'?['rook']:[]),...plan.cast.map(c=>c.id)].filter((id,i,a)=>id&&library.actors[id]&&a.indexOf(id)===i&&(s.id!=='metro'||ids.all.includes(id)));
  if(s.id==='metro'&&plan.level!=='early'){const hedgehog=extraActors.indexOf('rainbow-hedgehog');if(hedgehog>=5)extraActors.splice(3,0,...extraActors.splice(hedgehog,1));}
  first.actors=extraActors.slice(0,5);
  const closing=story.pages.at(-1),friends=plan.cast.filter(c=>c.id!=='rook');if(friends.length){closing.say.push(['narrator',`${list(friends.map(c=>c.name))} are here.`]);closing.actors=[ids.hero,ids.dad,...friends.map(c=>c.id)].filter(id=>library.actors[id]).slice(0,5);}
  const elsewhere=story.pages.find(p=>p.scene!==s.place)?.scene;
  if(first.magic){const magic=first.magic;delete first.magic;const host=story.pages.find(p=>p.scene!==s.place&&!p.beat&&!p.magic);if(host)host.magic=magic;}
  if(s.id==='flower-meadow'){
   const at=story.pages.findIndex(p=>plan.beats.find(b=>b.id===p.beat)?.painted);
   if(at>=0){const base=story.pages[at];story.pages.splice(at,0,{...structuredClone(base),beat:'meadow-find'});}
  }
  for(const p of story.pages){const b=plan.beats.find(b=>b.id===p.beat);if(b?.painted||s.id==='metro'&&b?.at===s.place){p.scene=s.place;p.props=[];p.actors=extraActors.slice(0,5);delete p.action;delete p.magic;p.say=[['narrator',b.intro||(b.kind==='order'?'Pretend hops start here.':b.kind==='count'?'Dark stones make a path.':'There is a dry way across.')]];}
   else if(p!==first&&p.scene===s.place)p.scene=elsewhere;}
  // Ordinary templates do not know the scenario's extra beats; append them in plan order after the final planned beat.
  for(const b of plan.beats.filter(b=>!story.pages.some(p=>p.beat===b.id))){const previous=plan.beats.slice(0,plan.beats.indexOf(b)).findLast(x=>story.pages.some(p=>p.beat===x.id));const last=s.id==='metro'?story.pages.findIndex(p=>p.beat===previous?.id):story.pages.findLastIndex(p=>p.beat);story.pages.splice(last+1,0,{beat:b.id,scene:s.place,actors:extraActors.slice(0,5),props:[],say:[['narrator',b.intro||(b.kind==='order'?'Pretend hops start here.':'There is another way across.')]]});}
  if(plan.level==='early'){const host=story.pages.find(p=>p.scene!==s.place&&!p.beat&&!p.action&&!p.magic);if(host){host.action='throw';host.fetcher=plan.cast[0]?.id;host.after=[['narrator','Caught! Everyone smiles together.']];}}
  // Keep a short visit at a second place from becoming an isolated third place.
  const counts=new Map();for(const page of story.pages)counts.set(page.scene,(counts.get(page.scene)||0)+1);
  for(const [bg,n] of counts)if(n===1&&bg!==s.place){const other=[...counts].filter(([id,n])=>id!==s.place&&id!==bg&&n>1).sort((a,b)=>a[1]-b[1])[0]?.[0];if(other)for(const page of story.pages)if(page.scene===bg)page.scene=other;}
  story.title=['flower-meadow','metro'].includes(s.id)?`${plan.name}: ${s.title}`:`${plan.name} and the Volcano`;
  if(s.id==='metro'){
   first.say=[['narrator',`${plan.name} rides with Dad${plan.sibling?` and ${plan.sibling}`:''}.`],['narrator','The metro stops here. Dad parks beside the path.'],['narrator','The shop is a short ride away.']];
   for(const p of story.pages){p.props=(p.props||[]).filter(id=>!String(id).startsWith('train'));if(p.action==='drive'){p.action='throw';p.fetcher=plan.cast[0]?.id;p.say=[['dad','A quick catch before we go!']];p.after=[['narrator','Caught! Everyone smiles.']];}}
   story.summary=`${plan.name} counted six seats in the blue metro, parked beside the path and chose the wheels order to reach the shop with Dad.`;
   story.hook='Where will the metro take them next?';
   if(plan.level==='early'){closing.say=[['narrator',`${plan.name} holds his key.`],['narrator',`${list(plan.cast.map(c=>c.name))} come too.`]];const i=story.pages.findLastIndex(p=>p!==closing&&p!==first&&!p.beat&&!p.magic&&!p.action);if(i>=0)story.pages.splice(i,1);}
   if(story.pages.length>11&&!closing.magic){const i=story.pages.findIndex(p=>p!==first&&p!==closing&&p.magic&&!p.beat&&!p.action);if(i>=0){closing.magic=story.pages[i].magic;story.pages.splice(i,1);}}
   while(story.pages.length>11){const i=story.pages.findIndex((p,i)=>i>0&&i<story.pages.length-1&&!p.beat&&!p.magic&&!p.action);if(i<0)break;story.pages.splice(i,1);}
  }
 }
 if(plan.scenario?.sceneQuestion){
  const s=plan.scenario,first=story.pages[0],firstMagic=first.magic;delete first.action;delete first.after;delete first.magic;
  // A remembered parked car is observed, never turned into a soccer field or a drivable train.
  first.scene=s.place;first.props=[];
  first.say=[['narrator',`${plan.name}, ${list(plan.cast.map(c=>c.name))} and Dad are ready for an outing.`],['narrator',s.opening]];
  for(const page of story.pages){const b=plan.beats.find(b=>b.id===page.beat);if(b?.at){page.scene=b.at;
    if(b.variant==='observe'){page.actors=[];page.props=[];page.say=[['narrator',plan.level==='early'?'Look closely at the painting.':'Before the walk, we plan our picnic.']];}}}
  const elsewhere=story.pages.find(p=>p.scene!==s.place)?.scene;
  for(const page of story.pages)if(page!==first&&page.scene===s.place&&(page.magic||page.action||page.props?.length||page.beat&&plan.beats.find(b=>b.id===page.beat)?.variant!=='observe'))page.scene=elsewhere;
  if(firstMagic){const host=story.pages.find(p=>p.scene!==s.place&&!p.beat&&!p.magic);if(host)host.magic={...firstMagic,object:'the outing map'};}
  if(plan.level==='early'){
   const play=story.pages.find(p=>!p.beat&&!p.action&&p.scene!==s.place);
   if(play){play.action='throw';play.fetcher=plan.cast[0]?.id;play.after=[['narrator','Caught! We are ready for the walk.']];}
  }
  const mom=(plan.grownups||[]).find(g=>g.id==='mom'&&library.actors.mom);if(mom)for(const page of story.pages.filter(p=>p!==first&&!p.beat).slice(0,2)){if(!page.actors.includes('mom'))page.actors.push('mom');}
  // Moving a question home must not leave a token one-page visit elsewhere.
  const counts=new Map();for(const page of story.pages)counts.set(page.scene,(counts.get(page.scene)||0)+1);
  for(const [bg,n] of counts)if(n===1&&bg!==s.place){const other=[...counts].filter(([id,n])=>id!==s.place&&id!==bg&&n>1).sort((a,b)=>a[1]-b[1])[0]?.[0];
   if(other)for(const page of story.pages)if(page.scene===bg)page.scene=other;}
  story.title=`${plan.name} and ${s.title}`;
  story.summary=`${plan.name} explored ${s.title.toLowerCase()} with ${list(plan.cast.map(c=>c.name))} and Dad.`; // (was "solved the picnic question" for every scenario: it fed false memories to the next chapters)
 }
 // With fewer independent reads the story still has room to breathe; never invent a magic word.
 if(plan.level==='reader'&&(plan.magic||[]).length<2){
  const times=new Map();for(const p of story.pages)times.set(p.scene,(times.get(p.scene)||0)+pageSeconds(p,plan));
  const least=[...times].sort((a,b)=>a[1]-b[1])[0]?.[0];
  const p=story.pages.find(p=>p.scene===least&&!p.beat)||story.pages.find(p=>p.scene===least);
  if(p)p.say.push(['narrator','The friends stop beside the path. They look around before setting off together.']);
 }
 return story;
}
