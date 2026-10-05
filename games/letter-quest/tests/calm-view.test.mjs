import test from 'node:test';
import assert from 'node:assert/strict';
import {calmHome,calmFeedback} from '../public/calm-view.mjs';
test('study entrance preserves profile, escapes its label and exposes four choices with the other games reachable',()=>{
 const profile={name:'<img onerror=bad>',xp:700,completed:12,settings:{sound:false}},before=structuredClone(profile),html=calmHome(profile);
 assert.deepEqual(profile,before);assert.equal((html.match(/class="calm-choice"/g)||[]).length,4);assert.ok(html.includes('&lt;img onerror=bad&gt;'));assert.ok(!html.includes('<img onerror'));
 for(const target of ['start','tab:matches','tab:reading','tab:adventure','tab:maze','tab:rescue','tab:soccer'])assert.ok(html.includes(`data-action="${target}"`));
 assert.ok(!html.includes('src="/calm-'),'art must resolve next to the module (hub /g/ prefix)');assert.equal((html.match(/src="[^"]*calm-(letters|words|reading|story)\.svg"/g)||[]).length,4);
 assert.ok(!html.includes('700'));assert.ok(!/reward|XP|gems/.test(html));
});
test('quiet feedback names the actual activity without making a mastery claim',()=>{
 assert.equal(calmFeedback({type:'trace',char:'A'}),'You traced A.');assert.equal(calmFeedback({type:'find',char:'B'}),'You found B.');assert.equal(calmFeedback({type:'spell',word:'cat'}),'You built cat.');
});
