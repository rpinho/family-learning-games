// The Book nightly, part 2: tomorrow's Letter Hunts for each child, written from his learner model (no language
// model). Deterministic letter curriculum: the next letter he is still learning, then a weak one to revisit, never
// the letter(s) of today's hunts. Three hunts a day: that letter's SOUND (things that start with it), its SHAPE
// (the letter written somewhere at home), and the second letter's sound. Hints come from his interests and from
// things every home has, all starting with the right SOUND (not just the right letter: "chess" is not a /k/ word).
// Lines are voiced by the book's own voices, letter sounds come from Letter Quest's verified clips (narrate.py),
// and the no-repeat / pronunciation lint and the clip check run before anything is published. If any step fails,
// yesterday's hunts stay (marked replayable), so a child never has an empty day. Yesterday's file is kept.
// Usage: node book/hunts.mjs [--date YYYY-MM-DD] [--player id] [--dry]
import {existsSync} from 'node:fs';
import {readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bookPaths,readProfiles,localDate,addDays} from './paths.mjs';
import {SOUNDS} from './plan.mjs';
import {hasSound} from '../hub/public/word-families.mjs';
import {repeatedWords} from './lint.mjs';
import {voiceHunts} from '../hub/scripts/hunt-voice.mjs';
const here=dirname(fileURLToPath(import.meta.url));
// Things at home (and from the children's interests), by their first SOUND (a letter key: its sound class).
export const THINGS={
 a:[['apple','🍎'],['arrow','🏹'],['alligator toy','🐊']],b:[['ball','⚽'],['book','📖'],['bed','🛏️'],['banana','🍌'],['box','📦'],['bowl','🥣'],['bow','🏹']],
 c:[['cup','☕'],['car','🚗'],['carrot','🥕'],['cake','🍰'],['coat','🧥'],['can','🥫']],d:[['door','🚪'],['dinosaur','🦕'],['dragon','🐉'],['dish','🍽️'],['duck','🦆'],['doll','🪆']],
 e:[['egg','🥚'],['envelope','✉️'],['elbow','💪']],f:[['fork','🍴'],['fish','🐟'],['flower','🌸'],['foot','🦶'],['fan','🪭']],g:[['goal','🥅'],['glass','🥛'],['game','🎲'],['grapes','🍇'],['guitar','🎸']],
 h:[['hat','🎩'],['hand','✋'],['house','🏠'],['hammer','🔨']],i:[['insect','🐞'],['igloo','🧊']],j:[['jar','🫙'],['jam','🍯'],['jacket','🧥'],['juice','🧃']],
 k:[['key','🔑'],['kite','🪁'],['king','♚'],['kiwi','🥝']],l:[['lamp','💡'],['leaf','🍃'],['lemon','🍋'],['lid','🫕']],m:[['mug','☕'],['milk','🥛'],['map','🗺️'],['mirror','🪞'],['maze','🌀'],['mitten','🧤']],
 n:[['nose','👃'],['nut','🥜'],['net','🥅'],['napkin','🧻']],o:[['octopus toy','🐙'],['olive','🫒'],['otter toy','🦦']],p:[['pizza','🍕'],['pen','🖊️'],['pillow','🛏️'],['plate','🍽️'],['pear','🍐'],['puzzle','🧩'],['pencil','✏️']],
 q:[['queen','♛'],['quilt','🛌']],r:[['robot','🤖'],['rug','🟫'],['ring','💍'],['rook','♜'],['rabbit toy','🐰']],s:[['sock','🧦'],['spoon','🥄'],['sofa','🛋️'],['soap','🧼'],['star','⭐'],['soccer ball','⚽']],
 t:[['train','🚂'],['table','🪑'],['towel','🧺'],['toothbrush','🪥'],['target','🎯'],['tomato','🍅']],u:[['umbrella','☂️']],v:[['vase','🏺'],['van','🚐'],['violin','🎻']],
 w:[['window','🪟'],['watch','⌚'],['water','💧'],['wall','🧱']],y:[['yogurt','🥛'],['yellow crayon','🖍️'],['yarn','🧶']],z:[['zipper','🤐'],['zebra toy','🦓']]};
// Interests that bring their own things (a soccer fan finds a goal; an archer finds a bow and a target).
const INTEREST_THINGS={soccer:['ball','goal','net','soccer ball'],dinosaurs:['dinosaur'],dragons:['dragon'],pizza:['pizza','plate'],trains:['train'],archery:['bow','arrow','target'],
 robots:['robot'],mazes:['maze','map'],chess:['king','queen','rook','knight'],'slingshots and targets':['target']};
