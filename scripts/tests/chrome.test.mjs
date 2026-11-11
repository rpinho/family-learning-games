import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {findChrome} from '../chrome.mjs';

test('explicit Chrome executable takes precedence over installed browsers',t=>{
 const root=mkdtempSync(join(tmpdir(),'chrome-discovery-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const executable=join(root,'browser');writeFileSync(executable,'#!/bin/sh\nexit 0\n',{mode:0o700});
 assert.equal(findChrome({CHROME:executable}),executable);
});
test('an unavailable explicit executable reports absence instead of using another browser',()=>{
 assert.equal(findChrome({CHROME:join(tmpdir(),'missing-browser','chrome')}),null);
});
