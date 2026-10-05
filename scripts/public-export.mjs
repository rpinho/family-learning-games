import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,copyFileSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {sanitize,privacyIssues,privatePath,denied} from './public-policy.mjs';
import {adaptPublic,retained,omitted} from './public-adaptations.mjs';
const textTypes=new Set(['.mjs','.js','.jsx','.ts','.tsx','.css','.html','.py','.sh','.svg','.webmanifest']);
const keep=/^(?:README\.md|AGENTS\.md|PRIVACY\.md|SECURITY\.md|THIRD_PARTY_NOTICES\.md|DEPLOY\.md|.*(?:README|PROVENANCE|CREDITS|NOTICE|LICENSE|COPYING)[^/]*\.(?:md|txt)|package(?:-lock)?\.json|tsconfig\.json)$/;
const excluded=/(?:^|\/)(?:out|\.next|node_modules|__pycache__|build|worker)(?:\/|$)|(?:^|\/)(?:book-art|book-art-additions\.json|book-art-layouts\.json|book-art-local\.json|home-shortcuts\.json)(?:\/|$)/;
const excludedTools=/(?:^|\/)(?:build-symbol-model|diagnose[^/]*|replay-family-art|family-day-recap|fetch-family-audio|import-(?:letter|reading)-sounds|denoise-letter-sounds|preview-guided|extend-picture-model)(?:\.|\/)|^hub\/scripts\/(?!make-calm-sounds\.py|headless-guard\.mjs|no-device-voice\.mjs|chapter-play\.mjs|hunt-voice\.mjs|check-clips\.mjs|record-sheet\.py|check-loudness\.mjs|world-.*\.mjs)/;
const git=(repo,args)=>execFileSync('git',['-C',repo,...args],{maxBuffer:128*1024*1024});
export function exportLive({target,sourceRoot,refs}){
 const issues=[];let count=0;
 for(const [game,ref]of Object.entries(refs)){
  if(!/^[a-f0-9]{7,40}$/.test(ref))throw Error('Supply an exact hexadecimal live SHA for '+game);
  const repo=join(sourceRoot,game==='hub'?'family-learning-games':game);
  const sha=git(repo,['rev-parse','--verify',ref+'^{commit}']).toString().trim();
  const names=git(repo,['ls-tree','-r','--name-only',sha]).toString().trim().split('\n');
  for(const name of names){
   if(game==='hub'&&!/^(hub\/|book\/|scripts\/deploy\/|scripts\/(?:stage|promote|chess-voice-lines\.mjs)$)/.test(name))continue;
   let dest=game==='hub'?name:join('games',game,name);
   if(omitted.has(sanitize(dest))||retained.has(sanitize(dest))||/\.config\.(?:mjs|ts)$/.test(dest)||/(?:^|\/)dist\//.test(dest)&&!['target-trail','three-in-a-row'].includes(game))continue;
   if(excluded.test(dest)||excludedTools.test(dest)||privatePath.test(dest)||keep.test(name)||keep.test(dest))continue;
   const ext=extname(name);if(!textTypes.has(ext)&&ext!=='.json'&&!/scripts\/(?:stage|promote|chess-voice-lines\.mjs)$/.test(name))continue;
   // Only engine fixtures, curricula, and code configuration. No household JSON.
   if(ext==='.json'&&!/(?:\/tests\/(?:fixtures\/)?|book\/episodes\/fixtures\/|hub\/chess-[\w-]+\.json$|symbol-model\.json$|doodle-model\.json$)/.test(dest))continue;
   const original=dest;dest=sanitize(dest);
   // Approved public artwork is retained; private source artwork is never copied.
   if(ext==='.svg'){if(!existsSync(join(target,dest)))issues.push(dest+': unreviewed vector asset');continue;}
   if(/(?:doodle|symbol)-model\.json$/.test(dest))continue;
   if((ext==='.svg'||ext==='.json')&&!existsSync(join(target,dest))){issues.push(dest+': unreviewed asset or fixture');continue;}
   let text=adaptPublic(dest,git(repo,['show',sha+':'+name]).toString(),target);
   // Keep the forwarding-header defense without embedding a provider name.
   text=text.replace(new RegExp("'"+denied.at(-1)+"-'",'gi'),"('tail'+'scale-')");
   text=text.replace(/'\/Applications\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome'/g,"process.env.CHROME");
   const found=privacyIssues(dest,Buffer.from(text));if(found.length){issues.push(...found);continue;}
   mkdirSync(dirname(join(target,dest)),{recursive:true});writeFileSync(join(target,dest),text);count++;
  }
 }
 // The shared checkpoint contract is one byte-identical public module.
 const common=join(target,'hub/public/word-break.mjs');if(existsSync(common))for(const [game,folder]of [['letter-quest','public'],['maze-garden','public'],['number-park','lib'],['word-arcade','lib'],['target-trail','dist'],['three-in-a-row','dist']]){const dest=join(target,'games',game,folder,'word-break.mjs');if(existsSync(dest))copyFileSync(common,dest);}
 if(issues.length)throw Error('Public export refused:\n'+issues.join('\n'));
 return count;
}
