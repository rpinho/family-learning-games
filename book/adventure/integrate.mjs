import {skeleton,paths,flatten,lintStory,travel,conditionalPayoffs,lineText} from './graph.mjs';
import {adventureBrief} from './brief.mjs';
import {buildPrompt,wordTarget} from '../prompt.mjs';
import {lintChapter,safetyIssues,comparisonIssues,sayOf,LEVELS,softFix} from '../lint.mjs';
import {assemble,nameForms,mentions} from '../assemble.mjs';
import {artFor,MAX_ACTORS} from '../../hub/public/book-scene.mjs';
export const TURN_TYPES=['riddle','trade','help-a-friend','no','map'];
export function rotateChallenges(plan,previous=[]){
 const last=previous.at(-1)?.meta?.turnType||((previous.at(-1)?.pages||[]).some(p=>p.beat?.kind==='no')?'no':null);
 let i=Math.abs(Number(plan.date.replaceAll('-','')))%TURN_TYPES.length;if(TURN_TYPES[i]===last)i=(i+1)%TURN_TYPES.length;
 const type=TURN_TYPES[i];plan.turnType=type;
 plan.beats=plan.beats.filter(b=>b.kind!=='fork').map(b=>{
  if(b.kind!=='no'||type==='no')return b;
  const heads={riddle:'A gate has a riddle.',trade:'Work out the fair trade.', 'help-a-friend':'A friend needs your help.',map:'Check the map before going on.'};
  return {id:b.id,kind:'puzzle',variant:'observe',answer:String(b.right),options:b.options,display:null,what:`${heads[type]} ${b.fixSpoken}`,spoken:b.fixSpoken,hint:b.hint,done:`${b.right} is right. The path is open.`,turnType:type};
 });return type;
}
export function adventurePlan(plan,kit,previous=[]){
 rotateChallenges(plan,previous);plan.avoidBgs=[];plan.avoidScenarios=[];plan.recent=[];
 const sk=skeleton(kit,[]),branch=plan.beats.findIndex((b,i)=>i>0&&i<=2&&['count','puzzle','share','score','remainder'].includes(b.kind)),at=branch<0?1:branch;
 const first=plan.beats.slice(0,at),mirror=plan.beats[at],rest=plan.beats.slice(at+1);
 for(const n of sk.nodes){n.beat=null;n.beats=n.id==='opening'?first.map(b=>b.id):/^branch/.test(n.id)?(mirror?[mirror.id]:[]):n.id==='gate'?rest.slice(0,2).map(b=>b.id):n.id==='ending'?rest.slice(2,4).map(b=>b.id):[];}
 if(rest.length>4)throw Error('Adventure has too many beats for two per node');
 for(const b of plan.beats){delete b.away;delete b.at;if(b.painted&&!kit.places.some(p=>p.bg===plan.scenario?.place))throw Error('Painted scenario is outside the adventure kit');}
 plan.minActions=0;plan.actions={};plan.adventureKit=kit.id;plan.kitWords=[kit.title,...kit.places.map(p=>p.name),...kit.edges.map(e=>e[2])].filter(Boolean);return sk;
}
export function pathStory(story,path,carried=[]){const ch=flatten(story,path,{carried});let index=0;ch.pages=path.nodes.flatMap(id=>{const n=story.nodes?.[id];return (n?.pages||[]).map((p,i)=>({...ch.pages[index++],say:[...ch.pages[index-1].say,...path.picks.flatMap(id=>p.consequences?.[id]||[])],...(n.choice&&i===n.pages.length-1?{choice:{...n.choice,options:n.choice.options.filter(o=>path.picks.includes(o.id))}}:{})}));});return ch;}
export function softFixAdventure(story,plan){return {...story,nodes:Object.fromEntries(Object.entries(story.nodes||{}).map(([id,n])=>[id,softFix(n,plan)]))};}
const FORMULA=/\bneeds?\b.{0,60}\bbefore\b/i;
function overlap(a,b,drop=[]){const ws=t=>new Set(String(t).toLowerCase().match(/[a-z]{3,}/g)?.filter(w=>!drop.includes(w)&&!['the','and','its','his','her','you','your','with','then'].includes(w))||[]),A=ws(a),B=ws(b);
 if(!A.size||!B.size)return 0;let n=0;for(const w of A)if(B.has(w))n++;return n/Math.min(A.size,B.size);}
