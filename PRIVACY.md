# Privacy

This repository contains game code, fictional examples, authored assets, synthetic test fixtures, and a small attributed model derived from a public drawing dataset. No household play history or child-created drawings are included.

## What onboarding asks and why

The grown-up setup asks for a first name or nickname, age or grade, starting letters/counting/reading/maths skills, optional short placement observations, interests and favourite things. These help address the child and choose starting themes and challenges. No surname, birthday, school or address is required. Grown-up reports and placement observations stay separate from observed gameplay evidence and do not certify mastery.

Photos are optional; setup works with zero photos. The browser re-encodes selected PNG/JPEG images to strip metadata and bound size, then transfers them only to the family’s own server. They live under the private `book/photos/` folder and have no public image endpoint. They are never sent to a model provider by onboarding or the text writer. A separately installed local-only art worker may use them as likeness references when the grown-up enables that permission. Switching permission off retains stored images; “Remove saved photos” deletes the originals. Private backups and artwork already made from a reference may retain the likeness.

The default private root is `.data/`; `FAMILY_DEPLOY_ROOT` can select a different private root. Setup writes `book/profiles.json`, `book/cast.json` and `learner/<child>.json` there. Data remains until a grown-up removes it. The server-checked grown-up gate prevents accidental taps and is not authentication; people with trusted LAN access share the installation.

## Optional model subscription

Games and onboarding do not call an AI provider. If the family separately enables the nightly text writer, selected names, interests, learning context and day notes go to the configured provider under the family’s account and that provider’s data policies. Photo bytes do not. The local art step must remain local-only. See [AGENTS.md](AGENTS.md#enable-the-nightly-quest-writer-optional) for the opt-in setup.

## What a running installation saves

- Preset progress, difficulty, scores, selected settings and current activities.
- Answer attempts, assistance, retries and relevant timing.
- Drawing strokes and recognition results where drawing features are used.
- Technical diagnostics such as errors, revisions and request timing.

The root launcher puts this in `.data/`, outside tracked source. These files persist until the adult operating the server removes them; there is no automatic retention schedule. Treat them as private, make backups if wanted, and do not publish them. The optional Book push-to-talk feature requests microphone permission and processes a short recording in memory with a local recognition worker; audio is dropped after processing and never written to disk. It does not use the camera. No recordings are included in this repository. The hub uses local play diagnostics and optional local skill summaries to order home cards and suggest an activity. Day notes, learner summaries, generated quests, chapters and World progress also stay in the installation’s private data directories. These suggestions are experimental conveniences, not assessments of enjoyment or learning. No gameplay history is sent outside the installation by the games themselves; the optional text writer uses selected learning context as described above.

Anyone who can reach your server may access the shared player presets. There is no private account boundary between families. Use separate local installations for separate households. Parent controls are not authentication.

There is no game-owned external telemetry service. Browser speech synthesis may be provided by your operating system or a remote speech provider; inspect your device's voice settings if offline processing is required. Dependency installation downloads packages from npm. The optional model-building script downloads a public Google dataset; it does not upload drawings.

Before opening an issue, reproduce it using Admin with invented data. Do not upload `.data`, voice caches, logs, photos, screenshots showing identities, or exports from a child's session.
