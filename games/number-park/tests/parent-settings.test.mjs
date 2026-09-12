import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchPlayer,chooseDevicePlayer,PARENT_PLAYER_KEY} from '../lib/player-launch.mjs';
test('parent device choice survives stale installed links, generic launches and refresh',()=>{
 for(const id of ['beginner','explorer','admin'])for(const search of ['','?player=beginner','?player=explorer&tab=draw&_refresh=123'])assert.equal(launchPlayer(search,'beginner',id),id);
 assert.equal(launchPlayer('?player=explorer','beginner','invalid'),'explorer');
});
test('parent switch is explicit, remembers choice and never writes a learning profile',()=>{
 const writes=[],applied=[],events=[];const options={id:'explorer',current:'beginner',saving:false,draft:false,confirm:()=>true,storage:{setItem:(...args)=>writes.push(args)},apply:id=>applied.push(id),report:e=>events.push(e)};
 for(const extra of [{saving:true},{id:'beginner'},{id:'unknown'},{draft:true,confirm:()=>false}])assert.equal(chooseDevicePlayer({...options,...extra}),false);
 assert.deepEqual(writes,[]);assert.deepEqual(applied,[]);assert.equal(chooseDevicePlayer(options),true);
 assert.deepEqual(writes,[[PARENT_PLAYER_KEY,'explorer']]);assert.deepEqual(applied,['explorer']);assert.deepEqual(events,[{from:'beginner',to:'explorer'}]);
 assert.throws(()=>chooseDevicePlayer({...options,storage:{setItem:()=>{throw Error('blocked')}}}));assert.equal(applied.length,1);
});
test('selector stays in parent dialog, large name stays visible and menu pauses auto-play',()=>{
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8'),menu=readFileSync(new URL('../app/parent-settings.tsx',import.meta.url),'utf8');
 assert.ok(page.indexOf('<ParentSettings')>page.indexOf('<footer>'));assert.match(menu,/<DialogContent/);assert.match(menu,/Player on this device/);assert.match(menu,/Use \{names\[choice\]\}/);assert.match(page,/className="player-identity"/);assert.match(page,/visible&&!parentOpen/);assert.match(page,/active=\{tab==='planning'&&!parentOpen\}/);
 const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url)));assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');
});
