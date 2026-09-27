// Real-world quests that are always doable at home (a quest the house can't answer is no fun).
// - A letter hunt comes with hint pictures of things most homes have, revealed one at a time if he comes back
//   empty-handed (and the companion who owns the letter counts too).
// - A reader's quest is a rhyme hunt (things at home that rhyme with a word he read), or, when the house has no
//   rhymes for it, word cards Dad prints and hides (the chapter's last page tells Dad; the sheet is in Grown-ups).
export const HOME_THINGS={
 A:[['apple','🍎'],['ant','🐜'],['arm','💪'],['alligator toy','🐊']],
 B:[['ball','⚽'],['book','📖'],['banana','🍌'],['bed','🛏️'],['bowl','🥣'],['button','🔘'],['bag','👜'],['bath','🛁']],
 C:[['cup','☕'],['car','🚗'],['cat toy','🐱'],['comb','🪮'],['carrot','🥕'],['cookie','🍪'],['candle','🕯️'],['coat','🧥']],
 D:[['door','🚪'],['dog toy','🐶'],['dish','🍽️'],['doll','🪆'],['dinosaur toy','🦕'],['duck toy','🦆']],
 E:[['egg','🥚'],['elbow','💪'],['envelope','✉️'],['elephant toy','🐘']],
 F:[['fork','🍴'],['foot','🦶'],['fan','🪭'],['flower','🌼'],['fridge','🧊'],['fish toy','🐟']],
 G:[['glass','🥛'],['glove','🧤'],['game','🎲'],['grapes','🍇'],['gate','🚧']],
 H:[['hat','🎩'],['hand','✋'],['honey','🍯'],['hairbrush','🪮'],['hanger','🧥']],
 I:[['ink pen','🖊️'],['igloo toy','🧊'],['insect toy','🐞']],
 J:[['jar','🫙'],['jacket','🧥'],['juice','🧃'],['jam','🍓'],['jigsaw puzzle','🧩']],
 K:[['key','🔑'],['kite','🪁'],['kettle','🫖'],['kitchen','🍳']],
 L:[['lamp','💡'],['leaf','🍃'],['lemon','🍋'],['Lego','🧱'],['lid','🫙'],['lock','🔒'],['ladder','🪜'],['lollipop','🍭'],['light','💡'],['laptop','💻']],
 M:[['mug','☕'],['milk','🥛'],['map','🗺️'],['mitten','🧤'],['mirror','🪞'],['marker','🖍️'],['mat','🟫']],
 N:[['nose','👃'],['napkin','🧻'],['nail','💅'],['necklace','📿'],['notebook','📓']],
 O:[['orange','🍊'],['oven','🍳'],['octopus toy','🐙'],['olive','🫒']],
 P:[['pillow','🛏️'],['pen','🖊️'],['pencil','✏️'],['plate','🍽️'],['pan','🍳'],['puzzle','🧩'],['plant','🪴'],['pasta','🍝']],
 Q:[['quilt','🛏️'],['queen chess piece','♛']],
 R:[['rug','🟥'],['ruler','📏'],['rope','🪢'],['robot toy','🤖'],['rice','🍚']],
 S:[['sock','🧦'],['spoon','🥄'],['shoe','👟'],['soap','🧼'],['sofa','🛋️'],['sink','🚰'],['star','⭐']],
 T:[['table','🪑'],['towel','🧺'],['toothbrush','🪥'],['train toy','🚂'],['tomato','🍅'],['teddy','🧸']],
 U:[['umbrella','☂️'],['up high shelf','⬆️']],
 V:[['vase','🏺'],['van toy','🚐'],['violin','🎻']],
 W:[['window','🪟'],['water','💧'],['watch','⌚'],['wall','🧱'],['wagon toy','🛒']],
 X:[['box (it ends with x)','📦']],
 Y:[['yogurt','🥛'],['yarn','🧶'],['yo-yo','🪀']],
 Z:[['zipper','🤐'],['zebra toy','🦓']]};
