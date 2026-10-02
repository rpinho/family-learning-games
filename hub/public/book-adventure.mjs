// Pure route helpers shared by playback, review and server validation.
export const graphOf=ch=>ch?.meta?.graph||null;
export function routePages(ch,choices={}, {complete=false}={}){
 const g=graphOf(ch);if(!g)return ch.pages.map((_,i)=>i);
 const by=new Map(g.nodes.map(n=>[n.id,n])),out=[],seen=new Set();let id=g.start;
 while(id&&!seen.has(id)){seen.add(id);const n=by.get(id);if(!n)break;out.push(...ch.pages.flatMap((p,i)=>p.node===id?[i]:[]));
  if(n.choice){const pick=n.choice.options.find(o=>o.id===choices[id]);if(!pick&&!complete)break;id=(pick||n.choice.options[0])?.next;}else id=n.next?.[0];
 }return out;
}
export function validChoices(ch,input={}){const out={};for(const n of graphOf(ch)?.nodes||[])if(n.choice?.options.some(o=>o.id===input[n.id]))out[n.id]=input[n.id];return out;}
export function reachedChoices(ch,input={}){const choices=validChoices(ch,input),out={};for(const i of routePages(ch,choices)){const p=ch.pages[i];if(p.choice&&choices[p.node])out[p.node]=choices[p.node];}return out;}
export function pageLines(p,choices={}){return [...(p.say||[]),...Object.values(choices).flatMap(id=>p.consequences?.[id]||[])];}
export function pathOptions(ch){const g=graphOf(ch);if(!g)return [];const out=[],by=new Map(g.nodes.map(n=>[n.id,n]));
 const walk=(id,choices,labels,seen=[])=>{if(seen.includes(id))return;const n=by.get(id);if(!n)return;if(n.choice){const page=ch.pages.find(p=>p.node===id&&p.choice);for(const o of n.choice.options)walk(o.next,{...choices,[id]:o.id},[...labels,page?.choice.options.find(x=>x.id===o.id)?.label||o.id],[...seen,id]);}else if(n.next?.length)walk(n.next[0],choices,labels,[...seen,id]);else out.push({choices,label:labels.join(' → '),pages:routePages(ch,choices)});};walk(g.start,{},[]);return out;
}