export const SHAPES={
 upper:{A:'two slides and a bridge',B:'a straight back and two round tummies',C:'a big open mouth',D:'a straight back and one big round tummy',E:'a straight back and three arms',F:'a straight back and two arms at the top',G:'an open mouth with a little shelf',H:'two poles and a bridge',I:'one tall line',J:'a hook',K:'a straight back and two kicking legs',L:'a tall line and a foot',M:'two mountains side by side',N:'a line that goes up, down, then up again',O:'a big round circle',P:'a straight back and a round head',Q:'a circle with a little tail',R:'a straight back, a round head and a kicking leg',S:'a wiggly road',T:'a tall line with a hat',U:'a big cup',V:'a sharp valley',W:'two valleys side by side',X:'two lines that cross',Y:'a cup on a stick',Z:'a zig and a zag'},
 lower:{a:'a round ball with a little stick',b:'a tall line and a round tummy',c:'a little open mouth',d:'a round tummy with a tall line after it',e:'a round shape with a line inside',f:'a hook with a little belt',g:'a round ball with a hook underneath',h:'a tall line and a little hill',i:'a little line with a dot on top',j:'a hook with a dot on top',k:'a tall line with two kicking legs',l:'one tall line',m:'two little hills',n:'one little hill',o:'a little circle',p:'a round head on a stick that goes down',q:'a round ball with a stick that goes down',r:'a little line with an arm',s:'a little wiggly road',t:'a line with a cross on it',u:'a little cup',v:'a little valley',w:'two little valleys',x:'two little lines that cross',y:'a little cup with a long tail',z:'a little zig and a zag'}};
