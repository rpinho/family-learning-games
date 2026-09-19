// Downloads only a bounded prefix of eight public categories. No family data.
import {mkdir,writeFile} from 'node:fs/promises';
import {DOODLES,drawingVector,recognizeDrawing} from '../lib/doodle.mjs';
const publicCategories=DOODLES.filter(label=>!['person','face'].includes(label));
const model={version:'quickdraw-neighbours-1',source:'https://github.com/googlecreativelab/quickdraw-dataset',license:'CC BY 4.0',examples:[]},held=[];
for(const label of publicCategories){
 const response=await fetch('https://storage.googleapis.com/quickdraw_dataset/full/simplified/'+label+'.ndjson',{headers:{Range:'bytes=0-1999999'}});
 if(!response.ok)throw Error('Could not fetch '+label);
 const reader=response.body.getReader(),decoder=new TextDecoder();let text='',count=0,bytes=0;
 try{while(count<170){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2500000)break;text+=decoder.decode(value,{stream:true});let end;while((end=text.indexOf('\n'))>=0&&count<170){const row=JSON.parse(text.slice(0,end));text=text.slice(end+1);if(!row.recognized)continue;const ink=row.drawing.map(s=>s[0].map((x,i)=>[x/2.55,s[1][i]/2.55]));const vector=drawingVector(ink);if(!vector)continue;if(count++<140)model.examples.push({label,vector,norm:Math.sqrt(vector.reduce((n,x)=>n+x*x,0))});else held.push({label,ink});}}}finally{await reader.cancel();}
 if(count<170)throw Error('Too few examples for '+label);console.log(label,count);
}
const results=held.map(x=>({expected:x.label,...recognizeDrawing(x.ink,model)}));
model.evaluation={samples:results.length,top1:results.filter(x=>x.candidates[0]===x.expected).length,offered:results.filter(x=>x.label).length,correctOffered:results.filter(x=>x.label===x.expected).length,byCategory:publicCategories.map(label=>({label,total:results.filter(x=>x.expected===label).length,top1:results.filter(x=>x.expected===label&&x.candidates[0]===label).length}))};
await mkdir(new URL('../data/',import.meta.url),{recursive:true});await writeFile(new URL('../data/doodle-model.json',import.meta.url),JSON.stringify(model));
console.log(JSON.stringify(model.evaluation));

// People and faces use authored examples, never private artwork or unsupported downloads.
await import('./extend-picture-model.mjs');
