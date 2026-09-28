import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {join} from 'node:path';
// Forward only: a release goes live only if it contains the live commit (a synthetic repo, no household state).
const cli=readFileSync(new URL('../../scripts/deploy/cli.mjs',import.meta.url),'utf8');
const part=cli.slice(cli.indexOf('function forwardCheck('),cli.indexOf('\n// ---------- previews'));
function repo(){const d=mkdtempSync(join(tmpdir(),'fwd-'));const g=(...a)=>spawnSync('git',['-C',d,...a],{encoding:'utf8'});
 g('init','-q','-b','main');g('config','user.email','t@t');g('config','user.name','t');
 const commit=m=>{writeFileSync(join(d,'f.txt'),m);g('add','.');g('commit','-qm',m);return g('rev-parse','HEAD').stdout.trim();};
 const a=commit('a'),b=commit('b');g('checkout','-qb','side',a);const c=commit('c');g('checkout','-q','main');g('merge','-q','--no-edit','side');const m=g('rev-parse','HEAD').stdout.trim();
 return {d,a,b,c,m};}
function load(ctx={}){const c={spawnSync,join,...ctx};vm.createContext(c);vm.runInContext(part+'\nthis.forwardCheck=forwardCheck;this.forwardOnly=forwardOnly;',c);return c;}

test('A candidate that misses the live commit is refused with a clear message; a descendant or a merge passes',()=>{
 const r=repo(),{forwardCheck}=load();
 assert.equal(forwardCheck(r.d,r.b,r.m),null,'the merge contains live');
 assert.equal(forwardCheck(r.d,r.a,r.b),null,'a descendant contains live');
 assert.match(forwardCheck(r.d,r.b,r.c),/^live [0-9a-f]{7} is not in candidate [0-9a-f]{7}; merge first/,'a branch cut before live is refused');
 assert.match(forwardCheck(r.d,r.b,'0'.repeat(40)),/cannot tell/,'an unknown commit is refused too');
 assert.equal(forwardCheck(r.d,r.b,r.b),null);
});
test('Promote and the promoter use it: live release vs candidate release; --allow-rollback goes back on purpose',()=>{
 const r=repo(),meta={live:r.b,old:r.c,next:r.m};
 const c=load({currentVersion:()=> 'live',releaseDir:(_n,v)=>v,readJSON:v=>meta[v.split('/')[0]]?{commit:meta[v.split('/')[0]]}:null,game:()=>({repo:r.d})});
 assert.match(c.forwardOnly('hub','old'),/hub: live [0-9a-f]{7} is not in candidate/);
 assert.equal(c.forwardOnly('hub','old',true),null,'a deliberate rollback');
 assert.equal(c.forwardOnly('hub','next'),null);
 assert.match(c.forwardOnly('hub','unknown'),/no recorded commit/);
 assert.ok(cli.includes("by: 'rollback', allowRollback: true"),'the rollback command allows going back');
 assert.ok(cli.indexOf('forwardOnly(q.game, q.version')<cli.indexOf('ok = await applyLive(q.game, q.version)'),'the promoter checks before going live');
});
