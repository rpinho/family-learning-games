#!/usr/bin/env node
// Letter Slalom timing budget, from real clip lengths (WAV headers) or a saved fixture.
// After a gate: the feedback line, then the next row's question. At base speed AND at go-faster speed, for both tracks:
//   feedback <= 25% of the time to the next row (at the speed of the pass),
//   the question ends with >= 2.2 s of travel left, and the skier never has to slow down for it.
// Usage: node scripts/check-slalom-timing.mjs --voice VOICE_DIR [--write tests/fixtures/slalom-clip-seconds.json]
//        node scripts/check-slalom-timing.mjs --fixture tests/fixtures/slalom-clip-seconds.json
import {readFileSync,writeFileSync,openSync,readSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {budgetReport,slalomTimingLines} from '../lib/slalom-budget.mjs';
const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
function wavSeconds(file){const fd=openSync(file,'r'),h=Buffer.alloc(4096);readSync(fd,h,0,4096,0);closeSync(fd);let o=12,rate=0,bytes=0;
 while(o<h.length-8){const id=h.toString('ascii',o,o+4),size=h.readUInt32LE(o+4);if(id==='fmt ')rate=h.readUInt32LE(o+16);if(id==='data'){bytes=size;break;}o+=8+size+(size%2);}return bytes/rate;}
let seconds;
if(arg('--voice')){const dir=arg('--voice'),m=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));seconds={};
 for(const line of slalomTimingLines()){const url=m.clips[line];if(!url)throw Error('missing clip: '+line);seconds[line]=+wavSeconds(join(dir,url.split('/').at(-1))).toFixed(3);}
 if(arg('--write'))writeFileSync(arg('--write'),JSON.stringify(seconds,null,1)+'\n');}
else seconds=JSON.parse(readFileSync(arg('--fixture'),'utf8'));
const report=budgetReport(seconds);
for(const r of report.cases)console.log(`${r.ok?'ok  ':'FAIL'} ${r.track.padEnd(16)} ${r.speed.padEnd(8)} feedback ${r.feedback.toFixed(2)}s (${Math.round(r.feedbackShare*100)}% of ${r.toRowAtPass}s to the row), question ${r.prompt.toFixed(2)}s, ends ${r.secondsLeftAfterPrompt}s / ${r.metresLeftAfterPrompt} m before the row${r.slowedForPrompt?', SLOWED':''}  [${r.worstFeedback} | ${r.worstPrompt}]`);
if(!report.ok){console.error('Letter Slalom timing budget broken');process.exit(1);}
