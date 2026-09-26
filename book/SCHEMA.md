# The Book: data schemas

One continuous, illustrated, narrated book per child. **Generate by night, play by day**: a nightly job rebuilds
each child's learner model (and, weekly, a private life context of story themes), plans the chapter's learning
beats, has a language model compose the pictures and write the narration around them, lints it, narrates every
line in its own voice with local Kokoro and publishes it. The hub opens today's chapter once, before the games,
as a full-screen picture book: each page turn speaks at once. Grown-ups can watch any chapter (Grown-ups → Watch).

Everything below lives **outside the repository** (children's data is private), under
`$FAMILY_DEPLOY_ROOT` (default `~/.local/share/family-games`):

| Path | Written by | Read by |
|---|---|---|
| `book/profiles.json` | a grown-up, by hand | nightly job |
| `book/cast.json` | a grown-up | nightly job |
| `book/art/lib/library.json` + images | `book/build-art.py` from the household's own source images | nightly job, hub `/book-art/` |
| `learner/<player>.json` | `book/build-learner.mjs` | nightly job, grown-ups |
| `learner/<player>-life.json` | `book/life.mjs` (weekly, or when a source changes) | nightly job |
| `book/<player>/<date>.json` / `.md` | `book/generate.mjs` | hub (json), grown-ups (md) |
| `book/voice/<16 hex>.wav` | `book/narrate.py` (added only, never rewritten) | hub `/book-voice/` |
| `<hub data>/book-progress/<player>.json` | hub (progress, and what he collected: letter keys, words he read) | hub, nightly job |
| `<hub data>/book-notes.json` | hub (Grown-ups "Today…") | nightly job |

Staging reads `staging-data/book/` instead of `book/`. Game saves are only ever read. Without a household
library the generic one in `hub/public/book-art/` is used (a hero, a grown-up, Bo the bear, Pip the robot).

## profiles.json

```json
{"<player>": {"age": 5, "interests": ["soccer"], "companions": [{"name": "Bo", "kind": "a big, gentle bear", "emoji": "🐻"}],
  "sibling": "<first name>", "mathTrack": "early|facts", "tricks": [{"id": "sentence-position", "text": "…", "source": "parent"}],
  "voice": {"voice": "af_heart", "speed": 0.9}, "lintExtra": ["…"],
  "arc": "the season-long quest, one sentence or two", "compass": ["kinds of stories he loves (style only)"],
  "life": {"sources": ["<private notes about the child, read weekly>"]}},
 "_lint": {"extra": ["words a chapter must never contain, e.g. a surname, school or staff names"]}}
```

## cast.json (optional: the child's own toys as his companions)

```json
{"allowNames": ["names of the family's toys that the brand rule would otherwise reject"],
 "children": {"<player>": {"fixed": ["<id>"], "rotate": ["<id>"], "perChapter": 2, "props": ["<id>"]}},
 "cast": [{"id": "owl", "name": "Captain Owl", "kind": "personality in one line", "emoji": "🦉",
   "letter": "O", "word": "owl", "shape": "spread my wings into a round O", "voice": "bm_fable", "speed": 1.0}],
 "props": [{"id": "kite", "name": "the kite", "kind": "a red kite"}]}
```

Fixed friends appear in every chapter; `perChapter` more are drawn from `rotate`, seeded by the date. A friend's
`letter` is the key a young reader wins from it (its `shape` is said in the first person: "Look, I …").
`voice`/`speed` pick its Kokoro voice. The ids match the picture library's actor ids.

## Picture library (`library.json`)

```json
{"backgrounds": {"<id>": {"file": "bg/<id>.webp", "about": "what it shows (the writer picks from this)"}},
 "actors": {"<id>": {"name": "…", "h": 0.42, "poses": {"idle": {"file": "actors/<id>-idle.webp", "ar": 0.6}, "fly": {"…": "…", "fly": true}}}},
 "props": {"<id>": {"file": "props/<id>.webp", "h": 0.12, "ar": 1, "about": "…", "seats": [[0.15, 0.74]]}}}
```

`h` is the height as a share of the screen, `ar` the image's width/height. The player centres a page's actors and
shrinks them together to fit (a phone gets smaller characters, never overlap). A `train` prop with `seats` carries
the actors in its carriages (`"ride": true`). `build-art.py` trims sprites, converts to WebP and writes the manifest
from a `spec.json` (actors, heights, flying poses); hand-drawn SVG sprites are copied as they are.

## Life context (`family-book-life-1`)

`{player, builtAt, sourceHash, sources: [file names], themes: [{id, kind: loves|strength|growing|dad, seed}], interests}`.
Themes are story seeds for gentle allegory, never facts; every one passes the chapter safety lint (no names but the
family's first names, no teachers, school, therapy, reports, illness or anything shaming).

## Chapter (`family-book-chapter-2`)

```text
{player, name, date, number, title, level: "early"|"reader", cover: {title, line, scene},
 art: {backgrounds, actors, props}  (only what this chapter uses, with URLs),
 pages: [{id, kind: "story"|"beat", scene: {bg, actors: [{id, pose}], props: [{id, n}], fx, ride?}, caption,
          say: [{who, text, voice, speed, clip}], magic?: {word, object, read, after: [line]}, beat?: {…}}],
 ui: {yes, tryAgain, noPrompt, readIt, numbers: {"1": line, …}, …}, quest: line, summary, hook,
 meta: {generatedAt, source, lint[], sceneNotes[], practises[], magic[], dadLines[], themes[], yesterday}}
```

Beats (chosen by code from the learner model; the model only sets them up in the story):
`teach-letter` (a friend shows its letter and sound), `stones` (tap the stepping-stones with that letter; wins the key),
`count` (tap each thing to count it, then say how many), `signs` (read the sign that says the word you need),
`spell` (put the spell's words back in order), `share` (deal the pizza slices onto plates, then say how many each),
`score` (the scoreboard: goals × points), and `no` (a friend insists on something wrong and begs to do it; he says
NO!, then fixes it). Magic words (a reader's mastered words, more as he masters more) glow on a sign or a door; the
narrator never says them first, and reading one makes the world respond.

`lint.mjs` rejects violence beyond cartoon mischief, scary/death/abuse themes, illness and medical words, clinical or
school-report language, teachers, grandparents, brands, personal data, private words, wrong sums, answer give-aways,
children speaking, unknown pictures, over-long captions, and narration above the child's level. One repair pass,
then `template.mjs`.
