// Replay updates the current view; learning evidence uses the first recorded
// attempt. Older summary-only logs cannot prove whether help was used.
export function firstPageResults(saved = [], logged = []) {
  const first = new Map();
  for (const row of [...logged].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (!Number.isInteger(row.page) || !Number.isFinite(Date.parse(row.at)) || first.has(row.page)) continue;
    first.set(row.page, row);
  }
  return saved.map(result => {
    const row = first.get(result.page);
    if (!row) return result;
    const sameAttempt = Math.abs(Date.parse(result.at) - Date.parse(row.at)) <= 50;
    const complete = Number.isFinite(row.misses) && Number.isFinite(row.hints);
    const out = {...result, at: row.at, helpUnknown: !complete && !sameAttempt};
    for (const key of ['correct', 'attempts', 'firstTapMs', 'guess', 'misses', 'hints']) {
      if (row[key] !== undefined) out[key] = row[key];
    }
    // Later misses are not the first attempt's misses. Legacy logs supply first
    // correctness but no miss count; unknown assistance stays conservative.
    if (!complete && !sameAttempt) { out.misses = row.correct === false ? 1 : 0; out.hints = 0; }
    return out;
  });
}
