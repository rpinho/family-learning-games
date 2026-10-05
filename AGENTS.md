# Install for your family

Use this when someone asks you to install or run this collection. Read README.md, PRIVACY.md and SECURITY.md first.

1. Check `node --version`, `npm --version`, and (if cloning) `git --version`. Require Node 22.13+. If a prerequisite is missing, explain it and use the user's permitted installation workflow; do not silently install system software or request unnecessary administrator privileges.
2. Clone this repository using its URL from the GitHub Code menu into a **new** user-selected or sensible local directory. Never overwrite an existing directory or reset a dirty checkout. A downloaded/unzipped copy works too.
   Replace `REPOSITORY_URL` with that exact clone URL:

   ```sh
   node --version
   npm --version
   git --version
   git clone REPOSITORY_URL "$HOME/family-learning-games"
   cd "$HOME/family-learning-games"
   ```

3. In the repository root, run **`npm run play`**. This installs locked dependencies, builds the two React apps, and starts the hub plus six existing servers. Keep the process running. For a split workflow use `npm run setup`, then `npm start`.
4. Open **http://localhost:4810/** and let the grown-up complete Family setup (a server-checked reading gate). Add each child with a first name/nickname and age or grade, starting skills, optional placement observations, interests and optional photos. Zero photos is a complete setup. Reopen **Grown-ups → Family setup** to edit or add a child. Never fill this with guessed real child data.
5. Verify the hub at **4810**, `/api/config`, `/api/dribble?player=beginner`, `/api/chess?player=beginner`, six embedded roots `/g/<game>/beginner/`, and their assets/APIs. Original API suffixes are `/api/beginner/state` for Letter Quest, `/api/beginner` for Word Arcade and Number Park, and `/api/state?player=beginner` for the other three; prefix them with `/g/<game>/beginner`. Also verify Guess My Drawing, Maze Garden’s four activities, Soccer Club’s three activities, and the chess path. Before onboarding, these reads produce fresh generic profiles. After onboarding, use the child IDs from `/api/config` for the hub and embeds (IDs remain stable on edits). Use Admin for automated checks; do not record test scores in a child’s save. Do not create test scores in a child's preset; use Admin if writes are necessary.
6. Return **one home-screen link, http://localhost:4810/**, and explain that the server terminal must remain open. Install the hub once, not each game separately. A different device needs trusted-LAN access; only enable `HOST=0.0.0.0` if the user wants it. Game backends remain loopback-only. Never create a public tunnel, public host, firewall exception or router port forward as a default installation step. Do not promise a publicly playable URL or guaranteed offline/PWA behavior.

## Private data and verification

Default launcher storage is the repository’s ignored `.data/` folder. The hub and nightly writer share this layout:

```text
.data/
  hub/                         hub saves, private logs and Book progress
  <game>/                      the six original game saves and logs
  book/profiles.json           names, age/grade, reported starting skills and interests
  book/cast.json               family cast and per-child context
  book/photos/<child>/         optional local likeness images
  learner/<child>.json         Book learner model, including labelled onboarding estimates
  learner/<child>-learner.json compiled gameplay evidence (nightly)
```

For an external private root, use the same environment on every start and scheduled run:

```sh
FAMILY_DEPLOY_ROOT="$HOME/.local/share/family-learning-games" npm run play
# Subsequent starts:
FAMILY_DEPLOY_ROOT="$HOME/.local/share/family-learning-games" npm start
```

Inspect existing data variables first. The launcher honours individual game data overrides and `FAMILY_DATA`; Book/learner overrides must remain inside the configured private root for onboarding writes. It refuses path traversal and symlinks below the private root. Never commit private profiles, photos, learner files, chapters, logs, voice caches, credentials or backups, even if an external folder is not covered by this repo’s `.gitignore`. Never point test instances at household data.

Basic read-only checks while `npm start` remains running:

```sh
curl --fail http://localhost:4810/health
curl --fail http://localhost:4810/api/config
curl --fail 'http://localhost:4810/api/dribble?player=admin'
curl --fail 'http://localhost:4810/api/chess?player=admin'
curl --fail http://localhost:4810/onboarding
```

Verify Family setup in a browser: the adult gate must precede private reads/writes, add a **fictional child only in an isolated test data root**, leave photos empty, save, return to Games, and confirm its name. Reopen setup and edit it; restart and verify it persists. In a real family installation, let the grown-up enter their data and confirm it privately. Verify each embedded game and its API using the route suffixes above. Optional World previews require a reviewed painting library and may report 503 until supplied; the separate fictional showcase is not household setup.

## Enable the nightly quest writer (optional)

Only enable this when the family asks for model-generated content. Ordinary games need no subscription. Install a supported CLI using the family’s approved workflow, and authenticate **as the family**, never using the installer’s account. For Codex:

```sh
npm install -g @openai/codex
codex login
codex login status
```

