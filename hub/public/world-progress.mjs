// Shared by the map, quest log and model checker. Never hide a goal because
// its room has not been visited or its prerequisites are still missing.
export function questGoals(model,state){
 const {ROOMS,GATES,LOCKS,ITEMS,definition}=model,goals=[];
 const add=(kind,id,entry,done)=>{
  const status=model.targetStatus({...state,room:entry.room},kind,id);
  goals.push({id:kind+'-'+id,kind,key:id,room:entry.room,title:entry.goal||entry.title||entry.label,
   icon:entry.icon||(entry.optional?'🏅':'⭐'),optional:!!entry.optional,
   rewards:entry.rewards||[],done,open:!done&&!status.missing.length&&!!model.routeTo(state.room,entry.room,state).length,
   missing:status.missing.map(r=>r.label)});
 };
 for(const [id,g] of Object.entries(GATES))add('gate',id,g,state.solved.includes(id));
 for(const [id,l] of Object.entries(LOCKS))add('lock',id,l,state.flags.includes(id)||state.flags.includes(id+'-tied'));
 if(!definition.early&&!definition.episode){
  for(const id of ['acorn-1','acorn-2','acorn-3','ball']){
   const room=id==='ball'?'soccer-pitch':'castle-forest';if(!ROOMS[room])continue;
   add('collect',id,{room,title:id==='ball'?'Fetch Pip’s ball':'Find acorn '+id.slice(-1),icon:id==='ball'?'⚽':'🌰'},state.collected.includes(id));
  }
  if(ROOMS['castle-forest'])goals.push({id:'friend-rope',kind:'friend',key:'castle-forest',room:'castle-forest',
   title:'Trade three acorns with Picos for a rope',icon:'🪢',rewards:['rope'],done:state.items.includes('rope'),
   open:!state.items.includes('rope')&&state.questStarted&&state.solved.includes('reading')&&state.collected.filter(id=>/^acorn-/.test(id)).length===3,missing:[]});
 }
 return goals.map(g=>({...g,rewardNames:g.rewards.map(id=>id.startsWith('map-')?'Map piece':ITEMS[id]?.name||'Discovery')}));
}

export function goalsByRoom(model,state,goals=questGoals(model,state)){
 const pins=Object.fromEntries(Object.keys(model.ROOMS).map(id=>[id,[]]));
 for(const g of goals)if(!g.done&&pins[g.room])pins[g.room].push(g);
 return pins;
}

// Definitions can place several toys in a room via TOYS or room.toys. These
// defaults also keep existing prototype saves playable without a migration.
export function worldToys(definition){
 const defaults=definition.early?
  {'tetherball-yard':['tetherball'],'flower-meadow':['bubbles'],'pizza-party':['soccer'],'lava-playroom':['drum']}:
  {'treehouse-town':['tetherball'],'soccer-pitch':['soccer'],'castle-gate':['bubbles'],waterfall:['drum']};
 return Object.fromEntries(Object.entries(definition.ROOMS).map(([id,r])=>{const authored=r.toys||definition.TOYS?.[id]||(definition.toys||[]).filter(t=>t.room===id),toys=[...(authored||[]),...(defaults[id]||[])];return [id,toys.filter((t,i)=>toys.findIndex(other=>(typeof other==='string'?other:other.kind)===(typeof t==='string'?t:t.kind))===i)];}));
}

export function multiplicationFacts(g){if(g.math?.facts?.length)return g.math.facts.map(f=>[f.a,f.b]);const facts=[...String(g.equation||'').matchAll(/(\d+)\s*[×*]\s*(\d+)/g)].map(m=>[+m[1],+m[2]]);for(const m of String(g.equation||'').matchAll(/(\d+)\s*÷\s*(\d+)/g))facts.push([+m[1]/+m[2],+m[2]]);return facts;}
// A range of tables is not evidence that any one fact is independently known.
// Correct fast taps and assisted answers never qualify as quick-fact evidence.
export function knownFact(evidence,a,b){
 if(Array.isArray(evidence))evidence={[`${a}x${b}`]:evidence.filter(e=>e&&(e.a===a&&e.b===b||e.fact===`${a}x${b}`||e.item===`fact:${a}x${b}`))};
 const fact=evidence?.[`${a}x${b}`]||evidence?.[`${a}×${b}`]||evidence?.[`${b}x${a}`]||evidence?.[`${b}×${a}`];
 const trials=Array.isArray(fact)?fact:fact?.attempts||[];
 const reliable=trials.filter(t=>Number(t.ms??t.firstTapMs)>=2000&&!t.fastTap&&!t.help&&!t.hints);
 if(reliable.length<3||reliable.at(-1)!==trials.at(-1))return false;
 return (reliable.at(-1).correct===true||reliable.at(-1).ok===true)&&reliable.at(-1).firstTry===true&&reliable.filter(t=>(t.correct===true||t.ok===true)&&t.firstTry===true).length>=3;
}
export function factSupport(g){
 const [fact]=multiplicationFacts(g);if(!fact)return null;const [a,b]=fact;
 if(a>12||b>12)return {text:g.hint,rows:[]};
 return {text:`${a} groups of ${b}. Count by ${b}: ${Array.from({length:a},(_,i)=>(i+1)*b).join(', ')}.`,rows:Array.from({length:a},()=>b)};
}
