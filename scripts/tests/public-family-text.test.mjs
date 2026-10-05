import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {familyTextIssues} from '../public-family-text.mjs';
import {privateGitleaksConfig,privateTermScan} from '../public-private-terms.mjs';
import {runGate} from '../public-privacy.mjs';
import {textIssues} from '../public-privacy.mjs';
import {createHash} from 'node:crypto';

// Invented subjects only. Familiar given-name spellings are assembled here so
// the corpus can be exercised without approving them as public story characters.
const unknown=['J','e','n','n','i','f','e','r'].join(''),novel=['Zor','pline'].join('');
test('unknown given names, possessives, handles and speech attributions block with safe locations',()=>{
 for(const text of [unknown,unknown.toUpperCase(),unknown+'-'+novel,novel+"'s kite",'@'+novel,'“Hello,” said '+novel,novel+' said “Hello.”',novel+': “Hello.”']){
  const issues=familyTextIssues('example.md','safe\n'+text);
  assert.ok(issues.length,text);assert.ok(issues.every(x=>x.startsWith('example.md:2:')));
  assert.ok(issues.every(x=>!x.includes(unknown)&&!x.includes(novel)));
 }
 assert.equal(familyTextIssues('example.md','River said “Hello.” Robin’s kite belongs to Ada.').length,0);
 assert.ok(familyTextIssues(unknown+'.md',unknown+'.md',{filename:true}).length);
});
test('code syntax handles are distinguished from unapproved handles in comments and strings',()=>{
 assert.equal(familyTextIssues('example.mjs','/**\n * @param {string} value\n */\nimport x from "@example/pkg";').length,0);
 assert.equal(familyTextIssues('example.css','@media (min-width: 20px) {}\n@keyframes turn {}').length,0);
 for(const text of ['// contact @'+novel,'const contact="@'+novel+'";'])assert.ok(familyTextIssues('example.mjs',text).some(x=>x.includes('handle')));
 assert.ok(familyTextIssues('example.md','contact @'+novel+'/photos').some(x=>x.includes('handle')));
});
test('nameless family specifics require review',()=>{
 for(const text of ['my son','our wife','I live in a small town','driveway','our street','aftercare','school','health','money','ADHD','autism','OT','neurofeedback','sleep study','age 11, grade 5','grade 5, 11-year-old','"age": 11,\n"grade": "fifth"','eleven-year-old in grade five']){
  assert.ok(familyTextIssues('example.md',text).length,text);
 }
});
test('an edited reviewed line loses its review and private terms override public cast names',async t=>{
 const reviews=JSON.parse(readFileSync(new URL('../public-text-reviews.json',import.meta.url),'utf8'));
 const digest=s=>createHash('sha256').update(s).digest('hex');
 const entry=reviews.find(x=>x.ruleHash===digest('unapproved person-like name'));assert.ok(entry);
 const text=readFileSync(new URL('../../'+entry.file,import.meta.url),'utf8').split('\n').find(line=>{
  const {createHash}=process.getBuiltinModule('node:crypto');return createHash('sha256').update(line).digest('hex')===entry.sha256;
 });assert.ok(text);
 assert.ok(familyTextIssues(entry.file,text+' '+unknown).some(x=>x.includes('person-like')));
 assert.ok(textIssues('example.md',Buffer.from('River'),['River']).some(x=>x.includes('private denylist')));
 const root=mkdtempSync(join(tmpdir(),'family-public-text-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=a=>execFileSync('git',a,{cwd:root});git(['init','-q']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);
 writeFileSync(join(root,'safe.txt'),'safe');git(['add','.']);git(['commit','-qm','Synthetic base']);const base=git(['rev-parse','HEAD']).toString().trim();
 writeFileSync(join(root,'old.md'),unknown);git(['add','.']);git(['commit','-qm','Synthetic history']);rmSync(join(root,'old.md'));git(['add','.']);git(['commit','-qm','Clean final tree']);
 const result=await runGate({root,base,publicTextOnly:true,scanSecrets:()=>assert.fail('secrets are separate')});
 assert.ok(result.issues.some(x=>x.includes('old.md@')&&x.includes('person-like')));
});
test('private regex generation escapes TOML/RE2 and refuses missing or empty policy',()=>{
 const term='Synthetic [A+B]. "Road" \\ test';const config=privateGitleaksConfig([term]);
 assert.match(config,/family-private-0/);assert.ok(!config.includes('useDefault'));
 for(const value of [[],[''],null,['a',42]])assert.throws(()=>privateGitleaksConfig(value));
});
test('temporary private rules and reports stay local, are redacted, and are removed on scanner failure',t=>{
 const root=mkdtempSync(join(tmpdir(),'family-rules-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 let configPath;
 const result=privateTermScan({root,snapshot:root,base:'base',terms:['Synthetic Clinic'],run:(exe,args)=>{
  configPath=args.find(a=>a.startsWith('--config=')).slice(9);
  assert.equal(statSync(configPath).mode&0o777,0o600);assert.ok(readFileSync(configPath,'utf8').includes('Synthetic Clinic'));
  assert.ok(args.includes('--redact=100'));assert.ok(args.includes('--ignore-gitleaks-allow'));
  return {status:2,stdout:'PRIVATE RAW OUTPUT',stderr:'PRIVATE RAW OUTPUT'};
 }});
 assert.ok(result.some(x=>x.includes('scanner failed')));assert.ok(result.every(x=>!x.includes('PRIVATE RAW')));assert.equal(existsSync(configPath),false);
});
test('real custom gitleaks rules catch removed private terms in earlier PR commits',t=>{
 const binary=existsSync('/opt/homebrew/bin/gitleaks')?'/opt/homebrew/bin/gitleaks':'gitleaks';
 assert.equal(spawnSync(binary,['version']).status,0,'Install gitleaks to run this integration test');
 const root=mkdtempSync(join(tmpdir(),'family-history-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=a=>execFileSync('git',a,{cwd:root});git(['init','-q']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);
 writeFileSync(join(root,'safe.txt'),'safe');git(['add','.']);git(['commit','-qm','Synthetic base']);const base=git(['rev-parse','HEAD']).toString().trim();
 const terms=['Synthetic Clinic','Invented [A+B] Lane','River'];writeFileSync(join(root,'old.txt'),terms.join('\n'));git(['add','.']);git(['commit','-qm','Synthetic range']);
 rmSync(join(root,'old.txt'));git(['add','.']);git(['commit','-qm','Clean tree']);
 const snapshot=join(root,'.snapshot');mkdirSync(snapshot);writeFileSync(join(snapshot,'safe.txt'),'safe');
 const issues=privateTermScan({root,snapshot,base,terms});
 assert.equal(issues.filter(x=>x.includes('old.txt')).length,3);assert.ok(issues.every(x=>x.includes('commit ')&&!terms.some(term=>x.includes(term))));
 assert.equal(privateTermScan({root,snapshot,base:'HEAD',terms}).length,0,'range excludes prior commits');
});
