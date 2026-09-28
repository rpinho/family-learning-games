import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {RULES} from '../dribble.mjs';

test('Hub persists only the chosen profile, rejects replay/foreign origins, and scopes runtime imports',async()=>{
 const data=await mkdtemp(join(tmpdir(),'family-hub-test-'));
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,FAMILY_CONFIG:'',FAMILY_DATA:data,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 try{
  const output=await new Promise((resolve,reject)=>{child.stdout.once('data',x=>resolve(String(x)));child.once('error',reject);child.once('exit',c=>reject(Error('Server exited '+c)));});
  const base='http://127.0.0.1:'+output.match(/localhost:(\d+)/)[1];
  const request=(a)=>fetch(base+'/api/dribble?player=admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rulesVersion:RULES,...a})});
  assert.equal((await fetch(base+'/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/config.json')).status,404);
  assert.equal((await fetch(base+'/api/dribble?player=unknown')).status,400);
  const first=await(await request({type:'start',revision:0})).json();
  assert.equal(first.profile.revision,1);
  assert.equal((await request({type:'level',level:2,revision:0})).status,409);
  const fake=await(await request({type:'feint',move:'left',roundId:first.profile.round.id,revision:1})).json();
  assert.equal(fake.profile.round.balanced,false);
  const escaped=await(await request({type:'move',move:'right',roundId:first.profile.round.id,revision:2})).json();
  assert.equal(escaped.profile.dribbles,1);assert.equal(escaped.profile.goals,0);
  assert.equal(JSON.parse(await readFile(join(data,'admin.json'),'utf8')).dribbles,1);
  assert.deepEqual((await readdir(data)).sort(),['admin.json','logs']);
  const savedBeforeMenu=await readFile(join(data,'admin.json'),'utf8');
  const menu=await(await fetch(base+'/api/menu?player=admin')).json();
  assert.equal(new Set(menu.order).size,12); // Background ranking may still be warming; never wait for it.
  assert.deepEqual(Object.keys(menu),['order','ready']);
  assert.equal((await(await fetch(base+'/api/menu?player=beginner')).json()).order[0],'letter-quest');
  assert.equal((await fetch(base+'/api/menu?player=unknown')).status,400);
  assert.equal((await fetch(base+'/api/menu?player=admin',{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/menu-order.mjs')).status,404);
  assert.equal(await readFile(join(data,'admin.json'),'utf8'),savedBeforeMenu);

  const redirect=await fetch(base+'/assets/runtime.js',{headers:{Referer:base+'/g/word-arcade/admin/'},redirect:'manual'});
  assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'/g/word-arcade/admin/assets/runtime.js');
  assert.equal((await fetch(base+'/assets/runtime.js',{headers:{Referer:'https://untrusted.example/g/word-arcade/admin/'},redirect:'manual'})).status,404);
  // Behind a local HTTPS proxy: the forwarded scheme makes the https embedding document same-origin.
  const tlsHeaders={Referer:base.replace('http:','https:')+'/g/word-arcade/admin/','X-Forwarded-Proto':'https'};
  const viaTls=await fetch(base+'/assets/runtime.js',{headers:tlsHeaders,redirect:'manual'});
  assert.equal(viaTls.status,307);assert.equal(viaTls.headers.get('location'),'/g/word-arcade/admin/assets/runtime.js');
  assert.equal((await fetch(base+'/assets/runtime.js',{headers:{Referer:tlsHeaders.Referer},redirect:'manual'})).status,404);
  assert.equal((await fetch(base+'/api/config',{headers:{Origin:base.replace('http:','https:'),'X-Forwarded-Proto':'https'}})).status,200);
  assert.equal((await fetch(base+'/api/config',{headers:{Origin:'https://untrusted.example','X-Forwarded-Proto':'https'}})).status,403);
  // Installable app: a shared manifest, and one per player whose id/start_url open that player's profile.
  const shared=await(await fetch(base+'/manifest.webmanifest')).json();
  assert.equal(shared.id,'/');assert.equal(shared.start_url,'/');assert.equal(shared.display,'standalone');
  for(const icon of shared.icons){const r=await fetch(base+icon.src);assert.equal(r.status,200,icon.src);assert.equal(r.headers.get('content-type'),'image/png');}
  assert.deepEqual(new Set(shared.icons.map(i=>i.purpose+' '+i.sizes)),new Set(['any 192x192','any 512x512','maskable 192x192','maskable 512x512']));
  const own=await(await fetch(base+'/manifest.webmanifest?player=beginner')).json();
  assert.equal(own.id,'/?player=beginner');assert.equal(own.start_url,'/?player=beginner');assert.equal(own.scope,'/');assert.match(own.name,/Beginner$/);
  assert.equal((await(await fetch(base+'/manifest.webmanifest?player=nobody')).json()).id,'/');
  assert.match(await(await fetch(base+'/?player=beginner')).text(),/href="\/manifest\.webmanifest\?player=beginner"/);
  assert.match(await(await fetch(base+'/?player=%3Cx%3E')).text(),/href="\/manifest\.webmanifest"/);
  for(const path of ['/dribble-live.mjs','/live-pitch.mjs','/dribble-ui.mjs','/chess/tokens.mjs'])assert.equal((await fetch(base+path)).status,200);
  const live=await(await request({type:'live-start',liveRules:1,revision:escaped.profile.revision})).json();
  assert.equal(live.profile.live.level,1);assert.equal(live.profile.dribbles,1);
  const checkpoint=await(await request({type:'live-checkpoint',liveRules:1,revision:live.profile.revision,roundId:live.profile.live.round.id,inputs:'iwee'})).json();
  assert.equal(checkpoint.profile.live.round.inputs,'iwee');
  const reloaded=await(await fetch(base+'/api/dribble?player=admin')).json();assert.equal(reloaded.profile.live.round.inputs,'iwee');
  await mkdir(join(data,'chess-voice'));
  const clip=Buffer.from('RIFFsynthetic audio fixture');await writeFile(join(data,'chess-voice','0123456789abcdef.wav'),clip);
  const audio=await fetch(base+'/chess-voice/0123456789abcdef.wav');
  assert.equal(audio.headers.get('content-length'),String(clip.length));assert.match(audio.headers.get('cache-control'),/immutable/);
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()),clip);
  await writeFile(join(data,'chess-voice','manifest.json'),'{}');
  assert.equal((await fetch(base+'/chess-voice/manifest.json')).headers.get('cache-control'),'no-store');
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
