// Read one accepted Number Park answer from a diagnostic action row. A partial
// block check is a real first attempt even though the round stays open for help.
// This does not read or change saves, and leaves retry deduplication to the caller.
const ANSWERS = new Set(['answer', 'cookie-answer', 'cookie-check', 'place-check']);
export function numberAttempt(row) {
  const kind = row?.input?.kind, after = row?.after, question = after?.question;
  if (row?.type !== 'action' || !ANSWERS.has(kind) || !question?.id) return null;
  if (kind === 'place-check' && (question.kind !== 'place' || question.placeMode !== 'build')) return null;
  const result = after.result;
  if (typeof result?.ok === 'boolean') return {question, ok: result.ok, help: !!result.helped};
  if (kind === 'place-check' && after.placeMessage &&
      Number.isInteger(after.placeChecks) && after.placeChecks > (row.before?.placeChecks || 0)) {
    return {question, ok: false, help: !!after.helped};
  }
  if (kind === 'cookie-check' && after.cookieMessage) return {question, ok: false, help: false};
  return null;
}
