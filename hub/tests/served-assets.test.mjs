import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Every root-level picture the home screen points at must be on the server's list of files it serves
// (a card with a missing logo shows a broken image).
test('home screen pictures are served', async()=>{
 const hub=await readFile(new URL('../public/hub.mjs',import.meta.url),'utf8'),server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const list=server.match(/const files=\[([^\]]*)\]/)[1];
 const refs=[...new Set([...hub.matchAll(/["'`]\/([a-z0-9-]+\.(?:svg|png|webp))["'`]/g)].map(m=>m[1]))];
 assert.ok(refs.includes('my-book.svg'));
 for(const f of refs)assert.ok(list.includes(`'${f}'`),`${f} is referenced by the home screen but not served`);
});
