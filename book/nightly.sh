#!/bin/bash
# The Book nightly: yesterday's recap (optional), then learner models + tomorrow's chapters.
# Low priority and time-boxed; a failure never touches the games. Configure with environment:
#   FAMILY_DEPLOY_ROOT, BOOK_RECAP_SCRIPT (optional recap generator), BOOK_CLAUDE_TOKEN_FILE,
#   BOOK_TIMEOUT (seconds, default 2700). Extra arguments go to generate.mjs.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Time-boxed, lowest priority. (perl exec needs real programs, not shell functions; exec failure = 127.)
if command -v taskpolicy >/dev/null; then LOW=(nice -n 19 taskpolicy -b); else LOW=(nice -n 19); fi
limit() { perl -e '$t=shift; alarm $t; exec @ARGV or exit 127' "$1" "${LOW[@]}" "${@:2}"; }
echo "== book nightly $(date '+%Y-%m-%d %H:%M:%S')"
if [ -n "${BOOK_RECAP_SCRIPT:-}" ] && [ -f "$BOOK_RECAP_SCRIPT" ]; then
  yesterday="$(node -e 'const d=new Date(Date.now()-864e5);console.log(new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d))')"
  limit 120 node "$BOOK_RECAP_SCRIPT" --date "$yesterday" || echo "recap failed (non-fatal)"
fi
limit "${BOOK_TIMEOUT:-2700}" node "$here/generate.mjs" "$@"
rc=$?
[ $rc -eq 142 ] && echo "book nightly: TIMED OUT"
# Tomorrow's Letter Hunts, from each child's learner model (deterministic; on failure yesterday's stay, replayable).
limit "${BOOK_HUNTS_TIMEOUT:-900}" node "$here/hunts.mjs" || echo "hunts step failed (yesterday's hunts kept, replayable)"
echo "== done rc=$rc $(date '+%H:%M:%S')"
exit $rc
