// A local art worker can consume this manifest. Nothing here calls an image service.
import {readFile,realpath} from 'node:fs/promises';
import {join,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writePrivateFile} from './private-files.mjs';
import {bookPaths,readProfiles} from './paths.mjs';
export async function artReferences(paths=bookPaths()){
 const profiles=readProfiles(paths),out=[];
 for(const [player,p] of Object.entries(profiles)){
  if(!p.artReferences?.enabled||!p.artReferences.localOnly)continue;
  if(!/^(?:beginner|explorer)(?:_[1-9]\d{0,3})?$/.test(player))continue;
  for(const photo of p.artReferences.photos||[]){
   if(!new RegExp('^photos/'+player+'/[a-f0-9-]+\\.(png|jpg)$').test(photo))throw Error('Invalid local art reference.');
   const file=resolve(paths.book,photo),root=await realpath(paths.root),actual=await realpath(file),rel=relative(root,actual);
   if(rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep))throw Error('Art reference escaped the private data directory.');
   await readFile(actual);out.push({player,name:p.name,file:actual,role:'child-likeness',localOnly:true});
  }
 }
 return {schema:'family-local-art-references-1',localOnly:true,references:out};
}
export async function writeArtReferences(paths=bookPaths()){
 const manifest=await artReferences(paths),file=join(paths.book,'art','local-references.json');
 await writePrivateFile(paths.root,file,JSON.stringify(manifest,null,2)+'\n');return file;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await writeArtReferences());
