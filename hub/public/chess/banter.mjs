// Optional character performance. Core task narration has priority over banter.
export const BANTER = {
  solved: [
    "You found it! I shall claim I taught you that.",
    "Excellent! My eyebrows are giving you a standing ovation.",
    "Aha! You did the thinking. I did the dramatic staring.",
    "Well played! I was about to say that. Probably.",
    "You spotted it! My detective hat is jealous.",
    "Nicely done! A small parade seems appropriate.",
    "That worked! I shall look impressed. Very impressed.",
    "Brilliant! I will take credit for the moral support.",
  ],
  assisted: [
    "We found it together! I make an excellent sidekick.",
    "A clue, a little thinking, and there it is!",
    "Good teamwork! My job was mostly the eyebrows.",
  ],
  retry: [
    "No drama. Well, a tiny bit. Let's try again.",
    "A little puzzle for both of us. I shall put on my thinking face.",
    "Not yet! Even my grand plans need another look.",
  ],
};
export const banterLines = () => Object.values(BANTER).flat();

export function createBanterPicker(now = () => Date.now()) {
  let lastAt = -Infinity, lastTask = '', retries = 0;
  const turns = {};
  return (action, profile) => {
    if (profile.settings?.coachChatter !== 'lively' || !profile.settings.sound || action !== 'move') return null;
    const s = profile.session;
    if (!s || s.phase === 'intro') return null;
    const key = `${s.id}:${s.index}`;
    let kind;
    if (s.phase === 'solved') {
      if (key === lastTask) return null;
      lastTask = key;
      kind = s.hints || s.errors ? 'assisted' : 'solved';
    } else if (s.feedback?.kind === 'incorrect' && ++retries % 2 === 0) kind = 'retry';
    if (!kind || now() - lastAt < 6500) return null;
    lastAt = now();
    const i = turns[kind] || 0;
    turns[kind] = i + 1;
    return BANTER[kind][i % BANTER[kind].length];
  };
}

export function captureReaction(move, learnerSide) {
  if (!move?.captured) return null;
  return { kind: move.color === learnerSide ? move.captured === 'q' ? 'youQueen' : 'youCapture' : move.captured === 'q' ? 'meQueen' : 'meCapture',
    mood: move.color === learnerSide ? move.captured === 'q' ? 'dismay' : 'shock' : 'smug',
    priority: move.captured === 'q' };
}
