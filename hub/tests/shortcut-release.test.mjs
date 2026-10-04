import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {releasedShortcuts} from '../shortcut-release.mjs';

const catalog=[{id:'existing'},{id:'new-activity',game:'puzzle-game',requiresFile:'lib/new-activity.mjs'}];
test('Independent release channels expose a shortcut only when its backend contains the activity',()=>{
 const root=mkdtempSync(join(tmpdir(),'shortcut-release-')),live=join(root,'live'),stage=join(root,'stage'),old=join(root,'old'),next=join(root,'next');
 for(const dir of [live,stage,old,next])mkdirSync(join(dir,'lib'),{recursive:true});
 writeFileSync(join(next,'lib/new-activity.mjs'),'export const activity=true;');
 symlinkSync(old,join(live,'puzzle-game'));symlinkSync(next,join(stage,'puzzle-game'));
 const picks=['existing','new-activity'];
 assert.deepEqual(releasedShortcuts(picks,catalog,live),['existing']);
 assert.deepEqual(releasedShortcuts(picks,catalog,stage),picks);
 assert.deepEqual(picks,['existing','new-activity'],'household selections are retained');
 assert.deepEqual(releasedShortcuts(picks,catalog,null),['existing']);
});
test('Release checks are local, bounded and reject escaping paths',()=>{
 let reads=0;const exists=()=>{reads++;return true;};
 for(const requiresFile of ['../save.json','/save.json','lib/../../save.json'])assert.deepEqual(releasedShortcuts(['x'],[{id:'x',game:'puzzle-game',requiresFile}],'/channel',exists),[]);
 assert.equal(reads,0);
 assert.deepEqual(releasedShortcuts(null,catalog,'/channel',exists),[]);
 assert.deepEqual(releasedShortcuts(['new-activity'],catalog,'/channel',exists),['new-activity']);assert.equal(reads,1);
});