export function lintAdventure(story,sk,kit,plan,opts={}){
 opts={...opts,travel:kit.edges.map(e=>e[2])};
 const out=lintStory(story,sk,kit,(_ch,path)=>{
  const ch=pathStory(story,path,plan.payoff?[plan.payoff]:[]),nodes=path.nodes.map(id=>sk.nodes.find(n=>n.id===id));
  const pathPlan={...plan,beats:plan.beats.map(b=>{const n=nodes.find(n=>n.beats.includes(b.id));return {...b,at:kit.places.find(p=>p.id===n?.place)?.bg};})};
  return lintChapter(ch,pathPlan,opts);
 });
 const setups=[];
 for(const n of sk.nodes){const w=story.nodes?.[n.id];if(!w)continue;const bg=kit.places.find(p=>p.id===n.place)?.bg;
  if((w.pages||[]).filter(p=>p.beat).length>2)out.push(`node ${n.id}: at most two challenges`);
  for(const p of w.pages||[]){if(p.scene!==bg)out.push(`node ${n.id}: use scene ${bg}`);if(p.beat&&!n.beats.includes(p.beat))out.push(`node ${n.id}: beat ${p.beat} belongs elsewhere`);
   if(p.beat){const text=(p.say||[]).map(lineText).join(' '),place=kit.places.find(p=>p.id===n.place),tokens=String(place?.name+' '+bg).toLowerCase().match(/[a-z]{3,}/g)||[];
    // Tied to the story: the place, its landmark or someone there (a friend's name, Dad, Mom). Not a keyword
    // formula: forcing "needs/before/opens" made every setup "The X needs Y before its Z opens" (2026-10-02).
    const who=[...(opts.actors||[]).flatMap(a=>String(a).split('-')),'dad','daddy','mom','grown-up',String(plan.name||'')].filter(w=>w.length>=3);
    if(/(?:map's final mark|one more clue|clue waits|last clue needs)/i.test(text)||!(/\[\[/.test(text)||[...tokens,...who].some(t=>new RegExp(`\\b${t}\\b`,'i').test(text))))out.push(`node ${n.id}: beat ${p.beat} setup must say why this moment needs it: tell it as part of the story at ${place?.name} (who wants what, what just went wrong)`);
    setups.push({node:n.id,beat:p.beat,text,tokens});}
  }
  for(const b of n.beats)if(w.pages.filter(p=>p.beat===b).length!==1)out.push(`node ${n.id}: beat ${b} must appear exactly once`);
  if(n.choice){const c=w.choice;if(!c?.prompt||c.options?.length!==2)out.push(`node ${n.id}: needs prompt and two options`);
   for(const o of n.choice.options){const x=c?.options?.find(x=>x.id===o.id);if(!x?.label||!x.reply)out.push(`node ${n.id}: option ${o.id} needs label and reply`);if(n.sets&&(!x?.sets?.id||!x?.sets?.label||!['item','ally','knowledge'].includes(x?.sets?.kind)))out.push(`node ${n.id}: option ${o.id} needs a flag`);if(!n.sets&&x?.sets)out.push(`node ${n.id}: only the first fork sets flags`);}
   out.push(...safetyIssues(JSON.stringify(c||{}),opts).map(i=>`choice ${n.id}: ${i}`),...comparisonIssues(JSON.stringify(c||{}),{names:[plan.sibling]}));
  }
 }
 setups.filter(x=>FORMULA.test(x.text)).slice(1).forEach(x=>out.push(`node ${x.node}: beat ${x.beat} setup repeats the "<place> needs <task> before it opens" formula: tell it as a story moment (who wants what, what just went wrong, what is hidden)`));
 // Mirrored branches: the same kind of challenge in a different SKIN, not the same sentence with the place swapped.
 const bA=setups.find(x=>x.node==='branchA'),bB=setups.find(x=>x.node==='branchB');
 if(bA&&bB&&overlap(bA.text,bB.text,[...bA.tokens,...bB.tokens])>.5)out.push('branch setups are the same sentence with the place swapped: give each branch its own moment in its own place');
 const a=story.nodes?.fork1?.choice?.options?.[0],b=story.nodes?.fork1?.choice?.options?.[1];if(a?.sets?.id===b?.sets?.id)out.push('first fork flags must differ');
 // The two things he could carry must make DIFFERENT things happen (2026-10-02: "The ribbon holds the curling map flat"
 // / "The pebble holds the curling map flat"; and one line repeated under both flags is no payoff at all).
 if(a?.sets?.id&&b?.sets?.id)for(const id of ['gate','ending']){const said=f=>(story.nodes?.[id]?.pages||[]).flatMap(p=>[...(p.say||[]),...(p.after||[])]).filter(l=>l?.if===f).map(lineText);
  const A=said(a.sets.id),B=said(b.sets.id);if(!A.length||!B.length)continue;
  if(A.some(x=>B.includes(x)))out.push(`node ${id}: the same line plays for both ${a.sets.label} and ${b.sets.label}: each must make its own thing happen`);
  else if(overlap(A.join(' '),B.join(' '),[a.sets.label,b.sets.label,a.sets.id,b.sets.id].join(' ').toLowerCase().match(/[a-z]{3,}/g)||[])>.6)out.push(`node ${id}: ${a.sets.label} and ${b.sets.label} do the same thing with the object swapped: each must make something different happen (the ribbon ties the gate; the pebble rings the bell)`);}
 const known=new Set([...(story.nodes?.fork1?.choice?.options||[]).map(o=>o.sets?.id),plan.payoff?.id].filter(Boolean));
 for(const n of sk.nodes)for(const p of story.nodes?.[n.id]?.pages||[])for(const l of [...(p.say||[]),...(p.after||[]),...(p.magic?.after||[])])if(l?.if&&!known.has(l.if))out.push(`node ${n.id}: unknown conditional flag ${l.if}`);
 if(plan.payoff&&!sk.nodes.filter(n=>n.reads||n.role==='opening').some(n=>conditionalPayoffs(story,n.id,plan.payoff).length))out.push(`carried flag ${plan.payoff.label}: needs an if:"${plan.payoff.id}" line visibly changing what happens on every route`);
 for(const id of ['c','d'])if(!(story.nodes?.ending?.pages||[]).some(p=>p.consequences?.[id]?.length))out.push(`node ending: needs consequences.${id} changing the ending`);
 const endingText=id=>JSON.stringify((story.nodes?.ending?.pages||[]).flatMap(p=>p.consequences?.[id]||[])).toLowerCase();if(endingText('c')===endingText('d')||overlap(endingText('c'),endingText('d'))>.5)out.push('second fork must enact two different endings: two different final moments (who joins, what is found, what is made), not the same line with one word changed');
 if((story.nodes?.fork2?.choice?.options||[]).some(o=>/\bmark(?:er|s|ing)?\b/i.test(o.label||'')))out.push('second fork: a marker is not a choice: offer two different things to do or find');
 for(const n of sk.nodes){for(const dest of (n.next||[]).map(id=>sk.nodes.find(x=>x.id===id)))if(dest.place!==n.place&&!JSON.stringify(story.nodes?.[n.id]?.pages||[]).toLowerCase().includes(String(travel(kit,n.place,dest.place)).toLowerCase()))out.push(`node ${n.id}: tell travel ${travel(kit,n.place,dest.place)}`);}
 for(const n of sk.nodes.filter(n=>/^branch/.test(n.id))){const prev=sk.nodes.find(x=>x.choice?.options.some(o=>o.next===n.id));if(prev&&!JSON.stringify(story.nodes?.[n.id]?.pages||[]).toLowerCase().includes(String(travel(kit,prev.place,n.place)).toLowerCase()))out.push(`node ${n.id}: tell arrival ${travel(kit,prev.place,n.place)}`);}
 return [...new Set(out)];
}
export function integratedBrief(plan,sk,kit,{library,...opts}){
 const linear=buildPrompt({...plan,scenario:null,style:'adventure'}, {library,...opts});
 return linear.slice(0,linear.indexOf('SHAPE\n'))+'\n'+adventureBrief({sk,kit,plan,chooser:plan.name,payoff:plan.payoff})+`\nINTEGRATION REQUIREMENTS (override linear shape and reply format):
- HARD NARRATION CAPS on EACH ROUTE including conditional consequences, magic after, and choices: ${LEVELS[plan.level].words[0]}-${wordTarget(plan)} words total. Page max ${LEVELS[plan.level].pageWords} words. Line max ${LEVELS[plan.level].lineWords-4} words. Use about 8-16 words on each beat page, 12-22 on each story page. Every conditional payoff 5-10 words. Do not use long paragraphs. Conditional lines count in those limits. Do not put two consecutive Dad lines: consequences should follow a narrator line, ending consequences.c/d may use narrator instead.
- Name ${plan.name} in a spoken STORY line at least once (a title or summary does not count). Include ${kit.title} only as the world, not in long descriptions. One brief memory callback; the day-note themes remain short.
- A payoff from an earlier chapter must matter on EVERY route. Use an object line with if set to its exact carried flag id in a shared node. It must change what happens, not merely be mentioned.
- Every route has 8-11 pages; retain linear voice, safety, narration/time limits, magic words, memory, day notes and learning focus above.
- Practice layout: ${sk.nodes.map(n=>n.id+': '+(n.beats.join(', ')||'story only')).join('; ')}. Branches use the SAME beat id and skill with distinct story setups in each place.
- Opening: story page FIRST, then its beat pages. Branch: arrival story then challenge; LAST branch page tells the kit's exact travel phrase to the shared gate. Ending: its assigned beat pages FIRST, then a final story page. Each fork is one story page ending in a choice.
- One page per beat, with "beat":"<id>". No extra beats or answer leaks. No node may hold more than TWO beats. Gate contains its beat pages; put conditional payoffs on the first. EVERY beat setup is a MOMENT IN THE STORY at its own place: someone wants something, something just went wrong, or something is hidden; a friend there can say it ("Picos tips the basket: plates everywhere!"). Name the place, its painted landmark or the friend. NEVER the formula "<the place> needs <the task> before <it> opens" (bad: "The chess courtyard needs equal picnic plates before its stairway opens"). The two branches meet the same kind of challenge in different SKINS: different moments, never the same sentence with the place swapped. NEVER generic glue such as "the map\'s final mark must fit", "a clue waits", or "one more clue". Explain the obstacle without giving the answer.
- BOTH gate AND ending: for EACH fork1 option write one say object {"who":"dad","text":"The ribbon ties the hill gate open.","if":"<that option sets.id>"}. Use the item\'s own words. It MUST visibly CHANGE what happens (pebble rings the bell; ribbon ties the gate), never merely "you kept it" or praise. Both variants are voiced, only the chosen flag\'s line is shown/spoken. Do NOT write unconditional generic substitutes. Two alternate Dad lines are fine because only one plays. Keep consequences.c/d for fork2 only.
- The second fork is a real choice between two different things to DO or FIND at the end (open the chest now or wake the owl first; take the lantern or follow the music), never a marker, a side or high/low. The FINAL ending PAGE has "consequences":{"c":[[who,text]],"d":[[who,text]]}: two different final moments, each following from its own option. This field belongs ON THE PAGE, not beside pages in the node. These are option ids, NOT item flags; do not use if:"c" or if:"d".
- Short choice labels, optional emoji, "reply" calmly spoken by Dad/Rook: what happens because of the choice. Never calls it correct or a score.
- Distinct flag ids/labels, at most two: both first options set one, second fork sets none.
- Any ally is an existing cast friend. No new named toy with no picture.
- Keep exact kit travel phrases in narration (also shown on screen); never describe an unchosen road.
- No compulsory action pages: choices and learning are the doing. ONLY JSON {title,summary,hook,nodes}.`;
}
export function parseAdventure(text){try{const ch=JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));return ch?.nodes&&typeof ch.nodes==='object'?ch:null;}catch{return null;}}
export function collapse(story,sk){const filtered={...story,nodes:Object.fromEntries(sk.nodes.map(n=>[n.id,{...story.nodes?.[n.id],pages:n.choice?(story.nodes?.[n.id]?.pages||[]).filter(p=>p.magic):(story.nodes?.[n.id]?.pages||[])}]))};const {nodes:discardedNodes,...ch}=pathStory(filtered,paths(sk)[0]);return {...ch,pages:ch.pages.map(({choice,consequences,node,...p})=>({...p,say:(p.say||[]).map(l=>l?.if?(({if:flag,...line})=>line)(l):l)}))};}
export function assembleAdventure(story,plan,sk,kit,opts){
 const raw=[],groups={};for(const n of sk.nodes){groups[n.id]=[];for(const p of story.nodes[n.id].pages){groups[n.id].push(raw.length);raw.push({...p,node:n.id,scene:kit.places.find(x=>x.id===n.place).bg});}}
 const ch=assemble({...story,pages:raw},plan,opts);
 const currentFlags=new Set((story.nodes.fork1?.choice?.options||[]).map(o=>o.sets?.id).filter(Boolean));
 for(const p of ch.pages)for(const l of [...p.say,...(p.action?.after||[]),...(p.magic?.after||[])])if(currentFlags.has(l.if))l.if=`${plan.date}:${l.if}`;
 ch.meta.carriedFlags=plan.payoff?[plan.payoff.id]:[];
 const line=(who,text)=>assemble({title:'',summary:'',hook:'',pages:[{scene:raw[0].scene,actors:[],say:[[who,text]]}]},plan,opts).pages[0].say[0];
 for(const n of sk.nodes)for(const i of groups[n.id]){const p=ch.pages[i],r=raw[i];p.node=n.id;p.place=n.place;
  if(r.consequences)p.consequences=Object.fromEntries(Object.entries(r.consequences).map(([k,ls])=>[k,sayOf({say:ls}).map(l=>line(l.who,l.text))]));
  const prev=sk.nodes.find(x=>x.choice?.options.some(o=>o.next===n.id));if(i===groups[n.id][0]&&prev&&prev.place!==n.place)p.travel={from:prev.place,to:n.place,text:travel(kit,prev.place,n.place)};
  const dest=sk.nodes.find(x=>x.id===n.next?.[0]);if(i===groups[n.id].at(-1)&&dest&&dest.place!==n.place)p.travel={from:n.place,to:dest.place,text:travel(kit,n.place,dest.place)};
 }
 for(const n of sk.nodes.filter(n=>n.choice)){const p=ch.pages[groups[n.id].at(-1)],w=story.nodes[n.id].choice;p.choice={prompt:line('dad',n.id==='fork1'&&String(w.prompt).split(/\s+/).length<5?'Which path would you like to take?':w.prompt),options:n.choice.options.map(o=>{const x=w.options.find(x=>x.id===o.id);return {id:o.id,next:o.next,label:x.label,emoji:String(x.label).match(/\p{Extended_Pictographic}(?:\uFE0F)?/u)?.[0]||x.emoji||'🗺️',...(mentions(x.label,nameForms(plan)).find(id=>opts.library.actors[id])?{pictureActor:mentions(x.label,nameForms(plan)).find(id=>opts.library.actors[id])}:{}),...(/\bstar\b/i.test(x.label)&&opts.library.props.star?{pictureProp:'star'}:{}),reply:line('dad',x.reply),...(x.sets?{sets:{...x.sets,id:`${plan.date}:${x.sets.id}`}}:{}),...(o.to?{picture:kit.places.find(p=>p.id===o.to)?.bg}:{})};})};}
 const forms=nameForms(plan);
 for(const p of ch.pages){const ls=[...Object.values(p.consequences||{}).flat(),...(p.choice?[p.choice.prompt,...p.choice.options.map(o=>o.reply)]:[])],need=new Set([plan.actorIds.hero,...ls.flatMap(l=>[l.who==='dad'?plan.actorIds.dad:l.who,...mentions(l.shown||l.text,forms)]).filter(id=>opts.library.actors[id]&&opts.actors.includes(id))]);
  for(const id of need)if(!p.scene.actors.some(a=>a.id===id))p.scene.actors.push({id,pose:'idle'});while(p.scene.actors.length>MAX_ACTORS){const i=p.scene.actors.findLastIndex(a=>!need.has(a.id));if(i<0)break;p.scene.actors.splice(i,1);}}
 ch.art=artFor(ch.pages,opts.library);for(const o of ch.pages.flatMap(p=>p.choice?.options||[])){if(o.pictureProp)Object.assign(ch.art.props,artFor([{scene:{bg:raw[0].scene,actors:[],props:[{id:o.pictureProp,n:1}]}}],opts.library).props);if(o.pictureActor&&!ch.art.actors[o.pictureActor])Object.assign(ch.art.actors,artFor([{scene:{bg:raw[0].scene,actors:[{id:o.pictureActor,pose:'idle'}],props:[]}}],opts.library).actors);}
 ch.meta.graph=sk;ch.meta.kit=kit;ch.meta.turnType=plan.turnType;return ch;
}
