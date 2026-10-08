// Assistance points to the next repair; it never fills or submits a letter.
export function spellingSupport(question, slots, selected) {
  if (!question?.helped || question.result?.ok || !['build', 'change'].includes(question.kind)) return null;
  const index = Number.isInteger(selected) && selected >= 0 && selected < question.word.length
    ? selected : [...question.word].findIndex((letter, i) => slots[i] !== letter);
  return index < 0 || slots[index] === question.word[index] ? null : {index, letter: question.word[index]};
}
