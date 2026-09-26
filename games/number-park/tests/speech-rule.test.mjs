import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {splitSpeech,planSpeech,speechParts,sessionOnce} from '../lib/speech-rule.mjs';
test('Content always speaks; how-to instructions once per session and only with sound on',()=>{
 assert.deepEqual(splitSpeech(['Tap and count.']),{content:[],instructions:['Tap and count.']});
 assert.deepEqual(splitSpeech(['Take away 3. How many are left?']).content,['Take away 3. How many are left?']);
 assert.deepEqual(splitSpeech(['Put the groups together. How many?']),{content:['How many?'],instructions:['Put the groups together.']});
 for(const line of ['Count only the apples.','Trace a circle.','12','Which letter makes this sound?','Reading sound a.'])assert.deepEqual(splitSpeech([line]).content,[line]);
 const store=new Map(),firstTime=sessionOnce('t:',{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)});
 assert.deepEqual(planSpeech(['Put the groups together. How many?'],{sound:true,firstTime}).say,['Put the groups together.','How many?']);
 assert.deepEqual(planSpeech(['Put the groups together. How many?'],{sound:true,firstTime}).say,['How many?'],'instruction not repeated');
 assert.deepEqual(planSpeech(['Tap and count.'],{sound:false,firstTime}).say,[],'instructions obey the sound button');
 assert.deepEqual(planSpeech(['Take away 2. How many are left?'],{sound:false,firstTime}).say,['Take away 2. How many are left?'],'content plays with sound off');
 assert.ok(speechParts(['Share 10 cookies with 3 friends. Extras go to Cookie Buddy.']).includes('Extras go to Cookie Buddy.'));
});
test('Number Park follows the rule where it speaks',async()=>{
 const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8'),page=await read('app/page.tsx'),planning=await read('app/planning.tsx'),reading=await read('app/reading.tsx');
 assert.match(page,/useEffect\(\(\)=>\{if\(tab!=='play'\|\|!open\|\|!q\|\|s\?\.finished\|\|s\?\.result\)return;[^\n]*planSpeech/,'question prompt is not muted by the sound button');
 assert.match(page,/useEffect\(\(\)=>\{if\(!sound\|\|tab!=='play'\|\|!open\|\|!s\?\.finished\|\|!s\.recap/,'recap narration obeys sound');
 assert.match(page,/useState\(true\)/);assert.match(page,/speak=\{text=>speak\(text\)\}/);
 assert.match(planning,/firstTime\.current\(line\)/);assert.match(planning,/!active\|\|!visible\|\|!sound/);
 assert.match(reading,/planSpeech\(prompt\(\)/);
});
