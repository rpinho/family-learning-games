import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createBanterPicker,captureReaction,banterLines} from '../public/chess/banter.mjs';
import {freshChess,publicChess} from '../chess-state.mjs';

test('Optional chatter preserves saves, mute and necessary directions',()=>{
 const p=freshChess();p.settings.sound=false;const before=JSON.stringify(p);
 const pub=publicChess(p,100,{coachChatter:'lively'});assert.equal(pub.settings.coachChatter,'lively');assert.equal(pub.settings.sound,false);assert.equal(JSON.stringify(p),before);
 assert.equal(publicChess(p).settings.coachChatter,'quiet');
 let now=0;const pick=createBanterPicker(()=>now),s={id:'lesson',index:0,phase:'solved',hints:0,errors:0};
 const profile={settings:{coachChatter:'lively',sound:true},session:s};
 const first=pick('move',profile);assert.ok(first);assert.equal(pick('move',profile),null,'same solved board is never celebrated twice');
 now=1000;s.index=1;assert.equal(pick('move',profile),null,'fast answers get breathing room');
 now=8000;s.index=2;assert.notEqual(pick('move',profile),first);
 now=16000;s.index=3;profile.settings.sound=false;assert.equal(pick('move',profile),null);
 profile.settings.sound=true;assert.equal(pick('hint',profile),null);assert.equal(pick('begin',profile),null);
 const inventory=JSON.parse(execFileSync(process.execPath,[new URL('../../scripts/chess-voice-lines.mjs',import.meta.url).pathname]));
 for(const text of banterLines())assert.ok(inventory.includes(text));
});

test('Capture reactions describe the actual mover with either board orientation',()=>{
 assert.deepEqual(captureReaction({color:'b',captured:'q'},'b'),{kind:'youQueen',mood:'dismay',priority:true});
 assert.deepEqual(captureReaction({color:'w',captured:'q'},'b'),{kind:'meQueen',mood:'smug',priority:true});
 assert.equal(captureReaction({color:'w',captured:'n'},'w').mood,'shock');
 assert.equal(captureReaction({color:'b',captured:'p'},'w').mood,'smug');
 assert.equal(captureReaction({color:'w'},'w'),null);
});