const PLACES=['📦','📚','⌨️','🥣','🧃'];
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
// The two letters for tomorrow: the next one he is still learning, then a weak one to revisit (never today's).
export function nextLetters(model,{today=[],lower=false,date='',book=null}={}){
 const lit=model?.literacy||{},norm=c=>lower?String(c).toLowerCase():String(c).toUpperCase();
 const ok=c=>/^[a-z]$/i.test(c)&&hasSound(c)&&THINGS[c.toLowerCase()]?.length>=2&&!today.map(norm).includes(norm(c));
 const mastered=new Set((lower?[...(lit.lettersMastered||[])].filter(c=>c===c.toLowerCase()):[...(lit.lettersMastered||[])].filter(c=>c===c.toUpperCase())).map(norm));
 const learning=(lower?(lit.learning||[]).filter(c=>c===c.toLowerCase()):(lit.learning||[]).filter(c=>c===c.toUpperCase())).map(norm).filter(c=>ok(c)&&!mastered.has(c));
 const weak=(model?.stuck||[]).filter(s=>s.area==='letters'&&s.item).map(s=>norm(s.item)).filter(ok);
 const known=(lower?(lit.lower||[]):(lit.letters||[])).map(norm).filter(ok);
 // The day's book letter comes first (one letter for the day: the book ends by sending him on this hunt).
 const first=(book&&hasSound(book)?norm(book):null)||learning[hash(date)%Math.max(1,Math.min(2,learning.length))]||weak[0]||known[0]||(lower?'b':'B');
 const second=[...weak,...learning,...known].find(c=>c!==first)||(first===(lower?'m':'M')?(lower?'s':'S'):(lower?'m':'M'));
 return [first,second];
}
function hintsFor(letter,interests,date,n=4){
 const k=letter.toLowerCase(),bank=THINGS[k]||[],fav=new Set(interests.flatMap(i=>INTEREST_THINGS[i]||[]));
 const ordered=[...bank.filter(([w])=>fav.has(w)),...bank.filter(([w])=>!fav.has(w)).sort((a,b)=>hash(date+a[0])-hash(date+b[0]))];
 return ordered.slice(0,n);
}
// One day's hunts for a child. who: {greet, cheer, voice:{voice,speed}, lower}.
export function dayHunts(model,{date,today=[],interests=[],who,book=null}){
 const [L1,L2]=nextLetters(model,{today:book?today.filter(t=>t.toUpperCase()!==book.toUpperCase()):today,lower:who.lower,date,book});const V=t=>({text:t,...who.voice});const cap=w=>w[0].toUpperCase()+w.slice(1);
 const sound=L=>SOUNDS[L.toUpperCase()],shape=L=>SHAPES[who.lower?'lower':'upper'][L];
 const soundHunt=(L,n)=>{const H=hintsFor(L,interests,date+n);const [w0]=H[0]||['thing'];
  return {id:`${L}-sound-${date}`,mode:'letter',kind:'sound',letter:L.toUpperCase(),generated:date,
   intro:V(`${who.greet} Let's hunt! This is ${who.lower?'little ':''}${L}. It says ${sound(L)}, like ${w0}.`),
   tip:`${L} says /${sound(L).replace(/\[|\]/g,'')}/`,goal:{text:`Find things that start with /${sound(L).replace(/\[|\]/g,'')}/`,line:V(`Your hunt: find things that start with ${sound(L)}. Go and look!`)},
   hints:H.slice(1).map(([w,e])=>({word:w,emoji:e,line:V(`Hint: maybe ${/^[aeiou]/i.test(w)?'an':'a'} ${w}?`)})),done:V(`${who.cheer} You found things that start with ${sound(L)}!`)};};
 const shapeHunt=L=>({id:`${L}-written-${date}`,mode:'letter',kind:'written',letter:L.toUpperCase(),generated:date,
  intro:V(`${who.greet} A letter hunt! Look at ${who.lower?'little ':''}${L}. It looks like ${shape(L)}.`),tip:`${L}: ${shape(L)}`,places:PLACES,
  goal:{text:`Find the letter ${L} written somewhere`,line:V(`Your hunt: find the letter ${L} written somewhere. Letters hide on boxes, books and keyboards!`)},
  hints:[['a box','📦'],['a book','📚'],['a keyboard','⌨️']].map(([w,e])=>({word:w,emoji:e,line:V(`Hint: look on ${w}.`)})),done:V(`${who.cheer} You found the letter ${L}!`)});
 return [soundHunt(L1,1),shapeHunt(L1),soundHunt(L2,2)];
}
// Who hunts with each child (voice and greeting), from the hunts file, with sensible defaults.
const WHO={diogo:{greet:'Ahoy, Diogo!',cheer:'Ahoy!',voice:{voice:'bm_fable',speed:1.05},lower:false},francisco:{greet:'Pika-pi! Conductor!',cheer:'Pika!',voice:{voice:'am_adam',speed:0.88},lower:true}};
// Bring an older hunts file up to the current shape (idempotent):
//  - a hand-written hunt with no mode and no letter (rhymes, tricky words, "ck") is a WORD hunt and is kept;
//  - the friend who hunts with a child must be in that child's cast (cast.json children.<player>.fixed): if not,
//    his first fixed friend takes over, with that friend's voice for the goodbye line;
//  - a child with both kinds of hunt gets a label per mode.
export function migrate(cfg,player,{cast={},paths=null,who=null}={}){
 for(const h of cfg.hunts||[])if(!h.mode&&!h.generated&&!h.letter)h.mode='word';
 const mine=cast?.children?.[player]?.fixed||[];
 if(mine.length&&!mine.includes(cfg.friend?.id)){const id=mine[0],c=(cast.cast||[]).find(x=>x.id===id)||{};
  const file=paths&&['svg','webp','png'].map(e=>`${id}-idle.${e}`).find(n=>existsSync(join(paths.book,'art','lib','actors',n)));
  cfg.friend={id,name:c.name||id,...(file?{url:`/book-art/actors/${file}`}:{})};
  if(cfg.tomorrow&&c.voice){cfg.tomorrow={text:cfg.tomorrow.text,voice:c.voice,speed:c.speed||0.95};}}
 if(cfg.hunts?.some(h=>h.mode==='word')&&!cfg.byMode)cfg.byMode={word:{label:'Word hunt'},letter:{label:'Letter hunt'}};
 return cfg;}
