import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {slot,atomicJSON,readJSON,backupSlot,requestChanges,withSlotLock} from '../review.mjs';
const player='beginner',date='2030-01-02';
async function fixture(){const book=await mkdtemp(join(tmpdir(),'review-store-')),base=slot(book,player,date,true);await atomicJSON(base+'.json',{player,date,meta:{review:{state:'pending',revision:'version-one'}}});return {book,base};}
test('review slots reject unsafe paths and invalid calendar dates',()=>{
 for(const args of [['/tmp','../parent',date],['/tmp',player,'2030-02-30'],['/tmp',player,'not-a-date']])assert.throws(()=>slot(...args));
});
test('a change request stays with its draft and its revision; stale and published drafts reject it',async()=>{
 const {book,base}=await fixture();await requestChanges({book,player,date,revision:'version-one',note:'Use a calmer ending.'});assert.equal((await readJSON(base+'.json')).meta.review.state,'changes');assert.equal((await readJSON(base+'.review.json')).notes[0].text,'Use a calmer ending.');
 assert.equal(JSON.parse((await readFile(join(book,'review-log','events.jsonl'),'utf8')).trim()).action,'changes');
 await assert.rejects(requestChanges({book,player,date,revision:'old-version',note:'Change again.'}),/draft changed/);
 const ch=await readJSON(base+'.json');ch.meta.review.state='approved';await atomicJSON(base+'.json',ch);await assert.rejects(requestChanges({book,player,date,revision:'version-one',note:'Change again.'}),/Already published/);
});
test('replacement backups retain original files and locks release after a writer failure',async()=>{
 const {book,base}=await fixture();const before=await readFile(base+'.json');await writeFile(base+'.md','A synthetic chapter');const back=await backupSlot(base,'history');assert.deepEqual(await readFile(join(back,date+'.json')),before);assert.equal(await readFile(join(back,date+'.md'),'utf8'),'A synthetic chapter');
 await assert.rejects(withSlotLock(book,player,date,async()=>{throw Error('writer failed');}),/writer failed/);
 await withSlotLock(book,player,date,async()=>{await assert.rejects(withSlotLock(book,player,date,async()=>{}),/busy/);});
});
