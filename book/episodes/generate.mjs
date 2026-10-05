import {EPISODE_SCHEMA,checkEpisode,episodeDefinition,mathDisplay} from './format.mjs';
import {SOUNDS} from '../plan.mjs';
import {hasSound,isFamilyWord,canSoundOut} from '../../hub/public/word-families.mjs';
import {phonemize} from '../../hub/public/pronounce.mjs';
import {safetyIssues,comparisonIssues} from '../lint.mjs';
import {dayNoteIssues} from '../daynotes.mjs';
import {assemble,voicesFor} from '../assemble.mjs';
// Carry assessment and explicit practice goals into both the writer and its fallback.
export function episodeLearning(plan,model={},learner={}){
 const literacy={...(model.literacy||{}),...(learner.literacy||{})},bp=learner.bookPlan||{};
 const names=[...new Set((plan.nameSpelling||[]).map(w=>String(w).toLowerCase()).filter(w=>/^[a-z]{2,16}$/.test(w)&&!['mom','grown-up'].includes(w)&&canSoundOut(w)))];
 return {level:plan.level,taughtLetters:[...new Set([...(literacy.letters||[]),...(literacy.learning||[]),plan.letter].filter(x=>x&&hasSound(x)).map(x=>x.toUpperCase()))],focus:plan.learnerFocus||[],
  wordLevel:literacy.wordLevel||1,wordsAlmost:literacy.wordsAlmost||[],wordsAboveLevel:literacy.wordsAboveLevel||[],readingFocus:literacy.readingFocus||bp.readingFocus||[],readingFeatures:literacy.readingFeatures||{},readingSupport:literacy.readingSupport||bp.readingSupport||{letterSounds:true,hearIt:true},masteryRule:literacy.masteryRule||null,
  confidenceWords:bp.confidenceWords||literacy.wordsAlmost||[],soundFocus:bp.soundFocus||[],hearAndBuildWords:bp.hearAndBuildWords||literacy.wordsAboveLevel||[],nameSpelling:names};
}
export function readingTarget(learning){
 const words=[...(learning.confidenceWords||[]),...(learning.wordsAlmost||[]),...(learning.focus||[]).filter(f=>f.kind==='signs').map(f=>f.value)].filter(w=>isFamilyWord(w)&&canSoundOut(w)&&!['mom'].includes(w));
 const vowels=(learning.readingFocus||[]).filter(f=>f.startsWith('short-')).sort((a,b)=>(learning.readingFeatures?.[a]?.rate??1)-(learning.readingFeatures?.[b]?.rate??1));
 for(const f of vowels){const word=words.find(w=>w[1]===f.slice(-1));if(word)return word;}
 return words[0]||'cat';
}
function addReadingGoals(e,learning){
 if(e.level!=='reader')return;
 const supported=(learning.hearAndBuildWords||learning.wordsAboveLevel||[]).find(w=>/^[a-z]{4,10}$/.test(w)&&canSoundOut(w));
 if(supported&&!e.puzzles.some(g=>g.practice==='hear-and-build')){
  const bonus=e.puzzles.find(g=>g.optional&&g.id==='place');
  if(bonus)Object.assign(bonus,{kind:'tiles',practice:'hear-and-build',title:'Hear and build the workshop word',prompt:'Listen and build '+supported+'.',hint:'Hear the word, then tap each letter sound.',goal:'Hear and build the workshop word',words:[supported],answer:supported,options:[supported,supported.slice(0,-1)],soundSupport:true});
 }
 const names=learning.nameSpelling||[];
 if(names.length){
  // Code owns the parent-approved labels: a writer cannot replace them with family roles.
  e.puzzles=e.puzzles.filter(g=>g.practice!=='name-spelling');e.sideQuests=e.sideQuests.filter(q=>q.puzzle!=='name-spelling');
  e.items['name-star']={name:'Name card star',icon:'star',collection:true};
  const target=names.join(' '),room=e.rooms.find(r=>r.door?.return)?.id||e.start;
  e.puzzles.push({id:'name-spelling',room,kind:'tiles',practice:'name-spelling',title:'A name for the gift card',prompt:'Build '+names.map(w=>w.toUpperCase()).join(' and ')+' for the gift card.',hint:'Tap each letter to hear its sound. Put the letters in order.',goal:'Spell '+target.toUpperCase()+' on the gift card',icon:'⭐',words:names,answer:target,options:[target,target.slice(0,-1)],requires:[],rewards:['name-star'],optional:true,soundSupport:true});
  e.sideQuests.push({id:'name-card-quest',title:'Write the name card',puzzle:'name-spelling'});
 }
}
export function fallbackEpisode(plan,library,learning=episodeLearning(plan)){
 const early=plan.level==='early',date=plan.date,id=plan.player+'-'+date;
 const painted=(...choices)=>choices.find(k=>library.backgrounds[k])||Object.keys(library.backgrounds)[0],friend=(...ids)=>ids.find(k=>library.actors[k])||Object.keys(library.actors)[0];
 const room=(id,name,bg,f,exits,lines)=>({id,name,bg,friend:f,icon:'🌳',exits,lines});
 const rooms=[room('welcome','Lantern trail',painted(plan.scenario?.place||'castle-gate','castle-gate','garden'),friend('dad','grown-up'),{right:'grove'},['Our friends need a light for their surprise. Shall we find the lantern together?','You found the light. Come back whenever you want.']),room('grove','Clue grove',painted('castle-forest','forest-path'),friend('bo','grown-up'),{left:'welcome',right:'hill'},['I found a clue beside this path. It will help us reach the surprise.','You followed my clue and opened the path.']),room('workshop','Lantern workshop',painted('workshop','home-room'),friend('robo','grown-up'),{},['There is an extra discovery in my workshop. You can visit whenever you want.','Your extra discovery can stay in your backpack.']),room('hill','Surprise hill',painted('castle-moon-hill','night-hill'),friend('mom','dad','grown-up'),{left:'grove'},[early?'Grown-up has a surprise waiting. Help me light the lantern.':'The lantern is ready. One final clue will light it.','Look at the tiny garden glowing inside the lantern.'])];
 rooms[1].door={to:'workshop',label:'Lantern workshop',wide:[.514,.328,.043,.106],tall:[.52,.151,.063,.049]};rooms[2].door={to:'grove',label:'Back to the grove',return:true};rooms[1].exitRequires={right:'trail-lock'};
 const items={rope:{name:early?'Strong ribbon':'Trail rope',icon:'rope'},lantern:{name:'Garden lantern',icon:'lantern'},star:{name:'Workshop star',icon:'star',collection:true},shell:{name:'Workshop shell',icon:'shell',collection:true}};
 const puzzle=(id,room,kind,title,prompt,hint,answer,options,requires,rewards,extra={})=>({id,room,kind,title,prompt,hint,goal:prompt,icon:'⭐',answer:String(answer),options:options.map(String),requires,rewards,...extra});
 const count=(id,room,n,requires,rewards,extra={})=>puzzle(id,room,'count','Pack the lights','Tap each light to pack it into the lantern.','Touch each light once. We can count them together.',n,[n,n===20?19:n+1],requires,rewards,{count:n,...extra});
 const math=(id,room,m,requires,rewards,extra={})=>{const a=m.type==='place'?Number(String(m.number)[m.digitIndex])*10**(3-m.digitIndex):m.type==='divide'?m.a/m.b:m.a*m.b;return puzzle(id,room,'math',m.type==='place'?'Find the digit value':'Lantern number clue','Work out the number to help your friend.','Take your time. Try grouping the numbers.',a,[a,a+1,a-1],requires,rewards,{math:m,...extra});};
 let puzzles;
 if(early){const L=learning.taughtLetters[0];puzzles=[count('ribbon','welcome',Math.min(20,Math.max(3,plan.beats?.find(b=>b.kind==='count')?.n||8)),[],['rope']),L?puzzle('clue','grove','sound','Hear the clue','Tap the letter that makes this sound: '+SOUNDS[L]+'.','Tap the sound button and listen again.',L,[L,...learning.taughtLetters.filter(x=>x!==L).slice(0,1)],['ribbon'],[],{letter:L,soundSupport:true}):count('clue','grove',6,['ribbon'],[]),count('light','hill',10,['trail-lock'],['lantern']),count('bonus','workshop',5,[],['star'],{optional:true})];if(L&&puzzles[1].options.length<2){puzzles[1]=count('clue','grove',6,['ribbon'],[]);}}
 else{const focus=readingTarget(learning);puzzles=[math('get-rope','welcome',{type:'fact',a:8,b:9},[],['rope']),puzzle('clue','grove','tiles','Read the clue','Build the word on the clue card.','Tap each letter to hear its sound. Blend the sounds.',focus,[focus,'cap'],['get-rope'],[],{words:[focus],picture:'📜',soundSupport:true}),math('light','hill',{type:'divide',a:72,b:8},['trail-lock'],['lantern']),math('bonus','workshop',{type:'multiply',a:24,b:13},[],['star'],{optional:true}),math('place','workshop',{type:'place',number:4836,digitIndex:1},[],['shell'],{optional:true})];if(puzzles[1].options[0]===puzzles[1].options[1])puzzles[1].options[1]='cat';}
 const episode={schema:EPISODE_SCHEMA,id,player:plan.player,date,level:plan.level,title:'The Lantern Garden',goal:'Find the garden lantern and light the surprise.',intro:'A dark lantern waits on the hill. Your friends have clues and a tool to help you light it.',recap:'You found a tool, followed the clue, and lit the lantern together.',reveal:early?'Surprise! Grown-up opens the lantern. A tiny glowing garden is growing inside.':'Surprise! A tiny glowing garden is growing inside the lantern. Your friends made it for the kingdom.',hook:'Tomorrow, a tiny path inside the lantern leads somewhere new.',start:'welcome',finish:'light',rooms,items,puzzles,locks:[{id:'trail-lock',room:'grove',item:'rope',requires:['clue'],label:'Tie the trail rope',hint:'Find the ribbon or rope, then follow the clue in the grove.',goal:'Carry your rope to the trail opening',icon:'rope'}],sideQuests:puzzles.filter(g=>g.optional).map(g=>({id:g.id+'-quest',title:g.title,puzzle:g.id})),learning};
 addReadingGoals(episode,learning);return episode;
}
export function episodeLines(ep,{voices={},pronounce={}}={}){
 const def=episodeDefinition(ep),n=voices.narrator||{voice:'af_bella@relaxed',speed:.8};
 const line=(text,who='narrator')=>({text:phonemize(text,pronounce),shown:text,...(voices[who]||n),who});
 const out={start:line('Tap your guide to begin. '+ep.goal),'on-way':line('Here we go.'),path:line('Try the clear ground.'),found:line('You already helped here. Your reward stays in your backpack.'),piece:line('You did it! Your reward stays in your backpack.'),treasure:line(ep.reveal),'next-done':line(ep.recap),intro:line(ep.intro),recap:line(ep.recap)};
 for(const [id,r]of Object.entries(def.ROOMS))r.lines.forEach((text,i)=>out['friend-'+id+'-'+i]=line(text,r.friend));
 for(const [id,g]of Object.entries(def.GATES)){out[id]=line(g.prompt);out['hint-'+id]=line(g.hint);out['next-'+id]=line(g.goal+' Go to the '+def.ROOMS[g.room].name+'.');if(g.kind==='tiles'){for(const c of new Set(g.words.join('')))out['sound-'+id+'-'+c]=line(SOUNDS[c.toUpperCase()]);for(const w of g.words)out['word-'+id+'-'+w]=line(w[0].toUpperCase()+w.slice(1)+'.');}if(g.kind==='sound')for(const L of g.options)out['sound-'+id+'-'+L]=line(SOUNDS[L]);}
 for(const [id,l]of Object.entries(def.LOCKS)){out['lock-'+id]=line(l.hint);out['next-'+id]=line(l.goal+' Go to the '+def.ROOMS[l.room].name+'.');out['used-'+id]=line('The path is open. Your tool stays in your backpack.');}
 const counts=['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];counts.forEach((t,i)=>out['count-'+(i+1)]=line(t));return out;
}
export function normalizeEpisode(raw,plan,learning){const e=structuredClone(raw);e.schema=EPISODE_SCHEMA;e.id=plan.player+'-'+plan.date;e.player=plan.player;e.date=plan.date;e.level=plan.level;e.learning=learning;delete e.lines;delete e.checks;delete e.fallback;delete e.entry;
 addReadingGoals(e,learning);
 e.revealVisual=/crown/i.test(e.reveal)?'crown':/moon/i.test(e.reveal)?'moon':'garden';
 for(const g of e.puzzles||[]){delete g.clip;if(g.kind==='count')g.countVisual=/stone/i.test(g.prompt)?'stone':/flower/i.test(g.prompt)?'flower':/acorn/i.test(g.prompt)?'acorn':'light';if(g.kind==='sound'){g.prompt='Tap the letter that makes this sound: '+SOUNDS[g.letter]+'.';g.goal='Listen to the clue. Find the matching letter.';}if(g.kind==='math'){g.equation=mathDisplay(g.math||{});if(g.math?.type==='place'){g.number=g.math.number;g.digitIndex=g.math.digitIndex;}}}return e;}
export async function writeEpisode(plan,{library,learning=episodeLearning(plan),ask=async()=>null,log=()=>{},validate=async e=>checkEpisode(e,{library,...learning}),extra=[],allow=[]}={}){
 const fallback=fallbackEpisode(plan,library,learning),system='Write a playable role-playing quest as JSON only. Code owns the schema and learner constraints. Friends talk; tools open paths; a reveal rewards the main goal. No page book.';
 const {name,age,level,cast,grownups,lead,scenario,memory,learnerFocus,sibling,details,themes,dadLines,recent,collection}=plan;
 const context={learning,name,age,level,cast,grownups,lead,scenario,memory,learnerFocus,sibling,details,themes,dadLines,recent,collection,daynotes:plan.daynotes?{thread:plan.daynotes.thread,moment:plan.daynotes.moment}:null};
 let inputs=JSON.stringify(context);for(const w of extra.filter(w=>w&&!allow.some(a=>String(a).toLowerCase()===String(w).toLowerCase()))){const pattern=String(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');inputs=inputs.replace(new RegExp('\\b'+pattern+'\\b','gi'),'a friend');}
 const prompt='Use exactly this JSON shape (sample values may change; retain 3–6 rooms, an enterable interior with a return door, tools, locks, 1–3 optional side quests). Return the full JSON.\n'+JSON.stringify(fallback)+'\nNightly Book inputs (use day notes only as their approved allegory; honor cast rules, memory hook, scenario and learner focus):\n'+inputs+'\nMath is tables 6–9+, two 2-digit factors, four-digit place value or exact division. Reading needs a CVC word chosen from learning.confidenceWords/wordsAlmost and readingFocus (use readingFeatures to prioritize weak vowels), with soundSupport:true. Use masteryRule for independent reading; assisted tile building is practice, never mastery. wordsAboveLevel/hearAndBuildWords may be heard and built with support, never assigned as unsupported reading. Honor readingSupport and soundFocus. Keep the optional name-spelling card exactly as supplied; use only learning.nameSpelling targets, never MOM or GROWN-UP as spelling targets. Early puzzles are spoken counts <=20 or sounds from taughtLetters only. Grown-up, never Mom, for the early child.';
 let errors=[],candidate=null,source='deterministic quest fallback';
 for(let attempt=0;attempt<4;attempt++){
  try{const r=await ask(prompt+(attempt?'\nRepair this candidate. Keep working parts, fix every rejection.\n'+JSON.stringify(candidate)+'\nRejections: '+errors.join(' | '):''),{system,log});if(!r)break;source=r.source;const text=String(r.text).replace(/^```(?:json)?\s*|\s*```$/g,'');candidate=normalizeEpisode(JSON.parse(text),plan,learning);
   errors=episodeContentIssues(candidate,extra,allow,plan);const result=await validate(candidate);errors.push(...result.issues);if(!errors.length)return {episode:candidate,source,checks:result};
  }catch(e){errors=[e.message];}log('Episode repair '+attempt+': '+errors.join(' | '));
 }
 const episode=normalizeEpisode(fallback,plan,learning);episode.fallback=true;const checks=await validate(episode);if(checks.issues.length)throw Error('Deterministic quest failed: '+checks.issues.join(' | '));return {episode,source:'deterministic quest fallback',checks,lint:errors};
}
function episodeContentIssues(e,extra,allow,plan){const text=[e.title,e.intro,e.recap,e.reveal,e.hook,...e.rooms.flatMap(r=>r.lines),...e.puzzles.flatMap(g=>[g.prompt,g.hint,g.title])].join(' ');return [...safetyIssues(text,{extra:extra.filter(w=>!(plan.nameSpelling||[]).some(n=>String(n).toLowerCase()===String(w).toLowerCase())),allow}),...comparisonIssues(text,{names:[plan.name,plan.sibling].filter(Boolean)}),...dayNoteIssues({pages:[{say:[{text}]}]},plan)];}
export function episodeChapter(ep,plan,{library,cast={},number=1,source='quest',checks={}}={}){
 const voices=voicesFor(ep.fallback?{cast:[]}:plan,{narrator:ep.fallback?undefined:plan.voice,named:cast.voices||{}}),lines=episodeLines(ep,{voices,pronounce:cast.pronounce||{}}),first=ep.rooms.find(r=>r.id===ep.start),actors=[plan.actorIds?.hero||plan.player,first.friend].filter(id=>library.actors[id]);
 const ch=assemble({title:ep.title,summary:ep.goal,hook:ep.hook,pages:[{scene:first.bg,actors,say:[['narrator',ep.intro]]}]},{...plan,keyArc:null,quest:null,beats:[]},{library,voices,pronounce:cast.pronounce||{},number,source,dadLines:plan.dadLines||[]});
 ch.episode={...ep,lines,checks};ch.meta.practises=ep.puzzles.map(g=>g.kind+': '+g.title);ch.meta.episode=true;return ch;
}
