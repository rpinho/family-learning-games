// The Book: the fallback chapter, used when no language model is reachable or its chapter fails the lint
// twice. Deterministic, built from the same beats and picture library; always passes the lint (tested).
const list=names=>names.length<2?names.join(''):names.slice(0,-1).join(', ')+' and '+names.at(-1);
const bg=(lib,...prefs)=>prefs.find(p=>lib.backgrounds[p])||Object.keys(lib.backgrounds)[0];
const idsOf=(plan,lib)=>plan.actorIds||{hero:lib.actors[plan.player]?plan.player:'hero',dad:lib.actors.dad?'dad':'grown-up'};
const pose=(lib,id,p)=>lib.actors[id]?.poses[p]?`${id}:${p}`:id;
function early(plan,lib){
 const {name}=plan,ids=idsOf(plan,lib),cast=plan.cast,[b1,b2,b3,b4,b5]=plan.beats;
 const owner=cast.find(c=>c.id===b1.owner)||cast[0],noWho=cast.find(c=>c.id===b4.who)||cast[0],others=cast.filter(c=>c.id!==owner.id).slice(0,2);
 const A=(...xs)=>xs.filter(Boolean).filter((x,i,a)=>lib.actors[x.split(':')[0]]&&a.indexOf(x)===i).slice(0,4);
 const H=ids.hero,D=ids.dad;
 return {title:`${name} and the ${b1.letter} Key`,pages:[
  {scene:bg(lib,'soccer-pitch','pitch','meadow'),actors:A(H,D,owner.id,others[0]?.id),action:'kick',say:[['narrator',`Good morning, ${name}! Today is an adventure day.`],['dad',`${list([owner.name,...others.map(o=>o.name)])} are here to play. Your turn, ${name}! Kick the ball!`]],after:[['narrator','Goal! What a kick!'],['dad','Now, off on our adventure!']]},
  {beat:'b1',scene:bg(lib,'castle-gate','castle','meadow'),actors:A(H,owner.id),fx:'sparkles',caption:b1.letter,say:[['narrator',`A big door blocks the way. It has a lock with a funny shape.`],['narrator',`${owner.name} has a secret.`]]},
  {scene:bg(lib,'forest-path','forest','meadow'),actors:A(pose(lib,H,'cheer'),owner.id,D),fx:'stars',say:[['narrator',`${name} has the ${b1.letter} key now! Click! The door swings open.`],['dad','Well done! Let us go and see what is inside.']]},
  {beat:'b2',scene:b2.kind==='kick-letter'?bg(lib,'soccer-pitch','pitch','meadow'):bg(lib,'river-bridge','forest','meadow'),actors:A(H,others[0]?.id||owner.id),say:[['narrator','Oh no, a wide river! There are stones to hop on.'],['narrator','Only some stones are strong enough.']]},
  {scene:bg(lib,'train-valley','meadow'),actors:A(H,D,owner.id),props:['train'],action:'drive',say:[['narrator','Across! And look, a little train is waiting.'],['dad',`All aboard! You drive, ${name}! Pull the lever!`]],after:[['narrator','Chug! The train rolls away to a new place.']]},
  {beat:'b3',scene:bg(lib,'dino-land','meadow','forest'),actors:A(H,others[1]?.id||owner.id),say:[['narrator','The train stops in a sunny valley.'],['narrator',`Everyone wants to know how many there are.`]]},
  {beat:'b4',scene:bg(lib,'castle-forest','castle','meadow'),actors:A(H,noWho.id),say:[['narrator',`${noWho.name} has a very cheeky idea.`]]},
  ...(b5?[{beat:'b5',scene:bg(lib,'train-valley','meadow'),actors:A(H,owner.id,others[0]?.id),say:[['narrator','Everyone wants a turn on the train.'],['narrator','Let us line up the tickets, one to five.']]}]:[]),
  {scene:bg(lib,'pizza-party','meadow'),actors:A(pose(lib,H,'cheer'),pose(lib,D,'cheer'),noWho.id,owner.id),fx:'confetti',say:[['narrator',`${noWho.name} laughs and laughs. What a silly idea that was!`],['dad',`${name}, you are a great helper.`],['narrator','Everyone shares a big warm pizza.']]},
  {scene:bg(lib,'night-hill','castle-moon-hill','night'),actors:A(H,D,owner.id),fx:'stars',say:[['narrator',`The moon comes up. ${name} holds the ${b1.letter} key tight.`],['narrator','Far away, another door is waiting. Who has the next key?']]}
 ],summary:`${name} got the ${b1.letter} key from ${owner.name}, crossed the river on the ${b1.letter} stones and counted with his friends.`,hook:'Another locked door is waiting for the next key.'};
}
function reader(plan,lib){
 const {name}=plan,ids=idsOf(plan,lib),cast=plan.cast,[b1,b2,b3,b4]=plan.beats,m=plan.magic;
 const c=cast[0],d=cast[1]||cast[0],noWho=cast.find(x=>x.id===b4.who)||d,H=ids.hero,D=ids.dad;
 const A=(...xs)=>xs.filter(Boolean).filter((x,i,a)=>lib.actors[x.split(':')[0]]&&a.indexOf(x)===i).slice(0,4);
 const magic=(i,object,after)=>m[i]?{magic:{word:m[i],object,after:[['narrator',after]]}}:{};
 return {title:`${name} and the Lost Map`,pages:[
  {scene:bg(lib,'treehouse-town','castle','meadow'),actors:A(H,D,c.id,d.id),fx:'sparkles',say:[['narrator',`${name} found an old map under the treehouse stairs.`],['dad','A treasure map! Shall we follow it?'],['narrator','A word is painted on the map. Can you read it?']],...magic(0,'the old map','The map glows, and a dotted path appears!')},
  {beat:'b1',scene:bg(lib,'train-valley','meadow'),actors:A(H,c.id),props:['train'],say:[['narrator','At the station, three trains are ready to go.'],['narrator',`${c.name} yawns. "Which one is ours?"`]]},
  {scene:bg(lib,'dino-land','meadow','forest'),actors:A(pose(lib,H,'cheer'),d.id,D),fx:'stars',say:[['narrator','The train chugs into a valley full of giant ferns.'],['narrator','A tall sign stands by the lake. What does it say?']],...magic(1,'the tall sign','The ground rumbles softly, and a secret path opens!')},
  {beat:'b2',scene:bg(lib,'castle-gate','castle','forest'),actors:A(H,d.id,c.id),say:[['narrator','A gate blocks the path. Its spell has fallen to pieces!'],['dad',`Read each word, ${name}. Not where they lie. What they say.`]]},
  {scene:bg(lib,'chess-courtyard','castle','meadow'),actors:A(pose(lib,H,'cheer'),c.id,D),fx:'sparkles',say:[['narrator','The gate creaks open. Inside is a sunny courtyard.'],['narrator','A chest has a word on its lid.']],...magic(2,'the chest lid','The lid pops open. Inside is the next piece of the map!')},
  {beat:'b3',scene:bg(lib,'pizza-party','soccer-pitch','meadow'),actors:A(H,c.id,d.id,D),say:[['narrator','Time for a snack before the big game!'],['narrator','Everyone must get the same. That is the rule.']]},
  {beat:'b4',scene:bg(lib,'soccer-pitch','pitch','meadow'),actors:A(H,noWho.id),props:['ball'],say:[['narrator',`After the game, ${noWho.name} runs to the scoreboard with a big grin.`]]},
  {scene:bg(lib,'soccer-pitch','pitch','meadow'),actors:A(H,D,noWho.id),action:'kick',say:[['narrator',`${noWho.name} giggles. You were right, ${name}!`],['dad','Now the real match. Your turn. Shoot!']],after:[['narrator','Goal! The crowd of birds goes wild!'],['dad','Great thinking, champ, and a great kick.']]},
  {scene:bg(lib,'night-hill','castle-moon-hill','night'),actors:A(H,D,c.id,d.id),fx:'stars',say:[['narrator',`The map has one more stop. ${name} rolls it up carefully.`],['narrator','A word shines on the map, under the moon.']],...magic(3,'the map','The map glows. Tomorrow, the train goes somewhere new!')}
 ],summary:`${name} followed the lost map by train with ${list(cast.map(x=>x.name))} and Dad, reading signs and fixing a spell.`,hook:'The map has one more stop.'};
}
export function templateChapter(plan,library){return plan.level==='early'?early(plan,library):reader(plan,library);}
