import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {deployment} from './fixtures.mjs';
// The nightly wrapper must really run the generator (a silent no-op once exited 0 without doing anything).
test('nightly.sh runs the generator at low priority and reports its exit code',async()=>{
 const {root,env}=await deployment();
 const run=(args,extra={})=>spawnSync('bash',[new URL('../nightly.sh',import.meta.url).pathname,...args],{env:{...process.env,...env,...extra},encoding:'utf8'});
 const ok=run(['--date','2026-03-10','--no-llm','--no-voice']);
 assert.equal(ok.status,0,ok.stdout+ok.stderr);
 assert.ok(existsSync(join(root,'book','older','2026-03-10.json')));assert.ok(existsSync(join(root,'book','young','2026-03-10.html')));
 assert.match(ok.stdout,/== done rc=0/);
 const bad=run(['--date','not-a-date','--no-llm','--no-voice','--player','ghost'],{FAMILY_DEPLOY_ROOT:join(root,'missing')});
 assert.notEqual(bad.status,0,'a failing generator is not reported as success');
});
