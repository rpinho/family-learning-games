# Privacy

This repository contains game code, fictional examples, authored assets, synthetic test fixtures, and a small attributed model derived from a public drawing dataset. No household play history or child-created drawings are included.

## What a running installation saves

- Preset progress, difficulty, scores, selected settings and current activities.
- Answer attempts, assistance, retries and relevant timing.
- Drawing strokes and recognition results where drawing features are used.
- Technical diagnostics such as errors, revisions and request timing.

The root launcher puts this in `.data/`, outside tracked source. These files persist until the adult operating the server removes them; there is no automatic retention schedule. Treat them as private, make backups if wanted, and do not publish them. The optional Book push-to-talk feature requests microphone permission and processes a short recording in memory with a local recognition worker; audio is dropped after processing and never written to disk. It does not use the camera. No recordings are included in this repository. The hub uses local play diagnostics and optional local skill summaries to order home cards and suggest an activity. Day notes, learner summaries, generated quests, chapters and World progress also stay in the installation’s private data directories. These suggestions are experimental conveniences, not assessments of enjoyment or learning. No history is sent outside the installation.

Anyone who can reach your server may access the shared player presets. There is no private account boundary between families. Use separate local installations for separate households. Parent controls are not authentication.

There is no game-owned external telemetry service. Browser speech synthesis may be provided by your operating system or a remote speech provider; inspect your device's voice settings if offline processing is required. Dependency installation downloads packages from npm. The optional model-building script downloads a public Google dataset; it does not upload drawings.

Before opening an issue, reproduce it using Admin with invented data. Do not upload `.data`, voice caches, logs, photos, screenshots showing identities, or exports from a child's session.
