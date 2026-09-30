import test from 'node:test';
import assert from 'node:assert/strict';
import {allVoiceLines} from '../public/dialogue.mjs';
import {RESCUE_LINES,PUZZLE_LINES} from '../public/rescue.mjs';
import {briefLine} from '../public/voice.mjs';

test('release narration includes short automatic rescue cues and full manual replays',()=>{
 const lines=allVoiceLines();
 assert.ok(lines.includes('Rescue complete!'));
 for(const cue of [...Object.values(RESCUE_LINES),...Object.values(PUZZLE_LINES)]){
  assert.ok(lines.includes(cue),`manual replay: ${cue}`);
  assert.ok(lines.includes(briefLine(cue)),`automatic narration: ${briefLine(cue)}`);
 }
 assert.equal(new Set(lines).size,lines.length);
});
