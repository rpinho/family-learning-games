import test from 'node:test';
import assert from 'node:assert/strict';
import {recentSeeds,detailIssues} from '../detail-rotation.mjs';
test('seed history retains only the last three chapters',()=>{
 const used=recentSeeds([{meta:{details:['old'],themes:['old-theme']}},{meta:{details:['boat']}},{meta:{themes:['forest']}},{meta:{details:['festival']}}]);assert.deepEqual([...used.details],['boat','festival']);assert.deepEqual([...used.themes],['forest']);
});
test('duplicate optional touches and withheld seeds fail while shared ordinary words do not',()=>{
 const seed={id:'pancakes',seed:'pancakes with warm honey'},line=text=>({who:'narrator',text}),story={pages:[{say:[line('Pancakes wait by the river.')]},{say:[line('Dad packs pancakes with warm honey.')]}]};
 assert.match(detailIssues(story,{details:[seed]}).join('|'),/occurs twice/);assert.match(detailIssues(story,{blockedSeeds:[seed]}).join('|'),/last three/);
 assert.deepEqual(detailIssues({pages:[{say:[line('Your star lights its first step.')]}]},{blockedSeeds:[{id:'small-spells',seed:'A young wizard learns tiny three-letter spells one at a time. Each word lights a new star in his spellbook.'}]}),[]);
});
