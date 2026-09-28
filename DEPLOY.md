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

A top-level `env` in `deploy.json` is added to every service's environment (a game's own `env` wins). Use it for
`FAMILY_EXTRA_HOSTS`: extra names or addresses this machine answers to (comma separated, e.g. a VPN name), which
every game and the hub accept in their host allowlist alongside `localhost`, the hostname and the current interface
addresses (re-read every few seconds). At an idle-gated promotion, the service's launchd plist is regenerated
from these settings and that service is unloaded/reloaded, so the new process receives changed environment
variables. Merely writing a plist and calling `kickstart` would retain launchd's old environment.

## HTTPS (installable app, microphone)

Browsers only install a proper app and only allow the microphone on a secure origin. Put a TLS reverse proxy on
this machine in front of the **hub port only** (for example a VPN's built-in HTTPS serve feature), proxying to
`http://127.0.0.1:<hub port>` and sending `X-Forwarded-Proto: https`. The hub trusts that header only from a loopback
peer. The games need no HTTPS origin of their own: the hub reaches them through its same-origin
`/g/<game>/<player>/` proxy. Add the proxy's host name to `FAMILY_EXTRA_HOSTS`. Plain http keeps working in parallel.
Open `https://<name>/?player=<id>` and install from there: each player's link has its own manifest, so each child's
installed app opens that child's profile.

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
  configured quiet windows after their short idle guard (see below). "Idle" uses real play: the last input reported by
  open pages, write requests through the hub, and save-file times. The promoter then:
  1. backs up the saves (with SHA-256 sums) to the backups directory;
  2. adds the new voice clips;
  3. switches the symlink, updates the launchd configuration and reloads that one service;
  4. checks health and that the listening process runs from the new release;
  5. checks that the saves are byte-identical.

  The original service plist is included in the backup. If loading the service or checking its health fails,
  it restores the previous release, voice manifest and original service configuration automatically. Every step is logged
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


## Quiet windows (2026-09-27)
The children's day runs 06:00-20:00 local (on Saturdays it ends about 19:30; treat it as 20:00). Promotions go live after 15 idle minutes at any time, or inside a quiet window after a short idle: **every night 20:00-06:00** (2 min), and **weekdays 07:30-15:00** while they are at school (5 min idle, a guard for sick days and holidays). Configure with `quietWindows` in the private deploy.json.

## Forward only (2026-09-28)

`promote` and the promoter refuse a release whose commit does not contain the live release's commit
(`git merge-base --is-ancestor`): "live X is not in candidate Y; merge first". Merge what is live into your branch,
then stage and promote. A deliberate rollback says so: `promote --allow-rollback`, or the `rollback` command (it sets
it). Refused queue entries move to `queue/refused/`.

## Previews: ideas waiting for Ricardo's review (2026-09-28)

Staging is for release candidates. A NEW IDEA is built on an `idea/*` branch and shown as a **preview**, never
promoted without Ricardo's review:

    node scripts/deploy/cli.mjs preview create <name> <game|hub> idea/<branch>   # build, check, run, print the URL
    node scripts/deploy/cli.mjs preview list
    node scripts/deploy/cli.mjs preview approve <name>    # marks it approved and prints the merge step
    node scripts/deploy/cli.mjs preview reject <name>     # stops it; release + data moved to previews-archive/
    node scripts/deploy/cli.mjs preview close <name>      # after an approved idea went live the normal way

- **URL:** `https://ricardos-mac-mini.tail5a4676.ts.net:8443/preview/<name>/?player=diogo|francisco|admin`, through the
  staging site (Tailscale is not touched). Opening it sets a cookie; while it is set, the staging hub sends everything to
  a hub/Book preview's own hub, or only that game's traffic (`/g/<game>/...`) to a game preview. A small
  "PREVIEW · <name> · exit" banner shows; `/preview/exit` leaves it.
- **Data:** each preview has its OWN data dir under `previews/<name>/`, a copy-on-write clone of the live saves (a hub
  preview also clones the book, and uses the STAGING games). It never writes to live or staging data.
- **Limits:** at most 3 previews run at once (16 GB Mini); a fourth is refused. Ports 5400+ on 127.0.0.1.
- **Restarts:** one launchd job per preview (`com.ricardo.family-games-preview.<name>`, background priority), so previews
  come back after a reboot. Creating a preview builds and checks under `nice`/`taskpolicy` like `stage`; it never
  touches live services, so it is allowed any time. Registry: `previews.json`.
- **Approved:** merge the idea branch into the normal line (it must contain live), stage, test, then the usual
  idle-gated promote. Close the preview once it is live.
