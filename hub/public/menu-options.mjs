// A reading-and-sequencing check for adult controls, not account authentication.
export function parentChallenge(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letters = Array.from({length:4}, () => alphabet[Math.floor(random()*alphabet.length)]);
  return {
    question: 'Ignore the numbers. Type only the letters, in reverse order.',
    code: letters.map(l => l + Math.floor(random()*10)).join(' '),
    answer: letters.toReversed().join(''),
  };
}
export function parentAnswerMatches(challenge, answer) {
  return !!challenge && String(answer).replace(/\s/g,'').toUpperCase() === challenge.answer;
}
export function menuStyle(player, configured, storage) {
  let saved;
  try { saved = storage?.getItem('family-games-menu-style:' + player); } catch {}
  return (saved || configured) === 'logos' ? 'logos' : 'screenshots';
}
export function gameArtwork(item, style) {
  return style === 'logos'
    ? {className:'game-logo',src:item.icon || '/game-icons/' + item.id + '.png'}
    : {className:'game-preview',src:'/previews/' + (item.preview || item.id) + '.jpg'};
}
