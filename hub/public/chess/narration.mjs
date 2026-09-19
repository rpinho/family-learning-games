import {FOUNDATION_VOICE} from './foundations-curriculum.mjs';
import {STEP_VOICE} from './steps-curriculum.mjs';
import { VOICE } from './curriculum.mjs';

// Coaching is requested at task boundaries and by the learner, not after every move.
export function narrationFor(action, profile, cue) {
  if(action==='move'&&profile.session?.phase==='solved'&&profile.session?.band==='foundations'&&profile.session?.unit==='learn-fork')return {text:FOUNDATION_VOICE.fork,kind:'task'};
  if(action==='move'&&profile.session?.band==='steps'&&profile.session.phase==='puzzle'&&profile.session.ply>0){
    const mate=profile.session.puzzle?.task==='Find checkmate';
    const skewer=profile.session.puzzle?.task==='Take the rook';
    if((mate||skewer)&&profile.session.feedback?.kind==='incorrect')return null;
    return {text:mate?STEP_VOICE.finishMate:skewer?STEP_VOICE.collectRook:STEP_VOICE.collect,kind:mate||skewer?'continuation':'automatic'};
  }
  if (action === 'hint') return { text: profile.session?.feedback?.voice, kind: 'hint' };
  if (action === 'game-hint') return { text: profile.game?.hint?.voice || VOICE.gameHint, kind: 'hint' };
  if (action === 'begin' || action === 'next') return {
    text: profile.session?.phase === 'summary' ? FOUNDATION_VOICE.finished : cue,
    kind: 'task',
  };
  return null;
}

export function createNarrationGate(now = () => Date.now()) {
  const heard = new Map();
  let lastAutomatic = -Infinity;
  return (text, { force = false, kind = 'automatic' } = {}) => {
    if (!text) return false;
    const at = now();
    if (!force && kind !== 'task' && (at - (heard.get(text) ?? -Infinity) < (kind === 'hint' ? 20000 : 90000) ||
        kind === 'automatic' && at - lastAutomatic < 15000)) return false;
    heard.set(text, at);
    if (!force && kind === 'automatic') lastAutomatic = at;
    return true;
  };
}
