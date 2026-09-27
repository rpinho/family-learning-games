import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean),issues=[];
const forbidden=/(^|\/)(node_modules|\.data|logs|\.openai|\.env[^/]*|voice)(\/|$)|\.(jsonl|pem|key|mov|pdf|map)$/i;
const patterns=[[/\/Users\/[^/\s]+\//g,'absolute personal path'],[/\b192\.168\.\d+\.\d+\b/g,'private LAN address'],[/\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_\-]{16,}/g,'possible credential'],[/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g,'private key']];
// Characters that belong to someone else (the children's Pokemon and Curious George plush friends) are drawn only as
// PRIVATE household art under ~/.local/share/family-games (book art, 3D looks, standees); the public edition uses
// its own generic friends. No picture, model or drawing script of them may ever be tracked.
const privateArt=/(pikachu|charizard|curious[-_ ]?george|george|stretch-monkey)[^/]*\.(svg|png|webp|jpe?g|gif|glb|gltf|usdz)$|(^|\/)(pikachu|george|charizard)\.py$/i;
const privateArtText=/curious george|pikachu|charizard/i;
for(const file of files){
 if(forbidden.test(file))issues.push(file+': forbidden runtime/private file');
 if(privateArt.test(file))issues.push(file+': private character art (keep it under ~/.local/share/family-games only)');
 if(/\.svg$/i.test(file)&&privateArtText.test(readFileSync(file).toString('utf8')))issues.push(file+': drawing of a private character');
 if(file==='scripts/check-public-tree.mjs')continue;
 const text=readFileSync(file).toString('utf8');
 for(const [pattern,label]of patterns){pattern.lastIndex=0;if(pattern.test(text))issues.push(file+': '+label);}
}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(`Checked ${files.length} tracked files for runtime data, home paths and common secret patterns. Manual privacy review is still required.`);
