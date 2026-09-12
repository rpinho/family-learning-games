# Family Learning Games

![Family Learning Games — six touch-friendly games for reading, counting, tracing and exploring](docs/media/social-preview.png)

Six touch-friendly games for practicing reading, numbers, planning, and puzzles with a grown-up. This is a **self-hosted source collection**, not a public online classroom or a hosted play service.

[Install in one command](#one-command-first-run) · [Let an agent install it](#let-a-coding-agent-install-it) · [Explore the games](#six-games-six-different-adventures) · [Privacy](PRIVACY.md)

## Six games. Six different adventures.

Drag, trace, steer, aim, and think ahead. Pick an activity and a manageable challenge, then play together.

<table>
<tr>
<td width="50%" valign="top">
<a href="games/letter-quest"><img src="docs/media/letter-quest.png" alt="Letter Quest: a first-person green labyrinth with a letter-position puzzle" width="100%"></a>
<strong>Letter Quest — words open worlds.</strong><br>
Letter tracing, reading missions, stories, soccer, and letter puzzles inside a 3D labyrinth.
</td>
<td width="50%" valign="top">
<a href="games/word-arcade"><img src="docs/media/word-arcade.png" alt="Word Arcade: a spaceship aims at moving letters to complete a word" width="100%"></a>
<strong>Word Arcade — spelling takes flight.</strong><br>
Spaceship challenges, word building, rhyme hunts, sorting, and flashcards. Practice or Arcade pace.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="games/number-park"><img src="docs/media/number-park.png" alt="Number Park: draggable groups of five and four stars for a hands-on addition activity" width="100%"></a>
<strong>Number Park — math you can move.</strong><br>
Count objects, combine groups, take away, continue patterns, draw, trace, and explore reading or harder math.
</td>
<td width="50%" valign="top">
<a href="games/maze-garden"><img src="docs/media/maze-garden.png" alt="Maze Garden: a 19-by-19 tracing maze with a rabbit, a carrot and adjustable difficulty" width="100%"></a>
<strong>Maze Garden — find your own way.</strong><br>
Adaptive 2D tracing mazes with changing themes, manual difficulty, zoom, and optional puzzle stops.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="games/three-in-a-row"><img src="docs/media/three-in-a-row.png" alt="Three in a Row: an active tic-tac-toe match against Rook with X, O and a clue button" width="100%"></a>
<strong>Three in a Row — think one move ahead.</strong><br>
Choose X or O, set the opponent's strength, play Rook, and explore one-move practice puzzles and tactical clues.
</td>
<td width="50%" valign="top">
<a href="games/target-trail"><img src="docs/media/target-trail.png" alt="Target Trail: letter targets and an aiming crosshair, with immediate difficulty and practice controls" width="100%"></a>
<strong>Target Trail — listen, aim, release.</strong><br>
Spoken letter and word targets with adjustable motion and aiming difficulty. Settings apply immediately.
</td>
</tr>
</table>

*Actual gameplay from an isolated, generic Admin demo. Click a card for its game guide. No children's profiles or drawings are shown; screenshots are not evidence of learning outcomes.*

### Made for playing together

- **Touch-friendly:** drag objects, trace paths, steer a spaceship, and aim with a finger.
- **Choose the challenge:** separate Beginner and Explorer presets; adjustable or adaptive challenges vary by game.
- **Keep progress local:** saved rounds and diagnostics live on your own server. No ads or game-owned analytics.
- **Easy to start:** one setup command for all six games. No AI API key required.

## Pick a game

| Game | What is inside | Default local link |
| --- | --- | --- |
| [Letter Quest](games/letter-quest) | Letter tracing, reading practice, stories, soccer and 3D mazes | http://localhost:4811 |
| [Word Arcade](games/word-arcade) | Moving spaceship challenges, word building, rhymes and flashcards | http://localhost:4812 |
| [Number Park](games/number-park) | Counting, patterns, manipulatives, drawing, reading and harder math | http://localhost:4813 |
| [Maze Garden](games/maze-garden) | Adaptive 2D tracing mazes with optional puzzle stops | http://localhost:4814 |
| [Three in a Row](games/three-in-a-row) | Tic-tac-toe against Rook and one-move practice puzzles | http://localhost:4815 |
| [Target Trail](games/target-trail) | Moving targets, adjustable aiming difficulty and spoken letters/words | http://localhost:4816 |

## Run on your computer

### One-command first run

With **Node.js 22.13 or newer**, npm, and Git installed, paste this one command into Terminal (macOS/Linux) or PowerShell 7:

```sh
git clone https://github.com/rpinho/family-learning-games.git && cd family-learning-games && npm run play
```

This downloads the collection, installs locked dependencies, builds the two React interfaces, and starts all six games. The other four apps need only Node. Open a link above in Chrome, Edge, or another modern browser. Keep the terminal running; Ctrl+C stops the servers. Later, run `npm start` in the same folder; no reinstall is necessary. An existing `family-learning-games` folder is not overwritten.

If you download the repository ZIP instead, unzip it, open a terminal in its folder, and run **`npm run play`**. Prerequisites are not silently installed and no administrator access is required by the game installer.

### Let a coding agent install it

Give your agent this request:

> Install and run https://github.com/rpinho/family-learning-games locally. Read its AGENTS.md and README first. Check Node/npm, use a new folder, run npm run play, verify all six games, and give me the local links. Keep it private and preserve any existing saves.

[AGENTS.md](AGENTS.md) contains the installation, verification, data-preservation and privacy instructions. No API key or paid AI service is needed to run the games.

Choose **Beginner**, **Explorer**, or **Admin**. Add `/?player=beginner` or `/?player=explorer` to a link to open that preset. Beginner and Explorer have different starting challenges and separate saves; Admin is for testing. These are three shared presets per installation, not authenticated personal accounts. Spelling names in exercises are fictional examples.

To run just one game, run `npm start` inside its directory (for the React games, first run `npm ci` and `npm run build`). Individual servers use their original default ports, listed in their READMEs. Run `npm test` from the collection root after setup to check all six suites.

## Play on a tablet or Chromebook

By default the servers accept connections only from the computer running them. For a **trusted private Wi-Fi network**, on macOS/Linux:

```sh
HOST=0.0.0.0 npm start
```

Then replace `localhost` in the links with that computer's LAN address. On PowerShell, set `$env:HOST="0.0.0.0"` before `npm start`. Allow the connection in your local firewall if necessary. Do **not** port-forward or expose these servers to the public internet. They do not have user authentication or internet-facing security hardening. A parent gate prevents accidental taps, not unauthorized access.

The apps include launcher icons and manifests. Installation/fullscreen behavior varies by browser; plain HTTP LAN addresses are not secure origins, so a seamless installable/offline experience is not guaranteed. GitHub Pages alone cannot run the Node save APIs.

## Privacy and saves

This release starts from fresh public history. It includes no real children's names, household logs, saved profiles, drawings, reports, contact details, credentials, or private deployment settings.

The launcher saves new local progress and diagnostics in **`.data/<game>/`**, which is ignored by Git. A game started individually uses its own directory under `~/.local/share/family-learning-games/`, unless its data environment variable is supplied. Never upload these data directories or attach raw logs/drawings to public issues. Save a backup before changing or removing local data.

Gameplay and drawing recognition run on your own server. There is no embedded API key, account requirement, advertising, chat, or third-party analytics. Browser narration may use a browser/vendor speech service; local voices are preferred when available, but offline speech is **not guaranteed**. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Audio and learning limitations

The shared edition uses device/browser narration instead of private voice caches. Voice quality and accent vary. In Number Park Reading, the fallback says **letter names with example words**, not isolated phonemes: a grown-up should model the actual sounds and blending. It is not equivalent to a professionally recorded phonics course.

Word Arcade includes original synthesized music loops and CC0 laser effects. Private-use songs, third-party character recordings and extracted instructional audio are not included. [Third-party notices](THIRD_PARTY_NOTICES.md) document the included assets and drawing model.

These are experimental practice games, not validated educational assessments or medical/occupational-therapy tools. Scores, tracing success and engagement do not establish mastery or transfer to paper. Drawing guesses can be wrong. Play together, let the child choose a manageable challenge, and check skills away from the screen.

## Contributing and reuse

Bug reports should use an Admin preset with synthetic examples. Include the game, steps, browser and expected behavior; omit names and personal data. Run `npm run check:privacy` before publishing changes. The scanner is a guardrail, not proof that a change contains no private information.

A project-wide reuse license has not been selected yet; public visibility is not a blanket redistribution or commercial-use license. Third-party assets retain the licenses in their notices.
