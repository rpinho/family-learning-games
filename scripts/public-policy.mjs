import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
// Encoded entries keep the scanner's own source free of its forbidden vocabulary.
// This is an explicit export policy, not a claim that a denylist replaces review.
const decode=x=>Buffer.from(x,'hex').toString();
export const policyFile=process.env.PUBLIC_SYNC_POLICY||join(homedir(),'.config/family-public-sync/privacy.json');
const local=existsSync(policyFile)?JSON.parse(readFileSync(policyFile,'utf8')):{};
if(local.replacements&&!local.replacements.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='string'&&v.length)))throw Error('Invalid private export policy');
const common=[["6d616e2077697468207468652079656c6c6f7720686174", "grown-up"], ["636f6f6b69652d6d6f6e73746572", "snack-friend"], ["636f6f6b6965206d6f6e73746572", "Snack Friend"], ["6269672d70696b61636875", "pip"], ["63686172697a617264", "dragon"], ["706f6b656d6f6e", "forest-friend"], ["706f6bc3a96d6f6e", "forest-friend"], ["70696b61636875", "pip"], ["67656f726765", "bo"], ["626c756579", "pip"], ["70696b61", "Pip"]].map(([a,b])=>[decode(a),b]);
export const replacements=[...common,...(local.replacements||[])].sort((a,b)=>b[0].length-a[0].length);
export const denied=replacements.filter(([a])=>a!==decode('70696b61')).map(([a])=>a).concat([decode('7461696c7363616c65')]);
export const privatePath=/(^|\/)(?:node_modules|\.data|logs|\.openai|\.env[^/]*|voice|voices|__pycache__|profiles|chapters|day-notes|learner-data)(?:\/|$)|\.(?:jsonl|pem|key|mov|pdf|map|pyc|glb)$/i;
export function privacyIssues(file,bytes){
 const issues=[];if(privatePath.test(file))issues.push(file+': forbidden runtime/private file');
 const text=bytes.toString('utf8'),hay=(file+'\n'+text).toLowerCase();
 if(denied.some(term=>hay.includes(term)))issues.push(file+': forbidden identity or character term');
 for(const [pattern,label] of [
  [/\/Users\/[^/\s]+\//,'absolute personal path'],
  [/\b(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)\b/,'private network address'],
  [/\b[a-z0-9-]+-mac-[a-z0-9-]+\.local\b/i,'private machine host'],
  [/[a-z0-9-]+\.tail[a-z0-9]+\.ts\.net/i,'private deployment host'],
  [/anonymi[sz]ed/i,'projected household data; replace with synthetic fixtures'],
  [/\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_\-]{16,}/,'possible credential'],
  [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,'private key']
 ])if(pattern.test(text))issues.push(file+': '+label);
 return issues;
}
export function checkTree(root,base){
 const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024});
 const files=git(['ls-files','-z']).toString().split('\0').filter(Boolean),issues=[];
 for(const file of files)issues.push(...privacyIssues(file,readFileSync(join(root,file))));
 if(base){const messages=git(['log','--format=%B',base+'..HEAD']).toString();if(denied.some(t=>messages.toLowerCase().includes(t)))issues.push('commit messages: forbidden identity or character term');}
 return {files:files.length,issues};
}
export function sanitize(text){
 // Household annotations are removed rather than republished under generic names.
 text=text.split('\n').filter(line=>!(/^\s*(?:\/\/|#|\*)/.test(line)&&denied.some(t=>line.toLowerCase().includes(t)))).join('\n');
 for(const [a,b]of replacements)text=text.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),s=>s===s.toUpperCase()?b.toUpperCase():s[0]===s[0].toUpperCase()?b[0].toUpperCase()+b.slice(1):b.toLowerCase());
 return text;
}
