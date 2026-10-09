import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cwd=new URL('..',import.meta.url).pathname;
const run=(args,input='')=>spawnSync('python3',['-c','import sys, json; from notice_payload import read_payload; print(json.dumps(read_payload(sys.argv[1:], sys.stdin)))',...args],{cwd,input,encoding:'utf8'});
test('failure notice builds structured data with quoted text and arbitrary single-line labels',()=>{
 for(const player of ['explorer','A "friend" \\ tablet ☃']){
  const r=run(['--failure',player,'2026-03-10']);assert.equal(r.status,0,r.stderr);
  const p=JSON.parse(r.stdout);assert.ok(p.subject.includes(player));assert.ok(p.body.includes(player));
  assert.ok(p.body.includes('"your quest is being built"'));assert.ok(p.body.includes('2026-03-10'));
 }
});
test('existing structured stdin notices retain their exact subject and body',()=>{
 const payload={subject:'Review tomorrow',body:'A "quoted" line\nSecond line.'},r=run([],JSON.stringify(payload));
 assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),payload);
});
test('failure notices reject malformed arguments, dates and multiline headers before mail access',()=>{
 for(const args of [['--failure'],['--other','explorer','2026-03-10'],['--failure','explorer','bad-date'],['--failure','explorer\nOther: header','2026-03-10']])assert.notEqual(run(args).status,0);
});
