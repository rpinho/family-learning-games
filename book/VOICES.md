# Book narration

The default edition uses local Kokoro voices. A household may configure a separate
renderer for a named voice in its private book data, without adding models,
references, generated audio or personal settings to the repository.

Set `cast.json`'s `voices.rook` to a versioned id beginning `local:rook-`, and add
`voice-renderers.json` beside it:

```json
{"voices":{"local:rook-example-v1":{"command":["python3","/private/renderer.py"],"timeout":600}}}
```

The trusted worker receives a request filename: `lines` contains `id`, `text`,
`voice`, `speed`; `out` is a scratch directory. Preserve pronunciation tags
`[[...]]` and the shared `letter_sounds`/`soundout` paths. Print one final JSON line
`{"clips":{"<id>":"<filename.wav>"}}`. Return mono 24 kHz PCM16 audio, with
nonzero sound and peaks below 30000. The whole batch is checked before clips are
published. Missing configuration or invalid output fails rather than changing
speakers silently. Browsers can request only lines already in an approved story.

Use a new voice id when the renderer, reference or pronunciation behavior changes.
Its clips have separate content keys, and existing recordings remain available.
Both nightly generation and on-demand narration use this configuration. Dad
currently shares the named Rook setting; narrator and friends keep their voices.
Already-written chapters apply that setting when read, without rewriting story
files or progress. A separately assigned Dad voice remains separate.

Pre-render Rook lines before selecting a new id, so children do not wait for a
model to start. Switching `voices.rook` back to `am_michael` restores the classic
voice using its retained recordings. Keep renderer configuration and caches in
the private book data; test against an isolated copy before selecting it live.