// Word families with things most homes have: "rhyme word|what to look for" (a family is used only when at least
// two of its things are not the word itself).
const RHYMES={at:['hat|a hat','mat|a mat','cat|a toy cat'],ed:['red|something red','bed|a bed'],og:['dog|a toy dog','log|a log','frog|a toy frog'],
 un:['sun|a picture of the sun','bun|a bun'],ot:['pot|a pot','dot|the dots on a dice','cot|a cot'],an:['pan|a pan','fan|a fan','van|a toy van','can|a can'],
 ug:['mug|a mug','rug|a rug','bug|a toy bug'],ock:['sock|a sock','clock|a clock','lock|a lock','block|a block'],ook:['book|a book','hook|a coat hook'],
 ake:['cake|a cake','rake|a rake','snake|a toy snake'],ar:['car|a toy car','jar|a jar','star|a star'],oon:['spoon|a spoon','moon|a picture of the moon','balloon|a balloon'],
 ish:['dish|a dish','fish|a toy fish'],ain:['train|a toy train','chain|a chain'],all:['ball|a ball','wall|a wall','doll|a doll'],ig:['pig|a toy pig','wig|a wig'],
 en:['pen|a pen','hen|a toy hen','ten|ten of something'],op:['top|a spinning top','mop|a mop'],ip:['ship|a toy ship','zip|a zip']};
const family=w=>Object.keys(RHYMES).sort((a,b)=>b.length-a.length).find(f=>w.endsWith(f)&&w.length>f.length&&RHYMES[f].filter(x=>x.split('|')[0]!==w).length>=2);
const cap=s=>s[0].toUpperCase()+s.slice(1);
// Two kinds, always labelled: a Sound hunt (things that start with the sound) and a Letter hunt (the letter itself,
// written somewhere at home: it teaches the SHAPE; used when he has the sound but not yet the shape).
export const WRITTEN_PLACES=[['a keyboard','⌨️'],['a toy box','📦'],['a book cover','📚'],['a cereal box','🥣'],['a label on a jar','🫙']];
export function letterQuest(L,{sound=L,friend=null,grown='Dad',kind='sound'}={}){
 if(kind==='shape')return {kind:'shape',text:`Letter hunt: find a big ${L} written somewhere at home, on a box, a book or a keyboard, and show ${grown}!`,
  hints:WRITTEN_PLACES.map(([w,e])=>({word:w,emoji:e,text:`Look on ${w}. Can you spot a big ${L}?`}))};
 const things=(HOME_THINGS[L]||[]).slice(0,6);
 const hints=[...(friend?[{word:friend.name,emoji:friend.emoji||'⭐',text:`${friend.name} starts with ${sound} too! Can you find ${friend.name}?`}]:[]),
  ...things.map(([w,e])=>({word:w,emoji:e,text:`Maybe a ${w}? ${cap(w)} starts with ${sound}.`}))];
 return {kind:'sound',text:`Sound hunt: find three things that start with ${L} and show ${grown}!`,hints};
}
// Reader: a rhyme hunt when the house can answer it, otherwise word cards Dad hides (printed from Grown-ups).
export function readerQuest(words,{seed=0,grown='Dad'}={}){
 const ws=[...new Set(words.map(w=>String(w).toLowerCase()).filter(Boolean))];
 const rhymeable=ws.find(w=>family(w));
 if(rhymeable&&seed%2===0){const f=family(rhymeable),things=RHYMES[f].filter(t=>t.split('|')[0]!==rhymeable);
  return {text:`Rhyme hunt! Find something at home that rhymes with ${rhymeable}, and show ${grown}.`,hints:things.map(t=>{const [r,d]=t.split('|');return {word:r,emoji:'🔎',text:`Look for ${d}. ${cap(r)}, ${rhymeable}!`};})};}
 const cards=ws.slice(0,3);
 return {text:`Dad is hiding ${cards.length===1?'a word card':cards.length+' word cards'} around the house. Find ${cards.length===1?'it':'them'} and read ${cards.length===1?'it':'each one'} to ${grown}!`,cards,
  dad:`For Dad: print the word cards (Grown-ups, then Word cards) and hide them before he starts looking.`};
}
