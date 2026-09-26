# The Book: data schemas

One continuous book per child. **Generate by night, play by day**: a nightly job rebuilds each child's
learner model, plans tomorrow's chapter, has a language model write the story around the plan, lints it,
narrates it with local Kokoro and publishes it. The hub opens today's chapter once, before the games.

Everything below lives **outside the repository** (children's data is private), under
`$FAMILY_DEPLOY_ROOT` (default `~/.local/share/family-games`):

| Path | Written by | Read by |
|---|---|---|
| `book/profiles.json` | a grown-up, by hand | nightly job |
| `book/cast.json`, `book/cast/<id>.jpg` | a grown-up; portraits by `book/portraits.py` from the family's toy photos | nightly job, hub `/book-cast/` |
| `learner/<player>.json` | `book/build-learner.mjs` | nightly job, grown-ups |
| `book/<player>/<date>.json` / `.md` / `.html` | `book/generate.mjs` | hub (json), grown-ups (md, printable html) |
| `book/voice/<16 hex>.wav` | `book/narrate.py` (added only, never rewritten) | hub `/book-voice/` |
| `<hub data>/book-progress/<player>.json` | hub | hub, bedtime page |
| `<hub data>/book-notes.json` | hub (Grown-ups "Today…") | nightly job, bedtime page |

Staging reads `staging-data/book/` instead of `book/`. Game saves are only ever read.

## profiles.json

```json
{"<player>": {"age": 5, "interests": ["soccer"], "companions": [{"name": "Bo", "kind": "a big, gentle bear", "emoji": "🐻"}],
  "sibling": "<first name>", "mathTrack": "early|facts", "tricks": [{"id": "sentence-position", "text": "…", "source": "parent"}],
  "voice": {"voice": "af_heart", "speed": 0.9}, "lintExtra": ["…"]},
 "_lint": {"extra": ["words a chapter must never contain, e.g. a surname"]}}
```

## cast.json (optional: the child's own toys as his companions)

```json
{"photos": "<folder of toy photos>", "allowNames": ["names of the family's toys that the brand rule would otherwise reject"],
 "children": {"<player>": {"fixed": ["<id>"], "rotate": ["<id>"], "perChapter": 2, "props": ["<id>"]}},
 "cast": [{"id": "owl", "name": "Captain Owl", "kind": "personality in one line", "emoji": "🦉", "photo": "<file>", "box": [x, y, size]}],
 "props": [{"id": "kite", "name": "the kite", "kind": "a red kite"}]}
```

Fixed friends appear in every chapter; `perChapter` more are drawn from `rotate`, seeded by the date.
Without `children`, the whole cast is shared. Without the file, the profile's `companions` are used.
Portraits never leave the private data directory.

## Learner model (`family-book-learner-1`)

| Field | Meaning |
|---|---|
| `player`, `name`, `age`, `builtAt`, `sources` | who, when, which game saves were found |
| `interests`, `companions` | profile interests plus favourite activities from the last 7 days |
| `literacy` | `letters` known, `learning` (letters still being learned), `lettersMastered`, `wordLevel`, `sentenceLevel` (1–3), `wordsMastered`, `wordsStuck`, `sentenceBreaks` |
| `math` | `track: "facts"`: cookie division `{level, stage}`, per-skill `levels`, `tables`, `factsMastered`, `factsStuck`, `hardShares`. `track: "early"`: `countTo`, `completed`, `takeAwayStuck` |
| `games` | a few numbers per game (Letter Quest, Word Arcade, Maze Garden, Target Trail + Sling Shot, Three in a Row, soccer, chess) |
| `activity7d` | dated entries per game over the last week |
| `stuck` | `{area, item, detail}`: letters being learned, words he keeps missing, the recap's "worth a look" lines |
| `tricks` | heuristics instead of the skill: grown-up notes plus log evidence (fast tap-through on sentence tiles or letters, rapid "harder" taps) |
| `story` | running game-story lines, Letter Quest chapter, labyrinth level, mazes built, last five book chapters `{date, title, summary, hook}` |
| `recent` | `yesterday` (the parent recap), `play` (every game, from saves and hub opens), `dadLines` (Today… notes for yesterday and today) |

## Chapter (`family-book-chapter-1`)

```text
{player, name, date, number, title, cover, companion: {name, emoji}, level: "early"|"reader",
 pages: [
  {kind: "story", text, lines[], scene, teach?: {letter, word, picture}},
  {kind: "challenge", text, lines[], practises, item: <word-break item: find-letter | first-letter | read-word | sentence | math | count>},
  {kind: "mistake", text, lines[], mistake: {kind: "math"|"letter", claim, wrong, right, tokens?, hint, caught, fix: <item>}}
 ],
 cast: [{id, name, emoji, portrait}], (each page also lists the cast ids it mentions)
 summary, hook, bedtimeQuestion, voice: {name, speed, clips: {text: file}},
 meta: {generatedAt, source, lint[], practises[], dadLines[], yesterday}}
```

The plan (what is practised, the deliberate mistake) is chosen by code from the learner model; the model
only writes the story. `lint.mjs` rejects violence beyond cartoon mischief, scary/death/abuse themes,
illness and medical words, grandparents, brands, personal data, private words, unplanned wrong sums,
answer give-aways, and text above the child's level. One repair pass, then `template.mjs`.
