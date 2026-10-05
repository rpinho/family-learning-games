import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';

// Never relay scanner stdout/stderr: both tools can include raw secrets or identities.
export function secretScan({root, snapshot, base, head='HEAD', run=spawnSync}) {
 const scratch=mkdtempSync(join(tmpdir(),'public-secret-scan-')), issues=[];
 const invoke=(tool,args,parse,good)=>{
  const binary=existsSync('/opt/homebrew/bin/'+tool)?'/opt/homebrew/bin/'+tool:tool;
  const result=run(binary,args,{cwd:root,encoding:'utf8',maxBuffer:256*1024*1024,timeout:600000,env:{...process.env,GITLEAKS_CONFIG:'',GITLEAKS_CONFIG_TOML:''}});
  const before=issues.length;
  try {parse(result.stdout||'');}catch {issues.push(`${tool}:1: invalid scanner report (details withheld)`);}
  if(result.error||!good.includes(result.status)||[1,183].includes(result.status)&&issues.length===before)issues.push(`${tool}:1: scanner failed (exit ${result.status??'unavailable'}; details withheld)`);
 };
 try {
  writeFileSync(join(scratch,'empty-ignore'),'');
  for(const [mode,target,opts] of [['dir',snapshot,[]],['git',root,[`--log-opts=${base?base+'..':''}${head}`]]]){
   const report=join(scratch,mode+'.json');
   invoke('gitleaks',[mode,target,...opts,'--redact=100','--no-banner','--no-color','--ignore-gitleaks-allow',`--gitleaks-ignore-path=${join(scratch,'empty-ignore')}`,'--max-archive-depth=3','--report-format=json',`--report-path=${report}`],()=>{
    if(!existsSync(report))throw Error('Missing report');
    const hits=JSON.parse(readFileSync(report,'utf8'))||[];
    for(const hit of hits)issues.push(`${hit.File.startsWith(snapshot+'/')?hit.File.slice(snapshot.length+1):hit.File}:${hit.StartLine||1}: gitleaks ${hit.RuleID}${hit.Commit?' (commit '+hit.Commit.slice(0,12)+')':''}`);
   },[0,1]);
  }
  // Modern equivalent of --only-verified=false. Verification is disabled so candidate
  // secrets never leave this machine; unverified/unknown findings also block publication.
  const common=['--json','--no-update','--no-verification','--results=verified,unknown,unverified,filtered_unverified','--no-filter-unverified','--no-ignore-tag','--fail','--fail-on-scan-errors'];
  for(const args of [['filesystem',snapshot,...common],['git',pathToFileURL(root).href,...(base?[`--since-commit=${base}`]:[]),`--branch=${head}`,'--skip-additional-refs',...common]]){
   invoke('trufflehog',args,out=>{for(const line of out.split('\n').filter(Boolean)){
    const hit=JSON.parse(line),data=hit.SourceMetadata?.Data||{},source=data.Git||data.Filesystem||{};
    let file=source.file||source.path||'trufflehog';
    if(file.startsWith(snapshot+'/'))file=file.slice(snapshot.length+1);
    issues.push(`${file}:${source.line||1}: trufflehog ${hit.DetectorName||'secret'}${source.commit?' (commit '+source.commit.slice(0,12)+')':''}`);
   }},[0,183]);
  }
 }finally{rmSync(scratch,{recursive:true,force:true});}
 return issues;
}
