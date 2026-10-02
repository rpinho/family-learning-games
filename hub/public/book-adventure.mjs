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
export function routeFlags(ch,choices={}){
 const reached=ch?reachedChoices(ch,choices):{},flags=new Set(ch?.meta?.carriedFlags||[]);
 for(const p of ch?.pages||[]){const o=p.choice?.options.find(o=>o.id===reached[p.node]);if(o?.sets?.id)flags.add(o.sets.id);}
 return flags;
}
export function pageLines(p,choices={},ch=null){
 const flags=routeFlags(ch,choices),visible=l=>!l?.if||flags.has(l.if);
 return [...(p.say||[]),...Object.values(choices).flatMap(id=>p.consequences?.[id]||[])].filter(visible);
}
export function pathOptions(ch){const g=graphOf(ch);if(!g)return [];const out=[],by=new Map(g.nodes.map(n=>[n.id,n]));
 const walk=(id,choices,labels,seen=[])=>{if(seen.includes(id))return;const n=by.get(id);if(!n)return;if(n.choice){const page=ch.pages.find(p=>p.node===id&&p.choice);for(const o of n.choice.options)walk(o.next,{...choices,[id]:o.id},[...labels,page?.choice.options.find(x=>x.id===o.id)?.label||o.id],[...seen,id]);}else if(n.next?.length)walk(n.next[0],choices,labels,[...seen,id]);else out.push({choices,label:labels.join(' → '),pages:routePages(ch,choices)});};walk(g.start,{},[]);return out;
}
// Activity evidence stays legible and above the foreground family on a tall screen.
export function countLayout(n,{width:W,height:H,kind='count'}){
 const wide=W>H*1.05,cols=Math.min(n,wide?6:kind==='count'?(n>12?5:4):3),rows=Math.ceil(n/cols),gap=12;
 const size=Math.min(110,(W*(wide?.48:.88)-gap*(cols-1))/cols,H*(wide?.34:.28)/rows),top=H*(wide?.34:.34),out=[];
 for(let r=0;r<rows;r++){const nr=Math.min(cols,n-r*cols),left=(W-(nr*size+(nr-1)*gap))/2;for(let c=0;c<nr;c++)out.push({left:left+c*(size+gap),top:top+r*(size+gap),width:size,height:size});}return out;
}
