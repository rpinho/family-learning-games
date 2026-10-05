# Public publication gate

Run `npm run check:privacy -- --base origin/main` before a public commit or push.
`public-sync.mjs` invokes the same gate before committing and again before pushing.
Any finding or unavailable scanner exits non-zero. Reports contain `file:line` and
rule names, never matched identities, reference paths, credentials or scanner raw
output. Git scanners and PII checks cover the PR merge-base through HEAD; PII also
checks every intermediate tree and commit message. Filesystem scanners include
tracked files and non-ignored untracked files, including staged/unstaged edits.
Ignored household data and installed dependencies are outside the public tree.

Install Gitleaks, TruffleHog and ExifTool using your approved local workflow. Media
checks require an external virtual environment (never committed):

```sh
python3 -m venv "$HOME/.local/share/family-public-sync/venv"
"$HOME/.local/share/family-public-sync/venv/bin/pip" install 'Pillow==11.3.0' 'numpy==2.0.2' 'opencv-python-headless==4.11.0.86'
```

`PUBLIC_SYNC_PYTHON` overrides that interpreter. Missing tools/reference roots or
unreadable images block publication. Configure `PUBLIC_SYNC_POLICY` outside this
repository (default `~/.config/family-public-sync/privacy.json`). Existing
`replacements` remain supported. Add private terms with `denied: ["term", ...]` or
`denylist: {"category": ["term", ...]}`. Include family, friends, therapists,
schools, town/street and private devices; a denylist cannot discover unknown names.
Never copy this policy or its values into logs, tests, PRs or public history.

Generic checks flag email, phone, street addresses, ZIP/city, IP addresses,
private hostnames, absolute home paths and labelled birthdays. The only intrinsic
network exceptions are loopback, wildcard bind addresses and RFC documentation
addresses; email examples must use reserved example/invalid domains. Reserved
North American example numbers use the 202-555-01xx range. Raster/media binary
bytes are checked for private terms, while generic text patterns apply to text
files and filenames, avoiding random compressed bytes. Code member expressions
and image filenames with `@2x` suffixes are distinguished from hosts/emails.
Required upstream copyright contacts have line-hash exceptions in
`public-pii-exceptions.json`, with a reason for each; edited lines lose approval.
No whole-file, secret-detector or private-name exemptions are permitted.

Gitleaks runs on the filesystem snapshot and git range with full redaction and
ignores inline allow comments. TruffleHog runs both sources with all result
classes, including unverified/unknown/filtered unverified. This is the modern
CLI equivalent of `--only-verified=false`. Verification is disabled to keep
candidate credentials local; any detected result fails. Inline ignore tags are
disabled. GitHub runs these secret-only checks for every PR/push with pinned
scanner versions and no credential verification. Private policy and likeness
sources are never uploaded. No `.gitleaks.toml` exceptions are currently needed.

ExifTool checks every public image, video and audio for GPS/location, camera
make/model/serial, owner/artist/author/creator and original/creation/modification
timestamps (filesystem timestamps and zero-valued container placeholders are
excluded). `npm run check:privacy -- --strip` removes metadata in place, then
checks again; it does not clear text, likeness or review findings. Review any
format-specific stripping failure. ICC colour-profile copyright notices are
preserved, as they describe the profile's vendor, not its image's creator.

Disguised media extensions and SVGs with embedded/external content are refused
until represented as separately scanned assets. Video with an audio stream cannot
use silent-video approval. The gate also refuses symlinks and a candidate that
changes during a scan.

All raster images/animation frames are compared with every decodable private
reference below the five configured reference roots. A near-duplicate requires
**64-bit dHash distance <= 6 AND 63-bit pHash distance <= 8** (pHash omits the DC
coefficient). Low-information swatches (greyscale standard deviation < 8) are
excluded from approximate matching. These thresholds catch resizes and light
recompression; substantial crops, new paintings inspired by a photograph, and
changed poses may evade perceptual hashes. Haar face candidates block until a
human reviews them; it can flag illustrations or miss small/profile faces.
Neither detector proves that a drawing lacks a real person's likeness.

Every audio file starts unapproved: names such as `ambient` do not prove absence
of speech. Review its generator/provenance. Only synthesized effects/music and
licensed non-speech effects may receive approval; family recordings and speech
must be removed. Video likewise requires a silent-video provenance review.
Private `mediaReviews` entries are keyed by the full asset SHA-256, with `kind`
(`illustration`, `synthetic-audio`, `silent-video`), `reason` and `reviewer`.
Changes invalidate approval; near-duplicate and EXIF findings cannot be approved.

Every run writes a local contact sheet of **all** public raster and vector images
with thumbnails, paths and outcomes, and a machine-readable `results.json`, under
`~/.local/share/family-public-sync/review/<local-date>/`. Private photo names and
thumbnails are never included. Claude's visual review is a separate review step;
automated success does not assert that Claude has reviewed it.

Tests generate fictional names, contacts, EXIF and resized synthetic imagery in
isolated temporary repositories. They exercise untracked and intermediate-commit
leaks, unavailable scanners, unverified secrets, metadata stripping, near-duplicate
matching and safe reporting. They never use family data as fixtures.
