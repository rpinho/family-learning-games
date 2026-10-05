import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const hash=s=>createHash('sha256').update(s).digest('hex');
const names=new Set(JSON.parse(readFileSync(new URL('./privacy-data/given-names.sha256.json',import.meta.url),'utf8')));
const policy=JSON.parse(readFileSync(new URL('./public-name-allowlist.json',import.meta.url),'utf8'));
if(names.size<1000||!['people','handles'].every(key=>Array.isArray(policy[key])&&policy[key].every(e=>Array.isArray(e.names)&&e.names.length&&e.names.every(n=>typeof n==='string'&&n.trim())&&typeof e.reason==='string'&&e.reason.trim())))throw Error('public name policy is invalid');
const allowed=new Set(policy.people.flatMap(entry=>entry.names).map(name=>name.toLowerCase()));
const handles=new Set(policy.handles.flatMap(entry=>entry.names));
const reviewed=JSON.parse(readFileSync(new URL('./public-text-reviews.json',import.meta.url),'utf8'));
const reviewIndex=new Map();
for(const entry of reviewed){const key=entry.file+'\0'+entry.ruleHash;const rows=reviewIndex.get(key)||[];rows.push(entry);reviewIndex.set(key,rows);}
const nameCache=new Map();
const word='[\\p{Lu}][\\p{L}\\p{M}]*(?:[-’\u0027][\\p{Lu}][\\p{L}\\p{M}]*)?';
const familyPatterns=[
 [/\b(?:my|our)\s+(?:sons?|daughters?|wife|husband|boys?|kids?|children|family)\b/gi,'household relationship'],
 [/\bI(?:['’]m|\s+(?:am|was|live|work|earn|paid|want|would|have))\b/gi,'personal-life statement'],
 [/\b(?:adhd|ot|autism|autistic|neurofeedback|sleep\s+study|occupational\s+therap(?:y|ist)|diagnos(?:is|ed|es)|therap(?:y|ist))\b/gi,'diagnosis or therapy'],
 [/\b(?:schools?|after[ -]?care|classrooms?|teachers?)\b/gi,'school context'],
 [/\b(?:driveway|porch|our\s+street|our\s+house|our\s+home)\b/gi,'home context'],
 [/\b(?:health|medical|medications?|hospitals?|illness|doctors?|anxiety|fever|asthma|epilepsy|depression|insomnia|sleep\s+(?:problem|disorder|trouble)|insurance)\b/gi,'health context'],
 [/\b(?:money|salary|income|mortgage|debt|tuition|bank\s+account|paid\s+\$?\d)\b|(?<![\w])\$\d[\d,.]*/gi,'money context'],
 // Broad on purpose: all child age/grade combinations require review, so no
 // household ages or grades need to appear in this public rule source.
 [/\b(?:age[ds]?["']?\s*[:=]?\s*["']?\d{1,2}|\d{1,2}[ -]years?[ -]old|(?:four|five|six|seven|eight|nine|ten|eleven|twelve)[ -]years?[ -]old|\d{1,2}\s*yo)\b[\s\S]{0,100}\b(?:grade|kindergarten|pre[ -]?k|year\s+\d{1,2})\b|\b(?:grade|kindergarten|pre[ -]?k|year\s+\d{1,2})\b[\s\S]{0,100}\b(?:age[ds]?["']?\s*[:=]?\s*["']?\d{1,2}|\d{1,2}[ -]years?[ -]old|(?:four|five|six|seven|eight|nine|ten|eleven|twelve)[ -]years?[ -]old|\d{1,2}\s*yo)\b/gi,'child age and grade']
];

// Reviews are bound to exact public lines and a rule, never whole paths. A name
// review may only document a non-person homonym; people belong in the allowlist.
export function familyTextFindings(file,text,{filename=false}={}){
 const source=file.replace(/@[a-f0-9]{12}$/,'');
 const lines=text.split('\n'),out=[],seen=new Set(),starts=[0],digests=new Map();
 for(let i=0;i<text.length;i++)if(text[i]==='\n')starts.push(i+1);
 const lineAt=index=>{let lo=0,hi=starts.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(starts[mid]<=index)lo=mid;else hi=mid;}return lo+1;};
 const add=(hit,rule,value)=>{
  const line=filename?1:lineAt(hit.index);
  const endLine=filename?1:lineAt(hit.index+hit[0].length-1);
  const key=line+'\0'+endLine+'\0'+rule+'\0'+value;if(seen.has(key))return;seen.add(key);
  const reviews=reviewIndex.get(source+'\0'+hash(rule));
  const digestKey=line+':'+endLine;
  if(reviews){if(!digests.has(digestKey))digests.set(digestKey,hash(filename?text:lines.slice(line-1,endLine).join('\n')));
   if(reviews.some(e=>e.sha256===digests.get(digestKey)&&e.reason?.trim()&&(!value||e.wordSha256===hash(value))))return;
  }
  out.push({line,endLine,rule,value});
 };
 for(const hit of text.matchAll(new RegExp('(?<![\\p{L}\\p{M}0-9])'+word+'(?![\\p{L}\\p{M}0-9])','gu'))){
  const token=hit[0].toLowerCase();if(!nameCache.has(token))nameCache.set(token,names.has(hash(token)));
  const known=nameCache.get(token)||token.split(/[-’']/u).some(part=>names.has(hash(part)));
  if(known&&!allowed.has(token)&&!/^['’](?:t|re|ll|ve|d|m)\b/.test(text.slice(hit.index+hit[0].length)))add(hit,'unapproved person-like name',hit[0]);
 }
 for(const hit of text.matchAll(new RegExp('(?<![\\p{L}\\p{M}])('+word+')[’\u0027]s\\b','gu'))){
  if(['It','Let','That','There','Where','Here','Who'].includes(hit[1]))continue; // Grammatical contractions.
  if(!allowed.has(hit[1].toLowerCase()))add(hit,'unapproved possessive name',hit[1]);
 }
 for(const hit of text.matchAll(/(?<![\w@])@([\w][\w.-]*)/g)){
  // Package scopes and decorators are code syntax; social handles in prose,
  // comments and strings still require an exact committed handle entry.
  const before=text.slice(text.lastIndexOf('\n',hit.index)+1,hit.index),after=text.slice(hit.index+hit[0].length);
  const packageSyntax=/\b(?:from|import|require\()\s*["']$/.test(before)||/\b(?:npm|pnpm|yarn)\s+(?:install|add)\b[^\n]*$/.test(before)||/(?:^|\/)package(?:-lock)?\.json$/.test(source);
  if(packageSyntax&&/^[\w.-]+\//.test(text.slice(hit.index+1)))continue;
  if(/^@\d+x(?:\.(?:png|jpe?g|webp|svg))?$/.test(hit[0])&&/\.(?:png|jpe?g|webp|svg)(?:$|["'`\s])/.test(text.slice(hit.index)))continue;
  if(/\.(?:css|html|m?js|[jt]sx?)$/i.test(source)&&/(?:^|[};{])\s*$/.test(before)&&['@media','@keyframes','@supports','@import','@font-face','@container','@charset','@layer','@property','@starting-style'].includes(hit[0])&&/^\s*[^"'`\n]/.test(after))continue;
  if(/\.(?:m?js|[jt]sx?)$/i.test(source)&&/^\s*(?:\/\*\*?\s*|\*\s*|\/\/\s*)$/.test(before)&&['@param','@type','@return','@returns','@default','@link','@constant','@readonly','@property','@private','@static','@name','@method','@deprecated','@abstract','@fires','@see','@augments','@extends','@constructor','@class','@module','@description','@example','@todo','@generated','@typedef','@hideconstructor','@event','@async','@license','@classdesc','@callback'].includes(hit[0]))continue;
  if(/\.(?:m?js|[jt]sx?)$/i.test(source)&&hit[0]==='@link'&&before.endsWith('{')&&/^\s+[^\s}]+(?:\s+[^}]*)?\}/.test(after))continue;
  if(/\.(?:m?js|[jt]sx?)$/i.test(source)&&hit[0]==='@__PURE__'&&/\/\*\s*$/.test(before)&&/^\s*\*\//.test(after))continue;
  if(!handles.has(hit[0]))add(hit,'unapproved handle',hit[0]);
 }
 for(const pattern of [
  new RegExp('(?<![\\p{L}\\p{M}])('+word+')\\s+(?:said|says|asked|asks|replied|wrote|whispered|shouted|told)\\b','gu'),
  new RegExp('(?:said|says|asked|replied|wrote|whispered|shouted|—|–)\\s+('+word+')\\b','gu'),
  new RegExp('^\\s*(?:[-*>]\\s*|//\\s*)?('+word+'):\\s*[“"\u0027]','gmu')
 ])for(const hit of text.matchAll(pattern))if(!allowed.has(hit[1].toLowerCase()))add(hit,'unapproved speech attribution',hit[1]);
 for(const [pattern,rule]of familyPatterns)for(const hit of text.matchAll(pattern))add(hit,rule);
 return out;
}

export function familyTextIssues(file,text,options){
 return familyTextFindings(file,text,options).map(hit=>`${file}:${hit.line}: ${hit.rule} (value withheld)`);
}
