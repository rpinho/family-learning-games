import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {puzzleBase,PUZZLE_LINES} from '../public/rescue-puzzles.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('Rescue HTTP saves separately, rejects stale writes, serves assets and records diagnostics',async()=>{
 const data=await mkdtemp(join(tmpdir(),'rescue-api-test-')),port=14323;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),LETTER_QUEST_DATA:data},stdio:['ignore','pipe','pipe']});
 const timeout=setTimeout(()=>child.kill(),12000);
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited');})]);
  const base=`http://127.0.0.1:${port}`,get=async id=>(await (await fetch(`${base}/api/${id}/state`)).json()).profile;
  const initial=await get('admin'),other=await get('beginner');
  const payload={kind:'turn',turn:1,rescueVersion:2,mission:1,revision:initial.revision};
  const post=body=>fetch(`${base}/api/admin/rescue`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({...payload,rescueVersion:1})).status,409);
  const response=await post(payload);assert.equal(response.status,200);const saved=(await response.json()).profile;
  assert.equal(saved.rescue.engine,2);assert.equal((await post(payload)).status,409);
  assert.equal((await post({...payload,mission:99,revision:saved.revision})).status,400);
  assert.deepEqual(await get('beginner'),other);assert.equal(saved.xp,initial.xp);assert.deepEqual(saved.skills,initial.skills);
  assert.deepEqual(JSON.parse(await readFile(join(data,'admin.json'),'utf8')),saved);
  // Fixtures belong to the isolated temporary server, never a live child/Admin save.
  for(const engine of [1,2]){
   const p=structuredClone(saved);
   if(engine===1)p.rescue={mission:1,phase:'friend',plan:['key','friend'],position:10,direction:0,paused:false,helped:false,moves:7,helpCount:0,pauses:0,badges:3,history:[]};
   else{const b=puzzleBase(p.rescue);Object.assign(p.rescue,{phase:'explore',position:b.exit+b.size,direction:0,opened:b.switches.map(v=>v.color),crates:[...b.pads],rescued:[]});}
   await writeFile(join(data,'admin.json'),JSON.stringify(p));
   const result=await post({kind:'forward',rescueVersion:engine,mission:1,revision:p.revision});
   assert.equal(result.status,200);const body=await result.json();
   assert.deepEqual(body.result,{kind:'exit-needs-friend',line:PUZZLE_LINES.missingFriend});
   assert.deepEqual(body.profile.rescue,p.rescue);assert.equal(body.profile.xp,p.xp);
   assert.deepEqual((await get('admin')).rescue,p.rescue);
  }
  for(const file of ['rescue.mjs','rescue-view.mjs','rescue.css'])assert.equal((await fetch(base+'/'+file)).status,200);
  const logs=await readdir(join(data,'logs'));let recorded='';for(const f of logs)if(f.endsWith('.jsonl'))recorded+=await readFile(join(data,'logs',f),'utf8');assert.match(recorded,/rescue_action/);assert.match(recorded,/exit-needs-friend/);
 }finally{clearTimeout(timeout);const exited=once(child,'exit');child.kill();await exited;}
});
