import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {wordSearchService} from '../word-search-service.mjs';
import {wordBlocksService} from '../word-blocks-service.mjs';
import {SEARCH_WORDS} from '../word-search-service.mjs';
import {SENTENCES} from '../public/word-blocks/content.mjs';
import {scenePicture} from '../public/word-blocks/art.mjs';
import {CATALOG,destination} from '../public/catalog.mjs';

async function fixture(name,make){
 const data=await mkdtemp(join(tmpdir(),'generic-games-test-')),players=['beginner','explorer','admin'];
 let service=make({data,players});
 return {data,players,reopen:()=>{service=make({data,players});},async req(body,{player='admin',method=body?'POST':'GET',type='application/json',path='/api/'+name,raw}={}){
  const req=Readable.from(raw===undefined?(body?[JSON.stringify(body)]:[]):[raw]);req.method=method;req.headers={'content-type':type};let status,value;
  await service.handle(req,{writeHead:s=>status=s,end:s=>value=JSON.parse(s)},new URL('http://localhost'+path+'?player='+encodeURIComponent(player)));
  return {status,...value};
 }};
}
for(const [name,make]of [['word-search',wordSearchService],['word-blocks',wordBlocksService]]){
 test(name+' has fresh generic presets, bounded JSON, revision checks and isolated durable saves',async()=>{
  const f=await fixture(name,make);
  for(const player of f.players){const r=await f.req(null,{player});assert.equal(r.status,200);assert.equal(r.profile.revision,0);}
  assert.deepEqual(await readdir(f.data),[],'reads never create profiles');
  for(const player of ['unknown','../admin','constructor'])assert.equal((await f.req(null,{player})).status,400);
  assert.equal((await f.req({}, {type:'text/plain'})).status,415);
  for(const raw of ['{','null','[]'])assert.equal((await f.req({}, {raw})).status,400);
  assert.equal((await f.req({}, {raw:'x'.repeat(2049)})).status,413);
  assert.equal((await f.req(null,{method:'PUT'})).status,405);
  assert.equal((await f.req(null,{path:'/api/'+name+'/other'})).status,404);
  assert.equal((await f.req({type:'next',revision:99})).status,409);
  const input=name==='word-search'?{type:'open'}:{type:'start',activity:'spelling',revision:0};
  const opened=await f.req(input);assert.equal(opened.status,200);assert.equal(opened.profile.revision,1);
  f.reopen();assert.deepEqual((await f.req()).profile,opened.profile);
  for(const player of ['beginner','explorer'])assert.equal((await f.req(null,{player})).profile.revision,0);
  assert.deepEqual(await readdir(f.data),[name+'-admin.json']);
  // New identities added by Family setup use the same generic content.
  f.players.push('beginner_1');assert.equal((await f.req(null,{player:'beginner_1'})).status,200);
  if(name==='word-search'){
   assert.ok(opened.profile.current.targets.every(t=>SEARCH_WORDS.includes(t.word)));
   const t=opened.profile.current.targets[0],input={type:'select',revision:1,first:t.cells[0],last:t.cells.at(-1)};
   const found=await f.req(input);assert.equal(found.result.word,t.word);
   assert.equal((await f.req(input)).status,409,'a stale find cannot count twice');
   assert.deepEqual((await f.req({type:'open'})).profile,found.profile,'opening is idempotent');
  }else{
   const s=opened.profile.current;assert.equal(s.id,'mat');
   let revision=1;
   for(let i=0;i<3;i++)while(s.values[i]!==s.answers[0][i]){
    const r=await f.req({type:'turn',index:i,direction:1,revision:revision++});assert.equal(r.status,200);s.values=r.profile.current.values;
   }
   const right=await f.req({type:'press',revision:revision++});assert.equal(right.result.right,true);
   assert.equal((await f.req({type:'press',revision:revision-1})).status,409);
   const sentence=await f.req({type:'start',activity:'sentences',revision});assert.equal(sentence.status,200);assert.ok(SENTENCES.some(row=>row.id===sentence.profile.current.id));
  }
  const saved=await readFile(join(f.data,name+'-admin.json'),'utf8');assert.ok(saved.length<12000);
 });
}
test('generic sentences accept precisely the pictured alternatives and use only original SVG',()=>{
 assert.equal(SENTENCES.length,20);
 for(const row of SENTENCES){
  const art=scenePicture(row.scene);assert.match(art,/^<svg/);assert.doesNotMatch(art,/<image|href=|<text/);
  for(const a of row.choices[0])for(const b of row.choices[1])for(const c of row.choices[2]){
   const truePicture=['sat','ran'].includes(row.scene.action)?['a','the'].includes(a)&&b===row.scene.subject&&c===row.scene.action:a===row.scene.subject&&['was','got'].includes(b)&&c===row.scene.action;
   assert.equal(row.answers.some(words=>words.join(' ')===[a,b,c].join(' ')),truePicture);
  }
 }
 assert.throws(()=>scenePicture({subject:'person',action:'sat'}));
});
test('all three cards use native routes with original SVG icons',()=>{
 for(const id of ['free-build','word-search','word-blocks']){
  assert.equal(destination('#'+id).type,id);assert.equal(CATALOG.find(c=>c.id===id).icon,'/'+id+'.svg');
 }
});
