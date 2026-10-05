import test from 'node:test';import assert from 'node:assert/strict';
import {shelfPage} from '../public/calm-shelf.mjs';
import {CATALOG} from '../public/catalog.mjs';
test('shelves retain every destination exactly once in the captured preference order',()=>{const items=[{id:'my-book'},...CATALOG.slice().reverse()];const all=[];for(let page=0;page<shelfPage(items).count;page++){const s=shelfPage(items,page);assert.ok(s.items.length<=4);all.push(...s.items);}assert.deepEqual(all,items);assert.equal(new Set(all.map(x=>x.id)).size,items.length);assert.equal(shelfPage(items,-1).index,0);assert.equal(shelfPage(items,100).index,shelfPage(items).count-1);});
test('empty and partial shelves are safe without mutating the cached order',()=>{const items=Object.freeze([{id:'one'}]);assert.deepEqual(shelfPage(items,4).items,items);assert.deepEqual(shelfPage([]).items,[]);assert.equal(shelfPage([]).count,1);});
