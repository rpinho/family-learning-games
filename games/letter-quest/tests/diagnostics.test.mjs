import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,stat,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDiagnostics,cleanEvent} from '../diagnostics.mjs';
import {createTelemetry} from '../public/telemetry.mjs';
import {summarize} from '../diagnostic-report.mjs';
test('Logs append privately, survive restart, and expose write failures',async()=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'letter-quest-logs-'));
 const logger=createDiagnostics(data);
 await Promise.all(Array.from({length:20},(_,i)=>logger.record('test',{i})));
 await createDiagnostics(data).record('restarted');
 const files=await readdir(path.join(data,'logs'));assert.equal(files.length,1);
 const file=path.join(data,'logs',files[0]);const rows=(await readFile(file,'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(rows.length,21);assert.equal(rows[20].type,'restarted');assert.equal((await stat(file)).mode&0o777,0o600);
 const broken=await mkdtemp(path.join(os.tmpdir(),'letter-quest-logs-fail-'));await writeFile(path.join(broken,'logs'),'fixture');
 const bad=createDiagnostics(broken);assert.equal(await bad.record('test'),false);assert.equal(bad.status().ok,false);
});
test('Client diagnostic schema rejects unknown events and drops unrelated sensitive fields',()=>{
 const event={kind:'runtime_error',eventId:'event-1',session:'session-1',player:'beginner',message:'failed http://localhost/app.mjs?token=secret',password:'secret',cookies:'secret',arbitrary:{secret:1}};
 const clean=cleanEvent(event);assert.equal(clean.password,undefined);assert.equal(clean.cookies,undefined);assert.equal(clean.arbitrary,undefined);assert.ok(!clean.message.includes('secret'));
 assert.throws(()=>cleanEvent({...event,kind:'anything'}));assert.throws(()=>cleanEvent({...event,message:'x'.repeat(25000)}));
});
test('Offline outbox retries across reload, bounds storage and never throws on denied storage',async()=>{
 const store=new Map();let offline=true;const batches=[];
 const env={localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},setInterval:()=>1,clearInterval:()=>{},fetch:async(_url,request)=>{if(offline)throw Error('offline');batches.push(JSON.parse(request.body));return {ok:true};}};
 const t=createTelemetry(()=>({player:'beginner'}),env);t.record('action',{action:'clear'});await t.flush();assert.equal(t.status().pending,1);
 const reloaded=createTelemetry(()=>({player:'beginner'}),env);offline=false;await reloaded.flush();assert.equal(reloaded.status().pending,0);assert.equal(batches[0].events[0].action,'clear');
 for(let i=0;i<250;i++)reloaded.record('action',{action:'clear'});assert.equal(reloaded.status().pending,200);assert.equal(reloaded.status().dropped,50);
 const denied=createTelemetry(()=>({player:'beginner'}),{...env,localStorage:{getItem(){throw Error();},setItem(){throw Error();}}});denied.record('action');assert.equal(denied.status().storageOK,false);await denied.flush();assert.equal(denied.status().pending,0);
});
test('Report separates children, assisted wins, levels and demo; deduplicates offline retries',async()=>{
 const row=(player,ok,helped)=>({type:'attempt',player,session:player,key:'trace:F',before:{level:0},challenge:{type:'trace'},result:{ok,reason:'shape'},input:{helped,durationMs:5000}});
 const event={eventId:'same',player:'beginner',session:'d',kind:'trace_blocked',reason:'feedback'};
 const rows=[...Array.from({length:5},()=>row('beginner',false,false)),row('explorer',true,true),row('demo',true,false),row('admin',true,false),{type:'client_events',events:[event,event]}];
 const report=await summarize(rows);assert.equal(report.attempts,6);assert.equal(report.clientEvents,1);assert.equal(report.technicalIssues,1);
 assert.equal(report.skills[0].signal,'Review difficulty / scoring / input');assert.equal(report.skills[1].independent,0);
 assert.equal((await summarize(rows,{player:'explorer'})).attempts,1);
 assert.equal((await summarize(rows,{player:'admin'})).attempts,1);
 assert.equal((await summarize([{...row('explorer',true,false),revision:10},{...row('explorer',true,false),revision:12}],{excludedRevisions:{explorer:10}})).attempts,1);
});
test('Maze reports distinguish setbacks and learning retries from independent answers',async()=>{
 const rows=[{kind:'incorrect',steppedBack:true},{kind:'retry'},{kind:'correct',helped:true},{kind:'correct',helped:false}].map(result=>({type:'maze_action',player:'explorer',session:'maze',result,input:{}}));
 const m=(await summarize(rows)).mazes[0];assert.equal(m.setbacks,1);assert.equal(m.learningRetries,1);assert.equal(m.independent,1);assert.equal(m.assisted,1);assert.equal(m.incorrect,1);
});
