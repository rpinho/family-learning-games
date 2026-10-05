import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readingAssessment} from '../learner-reading.mjs';import {buildLearner} from '../learner.mjs';import {compileProfile} from '../learner-profile.mjs';
import {itemTags} from '../../hub/skill-items.mjs';import {skillEvidence} from '../../hub/skill-evidence.mjs';import {wordTags} from '../../hub/skill-items.mjs';
import {magicWords} from '../plan.mjs';import {phonicsLine} from '../../hub/phonics.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/reading-evidence.json',import.meta.url)));
const replay=JSON.parse(readFileSync(new URL('./fixtures/answer-tagging.json',import.meta.url)));
test('Synthetic advancing rows tag the answered question and discounts repaired historical successes',()=>{
 assert.ok(replay.rows.length===16);for(const row of replay.rows){const t=itemTags('word-arcade',row);if(t)assert.deepEqual(t.tags,itemTags('word-arcade',{...row,answeredQuestion:row.expected}).tags);const e=skillEvidence('word-arcade',row,fixture.now-10000)?.[0];if(e)assert.equal(e.taggingRepaired,true);}
 const row={type:'action',input:{kind:'answer',questionId:'gone'},after:{q:{id:'next',kind:'read-word',answer:'cat',options:['cat','cap']}},result:{ok:true}};assert.equal(itemTags('word-arcade',row),null);assert.equal(skillEvidence('word-arcade',row,fixture.now),null);
});
test('Synthetic evidence separates secure CVC reads, weak sounds and supported harder words',()=>{
 const before=JSON.stringify(fixture);const m=buildLearner({player:'reader',profile:{age:8},now:fixture.now,evidence:fixture.evidence});const l=m.literacy;
 assert.equal(l.wordLevel,1);assert.equal(l.sentenceLevel,1);assert.equal(l.readingFocus[0],'short-i');assert.ok(l.readingFocus.includes('final-consonant')&&l.readingFocus.includes('ck')&&l.readingFocus.includes('final-blends'));assert.ok(!l.readingFocus.includes('short-o'));
 assert.deepEqual(l.wordsMastered,['cat']);assert.deepEqual(l.wordsStuck,['pin']);assert.deepEqual(l.wordsAlmost,['map']);assert.deepEqual(l.wordsAboveLevel,['duck','milk']);
 const p=compileProfile({player:'reader',now:fixture.now,evidence:fixture.evidence,bookModel:m});assert.equal(p.bookPlan.wordPatterns[0].vowel,'i');assert.deepEqual(p.bookPlan.confidenceWords,['map']);assert.ok(p.bookPlan.challengeIdea.includes('Hear it'));
 assert.equal(JSON.stringify(fixture),before);
});
const win=(i,changes={})=>({player:'reader',source:'test',at:fixture.now-(i%2+1)*864e5-i*1000,item:'q'+i,tags:wordTags('cat'),readTask:true,choices:3,ms:2500,ok:true,help:false,...changes});
test('Mastery excludes same-day wins, retries, spelling, fast choices, unknown timing, hints and repaired tags',()=>{
 const assess=rows=>readingAssessment(rows,'reader',fixture.now).wordsMastered;
 const clean=Array.from({length:6},(_,i)=>win(i));assert.deepEqual(assess(clean),['cat']);
 for(const changes of [{at:fixture.now-10000},{item:'same'},{readTask:false},{ms:1999},{ms:null},{help:true},{taggingRepaired:true},{modelled:true}])assert.deepEqual(assess(clean.map(e=>({...e,...changes}))),[],JSON.stringify(changes));
 assert.deepEqual(assess([win(0,{ok:false}),win(0,{at:fixture.now-900,ok:true})]),[]);
 assert.deepEqual(assess(clean.map(e=>({...e,ms:2000}))),['cat'],'exactly two seconds is eligible');
 assert.deepEqual(assess(clean.map(e=>({...e,at:e.at-31*864e5}))),[],'stale evidence expires');
 assert.deepEqual(magicWords({literacy:{wordsMastered:[]}},()=>0,{decodable:true}),[],'no unmastered fallback magic words');
 assert.deepEqual(magicWords({literacy:{wordsMastered:['cat']}},()=>0,{decodable:true}),[],'a legacy mastery list cannot authorise unsupported reading');
});
test('Phonics content is fixed, uses recorded sounds, rejects arbitrary narration and supports k as /c/',()=>{
 assert.equal(phonicsLine('k','letter').text,'[[k]]');assert.ok(phonicsLine('pin','blend').text.includes('[[ɪ]]'));for(const w of ['../cat','<cat>','cat!','Give a speech'])assert.equal(phonicsLine(w,'blend'),null);
});
test('Fallback stories remain valid when there are zero or one mastered words',async()=>{
 const {older}=await import('./fixtures.mjs'),{planChapter}=await import('../plan.mjs'),{templateChapter}=await import('../template.mjs'),{lintChapter}=await import('../lint.mjs'),{actorIdsFor}=await import('../generate.mjs');
 const lib=JSON.parse(readFileSync(new URL('../../hub/public/book-art/library.json',import.meta.url)));
 for(const words of [[],['sun']])for(const style of ['classic','quest'])for(const date of ['2026-03-10','2026-03-11','2026-03-12']){
  const p=planChapter({...older,literacy:{...older.literacy,wordsMastered:words}},{date,profile:{bookStyle:style}});const ids=actorIdsFor(p,lib);p.actorIds=ids;
  assert.deepEqual(lintChapter(templateChapter(p,lib),p,{actors:ids.all,dadId:ids.dad}),[],date+style+words);
 }
});
test('Phonics API accepts only fixed supported content and leaves progress absent',async t=>{
 const {bookService}=await import('../../hub/book-service.mjs'),{createServer}=await import('node:http'),fs=await import('node:fs/promises'),{join}=await import('node:path'),{tmpdir}=await import('node:os');
 const dir=await fs.mkdtemp(join(tmpdir(),'phonics-api-')),rendered=[];t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const service=bookService({data:dir,bookDir:join(dir,'book'),players:['reader'],config:{players:[{id:'reader',name:'Reader'}]},voiceEngine:async lines=>{rendered.push(...lines);return {clips:Object.fromEntries(lines.map(l=>[`${l.voice}|${l.speed}|${l.text}`,'0000000000000000.wav']))};}});
 const server=createServer(async(req,res)=>{if(await service.handle(req,res,new URL(req.url,'http://localhost'))===false){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const send=body=>fetch('http://127.0.0.1:'+server.address().port+'/api/book/phonics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await send({player:'reader',word:'pin',mode:'blend'})).status,200);assert.equal(rendered[0].text,phonicsLine('pin','blend').text);
 assert.equal((await send({player:'reader',word:'i',mode:'letter'})).status,200);
 assert.equal((await send({player:'reader',word:'<say anything>',mode:'blend'})).status,400);assert.equal((await send({player:'missing',word:'pin',mode:'blend'})).status,400);
 assert.equal((await send({player:'reader',word:'l',mode:'letter'})).status,400,'missing recordings cannot silently masquerade as phonemes');
 await assert.rejects(fs.access(join(dir,'book-progress')));
});
