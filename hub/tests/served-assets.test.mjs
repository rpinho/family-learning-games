import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Every root-level picture the home screen points at must be on the server's list of files it serves
// (a card with a missing logo shows a broken image).
test('home screen pictures are served', async()=>{
 const hub=(await Promise.all(['hub.mjs','home-pages.mjs'].map(f=>readFile(new URL('../public/'+f,import.meta.url),'utf8')))).join('\n'),server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const list=server.match(/const files=\[([^\]]*)\]/)[1];
 const refs=[...new Set([...hub.matchAll(/["'`]\/([a-z0-9-]+\.(?:svg|png|webp))["'`]/g)].map(m=>m[1]))];
 assert.ok(refs.includes('my-book.svg'));
 for(const f of refs)assert.ok(list.includes(`'${f}'`),`${f} is referenced by the home screen but not served`);
});

test('Shortcut logos, favicon and manifest icon sizes are served and decode as the declared PNG dimensions',async()=>{
 const {SHORTCUTS}=await import('../public/home-shortcuts.mjs');
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const list=server.match(/const files=\[([^\]]*)\]/)[1];
 for(const item of SHORTCUTS){assert.ok(list.includes(`'${item.icon.slice(1)}'`));assert.match(await readFile(new URL('../public'+item.icon,import.meta.url),'utf8'),/<svg/);}
 const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 for(const icon of [...manifest.icons,{src:'/apple-touch-icon.png',sizes:'180x180'},{src:'/favicon.png',sizes:'48x48'}]){
  const file=icon.src.split('?')[0].slice(1);assert.ok(list.includes(`'${file}'`));
  const png=await readFile(new URL('../public/'+file,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);
 }
});

// A layout helper must load through the production allowlist, not just a test file server.
test('Book and World module dependencies are served by the hub',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8'),list=server.match(/const files=\[([^\]]*)\]/)[1];
 for(const entry of ['book.mjs','book-scene.mjs','world.mjs']){
  const source=await readFile(new URL('../public/'+entry,import.meta.url),'utf8');
  for(const [,file] of source.matchAll(/from ['"]\.\/([^'"]+\.mjs)['"]/g))assert.ok(list.includes(`'${file}'`),`${entry} imports ${file}, which must be served`);
 }
});
