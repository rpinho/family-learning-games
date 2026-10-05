import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

export function privateGitleaksConfig(terms){
 if(!Array.isArray(terms)||!terms.length||terms.some(t=>typeof t!=='string'||!t.trim()))throw Error('private terms unavailable');
 // JSON strings are valid TOML basic strings. RE2 metacharacters are escaped;
 // stable numeric IDs reveal neither a term nor its category.
 return 'title = "Local family privacy rules"\n'+[...new Set(terms)].map((term,i)=>{
  const regex='(?i)'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return `\n[[rules]]\nid = "family-private-${i}"\ndescription = "Private household term"\nregex = ${JSON.stringify(regex)}\n`;
 }).join('');
}

// This is a family privacy scanner. Default Gitleaks secret rules run separately.
export function privateTermScan({root,snapshot,base,head='HEAD',terms,run=spawnSync}){
 const scratch=mkdtempSync(join(tmpdir(),'family-private-rules-')),issues=[];
 try{
  const config=join(scratch,'gitleaks.toml'),ignore=join(scratch,'empty-ignore');
  writeFileSync(config,privateGitleaksConfig(terms),{mode:0o600});writeFileSync(ignore,'',{mode:0o600});
  for(const [mode,target,opts]of [['dir',snapshot,[]],['git',root,[`--log-opts=${base?base+'..':''}${head}`]]]){
   const report=join(scratch,mode+'.json');
   const binary=existsSync('/opt/homebrew/bin/gitleaks')?'/opt/homebrew/bin/gitleaks':'gitleaks';
   const result=run(binary,[mode,target,...opts,`--config=${config}`,'--redact=100','--no-banner','--no-color','--ignore-gitleaks-allow',`--gitleaks-ignore-path=${ignore}`,'--max-archive-depth=3','--report-format=json',`--report-path=${report}`],{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:256*1024*1024,env:{...process.env,GITLEAKS_CONFIG:'',GITLEAKS_CONFIG_TOML:''}});
   let hits;
   try{hits=JSON.parse(readFileSync(report,'utf8'));if(!Array.isArray(hits))throw Error('invalid');}
   catch{issues.push('family-gitleaks:1: missing or invalid report (details withheld)');}
   for(const hit of hits||[]){
    const file=hit.File.startsWith(snapshot+'/')?hit.File.slice(snapshot.length+1):hit.File;
    issues.push(`${file}:${hit.StartLine||1}: private household term${hit.Commit?' (commit '+hit.Commit.slice(0,12)+')':''} (value withheld)`);
   }
   if(result.error||![0,1].includes(result.status)||result.status===1&&!hits?.length)issues.push('family-gitleaks:1: scanner failed (details withheld)');
  }
 }finally{rmSync(scratch,{recursive:true,force:true});}
 return issues;
}