export async function writeHunts({paths=bookPaths(),date,players=null,dry=false,log=console.log}={}){
 const file=join(paths.book,'hunts.json');const before=await readFile(file,'utf8');const f=JSON.parse(before);
 let cast={};try{cast=JSON.parse(await readFile(paths.cast,'utf8'));}catch{}
 const profiles=readProfiles(paths);const results={};
 for(const [player,cfg] of Object.entries(f.players||{})){if(players&&!players.includes(player))continue;
  try{const model=JSON.parse(await readFile(join(paths.learner,player+'.json'),'utf8'));
   const who={...(WHO[player]||{greet:`Let's go, ${model.name||player}!`,cheer:'Hooray!',voice:{voice:'af_bella',speed:0.95},lower:false}),...(cfg.generator||{})};
   // Today's letters are not repeated tomorrow. A rerun for the same date keeps the letters that date was based on.
   const current=(cfg.hunts||[]).filter(h=>(h.mode||'letter')==='letter');
   const today=cfg.generatedFor===date&&Array.isArray(cfg.basedOn)?cfg.basedOn:[...new Set(current.map(h=>h.letter).filter(Boolean))];
   const interests=[...new Set([...(model.interests||[]),...((profiles[player]||{}).interests||[])])];
   migrate(cfg,player,{cast,paths,who});
   // The book for that day (written just before, in the nightly): a letters book's letter leads the hunts.
   let book=null;try{const c=JSON.parse(await readFile(join(paths.book,player,date+'.json'),'utf8'));if(c.level==='early')book=c.letter||c.pages?.find(p=>p.beat?.kind==='teach-letter')?.beat?.letter||null;}catch{}
   const fresh=dayHunts(model,{date,today,interests,who,book});
   cfg.hunts=[...fresh,...(cfg.hunts||[]).filter(h=>h.mode==='word')];cfg.generatedFor=date;cfg.basedOn=today;delete cfg.replayable;
   results[player]={letters:[...new Set(fresh.map(h=>h.letter))],ids:fresh.map(h=>h.id)};
  }catch(e){results[player]={error:String(e.message).slice(0,200)};cfg.replayable=true;log(`hunts ${player}: kept yesterday's (${e.message})`);}}
 // Voice, lint and clip check before anything is published.
 const r=await voiceHunts(paths.book,{f,paths,check:dry});
 if(!dry){// Every clip the published file points at must exist and sound whole (not only today's letter-sound lines).
  const clips=new Set();JSON.stringify(f.players,(k,v)=>{if(k==='clip'&&typeof v==='string')clips.add(v);return v;});
  // Lines that splice in a letter sound are joined (the click test applies); every other line is one render.
  const joined=new Set();JSON.stringify(f.players,(k,v)=>{if(v&&typeof v.clip==='string'&&[...String(v.text).matchAll(/\[\[([^\]]*)\]\]/g)].some(m=>{const n=m[1].replace(/[ˈˌ]/g,'').length;return n>0&&n<=2;}))joined.add(v.clip);return v;});
  const all=[...clips].map(c=>join(paths.book,'voice',c));const gone=all.filter(p=>!existsSync(p));
  if(gone.length)throw Error(`clip check failed: ${gone.length} clip(s) missing, first ${gone[0]}`);
  const runs=[[[...clips].filter(c=>joined.has(c)),[]],[[...clips].filter(c=>!joined.has(c)),['--whole']]];
  for(const [list,opt] of runs)if(list.length){try{execFileSync(paths.python,[join(here,'..','hub','scripts','check-sounds.py'),...opt,...list.map(c=>join(paths.book,'voice',c))],{encoding:'utf8'});}catch(e){throw Error('clip check failed:\n'+String(e.stdout||e.message).split('\n').filter(l=>!l.startsWith('ok ')).join('\n').slice(0,800));}}
  await copyFile(file,join(paths.book,`hunts.json.${date}.bak`));const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(f,null,1),{mode:0o600});await rename(tmp,file);}
 return {date,results,lines:r.lines,made:r.made};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
 const paths=bookPaths(),now=Date.now(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:paths.timeZone,hour:'numeric',hourCycle:'h23'}).format(now));
 const date=arg('--date')||(hour<12?localDate(now,paths.timeZone):addDays(localDate(now,paths.timeZone),1));
 try{const r=await writeHunts({paths,date,players:arg('--player')?[arg('--player')]:null,dry:args.includes('--dry')});console.log(JSON.stringify(r));}
 catch(e){
  // Never an empty day: yesterday's hunts stay, and can be played again.
  console.error('hunts failed, keeping yesterday\'s: '+e.message);
  try{const file=join(paths.book,'hunts.json'),f=JSON.parse(await readFile(file,'utf8'));for(const c of Object.values(f.players||{}))c.replayable=true;const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(f,null,1),{mode:0o600});await rename(tmp,file);}catch{}
  process.exit(1);}
}
