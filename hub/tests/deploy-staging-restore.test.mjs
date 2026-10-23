import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// A staging deploy whose release is gone is refused before staging changes; a failed readiness check switches staging
// back to the release it was on (synthetic fakes, no household state, no launchd).
const cli=readFileSync(new URL('../../scripts/deploy/cli.mjs',import.meta.url),'utf8');
const part=cli.slice(cli.indexOf('const releaseIntact ='),cli.indexOf('\n// ---------- promotion'));
function load({present=['new','old'],ready=['old']}={}){
 const st={link:'old',lines:[],switches:[],current:{hub:'old'}};
 const c={
  join:(...a)=>a.join('/'),existsSync:p=>p.startsWith('DATA')||present.some(v=>p===`R/${v}/.release.json`),
  releaseDir:(_n,v)=>`R/${v}`,channelLink:()=> 'L',atomicSymlink:t=>{st.link=t.split('/').pop();st.switches.push(st.link);},
  plistFor:()=>({label:'x',obj:{}}),plistPath:()=> 'p',bootout:async()=>{},bootstrap:async()=>{},writePlist:()=>{},
  portFor:()=>1,uiPortFor:()=>0,waitPortFree:async()=>true,
  verifyServing:async(_n,_c,v)=>ready.includes(v)?{ok:true}:{ok:false,why:'status {"/":0}'},
  guardStaging:()=>{},resolveRef:()=>({sha:'abc'}),build:async()=> 'new',qualityGate:()=>{},narrationGate:()=>{},contractGate:()=>{},
  lock:()=>()=>{},die:m=>{throw new Error(m);},dataDir:()=> 'DATA',refreshStagingData:()=>{},stagingHubConfig:()=>{},applyVoice:()=>{},
  currentVersion:()=>st.link,setCurrent:(_c,n,v)=>{st.current[n]=v;},log:m=>st.lines.push(m),console:{log(){}},cfg:{},Error};
 vm.createContext(c);vm.runInContext(part+'\nthis.stage=stage;',c);return {stage:c.stage,st};}

test('a failed staging readiness check switches staging back to the release it was on',async()=>{
 const {stage,st}=load({ready:['old']});
 await assert.rejects(stage('hub','new',{}),/staging hub new /);
 assert.deepEqual(st.switches,['new','old']);
 assert.equal(st.link,'old');assert.equal(st.current.hub,'old','current.json keeps the old release');
 assert.ok(st.lines.some(l=>l.startsWith('STAGING-FAILED hub new')));assert.ok(st.lines.includes('STAGING-RESTORED hub old'));
});
test('a release that is gone after its build is refused before staging changes',async()=>{
 const {stage,st}=load({present:['old']});
 await assert.rejects(stage('hub','new',{}),/is gone; staging unchanged/);
 assert.deepEqual(st.switches,[]);assert.equal(st.link,'old');
 assert.ok(st.lines.some(l=>l.startsWith('STAGING-REFUSED hub new')));
});
test('a ready release is staged and recorded; nothing to restore',async()=>{
 const {stage,st}=load({ready:['new','old']});
 await stage('hub','new',{});
 assert.deepEqual(st.switches,['new']);assert.equal(st.current.hub,'new');assert.ok(st.lines.includes('STAGED hub new'));
});
test('when the previous release is gone too, staging reports the failure without a second switch',async()=>{
 const {stage,st}=load({present:['new'],ready:[]});
 await assert.rejects(stage('hub','new',{}),/staging hub new /);
 assert.deepEqual(st.switches,['new']);assert.ok(!st.lines.some(l=>l.startsWith('STAGING-RESTORED')));
});
