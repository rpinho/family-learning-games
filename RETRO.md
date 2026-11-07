# Retro: building learning games for my own kids with AI agents

I built this for my two kids, who are 8 and 5, first. It wasn't meant as an app for strangers. They play in the browser on their tablets, with parental controls and no app to install. There are games for numbers, letters, drawing and mazes, a word search, chess lessons, and a daily story adventure called the Book. Most of the code was written by AI coding agents (Claude and Codex). I decided what to build and what was wrong.

These are notes on what I learned. Dates are 2026.

## The main lesson: direct feedback, and a fast loop

A friend who builds products told me that what they miss most at work is direct feedback from users. I have it every day. I sit on the couch while my kids play, and they tell me straight: "this doesn't work". I take a photo with my phone and send it to the agent. Usually it's fixed by the next morning. A name that sounded wrong in the afternoon was fixed that night.

Two users who tell you the truth, and a loop from a photo to a fix within a day. That's the best insight I've had into what to build, and it's why the games got good. My kids point out problems I miss, and sometimes they just stop playing when something annoys them. It isn't enough on its own, though. I still need to play the games myself.

## The idea

The model in my head was the Primer from The Diamond Age. A book that knows the child, tells a story every day, and puts the learning inside the story. It should also be a little subversive. The child can say no, choose a different path, and the story still works.

Nobody outside my family has used it. Everything below comes from two kids playing it every day.

## What worked

**The Book as the core.** Each day there's a new chapter: a short 2D adventure with places to walk to, things to find, and puzzles that carry the math and reading. The family is drawn from photos. The story uses things that actually happened that week. The photos, names and story notes are private, and none of them are in this repository (see PRIVACY.md). My older kid finished the Book every morning from Oct 27 to Nov 5 without being asked.

**Using the kids' own ideas.** The kids give ideas ("a tower of tiles to the ceiling") and the ideas become places and quests a few days later. That's what makes it feel like their book.

**Word Search, which I didn't expect.** It's my older kid's favorite now, above the Book. It launched on Nov 2. My older kid did 60 boards in the first five days, 27 of them on one day, and asked for it to be harder. The daily goal is five boards, and it clearly isn't what keeps them going. A safety rule I added had also made it easier without me noticing. Every word must have a picture, and none of the long words had one, so the 12x12 boards were all three-letter words. The fix was drawing the long words, plus an optional Expert mode that shows the picture and plays the word but hides the spelling.

**Choosing by ear.** Text to speech gets names wrong. One name came out sounding like a different word. I can't describe sounds in phonetic spelling, and I shouldn't have to. What worked was a page with three versions of each name, A, B and C, where I just tap the one that sounds right.

## What failed, and why

**The adventure turned into a worksheet.** On Oct 6 a change made each daily quest a single forward route. You couldn't leave a room until you finished its exercise. It was meant to keep the Book's pages in the same order as the walk. It removed the whole point. Walking, exploring and choosing where to go became doing exercises one after another. It stayed like that for a month. The tests said that was the correct behavior, and the kids kept playing anyway, which is part of why I missed it. I found it when I played it myself. The fix (Nov 6) opens every room in any order. A lock only stays where the lock is the puzzle, like a key found somewhere else. Guidance is now a goal ribbon, a map of what's left, and a hint.

**Fallback quests.** When the story writer fails the checks, a simpler fixed quest is published instead, so the child always has something. That's the right safety net, but it hid problems. On Nov 6 both kids got fallbacks. The causes were a Halloween memory brought back after Halloween, and a place whose name the safety check refuses. The same day, the next day's quest failed seven times on a place whose name ended in "Street", because the privacy check treats a capitalized "Something Street" as an address. In each case the quest planner kept choosing something the checker would always refuse. The planner now checks the exact text the child will see before it picks.

**Seasonal content leaking past its season.** Holiday chapters are a big part of the fun, and they don't end cleanly. Memories, callbacks and painted places from October kept coming back in November. Memories and callbacks now check the season before they're used, not only at the final check.

**Pronunciation.** Covered above. The voice handled common words well and our names badly, and my kids noticed every wrong name.

**Release windows.** At first, releases could only go out in a few fixed windows each day. In practice a fix finished in the afternoon waited until night even when nobody was playing. One fix sat in the queue for nine hours because the release script refused it silently. The rule now is simpler: a release goes out whenever nobody has played for 15 minutes, at any hour. A refused release now says so.

**Agents test what they changed, not what they broke.** Many regressions came from an agent running only the tests near its change. The open exploration change passed its own tests and broke seven others. One of those would have blanked the adventure page. Running the full test suites caught all of them. Every release now runs the full suites first.

## What's still open

**Does it teach, or does it just engage?** I don't know. Engagement is clear: daily Book completion, dozens of Word Search boards, requests for harder puzzles. Learning is not shown. The games don't record time per word or hint use yet. There's no baseline and no comparison. The next step is to measure something simple, like spelling accuracy on words my kids have met in the games versus words they haven't, before claiming anything.

**How much should the story decide?** Open exploration is more fun for my kids, I think. It also makes it easier to skip the hard parts. I don't know the right balance yet.

**Would it work for another family?** The onboarding asks for names, ages and photos, and builds a cast from them. I expect the first other family to find problems I can't see from here.
