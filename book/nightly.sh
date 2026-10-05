#!/bin/bash
# The Book nightly (21:05, after bedtime): the kids' day recap (optional), then learner models + tomorrow's chapters
# and tomorrow's Letter Hunts.
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
  # The kids' day (06:00-20:00 local) being recapped: after noon it is TODAY (the 21:05 run, after bedtime), before noon YESTERDAY
  # (an early-morning run). Same rule as generate.mjs and hunts.mjs use for the chapter date.
  recapday="$(node -e 'const tz=process.env.FAMILY_TZ||Intl.DateTimeFormat().resolvedOptions().timeZone,now=Date.now(),h=Number(new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"numeric",hourCycle:"h23"}).format(now)),d=new Date(h<12?now-864e5:now);console.log(new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(d))')"
  limit 120 node "$BOOK_RECAP_SCRIPT" --date "$recapday" || echo "recap failed (non-fatal)"
  # The Book's part of the recap (per-beat tries, first-try right, fast taps, time per page, hunts found).
  limit 60 node "$here/recap-book.mjs" --date "$recapday" || echo "book recap failed (non-fatal)"
fi
limit "${BOOK_TIMEOUT:-2700}" node "$here/generate.mjs" "$@"
rc=$?
# The calm Book's own lines (greeting, the counting hand-over, specific praise, warm resets, easier/harder) for the
# chapters just written, in each chapter's own narrator voice: <player>/<date>.calm.json beside the chapter. Optional:
# without it the chapter plays in the same calm style with its ordinary lines.
limit "${BOOK_CALM_TIMEOUT:-900}" node "$here/calm-lines.mjs" --render || echo "calm lines failed (non-fatal; the chapters play without them)"
[ $rc -eq 142 ] && echo "book nightly: TIMED OUT"
# Tomorrow's Letter Hunts, from each child's learner model (deterministic; on failure yesterday's stay, replayable).
limit "${BOOK_HUNTS_TIMEOUT:-900}" node "$here/hunts.mjs" || echo "hunts step failed (yesterday's hunts kept, replayable)"
echo "== done rc=$rc $(date '+%H:%M:%S')"
exit $rc
