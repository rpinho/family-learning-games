import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {join} from 'node:path';

// Execute the real promotion transaction with simulated launchd/filesystem
// boundaries. No test unloads a service or writes a household plist/save.
const cli = readFileSync(new URL('../../scripts/deploy/cli.mjs', import.meta.url), 'utf8');
const transaction = cli.slice(cli.indexOf('async function applyLive('), cli.indexOf('\nasync function tick()'));
function fixture(failure) {
  const file = '/fixture/service.plist', original = Buffer.from(JSON.stringify({EnvironmentVariables:{COACH:'quiet'}}));
  const desired = {EnvironmentVariables:{COACH:'lively'}};
  const files = new Map([[file, original]]), calls = [];
  let release = 'old', running = {release:'old',configuration:JSON.parse(original)}, failed = false, metadata;
  const context = {
    Buffer, process:{pid:42}, join,
    game:()=>({data:'/fixture/data',port:1234,uiPort:1235}),
    labelFor:()=> 'fixture.service', channelLink:()=>'/fixture/live',
    currentVersion:()=>release, releaseDir:(_name,version)=>version,
    existsSync:()=>true, backupSaves:()=>({dest:'/fixture/backup',hashes:{save:'unchanged'}}),
    readFileSync:path=>files.get(path),
    copyFileSync:(from,to)=>{files.set(to,files.get(from));calls.push('backup-plist');},
    writeFileSync:(path,bytes)=>files.set(path,bytes),
    renameSync:(from,to)=>{files.set(to,files.get(from));calls.push('restore-plist');},
    plistPath:()=>file, plistFor:()=>({obj:desired}),
    bootout:async()=>{calls.push('stop');running=null;},
    waitPortFree:async port=>{calls.push('wait:'+port);if(failure==='port'&&!failed){failed=true;return false;}return true;},
    writePlist:(path,obj)=>{calls.push('configure');files.set(path,Buffer.from(JSON.stringify(obj)));},
    bootstrap:async()=>{calls.push('start');if(failure==='start'&&!failed){failed=true;throw Error('load failed');}running={release,configuration:JSON.parse(files.get(file))};},
    kickstart:()=>{throw Error('kickstart would retain the old environment');},
    applyVoice:()=>{calls.push('voice-new');return 'old-voice';},
    restoreVoiceManifests:()=>calls.push('voice-old'),
    atomicSymlink:version=>{release=version;calls.push('release:'+version);},
    verifyServing:async()=>{calls.push('verify:'+release);if(failure==='health'&&!failed){failed=true;return {ok:false,why:'unhealthy'};}return {ok:!!running,statuses:{'/health':200}};},
    setCurrent:(_channel,_name,version)=>{metadata=version;},
    compareSaves:()=>[],hashSaves:()=>({save:'unchanged'}),log:line=>calls.push(line),
  };
  vm.createContext(context);vm.runInContext(transaction+'\nthis.promote=applyLive;',context);
  return {promote:()=>context.promote('game','new'),files,calls,original,file,get running(){return running;},get metadata(){return metadata;}};
}

test('Promotion loads changed environment and backs up the original plist before stopping',async()=>{
  const f=fixture();assert.equal(await f.promote(),true);
  assert.equal(f.running.release,'new');assert.equal(f.running.configuration.EnvironmentVariables.COACH,'lively');
  assert.equal(f.metadata,'new');assert.deepEqual(f.files.get('/fixture/backup/service.plist'),f.original);
  assert.ok(f.calls.indexOf('backup-plist')<f.calls.indexOf('stop'));
  for(const port of [1234,1235])assert.ok(f.calls.indexOf('wait:'+port)<f.calls.indexOf('configure'));
});
for(const failure of ['start','health','port'])test(`A ${failure} failure restores the old release, voice and loaded environment`,async()=>{
  const f=fixture(failure);assert.equal(await f.promote(),false);
  assert.equal(f.running.release,'old');assert.equal(f.running.configuration.EnvironmentVariables.COACH,'quiet');
  assert.deepEqual(f.files.get(f.file),f.original);assert.equal(f.metadata,undefined);
  assert.ok(f.calls.includes('voice-old'));assert.ok(f.calls.includes('verify:old'));
});

test('Staging also reloads the loaded configuration, so API checks exercise the intended environment',async()=>{
  const calls=[],desired={EnvironmentVariables:{COACH:'lively'}};let fileConfiguration,loadedConfiguration={EnvironmentVariables:{COACH:'quiet'}};
  const context={
    build:async()=> 'new',narrationGate:()=>{},qualityGate:()=>{},lock:()=>()=>{},existsSync:()=>true,
    dataDir:()=>'/fixture/data',refreshStagingData:()=>{},stagingHubConfig:()=>{},applyVoice:()=>{},
    currentVersion:()=> 'old',atomicSymlink:()=>{},releaseDir:()=>'/fixture/new',channelLink:()=>'/fixture/staging',
    plistFor:()=>({label:'fixture.staging',obj:desired}),plistPath:()=>'/fixture/service.plist',
    bootout:async()=>{calls.push('stop');loadedConfiguration=null;},
    portFor:()=>1234,uiPortFor:()=>1235,waitPortFree:async()=>true,
    writePlist:(_file,obj)=>{calls.push('configure');fileConfiguration=obj;},
    kickstart:()=>{throw Error('old loaded environment would remain');},
    bootstrap:async()=>{calls.push('start');loadedConfiguration=fileConfiguration;},
    verifyServing:async()=>({ok:loadedConfiguration?.EnvironmentVariables.COACH==='lively'}),
    setCurrent:()=>{},log:()=>{},console:{log:()=>{}},cfg:{lanHost:'fixture.invalid'},
  };
  vm.createContext(context);const stage=cli.slice(cli.indexOf('async function stage('),cli.indexOf('\n// ---------- promotion ----------'));
  vm.runInContext(stage+'\nthis.deploy=stage;',context);await context.deploy('hub','new',{});
  assert.deepEqual(calls,['stop','configure','start']);assert.equal(loadedConfiguration.EnvironmentVariables.COACH,'lively');
});
