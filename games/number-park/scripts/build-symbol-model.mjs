// Offline bootstrap from our existing authored manuscript centerlines. No child
// examples or external services are used to build this model.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {drawingVector} from '../lib/doodle.mjs';
const source=process.argv[2]||'../letter-quest/public/engine.mjs';
const {GLYPHS}=await import(pathToFileURL(source));
const glyphs=structuredClone(GLYPHS);
const variants={
 '1':[[[[50,15],[50,85]]],[[[35,30],[50,15],[50,85]]]],
 'I':[[[[50,15],[50,85]]]],
 'a':[[[[70,50],[60,38],[40,38],[28,50],[28,70],[40,82],[58,82],[70,70],[70,38],[70,85]]]],
 '4':[[[[65,15],[65,85]],[[25,15],[25,55],[80,55]]]],
 '3':[[[[25,20],[60,15],[78,28],[70,40],[30,50],[66,55],[80,70],[63,85],[25,80]]]],
 '6':[[[[68,12],[53,24],[40,42],[31,62],[30,78],[36,87],[48,88],[55,82],[53,70],[45,59],[32,52]]],[[[65,15],[50,28],[35,53],[28,73],[32,85],[46,89],[60,83],[65,71],[56,59],[44,57],[30,65]]]],
 '7':[[[[23,15],[78,15],[40,85]],[[32,48],[70,48]]],[[[17,27],[46,24],[77,20],[82,23],[73,35],[53,55],[24,82]]],[[[20,20],[80,20],[20,85]]]],
};
const examples=[];
for(const [label,ink] of Object.entries(glyphs))for(const shape of [ink,...(variants[label]||[])]){
 for(const [angle,shear,aspect] of [[0,0,1],[-.12,0,1],[.12,0,1],[0,-.18,1],[0,.18,1],[0,0,.3],[0,0,.45],[0,0,.55],[0,0,.7],[0,0,1.3],[-.07,-.1,.85],[.07,.1,1.15]]){
  const points=shape.map(s=>s.map(([x,y])=>{const a=(x-50)*aspect+(y-50)*shear,b=y-50;return [Math.max(0,Math.min(100,50+a*Math.cos(angle)-b*Math.sin(angle))),Math.max(0,Math.min(100,50+a*Math.sin(angle)+b*Math.cos(angle)))];}));
  const vector=drawingVector(points);examples.push({label,vector,norm:Math.sqrt(vector.reduce((s,v)=>s+v*v,0))});
 }
}
await writeFile(new URL('../data/symbol-model.json',import.meta.url),JSON.stringify({version:'manuscript-symbols-2',source:'Family-authored Letter Quest manuscript centerlines and authored common handwriting variants, with rotation, slant and width variants. Not trained on children.',glyphs,examples}));
console.log(JSON.stringify({classes:Object.keys(glyphs).length,examples:examples.length}));
