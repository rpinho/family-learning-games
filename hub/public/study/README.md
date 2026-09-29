# Book page study

Review-only idea: route-planner. It reads the existing local picture library, mounts an optional illustration, and returns to a synthetic page through the Book renderer. No account chapter, progress or preference is read or written. There is no device-speech fallback. Review prompts are included in the regular cloned release voice build; private art and recordings stay outside source control.

A dedicated preview opens the study at its root. `?mode=early` and `?mode=reader` select the review variants; `?before=1` shows the unmodified picture-book page for comparison. The study has large touch controls, keyboard alternatives, no timer or rewards and an always-available return to the page. `FAMILY_PREVIEW` affects only the review service. Production entry is unchanged.

Tests: `npm test --prefix hub`. Measure portrait, short landscape and Chromebook, including 4x CPU cold startup; check visibility/reduced motion and disposal. Parent review is required before merging this idea.
