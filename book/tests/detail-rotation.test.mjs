import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseDetails} from '../quest-beats.mjs';
import {chooseThemes,planChapter} from '../plan.mjs';
import {detailIssues} from '../detail-rotation.mjs';
import {young} from './fixtures.mjs';
const detail={id:'pancakes',seed:'pancakes with warm honey',count:['pancake','pancakes','🥞']};
test('details and theme seeds used in any of the last three chapters are never offered, even seasonal ones',()=>{
 const previous=[{meta:{details:['pancakes'],themes:['kindness']}},{meta:{details:['cape'],themes:[]}},{meta:{details:['festival'],themes:[]}}],profile={details:[detail,{id:'cape',seed:'a bright blue cape'},{id:'festival',seed:'the autumn festival',window:['10-01','10-10']},{id:'boat',seed:'a tiny wooden boat'}]},life={themes:[{id:'kindness',seed:'help a shy friend'},{id:'building',seed:'build a wooden bridge'}]};
 const plan=planChapter(young,{date:'2026-10-04',profile,life,previous});assert.deepEqual(plan.details.map(d=>d.id),['boat']);assert.deepEqual(plan.themes.map(t=>t.id),['building']);
 assert.ok(!plan.blockedSeeds.some(d=>d.id==='boat'));assert.equal(planChapter(young,{date:'2026-10-04',profile:{details:[detail]},previous}).details.length,0);
 assert.deepEqual(chooseThemes(life,()=>.5,new Set(['kindness'])).map(t=>t.id),['building']);
 assert.equal(chooseDetails(profile,{date:'2026-10-04',avoid:new Set(['pancakes','cape','festival','boat'])}).length,0);
 const expired=planChapter(young,{date:'2026-10-04',profile:{details:[detail]},previous:[{meta:{details:['pancakes']}},{meta:{}},{meta:{}},{meta:{}}]});assert.equal(expired.details[0].id,'pancakes');
});
test('a detail cannot appear twice in the same chapter; prior seeds are rejected when smuggled into text',()=>{
 const line=text=>({who:'narrator',text}),story={pages:[{say:[line('Dad packs pancakes with warm honey.')]},{say:[line('Pancakes wait by the river bridge.')]}]};
 assert.match(detailIssues(story,{details:[detail]}).join('|'),/occurs twice/);
 assert.match(detailIssues(story,{blockedSeeds:[detail]}).join('|'),/last three/);
 assert.deepEqual(detailIssues({pages:story.pages.slice(0,1)},{details:[detail]}),[]);
});
test('a shared pair of ordinary words cannot ban required learning or an item payoff as a repeated theme',()=>{
 const seed={id:'small-spells',seed:'A young wizard learns tiny three-letter spells one at a time. Each word he sounds out lights a new star in his blue spellbook.'};
 assert.deepEqual(detailIssues({pages:[{say:[{who:'dad',text:'Your star lights its first step.'}]}]},{blockedSeeds:[seed]}),[]);
});
