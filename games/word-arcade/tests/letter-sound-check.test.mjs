import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {homedir} from 'node:os';
// The shared letter-sound clip check (scripts/letter_sound_check.py) on synthetic cases, incl. a click right at the edge of
// silence. Runs where the family's voice Python is installed; skipped elsewhere.
const py=process.env.VOICE_PYTHON||homedir()+'/.local/share/letter-quest-voice-env/bin/python';
test('Letter-sound check catches edge clicks, hard onsets and stops, and short sounds; passes smooth ones',{skip:!existsSync(py)&&'voice Python not installed'},()=>{
 const r=spawnSync(py,['scripts/letter_sound_check.py','selftest'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/selftest ok/);
});
