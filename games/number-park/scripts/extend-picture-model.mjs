// Adds deterministic, authored stick people, faces and bare-branched trees.
// Quick, Draw! training vectors and their attribution remain unchanged.
import {readFile,writeFile} from 'node:fs/promises';
import {picturePrototype} from '../lib/picture-prototypes.mjs';
import {drawingVector} from '../lib/doodle.mjs';
const url=new URL('../data/doodle-model.json',import.meta.url),model=JSON.parse(await readFile(url));
model.examples=model.examples.filter(e=>e.source!=='authored-pictures-1');
for(const kind of ['person','face','tree'])for(let variant=0;variant<60;variant++){
 const vector=drawingVector(picturePrototype(kind,variant));
 model.examples.push({label:kind,vector,norm:Math.sqrt(vector.reduce((s,x)=>s+x*x,0)),source:'authored-pictures-1'});
}
model.version='quickdraw-plus-authored-2';model.authored={version:'authored-pictures-1',source:'lib/picture-prototypes.mjs',categories:['person','face','tree'],examples:180};
// Historical evaluation is explicitly scoped to its original eight-class model.
if(model.evaluation&&!model.previousEvaluation){model.previousEvaluation={...model.evaluation,model:'quickdraw-neighbours-1'};delete model.evaluation;}
await writeFile(url,JSON.stringify(model));
