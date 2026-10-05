import {allVoiceLines} from '../public/dialogue.mjs';
import {RESCUE_LINES,PUZZLE_LINES} from '../public/rescue.mjs';
process.stdout.write(JSON.stringify([...allVoiceLines(),...Object.values(RESCUE_LINES),...Object.values(PUZZLE_LINES)]));
