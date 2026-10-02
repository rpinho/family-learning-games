// Writer brief for a graph whose places and learning challenges are fixed by code.
import {travel} from './graph.mjs';

export function adventureBrief({sk,kit,plan,beatLine=b=>`${b.id}: ${b.kind}`,payoff=null,chooser=null}){
 const byId=new Map(sk.nodes.map(n=>[n.id,n])),name=id=>kit.places.find(p=>p.id===id)?.name||id,bg=id=>kit.places.find(p=>p.id===id)?.bg||id;
 const nodeLines=sk.nodes.map(n=>{
  const prev=sk.nodes.filter(m=>(m.next||[]).includes(n.id)||m.choice?.options?.some(o=>o.next===n.id));
  // One way in: the arrival is told on this node. Several ways in from different places (the gate after the branches):
  // each branch ends by telling its own way there instead, so the shared page never names the wrong road.
  const ways=[...new Set(prev.filter(m=>m.place!==n.place).map(m=>m.place))];
  const arrive=ways.length===1?travel(kit,ways[0],n.place):null;
  const onward=(n.next||[]).map(id=>byId.get(id)).filter(m=>m&&m.place!==n.place&&new Set(sk.nodes.filter(x=>(x.next||[]).includes(m.id)&&x.place!==m.place).map(x=>x.place)).size>1).map(m=>`end this node by telling how they go on to ${name(m.place)}: ${travel(kit,n.place,m.place)}`)[0];
  const beat=n.beat?(typeof n.beat==='string'?(plan.beats||[]).find(b=>b.id===n.beat):n.beat):null;
  let line=`- "${n.id}" (${n.role}) at ${name(n.place)} [scene "${bg(n.place)}"]`;
  if(arrive)line+=`; they arrive ${arrive}: say how in one short line`;
  if(beat)line+=`; its challenge: ${beatLine(beat)}${beat.mirror?` (the other branch has the same kind of challenge in a different skin: make each fit its own place)`:''}`;
  if(n.role==='fork')line+=`; ends with a CHOICE between ${n.choice.options.map(o=>o.to?`"${o.id}" (towards ${name(o.to)})`:`"${o.id}"`).join(' and ')}${n.sets?': each option gives him something different to carry (an item, a friend or a piece of knowledge) that matters later':''}`;
  if(onward)line+=`; ${onward}`;
  if(ways.length>1)line+=`; they arrive from different places (each branch already told how): do not describe the road here`;
  if(n.reads)line+=`; what he chose earlier must change what happens here (use the thing he carries)`;
  return line;}).join('\n');
 return `ADVENTURE CHAPTER (a small gamebook in ONE world: ${kit.title})
Write the text for each node of this map. The code has fixed the shape, the places and the challenges; you write what happens.
${nodeLines}

RULES
- Every node is 1-2 pages in the linear format (scene, actors, say). Pages stay in their node's place; moving between places is always told ("down the zigzag path…"), never a jump.
- A choice is a real turning point: two different ways, both good; never a right and a wrong one; no fail state. The narrator asks ${chooser?`${chooser}`:'him'} to choose in one short line.
- What each option sets: {"id","kind":"item"|"ally"|"knowledge","label"} (at most two in the chapter). The gate and the ending must use what he chose so that the two ways feel different.
${payoff?`- From an earlier chapter he still carries ${payoff.label} (${payoff.kind}): it must matter once in today's story.\n`:''}- Each path read on its own must be a whole story and keep every limit of the linear brief.

REPLY with ONLY JSON: {"title":"...","summary":"...","hook":"...","nodes":{"<node id>":{"pages":[{"scene":"...","actors":[...],"say":[["narrator","..."]]}],"choice":{"prompt":"...","options":[{"id":"a","label":"short label","reply":"one short line","sets":{"id":"...","kind":"item","label":"..."}}]}}}}
(only fork nodes have "choice").`;
}