Complete the browser’s **ChatGPT** sign-in to use eligible subscription access; API-key sign-in uses separately billed API access. Access and limits depend on the family’s plan. See [official OpenAI authentication documentation](https://learn.chatgpt.com/docs/auth). Keep login caches/tokens out of this repository. Check `codex exec --help` for this version’s supported flags and choose a model available to that account.

From the repository root, first verify without model or voice calls, then run the subscribed writer:

```sh
# Local template smoke check; no text model or local voice installation required:
BOOK_BACKEND=none npm run book:nightly -- --no-llm
# Subscription-backed generation (override the model if needed):
BOOK_BACKEND=codex BOOK_CODEX_MODEL=gpt-6-sol npm run book:nightly -- --force
```

The second command replaces the local smoke-check chapter with a model-written one; scheduled runs do not use `--force`.

`book:nightly` shares the launcher’s `.data/` default, writes tomorrow’s Book/quest episode for every onboarded child, and disables voice rendering so a fresh installation needs no Python speech environment. Inspect the resulting `book/<child>/<date>.json` privately, confirm `meta.source` is the selected model rather than `template` or `deterministic quest fallback`, and preview from **Grown-ups → Watch**. Failed/unavailable providers can fall back to a template; a successful exit alone does not prove the subscription was used. The host must stay awake. The older `book/nightly.sh` also renders local voices and hunts; use it only after separately installing its voice dependencies.

To schedule on macOS/Linux, create a private executable wrapper **outside the repository**. Replace the repository and Node paths with those you verified (`command -v node`); include your explicit `FAMILY_DEPLOY_ROOT` if you use an external root. For example:

```sh
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/family-quests-nightly" <<'SH'
#!/bin/sh
cd "$HOME/family-learning-games" || exit 1
export BOOK_BACKEND=codex
export BOOK_CODEX_MODEL=gpt-6-sol
# Set this to the absolute Node executable reported by command -v node:
exec /path/to/node scripts/family-nightly.mjs
SH
chmod 700 "$HOME/.local/bin/family-quests-nightly"
```

Run the wrapper manually as the same signed-in OS user before scheduling it. It needs `codex` on its PATH (or export `BOOK_CODEX_BIN` to its absolute executable); schedulers often have a smaller PATH. Add this line with `crontab -e`, preserving existing entries, only after the family has requested the schedule:

```cron
5 21 * * * "$HOME/.local/bin/family-quests-nightly"
```

Use the OS user’s local time zone, or set `FAMILY_TZ` in the wrapper. On Windows, use Task Scheduler as the signed-in user to run Node with `scripts/family-nightly.mjs`, the repository as working directory and equivalent environment variables. Do not store credentials in the task definition. Do not install a public server, tunnel or third-party scheduler.

### Optional local likeness art

Photos are never passed to the text writer. A family can separately install a **local-only** Node art worker, set `FAMILY_PRIVATE_ART_SCRIPT` to its absolute path, and enable the photo permission in Family setup. The nightly runner invokes it only when enabled references exist, with `--references <private manifest> --book <private book dir>`. The manifest lists local photo paths and the `child-likeness` role; use the manifest’s `player` ID as that child’s actor ID. The worker should create the private `book/art/lib/library.json` and assets described in [book/SCHEMA.md](book/SCHEMA.md). There is no bundled image generator or cloud uploader. Never connect this step to a hosted photo/image API. A worker failure stops the generation run. To inspect its input locally without a worker, run `FAMILY_DEPLOY_ROOT="$PWD/.data" node book/private-art.mjs`; do not publish that manifest.

## What onboarding asks and why

First name/nickname and age/grade personalise the Book without needing a birthday or surname. Letters, counting, reading and maths guide a starting point; the optional placement prompts are labelled grown-up observations, never mastery evidence. Optional interests/favourite things guide story themes. Optional photos have their metadata stripped in the browser, stored only on the family’s server, and used only by an explicitly enabled local art step. With a text-model subscription enabled, selected names, interests, learning context and day notes leave the machine for the model provider; photo bytes do not. See [PRIVACY.md](PRIVACY.md). The adult gate is not authentication.

## Existing installations and recovery

- Start an installed copy with `npm start`; no rebuild is required unless source changed.
- Saves and diagnostics are in the root `.data/<game>/` directory. Preserve it during updates and reinstalls. Back it up privately before any migration. Never publish or attach it to an issue.
- Individual games can use their own data environment variables; inspect existing configuration before changing it. Never point a new/test installation at another household's saves.
- If ports are occupied, do not kill unrelated processes. Use a free seven-port block: `BASE_PORT` selects the first existing-game port; the hub uses one port below it (or `HUB_PORT`). Provide the adjusted single hub URL.
- If setup fails, report the actual failing command. Do not claim installation succeeded because cloning succeeded. Do not ignore build failures and start stale bundles.
- `npm test` runs the six app suites and hub tests sequentially; some tests use fixed isolated ports. Build before testing. For code changes, run the relevant tests and `npm run check:privacy` before any public commit.

## Publication boundaries

No real names, child drawings, saved profiles, logs, reports, home addresses, absolute personal paths, tokens, voice caches or private deployment metadata may enter public history. Review binary image metadata too. Use fictional/synthetic reproduction cases. Preserve third-party license notices. Never copy private source history into this repository.

Browser narration varies by device. Number Park's fallback names letters with example words; an adult must model phonemes and blending. Do not claim clinical validation, learning mastery or offline speech support.
