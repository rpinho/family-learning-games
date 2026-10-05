import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync,writeFileSync,copyFileSync,lstatSync,mkdtempSync,rmSync} from 'node:fs';
import {join,dirname,extname,resolve} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {secretScan} from './public-secrets.mjs';
import {privacyIssues,denied} from './public-policy.mjs';

const media=/\.(png|jpe?g|webp|gif|svg|bmp|tiff?|avif|heic|ico|mp4|mov|m4v|webm|avi|mkv|mp3|wav|ogg|m4a|flac|aac|aiff|opus)$/i;
const audio=/\.(mp3|wav|ogg|m4a|flac|aac|aiff|opus)$/i;
const video=/\.(mp4|mov|m4v|webm|avi|mkv)$/i;
const exceptions=JSON.parse(readFileSync(new URL('./public-pii-exceptions.json',import.meta.url),'utf8'));
const originalPath=file=>file.replace(/@[a-f0-9]{12}$/,'');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadPolicy(path=process.env.PUBLIC_SYNC_POLICY||join(homedir(),'.config/family-public-sync/privacy.json')){
 if(!existsSync(path))throw Error('privacy-policy:1: private policy missing; configure it outside the repository');
 const local=JSON.parse(readFileSync(path,'utf8'));
 const terms=[...(local.replacements||[]).map(x=>x[0]),...(local.denied||[]),...Object.values(local.denylist||{}).flat()];
 if(!terms.length||terms.some(x=>typeof x!=='string'||!x.trim()))throw Error('privacy-policy:1: empty or invalid private denylist');
 return {...local,terms:[...new Set([...terms,...denied])]};
}
const patterns=[
 [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'email'],
 [/(?<![\w.])(?:\+?\d{1,3}[ .-])?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?!\d)/g,'phone number'],
 [/\b\d{1,6}\s+(?:[A-Z][\w'-]*\s+){1,5}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Boulevard|Blvd\.?|Way|Place|Terrace)\b/g,'street address'],
 [/\b\d{5}(?:-\d{4})?(?:,\s+|\s+)(?:[A-Z][a-z]+\s*){1,3}\b/g,'ZIP and city'],
 [/\b(?:[A-Z][a-z]+\s+){1,3}(?:[A-Z]{2}[, ]+)?\d{5}(?:-\d{4})?\b/g,'city and ZIP'],
 [/(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g,'IP address'],
 [/(?<![\w:])(?:[a-f0-9]{1,4}:){2,7}[a-f0-9]{0,4}(?![\w:])/gi,'IPv6 address'],
 [/\b[\w.-]+\.(?:local|internal|lan|tail[\w-]+\.ts\.net)\b/gi,'private hostname'],
 [/\/Users\/[^/\s'"`<>]+(?:\/|\b)|\/home\/[^/\s'"`<>]+(?:\/|\b)|[A-Z]:\\Users\\[^\\\s]+/gi,'absolute home path'],
 [/\b(?:DOB|date\s+of\s+birth|birth[_ -]?date|born|birthday)\s*[:=]?\s*["']?(?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,'date of birth']
];
function synthetic(value,label){
 if(label==='ZIP and city')return /\bHz\b/.test(value);
 if(label==='email')return /@(?:example\.(?:com|org|net|invalid)|[\w.-]+\.invalid)$/i.test(value);
 if(label==='phone number')return /^(?:\+1[ .-]?)?(?:202[ .-]|\(202\)[ .-]?)555[ .-]01[0-9]{2}$/.test(value);
 if(label==='IP address')return value==='0.0.0.0'||value==='127.0.0.1'||/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./.test(value)||value.split('.').some(n=>+n>255);
 if(label==='IPv6 address')return !isIP(value)||value==='::1'||value.toLowerCase().startsWith('2001:db8:');
 return false;
}
export function textIssues(file,bytes,terms=[],{scanMediaText=false}={}){
 const issues=[],texts=[[file,1],[bytes.toString('utf8'),null]];
 for(const [text,fixed] of texts){
  const lineAt=i=>fixed||text.slice(0,i).split('\n').length;
  const scanText=!fixed&&/\.svg$/i.test(originalPath(file))?text.replace(/\b(?:d|points|viewBox|x[12]?|y[12]?|cx|cy|r|rx|ry|width|height|transform)\s*=\s*(["'])([\s\S]*?)\1/g,attribute=>attribute.replace(/[^\n]/g,' ')):text;
  const excepted=(hit,label)=>exceptions.some(e=>e.file===originalPath(file)&&e.rule===label&&e.sha256===createHash('sha256').update(text.split('\n')[lineAt(hit.index)-1]).digest('hex'));
  for(const term of terms){const re=new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');for(const hit of text.matchAll(re))issues.push(`${file}:${lineAt(hit.index)}: private denylist match (value withheld)`);}
  for(const [pattern,label]of patterns)for(const hit of scanText.matchAll(pattern))if((fixed||scanMediaText||/\.svg$/i.test(originalPath(file))||!media.test(originalPath(file)))&&!synthetic(hit[0],label)&&!excepted(hit,label)&&!(label==='private hostname'&&!fixed&&/\.(?:m?js|[jt]sx?|py)$/.test(originalPath(file))&&(text.slice(Math.max(0,hit.index-2),hit.index)==='${'||/^this\./.test(hit[0])&&/^\s*\+?=/.test(text.slice(hit.index+hit[0].length))))&&!(label==='email'&&/\.(?:png|jpg|webp|svg)\b/.test(hit[0])))issues.push(`${file}:${lineAt(hit.index)}: ${label} (value withheld)`);
 }
 for(const old of privacyIssues(originalPath(file),bytes))if(old.includes('forbidden runtime/private')||old.includes('projected household'))issues.push(`${file}:1: ${old.slice(file.length+2)}`);
 return [...new Set(issues)];
}
export function metadataFindings(tags){
 return Object.keys(tags).filter(k=>!/^File:|^System:|^ExifTool:|^SourceFile$/.test(k)&&/(GPS|Location|Make$|Model$|Owner|Artist|Author|Creator|By-line|DateTimeOriginal|CreateDate|CreationDate|ModifyDate|DateCreated|TimeCreated|MediaCreateDate|TrackCreateDate|CameraSerial|SerialNumber)/i.test(k)&&tags[k]!==''&&tags[k]!==0&&tags[k]!=='0000:00:00 00:00:00');
}
const privateRoots=()=>[
 join(homedir(),'personal-kb/inbox/kids apps'),
 ...['refs','src','lib'].map(s=>join(homedir(),'.local/share/family-games/book/art',s)),
 join(homedir(),'.local/share/family-games/book/cast')
];
export async function runGate({root=resolve('.'),base=process.env.PUBLIC_SYNC_BASE||'origin/main',head='HEAD',strip=false,secretsOnly=false,allHistory=false,policyPath,reviewDir,referenceRoots,scanSecrets=secretScan}={}){
 const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:256*1024*1024});
 base=allHistory?null:git(['merge-base',base,head]).toString().trim(); // Bound both scanners to the actual PR ancestry.
 const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean))];
 const issues=[];
 const policy=secretsOnly?{terms:[]}:loadPolicy(policyPath);
 const snapshot=mkdtempSync(join(tmpdir(),'public-tree-snapshot-'));
 const safe=s=>{for(const term of policy.terms)s=s.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[withheld]');return s.replace(/[\x00-\x1f\x7f]/g,'?');};
 const startHead=git(['rev-parse',head]).toString().trim();
 const commits=git(['rev-list','--reverse',base?`${base}..${head}`:head]).toString().trim().split('\n').filter(Boolean);
 try {
  if(strip&&!secretsOnly){
   const assets=files.filter(f=>media.test(f)&&existsSync(join(root,f))&&lstatSync(join(root,f)).isFile());
   const exif=existsSync('/opt/homebrew/bin/exiftool')?'/opt/homebrew/bin/exiftool':'exiftool';
   if(assets.length){
    const tags=spawnSync(exif,['-j','-G1','-a','-s',...assets.map(f=>join(root,f))],{encoding:'utf8',maxBuffer:128*1024*1024});
    if(tags.status!==0)issues.push('exiftool:1: pre-strip metadata scanner failed');
    try{for(const data of JSON.parse(tags.stdout))if(metadataFindings(data).length){
     const result=spawnSync(exif,['-all=','-overwrite_original',data.SourceFile],{encoding:'utf8'});
     if(result.status!==0)issues.push(`${data.SourceFile.slice(root.length+1)}:1: metadata stripping failed`);
    }}catch{issues.push('exiftool:1: invalid pre-strip metadata report');}
   }
  }
  for(const file of files){const path=join(root,file);let stat;try{stat=lstatSync(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
   const parts=file.split('/');let ancestor=root,linked=false;for(const part of parts.slice(0,-1)){ancestor=join(ancestor,part);if(lstatSync(ancestor).isSymbolicLink()){linked=true;break;}}
   if(linked||!stat.isFile()){issues.push(`${file}:1: symlink or non-regular public file refused`);continue;}
   const bytes=readFileSync(path);
   if(!secretsOnly&&!media.test(file)&&(/^(?:\x89PNG|GIF8|\xff\xd8\xff|ID3|fLaC|OggS)/.test(bytes.subarray(0,16).toString('latin1'))||bytes.toString('ascii',0,4)==='RIFF'&&['WEBP','WAVE'].includes(bytes.toString('ascii',8,12))||bytes.toString('ascii',4,8)==='ftyp'))issues.push(`${file}:1: media bytes with unrecognized extension; rename for complete media review`);
   if(!secretsOnly){issues.push(...textIssues(file,bytes,policy.terms));
    if(/\.svg$/i.test(file)&&/<image\b|<foreignObject\b|\b(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(bytes.toString('utf8')))issues.push(`${file}:1: embedded or external SVG content requires separate raster/media review`);
   }
   mkdirSync(dirname(join(snapshot,file)),{recursive:true});copyFileSync(path,join(snapshot,file));
  }
  if(!secretsOnly){
   const trees=new Map(),blobIds=new Set();
   for(const commit of commits){
    issues.push(...textIssues(`commit/${commit}/message`,git(['show','-s','--format=%B',commit]),policy.terms));
    const entries=git(['ls-tree','-r','-z',commit]).toString().split('\0').filter(Boolean).map(row=>{
     const split=row.indexOf('\t'),[mode,type,oid]=row.slice(0,split).split(' ');return {mode,type,oid,file:row.slice(split+1)};
    });trees.set(commit,entries);for(const e of entries)if(e.type==='blob')blobIds.add(e.oid);
   }
   const ids=[...blobIds],objects=new Map();
   if(ids.length){
    const data=execFileSync('git',['cat-file','--batch'],{cwd:root,input:ids.join('\n')+'\n',maxBuffer:512*1024*1024});
    let offset=0;for(const oid of ids){const end=data.indexOf(10,offset),size=Number(data.subarray(offset,end).toString().split(' ')[2]);
     if(!Number.isFinite(size))throw Error('history:1: invalid blob report');offset=end+1;objects.set(oid,data.subarray(offset,offset+size));offset+=size+1;
    }
   }
   for(const [commit,entries]of trees)for(const e of entries){
    const file=`${e.file}@${commit.slice(0,12)}`;
    if(e.type!=='blob'||e.mode!=='100644'&&e.mode!=='100755'){issues.push(`${file}:1: symlink/submodule or non-regular historical file refused`);continue;}
    issues.push(...textIssues(file,objects.get(e.oid),policy.terms));
   }
  }
  for(const commit of commits){const message=join(snapshot,'_privacy_scan_commit_messages',commit+'.txt');mkdirSync(dirname(message),{recursive:true});writeFileSync(message,git(['show','-s','--format=%B',commit]));}
  issues.push(...scanSecrets({root,snapshot,base,head}));
  let mediaResult={records:[],references:0},review;
  if(!secretsOnly){
   review=reviewDir||join(homedir(),'.local/share/family-public-sync/review',new Date().toLocaleDateString('en-CA'));mkdirSync(review,{recursive:true,mode:0o700});
   const assets=files.filter(f=>media.test(f)&&existsSync(join(root,f))&&lstatSync(join(root,f)).isFile()),metadata=new Map();
   const exif=existsSync('/opt/homebrew/bin/exiftool')?'/opt/homebrew/bin/exiftool':'exiftool';
   const inspect=list=>{
    if(!list.length)return;
    const result=spawnSync(exif,['-j','-G1','-a','-s',...list.map(f=>join(root,f))],{encoding:'utf8',maxBuffer:128*1024*1024});
    if(result.status!==0)issues.push('exiftool:1: metadata scanner failed (details withheld)');
    try{for(const tags of JSON.parse(result.stdout)){const file=tags.SourceFile.slice(root.length+1);metadata.set(file,metadataFindings(tags));
     if(video.test(file)&&Object.keys(tags).some(k=>/AudioFormat|AudioChannels|AudioSampleRate/.test(k)&&tags[k]))issues.push(`${file}:1: video contains audio; silent-video approval cannot authorize speech`);
     const fields=Object.fromEntries(Object.entries(tags).filter(([k])=>!/^SourceFile$|^(File|System|ExifTool|ICC_Profile):/.test(k)));
     issues.push(...textIssues(file,Buffer.from(JSON.stringify(Object.values(fields))),policy.terms,{scanMediaText:true}));}}catch{issues.push('exiftool:1: invalid metadata report');}
   };
   inspect(assets);
   for(const [file,hits]of metadata)for(const tag of hits)issues.push(`${file}:1: identifying media metadata ${tag} (use --strip)`);
   const python=process.env.PUBLIC_SYNC_PYTHON||join(homedir(),'.local/share/family-public-sync/venv/bin/python');
   const worker=join(dirname(fileURLToPath(import.meta.url)),'public-media.py');
   const result=spawnSync(python,[worker],{input:JSON.stringify({root,files:assets,review,references:referenceRoots||privateRoots()}),encoding:'utf8',maxBuffer:128*1024*1024,timeout:600000});
   try{mediaResult=JSON.parse(result.stdout);issues.push(...mediaResult.issues);}catch{issues.push('media-worker:1: missing or invalid report');}
   if(result.status!==0)issues.push('media-worker:1: scanner failed (details withheld)');
   const approvals=policy.mediaReviews||{};
   const approved=(file,type)=>{const review=approvals[createHash('sha256').update(readFileSync(join(root,file))).digest('hex')];return review?.kind===type&&typeof review.reason==='string'&&review.reason.trim()&&typeof review.reviewer==='string'&&review.reviewer.trim();};
   for(const record of mediaResult.records){
    if(record.faces&&approved(record.path,'illustration'))record.issues=record.issues.filter(s=>!s.startsWith('face candidate'));
    for(const issue of record.issues)issues.push(`${record.path}:1: ${issue}`);
   }
   for(const file of assets.filter(f=>audio.test(f)||video.test(f))){
    // No inferred approval from a reassuring filename: require content-bound review
    // of synthetic SFX/music or silent video. Speech and family recordings never pass.
    const kind=audio.test(file)?'synthetic-audio':'silent-video';
    if(!approved(file,kind))issues.push(`${file}:1: ${audio.test(file)?'possible speech audio':'video faces/audio'}: manual provenance review required`);
   }
   const records=new Map(mediaResult.records.map(r=>[r.path,r]));
   const cards=assets.filter(f=>!audio.test(f)&&!video.test(f)).map(file=>{
    const r=records.get(file)||{path:file,issues:[],faces:0};
    if(extname(file).toLowerCase()==='.svg'){const target=createHash('sha256').update(file).digest('hex')+'.svg';copyFileSync(join(root,file),join(review,target));r.thumbnail=target;}
    const hits=issues.filter(s=>s.startsWith(file+':')).map(s=>s.slice(s.indexOf(':1:')+4));
    return `<figure>${r.thumbnail?`<img loading="lazy" src="${r.thumbnail}">`:''}<figcaption>${escape(safe(file))}<br>${escape(hits.join('; ')|| (r.faces?'Reviewed illustration face candidate':'No automated findings; visual review pending'))}</figcaption></figure>`;
   });
   writeFileSync(join(review,'results.json'),JSON.stringify({...mediaResult,gateIssues:issues.map(safe)},null,2)+'\n');
   writeFileSync(join(review,'index.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"><title>Public image review</title><style>body{font:14px system-ui;background:#eee}main{display:flex;flex-wrap:wrap}figure{width:260px;padding:10px;background:white;margin:8px;overflow-wrap:anywhere}img{max-width:240px;height:180px;object-fit:contain}</style><h1>All public images</h1><p>${cards.length} images; ${mediaResult.references} private references checked. All illustrations are listed. Automated checks cannot prove absence of likeness; review every thumbnail.</p><main>${cards.join('\n')}</main>`);
  }
  if(git(['rev-parse',head]).toString().trim()!==startHead)issues.push('history:1: HEAD changed during scan; rerun');
  const endFiles=git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean);
  if([...new Set(endFiles)].sort().join('\0')!==[...files].sort().join('\0'))issues.push('tree:1: public file list changed during scan; rerun');
  for(const file of files)if(existsSync(join(snapshot,file))&&(!existsSync(join(root,file))||!lstatSync(join(root,file)).isFile()||!readFileSync(join(snapshot,file)).equals(readFileSync(join(root,file)))))issues.push(`${file}:1: file changed during scan; rerun`);
  return {files:files.length,commits:commits.length,issues:[...new Set(issues.map(safe))],images:mediaResult.records.length,references:mediaResult.references,review:review?join(review,'index.html'):undefined};
 }finally{rmSync(snapshot,{recursive:true,force:true});}
}
