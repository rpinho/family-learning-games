import {validFreeInk} from './drawing-space.mjs';
export const DOODLES=['tree','house','flower','sun','triangle','square','circle','star','person','face'];
export const PICTURE_LABELS=[...DOODLES,'family picture','two people','family portrait'];
export const DOODLE_ICONS={tree:'🌳',house:'🏠',flower:'🌼',sun:'☀️',triangle:'🔺',square:'🟦',circle:'🔵',star:'⭐',person:'🧍',face:'🙂','family picture':'👨‍👩‍👧','two people':'🧑‍🤝‍🧑','family portrait':'🖼️'};
export function inkStats(ink){
 if(!validFreeInk(ink))return null;
 const points=ink.flat();if(!points.length)return null;
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const p of points){x=Math.min(x,p[0]);y=Math.min(y,p[1]);right=Math.max(right,p[0]);bottom=Math.max(bottom,p[1]);}const w=right-x,h=bottom-y;
 let length=0;for(const s of ink)for(let i=1;i<s.length;i++)length+=Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]);
 return {x,y,w,h,length,points:points.length};
}
// A real, bounded nearest-neighbour image classifier. Training examples are
// public Quick, Draw! doodles; family drawings never train or leave the device.
export function drawingVector(ink){
 const b=inkStats(ink);if(!b||Math.max(b.w,b.h)<3||b.length<8)return null;
 const size=28,pixels=new Float32Array(size*size),scale=22/Math.max(b.w,b.h);
 const point=p=>[(p[0]-b.x-b.w/2)*scale+13.5,(p[1]-b.y-b.h/2)*scale+13.5];
 const dot=(x,y)=>{for(let j=Math.max(0,Math.floor(y)-2);j<=Math.min(27,Math.ceil(y)+2);j++)for(let i=Math.max(0,Math.floor(x)-2);i<=Math.min(27,Math.ceil(x)+2);i++)pixels[j*size+i]=Math.max(pixels[j*size+i],Math.exp(-((x-i)**2+(y-j)**2)/1.8));};
 let work=0;
 for(const stroke of ink){if(!stroke.length)continue;let previous=point(stroke[0]);dot(...previous);for(const p of stroke.slice(1)){const next=point(p),n=Math.ceil(Math.hypot(next[0]-previous[0],next[1]-previous[1])*2);work+=n;if(work>30000)return null;for(let i=1;i<=n;i++)dot(previous[0]+(next[0]-previous[0])*i/n,previous[1]+(next[1]-previous[1])*i/n);previous=next;}}
 const norm=Math.sqrt(pixels.reduce((a,x)=>a+x*x,0));return Array.from(pixels,x=>Math.round(x/norm*255));
}
export function recognizeDrawing(ink,model){
 const vector=drawingVector(ink),bounds=inkStats(ink);
 if(!vector)return {label:null,candidates:[],reason:'more-ink',model:model?.version||'none'};
 if(!model?.examples?.length)return {label:null,candidates:[],reason:'unavailable',model:'none'};
 const norm=Math.sqrt(vector.reduce((n,x)=>n+x*x,0)),scores=[];
 for(const e of model.examples){let dot=0;for(let i=0;i<vector.length;i++)dot+=vector[i]*e.vector[i];scores.push({label:e.label,score:dot/(norm*e.norm)});}
 scores.sort((a,b)=>b.score-a.score);
 const byLabel=DOODLES.map(label=>{const top=scores.filter(x=>x.label===label).slice(0,3);return {label,score:top.length?top.reduce((n,x)=>n+x.score,0)/top.length:0};}).sort((a,b)=>b.score-a.score);
 const best=byLabel[0],margin=best.score-byLabel[1].score;
 const certain=best.score>=.65&&margin>=.025&&bounds.length/Math.max(bounds.w,bounds.h)<30;
 return {label:certain?best.label:null,candidates:byLabel.slice(0,3).map(x=>x.label),candidateScores:byLabel.slice(0,3),reason:certain?'guess':'unsure',similarity:Math.round(best.score*1000)/1000,margin:Math.round(margin*1000)/1000,model:model.version};
}
