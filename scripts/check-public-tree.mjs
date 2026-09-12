import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean),issues=[];
const forbidden=/(^|\/)(node_modules|\.data|logs|\.openai|\.env[^/]*|voice)(\/|$)|\.(jsonl|pem|key|mov|pdf|map)$/i;
const patterns=[[/\/Users\/[^/\s]+\//g,'absolute personal path'],[/\b192\.168\.\d+\.\d+\b/g,'private LAN address'],[/\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_\-]{16,}/g,'possible credential'],[/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g,'private key']];
for(const file of files){
 if(forbidden.test(file))issues.push(file+': forbidden runtime/private file');
 if(file==='scripts/check-public-tree.mjs')continue;
 const text=readFileSync(file).toString('utf8');
 for(const [pattern,label]of patterns){pattern.lastIndex=0;if(pattern.test(text))issues.push(file+': '+label);}
}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(`Checked ${files.length} tracked files for runtime data, home paths and common secret patterns. Manual privacy review is still required.`);
