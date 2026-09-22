import test from 'node:test';
import assert from 'node:assert/strict';
import {freshChess} from '../chess-state.mjs';
import {pathProgress,shortPracticeLesson} from '../public/chess/path.mjs';
import {STEP_LESSONS} from '../public/chess/steps-curriculum.mjs';

test('Unseen short lessons are discoverable after older bridge progress without moving Continue',()=>{
 const p=freshChess();p.settings.band='steps';
 p.completed['steps-real-fork-1']={times:1,best:3,bestTotal:5,band:'steps'};
 p.session={lesson:'steps-real-fork-1',phase:'summary'};
 const snapshot=structuredClone(p);
 assert.equal(shortPracticeLesson(p).id,'steps-board-loose-1');
 assert.equal(pathProgress(p).find(l=>l.current).id,'steps-real-fork-2');
 assert.deepEqual(p,snapshot);
 p.completed['steps-board-loose-1']={times:1,best:2,band:'steps'};
 assert.equal(shortPracticeLesson(p).id,'steps-board-loose-2');
 for(const l of STEP_LESSONS.filter(l=>l.id.startsWith('steps-board-')))p.completed[l.id]={times:1};
 assert.equal(shortPracticeLesson(p),null);
});

test('Short practice shortcut never replaces unfinished work or appears in another course',()=>{
 const p=freshChess();p.settings.band='steps';
 assert.equal(shortPracticeLesson(p),null);
 p.completed['steps-real-fork-1']={times:1};
 for(const phase of ['intro','puzzle','solved']){
  p.session={lesson:'steps-real-fork-2',phase};assert.equal(shortPracticeLesson(p),null);
 }
 p.session=null;assert(shortPracticeLesson(p));
 for(const band of ['foundations','guided','stretch']){p.settings.band=band;assert.equal(shortPracticeLesson(p),null);}
});
