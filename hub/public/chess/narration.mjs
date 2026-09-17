import {STEP_VOICE} from './steps-curriculum.mjs';
import { VOICE } from './curriculum.mjs';

// Coaching is requested at task boundaries and by the learner, not after every move.
export function narrationFor(action, profile, cue) {
  if(action==='move'&&profile.session?.band==='steps'&&profile.session.phase==='puzzle'&&profile.session.ply>0)return {text:STEP_VOICE.collect,kind:'automatic'};
  if (action === 'hint') return { text: profile.session?.feedback?.voice, kind: 'hint' };
  if (action === 'game-hint') return { text: profile.game?.hint?.voice || VOICE.gameHint, kind: 'hint' };
  if (action === 'begin' || action === 'next') return {
    text: profile.session?.phase === 'summary' ? VOICE.checkpoint : cue,
    kind: 'automatic',
  };
  return null;
}

export function createNarrationGate(now = () => Date.now()) {
  const heard = new Map();
  let lastAutomatic = -Infinity;
  return (text, { force = false, kind = 'automatic' } = {}) => {
    if (!text) return false;
    const at = now();
    if (!force && (at - (heard.get(text) ?? -Infinity) < (kind === 'hint' ? 20000 : 90000) ||
        kind === 'automatic' && at - lastAutomatic < 15000)) return false;
    heard.set(text, at);
    if (!force && kind === 'automatic') lastAutomatic = at;
    return true;
  };
}
