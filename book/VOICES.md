# Book character voices

The household's private `cast.json` selects the actors' voices. The public defaults remain stock voices. Optional `local:<versioned-id>` speakers use the trusted private `voice-renderers.json` worker registry; audio and model references stay outside source.

A cast actor can set `refreshVoice: true` to apply its selected `voice` and `speed` to existing chapters as well as new ones. Named voices such as `@pirate` resolve through the same cast's `voices` map. This opt-in leaves other actors and the narrator as written. Dad's existing named Rook selection is independent.

Letter hunts use their friend's selected voice for new narration. With `refreshVoice`, old hunt lines without a speaker use the hunt's friend role. Shared recorded letter sounds remain phoneme tags passed intact to the renderer.

Use a new versioned voice ID when the reference or performance changes. Render the new cache before activation. `hub/scripts/check-clips.mjs --book <private folder>` checks current/future chapters and every hunt against the selected voice; old clips cannot satisfy a changed speaker. Original story files, progress and old recordings are retained. An already-open Book must be reopened or refreshed to receive a new selection.
