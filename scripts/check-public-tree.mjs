#!/usr/bin/env node
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runGate} from './public-privacy.mjs';
export async function main(args=process.argv.slice(2)){
 const options={};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--strip')options.strip=true;
  else if(args[i]==='--all-history')options.allHistory=true;
  else if(args[i]==='--secrets-only')options.secretsOnly=true;
  else if(args[i]==='--public-text-only')options.publicTextOnly=true;
  else if(['--base','--head','--root'].includes(args[i])&&args[i+1])options[args[i].slice(2)]=args[++i];
  else throw Error('privacy-gate:1: use [--base REF] [--head REF] [--root DIR] [--strip] [--secrets-only | --public-text-only] [--all-history]');
 }
 if(options.secretsOnly&&options.publicTextOnly||options.strip&&(options.secretsOnly||options.publicTextOnly))throw Error('privacy-gate:1: incompatible modes');
 if(options.root)options.root=resolve(options.root);
 const result=await runGate(options);
 for(const issue of result.issues)console.error(issue);
 console.log(`${result.issues.length?'FAIL':'PASS'}: ${result.files} files; ${result.commits} PR commits; ${result.issues.length} findings; ${result.images} images (raster + SVG); ${result.references} private references.`);
 if(result.review)console.log(`Contact sheet: ${result.review}`);
 if(result.issues.length)process.exitCode=1;
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{console.error('privacy-gate:1: gate failed (details withheld to protect private policy)');process.exitCode=1;});
