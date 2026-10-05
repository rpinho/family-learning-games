#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,copyFileSync,existsSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadPolicy} from './public-privacy.mjs';
import {exportLive} from './public-export.mjs';
import {checkTree,privacyIssues,denied,policyFile} from './public-policy.mjs';

export function publishPrepared({cwd,base,branch,title,gh,run=(exe,args,options={})=>{
 if(exe==='npm'||exe===process.execPath){
  if(process.platform==='darwin')return execFileSync('nice',['-n','19','taskpolicy','-b',exe,...args],{cwd,stdio:'inherit',...options});
  if(process.platform==='linux')return execFileSync('nice',['-n','19',exe,...args],{cwd,stdio:'inherit',...options});
 }
 return execFileSync(exe,args,{cwd,stdio:'inherit',...options});
}}){
 // No network mutation is permitted until every check and the commit scan passes.
 run('git',['add','--all']);
 let checked=checkTree(cwd);
 if(checked.issues.length)throw Error('Public sync refused:\n'+checked.issues.join('\n'));
 run('npm',['run','setup']);run('npm',['test']);

 run(process.execPath,['scripts/check-public-tree.mjs','--base',base]);
 const changes=execFileSync('git',['diff','--cached','--name-only'],{cwd}).toString().trim();
 if(!changes)throw Error('No public changes to publish.');
 const message='Sync public game engines and fictional demos';
 if(denied.some(t=>message.toLowerCase().includes(t)))throw Error('Unsafe commit message');
 run('git',['-c','user.name=Public Games Maintainer','-c','user.email=public-games@example.invalid','commit','-m',message]);
 checked=checkTree(cwd,base);
 if(checked.issues.length)throw Error('Public sync refused:\n'+checked.issues.join('\n'));
 // Inspect every newly introduced committed tree as well as the working tree.
 const commits=execFileSync('git',['rev-list',base+'..HEAD'],{cwd}).toString().trim().split('\n').filter(Boolean);
 for(const commit of commits){const files=execFileSync('git',['ls-tree','-r','--name-only',commit],{cwd}).toString().trim().split('\n');for(const file of files){const bytes=execFileSync('git',['show',commit+':'+file],{cwd,maxBuffer:128*1024*1024});const hits=privacyIssues(file,bytes);if(hits.length)throw Error('Public sync refused:\n'+hits.join('\n'));}}
 run(process.execPath,['scripts/check-public-tree.mjs','--base',base]);
 console.log(`PASS: ${checked.files} tracked files; 0 privacy hits; 0 new commit-message hits; builds and tests passed.`);
 // Use the already authenticated CLI without changing repository/global credentials.
 const helper="!'"+gh.replaceAll("'","'\\''")+"' auth git-credential";
 run('git',['push','--set-upstream','origin',branch],{env:{...process.env,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'credential.helper',GIT_CONFIG_VALUE_1:helper}});
 const scratch=mkdtempSync(join(tmpdir(),'public-sync-pr-')),body=join(scratch,'body.md');
 writeFileSync(body,'Updates the public edition with the live game engines, calm theme, world and quest engines, balance and patterns, home pages, and deployment tooling. Worlds use fictional demos and the original public cast with placeholder scenery.\n\nHousehold configuration, saved chapters and quests, day notes, profiles, learner data, photos, recordings and private artwork are excluded.\n\nValidation: privacy tree and new commit-message gates (zero hits), clean builds, full app/hub/book suites, and sync refusal tests. This PR is for review; it is not merged automatically.\n');
 try{run(gh,['pr','create','--base','main','--head',branch,'--title',title,'--body-file',body]);}finally{rmSync(scratch,{recursive:true,force:true});}
}

export function main(args=process.argv.slice(2)){
 const options={},refs={};
 for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!key?.startsWith('--')||!value||value.startsWith('--'))throw Error('Use --source-root DIR --hub SHA --number-park SHA --word-arcade SHA [other game SHAs] --out DIR [--branch NAME] [--gh PATH]');if(['hub','number-park','word-arcade','letter-quest','maze-garden','three-in-a-row','target-trail'].includes(key.slice(2)))refs[key.slice(2)]=value;else if(['source-root','out','branch','base','gh','date','prepare-only'].includes(key.slice(2)))options[key.slice(2)]=value;else throw Error('Unknown option '+key);}
 for(const key of ['hub','number-park','word-arcade'])if(!refs[key])throw Error('Missing --'+key+' live SHA');
 if(!existsSync(policyFile))throw Error('A private export policy is required; see DEPLOY.md');
 if(!options['source-root']||!options.out)throw Error('--source-root and --out are required');
 const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(options.out),base=options.base||'origin/main',date=options.date||new Date().toISOString().slice(0,10),branch=options.branch||'public/'+date.replaceAll('-','')+'-sync',gh=options.gh||join(homedir(),'dev','.bin','gh');
 if(options['prepare-only']!==undefined&&options['prepare-only']!=='true')throw Error('--prepare-only accepts only true');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Use an ISO date');
 if(existsSync(out))throw Error('Output directory already exists: choose a new worktree');
 const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8'});
 if(git(['status','--porcelain']).trim())throw Error('Run from a clean public checkout');
 // Refresh only public main. Private refs are never fetched into public history.
 git(['fetch','origin','main']);git(['check-ref-format','--branch',branch]);
 const baseSha=git(['rev-parse','--verify',base+'^{commit}']).trim();
 if(baseSha!==git(['rev-parse','origin/main']).trim())throw Error('The base must be the current public origin/main; private ancestry is forbidden');
 git(['worktree','add','-b',branch,out,baseSha]);
 // Seed only the clean, audited PUBLIC edition, never a private branch or history.
 const trusted=checkTree(repository);if(trusted.issues.length)throw Error('Public recipe refused:\n'+trusted.issues.join('\n'));
 const approved=git(['ls-files','-z']).split('\0').filter(Boolean),approvedSet=new Set(approved);
 for(const file of execFileSync('git',['ls-files','-z'],{cwd:out,encoding:'utf8'}).split('\0').filter(Boolean))if(!approvedSet.has(file))rmSync(join(out,file));
 for(const file of approved){mkdirSync(dirname(join(out,file)),{recursive:true});copyFileSync(join(repository,file),join(out,file));}
 const count=exportLive({target:out,sourceRoot:resolve(options['source-root']),refs});
 console.log(`Exported ${count} code files into ${branch}.`);
 if(options['prepare-only']==='true'){execFileSync('git',['add','--all'],{cwd:out});const gate=checkTree(out);if(gate.issues.length)throw Error('Public sync refused:\n'+gate.issues.join('\n'));console.log('Prepared for local review; no push or PR.');return out;}
 publishPrepared({cwd:out,base:baseSha,branch,title:'Sync public repo with live ('+date+')',gh});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{main();}catch(e){
 if(/^Public (?:sync|export|recipe) refused:\n/.test(e.message)){
  try{const terms=loadPolicy().terms;for(let issue of e.message.split('\n').slice(1)){
   for(const term of terms)issue=issue.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[withheld]');
   issue=issue.replace(/^([^:]+): (.*)$/,'$1:1: $2').replace(/[\x00-\x1f\x7f]/g,'?');console.error(issue);
  }}catch{console.error('public-sync:1: privacy refusal (private policy unavailable)');}
 }else console.error('public-sync:1: publication refused (run npm run check:privacy for safe findings; command failures appear above)');
 process.exitCode=1;
}}
