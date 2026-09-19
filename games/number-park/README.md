# Number Park

Part of [Family Learning Games](../../README.md). Use the root setup and launcher for all six games.

## Run separately

Requires Node.js 22.13 or newer. Run `npm ci` and `npm run build` first.

```sh
npm start
```

Open http://localhost:4321/?player=beginner or http://localhost:4321/?player=explorer. Use `?player=admin` for a separate test save.

Set `PORT` to change the port, `HOST` to change the listening interface, or `NUMBER_PARK_DATA` to set an explicit private data directory. Default saves live under `~/.local/share/family-learning-games/number-park/`. These servers are for trusted local use, not public internet hosting. Read the root privacy, security and audio limitations before use.

`npm test` runs this game's tests. Build first: the HTTP tests also check static assets.

### Picture guesses: people, faces and bare trees

The local picture model now includes original authored person/face prototypes and bare-branched trees alongside the existing public Quick, Draw! examples. A bounded trunk-and-branches check corroborates tree guesses without treating letters, combs or ladders as trees. No learner artwork trains the model or leaves the installation. Recognition remains fallible: ambiguous pictures stay uncertain, and free art never loses points. Guesses show picture icons; corrections open picture choices first. New person/face questions use the existing recorded stock voice.
