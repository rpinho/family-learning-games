import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {homeGames} from '../public/home-shortcuts.mjs';
import {CATALOG,destination} from '../public/catalog.mjs';
test('All games retain the child order, with reviewed shortcuts at the top and no paging',async()=>{
 const order=CATALOG.slice().reverse();const shown=homeGames(order,['snack-friend','maze-maker']);
 assert.deepEqual(shown.slice(2),order);assert.deepEqual(shown.slice(0,2).map(x=>x.id),['snack-friend','maze-maker']);
 assert.deepEqual(homeGames(order),order);assert.equal(homeGames(order,['unknown','maze-maker','maze-maker']).length,order.length+1);
 const src=await readFile(new URL('../public/hub.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/shelfPage|shelf-navigation|shelf-prev|shelf-next/);assert.match(src,/shown\.map/);
});
test('Reviewed shortcuts reach their original activity and storage owner',()=>{
 const balance=destination('#balance-scale');assert.equal(balance.game,'number-park');assert.equal(balance.query,'play=balance');
 const c=destination('#snack-friend');assert.equal(c.type,'frame');assert.equal(c.game,'number-park');assert.equal(c.query,'play=cookies');
 for(const [route,game,path]of [['maker','maze-garden','maker'],['trace','maze-garden',''],['letters','letter-quest','maze']]){
  const d=destination('#maze-garden/'+route);assert.equal(d.game,game);assert.equal(d.route,path);
 }
});
test('A younger player\'s reviewed shortcuts open Number Park activities directly, up to six, above every game',()=>{
 for(const [id,query] of [['cookie-share','play=cookies'],['pattern-parade','play=pattern'],['trace-numbers','tab=draw'],['take-away','play=subtract']]){
  const d=destination('#'+id);assert.equal(d.type,'frame');assert.equal(d.game,'number-park');assert.equal(d.query,query);
 }
 const order=CATALOG.slice();const picks=['cookie-share','pattern-parade','trace-numbers','take-away','maze-maker'];
 const shown=homeGames(order,picks);
 assert.deepEqual(shown.slice(0,5).map(x=>x.id),picks);assert.deepEqual(shown.slice(5),order);
 // The other player's four are unchanged in order and content.
 const older=homeGames(order,['snack-friend','maze-maker','maze-trace','letter-labyrinth']);
 assert.deepEqual(older.slice(0,4).map(x=>x.id),['snack-friend','maze-maker','maze-trace','letter-labyrinth']);assert.equal(older[0].description,'Share the cookies fairly.');
 assert.equal(homeGames(order,[...picks,'maze-trace','letter-labyrinth']).length,order.length+6);
});
