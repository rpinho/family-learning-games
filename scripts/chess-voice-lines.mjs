import {
  UNITS,
  VOICE,
  pieceHint,
  NAMES,
} from "../hub/public/chess/curriculum.mjs";
import {STEP_UNITS,STEP_VOICE} from '../hub/public/chess/steps-curriculum.mjs';
const lines = [
  ...STEP_UNITS.flatMap(u=>[u.idea,u.cue,...u.hints]),...Object.values(STEP_VOICE),
  ...UNITS.flatMap((u) => [u.idea, u.question, u.cue, ...u.hints]),
  ...Object.values(VOICE).flat(),
  "What is your opponent threatening? Check that before choosing your next move.",
  "Keep the earlier ideas in mind. Look at the whole board and work out which pattern matters.",
  "Compare checks, captures and threats. Calculate their best reply.",
];
for (const type of Object.keys(NAMES))
  for (const file of "abcdefgh")
    for (let rank = 1; rank <= 8; rank++)
      lines.push(pieceHint(type, file + rank));
console.log(JSON.stringify([...new Set(lines)]));
