import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {clipName} from '../../hub/book-service.mjs';
import {setRookVoice,voicesFor} from '../assemble.mjs';
import {bookPaths,soundSource} from '../paths.mjs';
const script=new URL('../narrate.py',import.meta.url).pathname;
const worker=`import json,sys,wave,array
from pathlib import Path
r=json.loads(Path(sys.argv[1]).read_text());out=Path(r['out']);clips={}
Path(r['audit']).write_text(json.dumps(r['lines']))
for i,l in enumerate(r['lines']):
 p=out/(l['id']+'.wav')
 with wave.open(str(p),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
  w.writeframes(array.array('h',[0 if r.get('bad') and i==1 else 1000,-1000]*2400).tobytes())
 clips[l['id']]=p.name
print(json.dumps({'clips':clips}))
`;
async function fixture(lines,extra={}){
 const out=await mkdtemp(join(tmpdir(),'book-external-')),py=join(out,'worker.py'),config=join(out,'renderers.json'),req=join(out,'request.json'),audit=join(out,'audit.json');
 await writeFile(py,worker);await writeFile(config,JSON.stringify({voices:{'local:rook-test-v1':{command:['python3',py]}}}));
 await writeFile(req,JSON.stringify({lines,out,voice_renderers:config,audit,...extra}));
 const run=()=>JSON.parse(execFileSync('python3',[script,req],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim());return {out,py,req,config,audit,run};
}
test('A configured renderer preserves text/sounds, uses matching JS/Python keys and reuses cached clips',async()=>{
 const lines=[{voice:'local:rook-test-v1',speed:.95,text:'Say [[b]], then [[pˌikəʧˈu]].'},{voice:'local:rook-test-v1',speed:1,text:'Jump!'}],f=await fixture(lines);
 const stock={voice:'am_michael',speed:1,text:'Classic.'},classicFile=join(f.out,clipName(stock));await writeFile(classicFile,'stock cache');
 const request=JSON.parse(await readFile(f.req));request.lines.push(stock);await writeFile(f.req,JSON.stringify(request));
 const r=f.run();assert.equal(r.made,2);
 for(const l of lines)assert.equal(r.clips[`${l.voice}|${l.speed}|${l.text}`],clipName(l));
 const heard=JSON.parse(await readFile(f.audit));assert.equal(heard[0].text,lines[0].text);
 assert.equal(await readFile(classicFile,'utf8'),'stock cache');
 await writeFile(f.py,'raise RuntimeError("worker should not run")');assert.equal(f.run().made,0);
});
test('Missing renderer and invalid batch output fail without publishing partial clips',async()=>{
 const lines=[{voice:'local:rook-test-v1',speed:.95,text:'Good.'},{voice:'local:rook-test-v1',speed:.95,text:'Bad.'}];
 const f=await fixture(lines);await writeFile(f.config,'{"voices":{}}');assert.throws(f.run,/no configured renderer/);assert.ok(!(await readdir(f.out)).some(n=>/^[a-f0-9]{16}\.wav$/.test(n)));
 await writeFile(f.config,JSON.stringify({voices:{'local:rook-test-v1':{command:['python3',f.py]}}}));
 await writeFile(f.py,worker.replace("0 if r.get('bad') and i==1 else 1000,-1000","0 if i==1 else 1000,0 if i==1 else -1000"));
 assert.throws(f.run,/silent or clipping/);assert.ok(!(await readdir(f.out)).some(n=>/^[a-f0-9]{16}\.wav$/.test(n)));
});
test('Rook role follows named selection in both newly generated and legacy chapters, and can switch back',()=>{
 const voices=voicesFor({cast:[]},{named:{rook:'local:rook-test-v1'}});assert.equal(voices.dad.voiceRole,'rook');assert.equal(voices.narrator.voice,'af_heart');
 const l=(who,voice,extra={})=>({who,voice,text:'Go!',speed:1,clip:'old.wav',...extra}),ch={pages:[{say:[l('dad','am_michael'),l('dad','bm_fable'),l('narrator','am_michael'),l('dad','local:rook-old-v1',{voiceRole:'rook'})]}]};
 const changed=setRookVoice(ch,'local:rook-test-v1');assert.equal(changed.length,2);assert.ok(changed.every(x=>!x.clip));
 assert.equal(ch.pages[0].say[1].voice,'bm_fable');assert.equal(ch.pages[0].say[2].clip,'old.wav');
 assert.equal(setRookVoice(ch,'am_michael').length,2);
 const paths=bookPaths({FAMILY_DEPLOY_ROOT:'/tmp/synthetic-household'});assert.equal(soundSource(paths).voice_renderers,join(paths.book,'voice-renderers.json'));
});
test('An on-demand time limit stops a stalled renderer without publishing clips',async()=>{
 const f=await fixture([{voice:'local:rook-test-v1',speed:1,text:'Go!'}],{renderer_timeout:1});
 await writeFile(f.py,'import time\ntime.sleep(3)\n');assert.throws(f.run,/TimeoutExpired/);
 assert.ok(!(await readdir(f.out)).some(n=>/^[a-f0-9]{16}\.wav$/.test(n)));
});
test('New chapters resolve a named companion while keeping stock public defaults and other speakers',()=>{
 const plan={cast:[{id:'pirate-friend',voice:'@pirate',speed:1},{id:'quiet-friend',voice:'af_nova',speed:1.1}]};
 const v=voicesFor(plan,{named:{pirate:'local:pirate-test-v1',rook:'local:rook-test-v1'}});
 assert.equal(v['pirate-friend'].voice,'local:pirate-test-v1');assert.equal(v['pirate-friend'].voiceRole,'pirate-friend');assert.equal(v['quiet-friend'].voice,'af_nova');assert.equal(v.narrator.voice,'af_heart');
 assert.equal(voicesFor({cast:[]}).dad.voice,'am_michael');
});
test('Mom can be given a named voice in the cast (new chapters use it); without one she keeps the default',()=>{
 assert.deepEqual(voicesFor({cast:[]},{named:{mom:'local:mom-test-v1'}}).mom,{voice:'local:mom-test-v1',speed:1});
 assert.equal(voicesFor({cast:[]}).mom.voice,'af_sarah');
});
