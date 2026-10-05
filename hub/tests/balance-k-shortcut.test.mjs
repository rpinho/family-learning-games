import test from 'node:test';import assert from 'node:assert/strict';
import {SHORTCUTS,homeGames} from '../public/home-shortcuts.mjs';import {destination} from '../public/catalog.mjs';import {homePages} from '../public/home-pages.mjs';import {CATALOG} from '../public/catalog.mjs';import {subActivityFor,activityFor} from '../menu-order.mjs';
test('Younger animal balance opens its own Number Park game, with distinct history and a served icon',()=>{
 const card=SHORTCUTS.find(c=>c.id==='balance-scale-k');assert.ok(card);assert.equal(card.activity,'np:balance-k');assert.equal(card.icon,'/balance-scale-k.svg');const d=destination('#balance-scale-k');assert.equal(d.game,'number-park');assert.equal(d.query,'play=balance-k');assert.equal(subActivityFor('hub',{type:'client',kind:'open_game',detail:'balance-scale-k'}),'np:balance-k');
});
test('The sixth younger shortcut is discoverable on the first page for seven days',()=>{
 const picks=['cookie-share','pattern-parade','trace-numbers','take-away','maze-maker','balance-scale-k'];const cards=homeGames(CATALOG,picks);assert.equal(cards.filter(c=>picks.includes(c.id)).length,6);
 for(const columns of [3,5])for(const day of ['2026-10-03','2026-10-09']){const p=homePages(cards,{lead:1,columns,day,newGames:{'balance-scale-k':'2026-10-03'}});assert.ok(p.first.some(c=>c.id==='balance-scale-k'));}
});

test('Animal answers and actual block placements count toward the younger shortcut',()=>{
 for(const row of [{type:'action',input:{kind:'start',game:'balance-k'}},{type:'action',input:{kind:'answer'},before:{game:'balance-k'}},{type:'action',input:{kind:'balance-k-place'},before:{game:'balance-k'}}])assert.equal(subActivityFor('number-park',row),'np:balance-k');
 assert.equal(activityFor('number-park',{type:'action',input:{kind:'balance-k-place'}}),'number-park');assert.equal(subActivityFor('number-park',{type:'action',input:{kind:'pattern-level'},before:{game:'pattern'}}),null);
});
