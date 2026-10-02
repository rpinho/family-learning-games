// Reusable bounded story graphs: world maps, fixed skeletons, complete path lint and consequence ledgers.
// ---------- kit ----------
// {id, title, places:[{id, bg, name}], edges:[[a,b,"how you get there"]]}
export function kitIssues(kit,{backgrounds=null}={}){
 const out=[];if(!kit?.id)out.push('kit has no id');
 const ids=new Set((kit?.places||[]).map(p=>p.id));
 if(ids.size<3)out.push(`kit ${kit?.id}: needs at least 3 places, has ${ids.size}`);
 for(const p of kit?.places||[])if(backgrounds&&!backgrounds.has(p.bg))out.push(`kit ${kit.id}: place ${p.id} uses unknown background ${p.bg}`);
 for(const [a,b,how] of kit?.edges||[]){if(!ids.has(a)||!ids.has(b))out.push(`kit ${kit.id}: edge ${a}-${b} names an unknown place`);if(!how)out.push(`kit ${kit.id}: edge ${a}-${b} needs a way to travel`);}
 return out;}
export const neighbours=(kit,a)=>(kit.edges||[]).flatMap(([x,y])=>x===a?[y]:y===a?[x]:[]);
export const legalMove=(kit,a,b)=>a===b||neighbours(kit,a).includes(b);
export const travel=(kit,a,b)=>(kit.edges||[]).find(([x,y])=>(x===a&&y===b)||(x===b&&y===a))?.[2]||null;

// ---------- skeleton ----------
// Branch and bottleneck: opening → fork → branch A | branch B (different places, same kind of challenge in a
// different skin) → gate (shared bottleneck) → small fork → ending. ~8 nodes authored, 6 on any path.
// beats: the day's beats in order; the first two "branch" beats are mirrored (A and B carry the same kind and
// skill), so every path meets the day's learning by construction.
export function skeleton(kit,beats,{rand=Math.random}={}){
 const start=kit.places[0].id,nb=neighbours(kit,start);
 if(nb.length<2)throw new Error(`kit ${kit.id}: the start place needs two ways on`);
 const [pa,pb]=nb.length>2?shuffle(nb,rand).slice(0,2):nb;
 const meet=kit.places.map(p=>p.id).find(id=>id!==start&&id!==pa&&id!==pb&&neighbours(kit,id).includes(pa)&&neighbours(kit,id).includes(pb))||start;
 const [b0,b1,b2,b3]=beats;
 const nodes=[
  {id:'opening',role:'opening',place:start,beat:b0?.id||null,next:['fork1']},
  {id:'fork1',role:'fork',place:start,choice:{options:[{id:'a',next:'branchA',to:pa},{id:'b',next:'branchB',to:pb}]},sets:true},
  {id:'branchA',role:'branch',place:pa,beat:b1?{...b1,id:b1.id+'a',mirror:b1.id}:null,next:['gate']},
  {id:'branchB',role:'branch',place:pb,beat:b1?{...b1,id:b1.id+'b',mirror:b1.id}:null,next:['gate']},
  {id:'gate',role:'gate',place:meet,beat:b2?.id||null,next:['fork2'],reads:true},
  {id:'fork2',role:'fork',place:meet,choice:{options:[{id:'c',next:'ending'},{id:'d',next:'ending'}]}},
  {id:'ending',role:'ending',place:meet,beat:b3?.id||null,next:[],reads:true}];
 return {kit:kit.id,start:'opening',nodes};
}
function shuffle(a,rand){return a.map(v=>[rand(),v]).sort((x,y)=>x[0]-y[0]).map(v=>v[1]);}

// ---------- paths ----------
export function paths(sk){const byId=new Map(sk.nodes.map(n=>[n.id,n])),out=[];
 const walk=(id,trail,picks)=>{const n=byId.get(id);if(!n||trail.includes(id))return;const t=[...trail,id];
  if(n.choice){for(const o of n.choice.options)walk(o.next,t,[...picks,o.id]);return;}
  if(!n.next.length){out.push({nodes:t,picks});return;}for(const x of n.next)walk(x,t,picks);};
 walk(sk.start,[],[]);return out;}
// One route through the model's story, as a linear chapter: the pages of each node in order.
export function flatten(story,path){return {...story,pages:path.nodes.flatMap(id=>story.nodes?.[id]?.pages||[])};}

// Graph checks the linear lint can't see: every node written and reachable, moves only along map edges, every flag
// set is read later, choices that differ (a different place and at least one flag), at most two flags a chapter.
export function graphIssues(story,sk,kit){
 const out=[],byId=new Map(sk.nodes.map(n=>[n.id,n])),place=id=>byId.get(id)?.place;
 for(const n of sk.nodes)if(!story.nodes?.[n.id]?.pages?.length)out.push(`node ${n.id} has no pages`);
 const reached=new Set(paths(sk).flatMap(p=>p.nodes));for(const n of sk.nodes)if(!reached.has(n.id))out.push(`node ${n.id} can't be reached`);
 for(const p of paths(sk))for(let i=1;i<p.nodes.length;i++){const a=place(p.nodes[i-1]),b=place(p.nodes[i]);if(!legalMove(kit,a,b))out.push(`path ${p.picks.join('')}: ${a} to ${b} is not on the map`);}
 const flags=[];for(const n of sk.nodes)for(const o of story.nodes?.[n.id]?.choice?.options||[])if(o.sets)flags.push(o.sets);
 if(new Set(flags.map(f=>f.id)).size>2)out.push(`a chapter sets at most 2 flags (found ${new Set(flags.map(f=>f.id)).size})`);
 const later=sk.nodes.filter(n=>n.reads).flatMap(n=>(story.nodes?.[n.id]?.pages||[]).flatMap(pg=>[...(pg.say||[]),...Object.values(pg.consequences||{}).flat()].map(l=>Array.isArray(l)?l[1]:l.text||''))).join(' ').toLowerCase();
 for(const f of flags)if(f.label&&!later.includes(String(f.label).toLowerCase().split(' ').pop()))out.push(`flag "${f.label}" is set but never comes back later in the chapter`);
 const f1=story.nodes?.fork1?.choice?.options||[];if(f1.length===2&&!f1.some(o=>o.sets))out.push('the first choice must change something he carries (set a flag on at least one option)');
 return out;}

// The existing linear lint on every path, plus the graph checks. lint(ch) -> issues.
export function lintStory(story,sk,kit,lint){
 const out=[...graphIssues(story,sk,kit)];
 for(const p of paths(sk))for(const i of lint(flatten(story,p),p))out.push(`path ${p.picks.join('') || '-'}: ${i}`);
 return [...new Set(out)];}

// ---------- ledger ----------
// {arc, flags:[{id, kind:'item'|'ally'|'knowledge', label, set:date, paid:date|null}]}
export function applyChoice(ledger,flag,date){const l={arc:ledger?.arc||null,flags:[...(ledger?.flags||[])]};
 if(flag&&!l.flags.some(f=>f.id===flag.id))l.flags.push({id:flag.id,kind:flag.kind||'item',label:flag.label,set:date,paid:null});return l;}
// Tomorrow pays off one flag: the oldest one not yet paid.
export const payoff=ledger=>(ledger?.flags||[]).find(f=>!f.paid)||null;
export function markPaid(ledger,id,date){return {...ledger,flags:(ledger?.flags||[]).map(f=>f.id===id?{...f,paid:date}:f)};}
