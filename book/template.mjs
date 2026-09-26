// The Book: the fallback chapter. Used when no language model is reachable or its chapter fails the
// lint twice. Deterministic, always passes the lint (tests check this for both levels).
const PLACES={
 soccer:{where:'the green park pitch',scene:'⚽🥅🌳',thing:'a shiny golden ball',fun:'kicked the ball high into the sky'},
 dinosaurs:{where:'Dino Valley',scene:'🦕🌋🌳',thing:'a big, round dinosaur egg',fun:'stomped like a friendly dinosaur'},
 robots:{where:'the robot workshop',scene:'🤖🔧⚙️',thing:'a tiny silver gear',fun:'danced a beeping robot dance'},
 cookies:{where:'the little bakery',scene:'🍪🏠🧁',thing:'a warm cookie jar',fun:'shared the cookies with everyone'},
 chess:{where:'the chessboard castle',scene:'♟️🏰👑',thing:'a lost wooden knight',fun:'marched across the squares'},
 mazes:{where:'the twisty maze garden',scene:'🌳🗺️🌸',thing:'a hidden garden key',fun:'raced along the twisty paths'}
};
const others=plan=>(plan.cast||[plan.companion]).slice(1).map(c=>c.name);
const list=names=>names.length<2?names.join(''):names.slice(0,-1).join(', ')+' and '+names.at(-1);
const placeFor=plan=>PLACES[plan.interests.find(i=>PLACES[i])]||PLACES.soccer;
function early(plan){
 const {name,companion:c,teach,challenges:[c1,c2,c3],mistake:m}=plan,P=placeFor(plan),W=teach.word,Wc=W[0].toUpperCase()+W.slice(1);
 return {title:`${name}, ${c.name} and the ${P.thing.split(' ').slice(-2).join(' ')}`,pages:[
  {text:`Good morning, ${name}! ${c.name} is here too${others(plan).length?`, with ${list(others(plan))}`:''}. Today we go to ${P.where}. Off we go!`,scene:P.scene},
  {text:`Look! ${c.name} sees something. It is ${P.thing}! But it is stuck behind a gate.`,scene:P.scene},
  {teach:true,text:`On the gate is a picture. It is a ${W}. ${Wc} starts with ${teach.letter}. ${teach.letter}, ${teach.letter}, ${W}!`,scene:c.emoji||'🐻'},
  {challenge:c1.id,text:`The gate has letters on it. Can you help ${c.name} find the right one?`},
  {text:`Click! The gate opens. ${c.name} jumps for joy. ${name} is a great helper!`,scene:P.scene},
  {challenge:c2.id,text:`Now a door with a picture. The door opens with the first letter. Can you find it?`},
  {mistake:m.id,text:`${c.name} points and says: ${m.claim} Hmm. Is that right?`},
  {challenge:c3.id,text:`${c.name} has a snack for the trip. How many are there? Let us count together.`},
  {text:`${name} and ${c.name} ${P.fun}. What a happy day! Tomorrow, a new door is waiting. The end, for today.`,scene:P.scene}
 ],summary:`${name} and ${c.name} opened a letter gate at ${P.where} and found ${P.thing}.`,hook:`A new door with a new letter is waiting.`,bedtimeQuestion:`What was behind the gate today, ${name}?`};
}
function reader(plan){
 const {name,companion:c,challenges:[c1,c2,c3,c4],mistake:m}=plan,P=placeFor(plan);
 return {title:`${name} and the Puzzle at ${P.where.replace(/^the /,'The ')}`,pages:[
  {text:`${name} woke up early and grabbed his bag. ${c.name} was already waiting by the door${others(plan).length?` with ${list(others(plan))}`:''}. "Today we go to ${P.where}," said ${c.name}. "Someone left us a puzzle map!"`,scene:P.scene},
  {text:`The map had a big red X and four little locks drawn around it. Each lock needed a clue. "Four locks," said ${name}. "We can do this, one at a time." ${c.name} bounced happily and led the way.`,scene:'🗺️🔑'},
  {challenge:c1.id,text:`The first lock had a row of words on it. Some words looked almost the same. "Read every letter," said ${c.name}. "The lock only opens for the right word."`},
  {text:`Click! The first lock sprang open. Behind it was a note: "Well read, explorer. Now put my words back in order." The words had tumbled all over the path like fallen leaves.`,scene:'🍂📖'},
  {challenge:c2.id,text:`${c.name} tried to guess by where the words were lying. ${name} smiled. "Let's read each word and build the sentence properly."`},
  {text:`The sentence clicked together and a small bridge folded down over the stream. On the other side was a picnic table with cookies and a row of empty plates.`,scene:'🌉🍪'},
  {challenge:c3.id,text:`A sign said: "Share me fairly and the next lock opens." ${name} looked at the cookies and at the plates, and started to think.`},
  {mistake:m.id,text:`"I know the last clue!" said ${c.name} proudly. "It is easy. ${m.claim}. I am sure of it!"`},
  {challenge:c4.id,text:`The last lock had a number pad. It flashed a times table question. ${name} took a deep breath and thought it through.`},
  {text:`The last lock opened with a happy ding, and there was ${P.thing}! ${name} and ${c.name} ${P.fun}. "Tomorrow," said ${c.name}, "the map shows another path." The end, for today.`,scene:P.scene}
 ],summary:`${name} and ${c.name} followed a puzzle map at ${P.where}, opened four locks and found ${P.thing}.`,hook:`The map shows another path.`,bedtimeQuestion:`Which lock was the trickiest today, ${name}, and how did you open it?`};
}
export function templateChapter(plan){return plan.level==='early'?early(plan):reader(plan);}
