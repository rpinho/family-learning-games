# Agent installation guide

Use this when someone asks you to install or run this collection. Read README.md, PRIVACY.md and SECURITY.md first.

1. Check `node --version`, `npm --version`, and (if cloning) `git --version`. Require Node 22.13+. If a prerequisite is missing, explain it and use the user's permitted installation workflow; do not silently install system software or request unnecessary administrator privileges.
2. Clone `https://github.com/rpinho/family-learning-games.git` into a **new** user-selected or sensible local directory. Never overwrite an existing directory or reset a dirty checkout. A downloaded/unzipped copy works too.
3. In the repository root, run **`npm run play`**. This installs locked dependencies, builds the two React apps, and starts the hub plus six existing servers. Keep the process running. For a split workflow use `npm run setup`, then `npm start`.
4. Verify the hub at **4810**, `/api/config`, `/api/dribble?player=beginner`, `/api/chess?player=beginner`, six embedded roots `/g/<game>/beginner/`, and their assets/APIs. Original API suffixes are `/api/beginner/state` for Letter Quest, `/api/beginner` for Word Arcade and Number Park, and `/api/state?player=beginner` for the other three; prefix them with `/g/<game>/beginner`. Also verify Guess My Drawing, Maze Garden’s four activities, Soccer Club’s three activities, and the chess path. These reads should produce fresh generic profiles on a new installation. Do not create test scores in a child's preset; use Admin if writes are necessary.
5. Return **one home-screen link, http://localhost:4810/**, and explain that the server terminal must remain open. Install the hub once, not each game separately. A different device needs trusted-LAN access; only enable `HOST=0.0.0.0` if the user wants it. Game backends remain loopback-only. Never create a public tunnel, public host, firewall exception or router port forward as a default installation step. Do not promise a publicly playable URL or guaranteed offline/PWA behavior.

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
