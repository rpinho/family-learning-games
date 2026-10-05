import {worldToys} from './public/world-progress.mjs';
import {phonicsLine} from './phonics.mjs';
import {canSoundOut} from './public/word-families.mjs';
import {worldEpisodes} from './world-episodes.mjs';
import {readFile,access,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {smallLearnerProfile} from './world-small-learner.mjs';
import {worldStore} from './world-store.mjs';
import {CASTLE,SMALL,worldDefinition} from './public/world-definitions.mjs';
import {artFor} from './public/book-scene.mjs';
import {clipName,mergeArtLibrary} from './book-service.mjs';
import {applyBackgroundLayouts} from './public/book-painted-layout.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const send=(res,status,b)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(b));};
// The legacy reaction renderer appends a spoken translation. The World uses only
// the approved cry, in its own cache entry, without changing any Book clip or renderer.
export async function worldCryClip(bookDir,voice,{render=true}={}){
 let registry;try{registry=JSON.parse(await readFile(join(bookDir,'voice-renderers.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 const command=registry.voices?.[voice]?.command;if(!command?.some(a=>/reaction-renderer\.py$/.test(a)))return null;
 const profileFile=command.find(a=>/-profile\.json$/.test(a));if(!profileFile)throw Error('No approved cry profile.');
 const profile=JSON.parse(await readFile(profileFile,'utf8')),source=profile.reactions?.curious||profile.reactions?.happy;
 if(!source?.file||!source.sha256)throw Error('No approved cry recording.');const bytes=await readFile(source.file);
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Cry recording failed verification.');
 const clip=createHash('sha256').update(`world-cry-1\0${voice}\0${source.sha256}`).digest('hex').slice(0,16)+'.wav',dir=join(bookDir,'voice');
 try{await access(join(dir,clip));}catch{if(!render)return null;await mkdir(dir,{recursive:true,mode:0o700});const tmp=join(dir,clip+'.'+randomUUID()+'.tmp');await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,join(dir,clip));}
 return clip;
}
export function worldLines(cast={},definition=CASTLE,profile={}){
 const {ROOMS,GATES,FRIENDS,LOCKS}=definition;
 if(definition.early){const narrator=profile.voice||{voice:'af_bella@relaxed',speed:.8},dad={voice:cast.voices?.rook||'am_michael',speed:.9},line=(text,v=narrator)=>({text,...v});const out={start:line('Tap the ground to walk. Then tap Dad to begin.',dad),first:line('Tap Dad on volcano island first.'),path:line('Try the clear ground.'),found:line('You already helped here. Your reward is in your backpack.'),piece:line('You did it! Your reward is in your backpack. Tap the next glowing thing.'),selected:line('Tap the gift door to use your collected things.'),wrongTool:line('Tap the glowing thing for a clue.'),'on-way':line('Here we go.'),treasure:line('Surprise! A flower present for Grown-up, wrapped with your strong ribbon. You made this gift together.',dad),'next-done':line('Your gift for Grown-up is ready! Visit your friends.',dad)};for(const [id,g]of Object.entries(GATES)){out[id]=line(g.prompt);if(g.kind==='sound'&&g.letter)out['sound-'+id+'-'+g.letter]=phonicsLine(g.letter.toLowerCase(),'letter');out['hint-'+id]=line(g.hint);out['next-'+id]=line(g.goal,dad);}for(const [id,l]of Object.entries(LOCKS)){out['lock-'+id]=line(l.hint);out['next-'+id]=line(l.goal,dad);out['used-'+id]=line('The gift door is open. Choose the basket with more flowers.');}for(const [id,pair]of Object.entries(FRIENDS))pair.forEach((text,i)=>out['friend-'+id+'-'+i]=line(ROOMS[id].friend==='dad'?(i?'You helped here. Choose another place.':GATES[ROOMS[id].gate]?.goal||text):text,ROOMS[id].friend==='dad'?dad:narrator));for(let n=1;n<=20;n++)out['count-'+n]=line(['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'][n-1]);return out;}
 const narrator={voice:'af_bella@relaxed',speed:.8},dad={voice:cast.voices?.rook||'am_michael',speed:.9},friend=id=>{const a=cast.cast?.find(a=>a.id===id);return {voice:a?.voice||narrator.voice,speed:a?.speed||1};};
 const line=(text,v=narrator)=>({text,...v});
 const out={
  quest:line(FRIENDS['castle-gate'][0],dad),dad:line(FRIENDS['castle-gate'][1],dad),pip:line('Pip!',friend('pip')),
  'on-way':line('Here we go.'),near:line('Walk closer, then tap.'),path:line('Try the clear ground.'),
  piece:line('Your reward is in your backpack. Talk to your friend again.'),ready:line('All three map pieces are in your backpack. My birthday presents are behind the castle door.',dad),
  tomorrow:line('The restored map leads to the pirate shore. There is another surprise to find.',dad),spyglass:line('Your spyglass finds the pirate shore.'),
  start:line('Tap the ground to walk. Walk to Dad, then tap him.',dad),first:line('Talk to Dad at the castle gate first.'),found:line('You already found this reward.'),
  selected:line('Carry your tool to a place it fits, then tap that place.'),wrongTool:line('Try a different tool. Tap What next if you need a clue.'),
  acorn:line('An acorn rustles out of the bush.'),ball:line('You pulled the ball out of the branch. Take it back to Pip.'),
  secret:line('Surprise! Pip was hiding in this chest.'),secretDone:line('Pip already popped out. He is still here beside the treehouse.'),
  'used-bridge':line('The rope is tied. Now help Snake bundle the bridge planks.'),'used-night':line('The lantern lights the dark path. You can enter the secret night garden.'),
  'used-runaway':line('Your net caught the island map! Finish the three map pieces and follow the compass to the treasure.'),'used-dig':line('You dug up the captain’s chest. Work out his treasure code.'),
  'need-compass':line('Find Dad’s star compass in the night garden first.'),treasure:line('You found the treasure! A tiny island castle, golden coins and a star compass. The captain made you the island’s explorer.',dad),
  'next-acorns':line('From the castle gate, take the forest path. Tap all three acorn bushes, then bring them to Picos for a rope.',dad),
  'next-rope-reading':line('Your three acorns are ready. Read Picos’s hidden sign in the castle forest, then talk to Picos to earn the rope.',dad),
  'next-lantern':line('In the castle forest, tap the painted castle opening. Help Robo in the workshop to earn a lantern.',dad),
  'next-ball':line('Go to the soccer pitch. Fetch Pip’s ball, then score a goal to earn the shovel.',dad),
  'next-net':line('From the pitch, take the treehouse path. Tap the lit opening, then help the baker count her rolls to earn a net.',dad),
  'next-chess':line('Bo has a map piece in the courtyard. Compare both sets of captures.',dad),
  'next-reading':line('Picos has a map piece in the forest. Read his whole instruction, then follow it.',dad),
  'next-score':line('Pip has a map piece at the pitch. Count his goals, then take away the missing six.',dad),
  'next-bridge':line('Go through the forest to the river bridge. Tap your rope in the backpack, then the bridge gap. Help Snake with the planks.',dad),
  'next-map':line('Cross the bridge to the pirate shore, then go to moon hill. Help Loona count the stars. Tap your net, then the fluttering map.',dad),
  'next-night':line('On moon hill, tap your lantern, then the dark path. Enter the night garden and read Dad’s chest instruction.',dad),
  'next-treasure':line('Return to the pirate shore. Tap your shovel, then the X. The island map and star compass will guide you to the treasure.',dad),
  'next-done':line('All '+Object.values(definition.ITEMS).filter(i=>i.collection).length+' discoveries are on your collection shelf! Visit your friends or Dad’s birthday presents at the castle.',dad)
 };
 for(const [id,g] of Object.entries(GATES)){out[id]=line(g.instruction?'Read the sign. Follow its instruction by tapping the right thing.':g.prompt);out['hint-'+id]=line(g.hint);if(g.optional)out['next-'+id]=line('Discover '+g.title+' at the '+ROOMS[g.room].name,dad);}
 for(const [id,pair] of Object.entries(FRIENDS))pair.forEach((text,i)=>{out['friend-'+id+'-'+i]=line(text,ROOMS[id].friend==='dad'?dad:narrator);});
 for(const [id,l] of Object.entries(LOCKS))out['lock-'+id]=line(l.hint);
 for(const [id,g]of Object.entries(GATES)){
  const words=g.words|| (g.instruction?(g.prompt.toLowerCase().match(/[a-z]+/g)||[]).filter(canSoundOut):[]);
  for(const word of words){const spoken=phonicsLine(word,'blend');if(spoken)out['word-'+id+'-'+word]=spoken;for(const c of word){const sound=phonicsLine(c,'letter');if(sound)out['sound-'+id+'-'+c]=sound;}}
 }
 return out;
}
export async function recordedWorldLines(bookDir,definition=CASTLE,profile={}){
 let cast={};try{cast=JSON.parse(await readFile(join(bookDir,'cast.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const out=worldLines(cast,definition,profile);for(const [key,l] of Object.entries(out)){const clip=key==='pip'?await worldCryClip(bookDir,l.voice,{render:false}):null;
 const candidate=clip||clipName(l);try{await access(join(bookDir,'voice',candidate));l.clip=candidate;}catch{}}
 return out;
}
export function worldService({bookDir,config,book,authorized}){
 let profiles={};const profilesReady=readFile(join(bookDir,'profiles.json'),'utf8').then(x=>{profiles=JSON.parse(x);}).catch(e=>{if(e.code!=='ENOENT')throw e;});
 const players=config.players.filter(p=>p.id!=='admin').map(p=>p.id),definitions={},store=worldStore({bookDir,players,definitions});
 const learnerReady=profilesReady.then(async()=>{for(const player of Object.keys(profiles)){
  const readLearner=async suffix=>{try{return JSON.parse(await readFile(join(bookDir,'..','learner',player+suffix+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}};
  const [compiled,raw]=await Promise.all([readLearner('-learner'),readLearner('')]);
  profiles[player]={...profiles[player],learner:{...compiled,literacy:compiled.literacy||raw.literacy||{},math:{...(compiled.math||{}),...(raw.math||{})}}};
 }});
 const lines=player=>recordedWorldLines(bookDir,definitions[player],profiles[player]);
 return {async available(player){await learnerReady;const date=book.today?.()||new Date().toISOString().slice(0,10);return (await worldEpisodes(bookDir,player,{date,base:worldDefinition(profiles[player]||{})}))?.episode.date===date;},async preview(player){await learnerReady;return worldDefinition(profiles[player]||config.players.find(p=>p.id===player)||{}).id;},async handle(req,res,u){
  const pages={'/world':['world.html','text/html'],'/world.mjs':['world.mjs','text/javascript'],'/world.css':['world.css','text/css'],'/world-model.mjs':['world-model.mjs','text/javascript'],'/world-icons.mjs':['world-icons.mjs','text/javascript'],'/world-definitions.mjs':['world-definitions.mjs','text/javascript'],'/world-episode.mjs':['world-episode.mjs','text/javascript'],'/world-progress.mjs':['world-progress.mjs','text/javascript']};
  if(pages[u.pathname]){if(req.method!=='GET')return send(res,405,{error:'Read only.'});const [name,type]=pages[u.pathname];res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(await readFile(join(here,'public',name)));return;}
  if(!['/api/world','/api/world/voice'].includes(u.pathname))return false;
  await learnerReady;for(const p of config.players)definitions[p.id]=worldDefinition(await smallLearnerProfile(bookDir,p.id,profiles[p.id]||p));
  const player=u.searchParams.get('player');if(!players.includes(player))return send(res,400,{error:'Choose a player.'});
  const preview=u.searchParams.get('preview')==='1',review=u.searchParams.get('review')==='1';
  const today=book.today?.()||new Date().toISOString().slice(0,10),date=(preview||review)&&u.searchParams.get('date')||today;
  const futurePreview=preview&&date>today;
  if((review||futurePreview)&&!authorized(req))return send(res,403,{error:'Open the grown-ups gate.'});
  const episodes=await worldEpisodes(bookDir,player,{date,review,base:definitions[player]});
  const found=episodes?.episode.date===date?episodes:null;
  if(review&&!found)return send(res,404,{error:'No quest to review for this date.'});
  const definition=found?.definition||definitions[player],{ROOMS}=definition,savePreview=review?found?.episode.id:futurePreview?'future-'+date:found?'published':false;
  const episodeLines=async()=>{const out=found?Object.assign({},await lines(player),...found.episodes.map(e=>e.lines||{})):await lines(player);const cast=JSON.parse(await readFile(join(bookDir,'cast.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));for(const [key,l] of Object.entries(out)){const dad=l.who==='dad'||key.startsWith('friend-')&&Object.entries(definition.ROOMS).some(([id,r])=>r.friend==='dad'&&key.startsWith('friend-'+id+'-'));if(!dad||!cast.voices?.rook||l.voice===cast.voices.rook)continue;l.voice=cast.voices.rook;delete l.clip;const candidate=clipName(l);try{await access(join(bookDir,'voice',candidate));l.clip=candidate;}catch(e){if(e.code!=='ENOENT')throw e;}}return out;};
  try{
   if(req.method==='GET'&&u.pathname==='/api/world'){
    // A newly painted room can be in the release library before it reaches the household manifest.
    const generic=JSON.parse(await readFile(join(here,'public','book-art','library.json'),'utf8')),layouts=JSON.parse(await readFile(join(here,'book-art-layouts.json'),'utf8'));
    const additions=JSON.parse(await readFile(join(here,'book-art-additions.json'),'utf8'));const lib=applyBackgroundLayouts(mergeArtLibrary(mergeArtLibrary(generic,additions),await book.library()),layouts),actors=[...new Set([player,...Object.values(ROOMS).map(r=>r.friend)])].filter(id=>lib.actors?.[id]).map(id=>({id,pose:id===player&&lib.actors[id].poses?.stand?'stand':'idle'}));
    const art=artFor(Object.entries(ROOMS).map(([id,r])=>({scene:{bg:r.bg||id,actors,props:['chest','presents','ball','star',...['rook','knight','pawn','bishop'].flatMap(p=>['chess-black-'+p,'chess-white-'+p])].map(id=>({id,n:1}))},beat:id==='chess-courtyard'?{kind:'puzzle',variant:'captures',captures:{hero:['rook','knight','pawn']}}:undefined})),lib);
    if(Object.values(ROOMS).some(r=>!art.backgrounds[r.bg||Object.keys(ROOMS).find(id=>ROOMS[id]===r)])||!art.actors[player])return send(res,503,{error:'This world needs its reviewed Book paintings and hero cut-out.'});
    return send(res,200,{state:await store.read(player,savePreview,definition),art,definition:{...definition,TOYS:worldToys(definition)},lines:await episodeLines(),name:config.players.find(p=>p.id===player).name,preview:review||futurePreview});
   }
   if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});let raw='';for await(const part of req){raw+=part;if(raw.length>2048)return send(res,413,{error:'Too much data.'});}let b;try{b=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
   if(u.pathname==='/api/world/voice'){const l=(await episodeLines())[b.key];if(!l)return send(res,404,{error:'No such line.'});if(!l.clip)return send(res,503,{error:'This recorded line is missing. Rebuild the release voices.'});return send(res,200,{clip:l.clip});}
   const result=await store.act(player,savePreview,b,definition);if(found&&found.episode.date===today&&!futurePreview&&!review&&b.action==='solve'&&result.correct&&book.recordQuest){const local=b.gate.slice(found.episode.id.length+2),i=found.episode.puzzles.findIndex(g=>g.id===local);if(i>=0)await book.recordQuest(player,{date:found.episode.date,index:i,result:result.state.attempts[b.gate]});}return send(res,200,result);
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save or load this world.',...(e.missing?{missing:e.missing,next:e.next}:{})});}
 }};
}
