# Deploying changes to a running household install

Children may be playing at any moment. A restart, a half-written file or a rebuilt bundle
under a running server freezes their game. So production never runs from a working tree.

## Rules for every agent (read before touching a game)

1. **Never restart a live service** (`launchctl kickstart`, `bootout`, killing a PID, `npm start` on a live port).
2. **Never write into live data or voice directories.** Saves, logs and voice clip stores belong to the running games.
3. **Never build inside a directory a live service runs from.** Production runs from immutable release
   directories; the source repositories are only for development.
4. **Commit, then deploy to staging:** `scripts/stage <game> [commit]`. Test there.
5. **Promote through the queue:** `scripts/promote <game> [commit|staging]`. It goes live on its own when
   nobody is playing. Do not wait for it, and do not try to force it.
6. **Heavy work runs at the lowest priority:** wrap builds, voice generation, headless browsers and
   ffmpeg in `nice -n 19 taskpolicy -b …`. `stage` and `promote` already do this for their own steps.

`<game>` is one of the ids in the private `deploy.json` (the six games plus `hub`).

## How it works

- **Releases.** `build` exports a commit with `git archive` into
  `$FAMILY_DEPLOY_ROOT/releases/<game>/<commit-time>-<sha>/`, clones `node_modules` copy-on-write
  when the lockfile is unchanged (otherwise `npm ci`), runs the build, and writes `.release.json`.
  A release is never modified afterwards. `$FAMILY_DEPLOY_ROOT` defaults to `~/.local/share/family-games`.
- **Channels.** `live/<game>` and `staging/<game>` are symlinks to releases. Services start from the
  symlink, so a restart picks up the new release, and switching back is one symlink.
- **Voice clips** stay in each game's data directory and are only ever added. At build time the
  release's own voice script runs against a copy-on-write clone of the live clip store, so only missing
  clips are synthesised. The release stores those new clips and its manifest. Promotion copies the
  missing clips first (it never overwrites or deletes one) and refuses to go live if any declared clip is
  missing.
- **Staging** is a parallel set of services on the live port + 1000 (the hub is on the hub port + 1000).
  It has its own copy of the saves (`staging-refresh <game|all>` copies the current live saves over it)
  and shows a red STAGING banner.
- **Promotion.** `promote` builds the release, starts it on a temporary port against a copy-on-write
  clone of the live saves, checks its health, and writes `queue/<game>.json`. The promoter job runs every
  minute. It goes live only when **every game and the hub have been idle for 15 minutes**, or during the
  night window (21:00–06:30) after 2 quiet minutes. "Idle" uses real play: the last input reported by
  open pages, write requests through the hub, and save-file times. The promoter then:
  1. backs up the saves (with SHA-256 sums) to the backups directory;
  2. adds the new voice clips;
  3. switches the symlink and restarts that one service;
  4. checks health and that the listening process runs from the new release;
  5. checks that the saves are byte-identical.

  If the health check fails, it rolls back to the previous release automatically. Every step is logged
  to `promotions.log`.
- **No stale pages.** The hub injects each page's release ids and exposes `/__deploy/version`. Open pages
  poll it every minute. When their game's release (or the hub's) changes, they reload themselves at a
  natural boundary: a home or menu screen, a finish screen, or between rounds. They never reload
  mid-round, during a word break, or while a save is in flight. If nobody has touched the page for 10
  minutes, it reloads anyway. While a game restarts, API calls retry with backoff instead of failing:
  reads always retry, and writes retry only when the game provably never received them.

## Commands

    scripts/stage <game|all> [ref]          # build + deploy to staging (any time)
    scripts/promote <game> [ref|staging]    # build + check + queue for live
    node scripts/deploy/cli.mjs status      # versions, queue, idle state
    node scripts/deploy/cli.mjs staging-refresh <game|all>
    node scripts/deploy/cli.mjs rollback <game> [--now]   # --now only for a broken live game

After changing the tooling itself, run `node scripts/deploy/cli.mjs install` so the promoter uses the new copy.
