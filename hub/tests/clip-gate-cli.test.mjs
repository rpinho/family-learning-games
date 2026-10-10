import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('the narration CLI returns complete JSON when missing recordings exceed a pipe buffer',async()=>{
 const book=await mkdtemp(join(tmpdir(),'synthetic-clip-gate-'));await mkdir(join(book,'living'));
 const lines=Object.fromEntries(Array.from({length:600},(_,i)=>['cue-'+i,['narrator','Synthetic missing recording '+i+' '+'.'.repeat(180)]]));
 await writeFile(join(book,'living','stories.json'),JSON.stringify({stories:{scene:{voices:{narrator:{voice:'af_heart',speed:1}},lines}},clips:{}}));
 const result=spawnSync(process.execPath,[new URL('../scripts/check-clips.mjs',import.meta.url).pathname,'--book',book,'--json'],{encoding:'utf8',maxBuffer:2**20});
 assert.equal(result.status,1,result.stderr);assert.ok(Buffer.byteLength(result.stdout)>65536);
 const output=JSON.parse(result.stdout);assert.equal(output.ok,false);assert.equal(output.missing.length,600);assert.equal(output.missing.at(-1).key,'cue-599');
});
