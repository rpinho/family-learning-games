// A demonstration ends a stuck card without turning the answer into a win.
export function flashcardCorrection(q) {
  if (q?.game !== 'flashcards') return null;
  if (q.deck === 'words' && Number.isInteger(q.position)) {
    return `The word is ${q.word}. The missing letter is ${q.answer.toUpperCase()}.`;
  }
  if (q.deck === 'letters') return q.help;
  return null;
}
