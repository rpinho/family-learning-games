# Fictional demo worlds

The World and daily quest engines share revision-checked saves, room navigation, inventories, prerequisites, counting, arithmetic, supported reading, patterns, rewards and a quest map. Beginner uses the small world; Explorer uses Castle Kingdom. Open `/world?player=beginner&preview=1` or `/world?player=explorer&preview=1` through the hub.

The public edition uses invented word cards, the original Bo and Pip artwork, generic guide and hero placeholders, and geometric demo scenery. Every counting token and its target rectangle is authored from scratch. No household paintings, likenesses, recorded voices or published daily quests are included. Without optional stock narration, world captions remain available; an adult can read instructions together.

The optional daily episode writer and compiler use the synthetic fixtures in `book/episodes/fixtures`. Runtime episodes, chapters, learner models and saves belong outside the repository. Review/future previews use the grown-ups gate; current demo play stores progress in the installation's private data directory.

Run `npm test` and `npm run check:privacy` before publishing. Browser checks use `CHROME`, the operator's Chrome for Testing executable, and close every browser they start.
