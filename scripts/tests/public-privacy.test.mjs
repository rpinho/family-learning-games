import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {textIssues,metadataFindings,runGate,loadPolicy} from '../public-privacy.mjs';
import {secretScan} from '../public-secrets.mjs';

const fakeName=['Fictional','Therapist'].join(' ');
test('PII detects private identities, file names and generic contact/location data without echoing values',()=>{
 const examples=[fakeName,['someone','private','test'].join('@').replace('@private@','@private.'),['212','867','4321'].join('-'),[123,'Example','Street'].join(' '),['90210','Exampletown'].join(' '),['100','80','2','3'].join('.'),['mini','local'].join('.'),['/Users','fictional','photo'].join('/'),'DOB: '+['2001','02','03'].join('/')];
 for(const value of examples){const hits=textIssues('sample.txt',Buffer.from('safe\n'+value),[fakeName]);assert.ok(hits.length,value);assert.ok(hits.every(s=>s.startsWith('sample.txt:2:')));assert.ok(hits.every(s=>!s.includes(value)));}
 assert.ok(textIssues(fakeName+'.png',Buffer.from(''),[fakeName]).length);
 assert.ok(textIssues('picture.svg',Buffer.from('<svg><text>'+examples[1]+'</text></svg>')).some(s=>s.includes('email')));
 assert.equal(textIssues('geometry.svg',Buffer.from('<svg><path d="M3.6.9.68 '+[820,900,1000].join(' ')+'"/></svg>')).length,0);
 assert.equal(textIssues('safe.md',Buffer.from('test@example.invalid http://localhost:4810/ 127.0.0.1 0.0.0.0')).length,0);
});
test('identifying EXIF rejected, filesystem timestamps ignored',()=>{
 const tags={'EXIF:GPSLatitude':42,'EXIF:Make':'Synthetic camera','EXIF:Artist':fakeName,'EXIF:DateTimeOriginal':'2000:01:01 00:00:00','System:FileModifyDate':'today','PNG:ImageWidth':32};
 assert.equal(metadataFindings(tags).length,4);
});
test('missing private policy fails closed',()=>assert.throws(()=>loadPolicy('/nonexistent-private-policy'),/missing/));
test('scanner failures and every unverified secret fail closed without raw output',()=>{
 const dir=mkdtempSync(join(tmpdir(),'secret-test-'));
 try{
 const args=[];
 const result=secretScan({root:dir,snapshot:dir,base:'base',run:(exe,a)=>{args.push(a);if(exe.includes('gitleaks'))return {status:2,stdout:'RAW PRIVATE DATA'};return {status:183,stdout:JSON.stringify({DetectorName:'Synthetic',Raw:'NEVER PRINT ME',Verified:false,SourceMetadata:{Data:{Filesystem:{file:join(dir,'secret.txt'),line:7}}}})};}});
 assert.ok(result.includes('secret.txt:7: trufflehog Synthetic'));
 assert.ok(result.some(s=>s.includes('scanner failed')));
 assert.ok(result.every(s=>!s.includes('NEVER PRINT')&&!s.includes('RAW PRIVATE')));
 assert.ok(args.some(a=>a.includes('--no-verification')&&a.includes('--no-ignore-tag')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('full gate catches historical identity, untracked file, fake EXIF and transformed private photo',async t=>{
 const root=mkdtempSync(join(tmpdir(),'public-privacy-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=args=>execFileSync('git',args,{cwd:root});git(['init','-q']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);
 writeFileSync(join(root,'safe.txt'),'safe');git(['add','.']);git(['commit','-qm','Synthetic base']);const base=git(['rev-parse','HEAD']).toString().trim();
 writeFileSync(join(root,'old.txt'),fakeName);git(['add','.']);git(['commit','-qm',fakeName]);rmSync(join(root,'old.txt'));git(['add','.']);git(['commit','-qm','Clean final tree']);
 writeFileSync(join(root,'untracked.txt'),fakeName);
 const recording=join(root,'voice.wav');writeFileSync(recording,Buffer.alloc(100));
 const refs=join(root,'.private'),review=join(root,'.review');mkdirSync(refs);mkdirSync(review);
 const policy=join(root,'.policy.json');writeFileSync(policy,JSON.stringify({denied:[fakeName]}));
 writeFileSync(join(root,'.gitignore'),'.private/\n.review/\n.policy.json\n');
 const python=join(homedir(),'.local/share/family-public-sync/venv/bin/python');
 execFileSync(python,['-c',`from PIL import Image, ImageDraw
from pathlib import Path
im=Image.new('RGB',(160,120),'white');d=ImageDraw.Draw(im)
for i in range(12):d.rectangle((i*13, i*7, i*13+10, i*7+24), fill=(i*20,30,200-i*10))
im.save(${JSON.stringify(join(refs,'fake.png'))})
exif=Image.Exif();exif[271]='Synthetic Camera';exif[306]='2000:01:01 00:00:00'
im.resize((320,240)).save(${JSON.stringify(join(root,'derivative.jpg'))},exif=exif)
import resvg_py
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">'+''.join('<rect x="%d" y="%d" width="10" height="24" fill="rgb(%d,30,%d)"/>'%(i*13,i*7,i*20,200-i*10) for i in range(12))+'</svg>'
Path(${JSON.stringify(join(root,'vector.svg'))}).write_text(svg)
Path(${JSON.stringify(join(refs,'composed.svg'))}).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><image href="fake.png" width="160" height="120"/></svg>')
Path(${JSON.stringify(join(refs,'vector-reference.png'))}).write_bytes(resvg_py.svg_to_bytes(svg_string=svg,width=512,height=512))`]);
 const result=await runGate({root,base,policyPath:policy,reviewDir:review,referenceRoots:[refs],scanSecrets:()=>[]});
 assert.ok(result.issues.some(s=>s.includes('untracked.txt:1:')));
 assert.ok(result.issues.some(s=>s.includes('old.txt@')));
 assert.ok(result.issues.some(s=>s.includes('/message:1:')));
 assert.ok(result.issues.some(s=>s.includes('identifying media metadata')));
 assert.ok(result.issues.some(s=>s.includes('near-duplicate')));
 assert.ok(result.issues.some(s=>s.startsWith('vector.svg:1: near-duplicate')));
 assert.ok(!result.issues.some(s=>s.includes('unreadable private image')));
 assert.ok(result.issues.some(s=>s.includes('voice.wav:1: possible speech')));
 assert.ok(result.issues.every(s=>!s.includes(fakeName)));
 assert.ok(readFileSync(result.review,'utf8').includes('derivative.jpg'));
 writeFileSync(policy,JSON.stringify({denied:[fakeName],mediaReviews:{[createHash('sha256').update(readFileSync(recording)).digest('hex')]:{kind:'synthetic-audio',reason:'Synthetic fixture',reviewer:'Test'}}}));
 const stripped=await runGate({root,base,strip:true,policyPath:policy,reviewDir:review,referenceRoots:[refs],scanSecrets:()=>[]});
 assert.ok(!stripped.issues.some(s=>s.includes('identifying media metadata')));
 assert.ok(!stripped.issues.some(s=>s.includes('possible speech')));
 writeFileSync(recording,Buffer.alloc(101));
 const changed=await runGate({root,base,policyPath:policy,reviewDir:review,referenceRoots:[refs],scanSecrets:()=>[]});
 assert.ok(changed.issues.some(s=>s.includes('voice.wav:1: possible speech')));
});
