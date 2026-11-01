# Golf Coaching Workspace

## Start here — the weekly swing journal

Open [the home page](index.html) locally over HTTP or at **https://jb201.github.io/golfwork/** after GitHub Pages deploys.

- [Journal](index.html): dated plans/results and month navigation.
- [Plan](coach/plan.html): generate a saved next-session snapshot from the latest earlier completed session.
- [Record results](coach/import.html): import measured shot CSV or enter an uploaded session summary; no self-grading.
- [Progress](coach/progress.html): normal 7i session averages, sample sizes, and goal gap.
- [Session 01](coach/session.html?id=2026-11-01-session-01): the saved first plan, actual practice/play results, and post-lesson review.
- [Research & History](coach/library.html): original benchmark dashboard, diagrams, workbooks, sources and prototype history.

The authoritative history is in Git, not localStorage. Each session lives in **sessions/YYYY-MM-DD-slug/session.json** with its dated plan, exact drill instructions, rationale, prior-session reference, and optional results. The manifest is [data/archive.json](data/archive.json); the reusable drill library is [data/drills.json](data/drills.json). Plans copy the library so later instruction changes do not rewrite earlier plans.

Phone/browser edits are explicitly labeled **local drafts**. Download a session bundle and return it to the workspace for validation and commit; only a push publishes it across devices. GitHub Pages cannot write to this repo. See [the weekly workflow](docs/session-workflow.md) for publication, CSV format, and limitations.

The Pages workflow publishes the journal, shared assets, session JSON, and selected original research HTML pages. Raw session exports, provisional notes, workbooks, WordPress export, video and old prototypes stay outside the Pages artifact (they remain in Git and are public if the repository is public). Set **Settings → Pages → Source → GitHub Actions** once. Old root HTML bookmarks were retired; use the journal and library instead.

## Folder guide

| Folder | Purpose |
|---|---|
| [coach](coach/) | Current planning, results, progress, session and library routes |
| [assets](assets/) | Shared application code and styles |
| [data](data/) | Canonical session index and current drill library |
| [sessions](sessions/) | Dated plans, results, reviews, original CSVs and session-specific notes |
| [research](research/README.md) | Original analyses, spreadsheets, diagrams, source export and baseline video |
| [knowledge](knowledge/) | Reusable coaching principles, sources and policies |
| [templates](templates/README.md) | Historical examples and worksheets, never real results |
| [legacy](legacy/README.md) | Superseded app source, preserved for history |
| [docs](docs/) | Workflow and organization documentation |
| [scripts](scripts/) / [tests](tests/) | Publication, analysis and verification tooling |

Keep only the home page, README, package configuration and repository configuration at the root. See [filing rules and move history](docs/workspace-organization.md).

The sections below describe the original baseline and research context, not a current drill prescription.

This workspace is set up as a Discovery-based golf improvement project focused on one core goal:

- Raise your 7-iron average to at least 145 yards total
- Fix the mechanics behind being over the top
- Improve sequencing and weight shift so the swing feels freer and more natural
- Extend the same pattern to the driver without losing control

## Current working hypothesis

The biggest driver of the issue is likely not a raw power problem but a path/sequencing problem:

- over-the-top move
- poor pressure shift / timing
- poor sequencing from lower body to torso to arms
- trying to force the swing instead of letting it happen naturally

The previously vague headcover prescription has been withdrawn. Current plans use explicit lead-support and normal-stance-transfer drills. Sequencing and over-the-top remain hypotheses requiring shot data and video, not diagnoses from distance alone.

## Primary data sources in this workspace

- [Original benchmark dashboard](research/pages/golf_benchmark_comparison.html)
- [Historical headcover diagram](research/pages/headcover_drill_diagram.html)
- [WordPress source export](research/sources/theiffylie.WordPress.2026-11-01.xml)
- [Original swing video](research/videos/20261031140158_golffix_iron_side_01.mp4)

## Baseline from the benchmark dashboard

I validated the workbook data in the workspace. The current measured benchmark is:

- 7i typical total distance: 117.2 yards
- 7i good-distance total: 134.3 yards
- 15 HC midpoint: 140.0 yards
- 10 HC midpoint: 150.0 yards
- 5 HC midpoint: 160.0 yards

This confirms the gap is real and the project is aligned with the right target: improve sequencing and quality of strike first, then extend beyond the current average.

## Discovery project structure

The project is organized around three working tracks:

1. Establish baseline and real-world constraints
2. Design the drill and sequencing intervention
3. Run a weekly review and progression loop

## Working weekly plan

- Review the last 20-30 iron swings and note carry/total, strike quality, and direction
- Check the over-the-top pattern using video and one simple set of visual cues
- Use the specific drill instructions preserved in that session’s saved plan
- Work on pressure shift and sequencing before adding speed
- Validate the fix with real swings at 50-70% effort before increasing speed
- Repeat the same concept with the driver once the 7-iron pattern becomes repeatable

## Instruction source filter for the swing project

We are intentionally narrowing the teaching focus to swing mechanics and ball-striking, not chipping, bunker play, or putting.

- Danny Maude is a fair reference point because he often emphasizes a practical, repeatable swing pattern and clear sequencing cues.
- We should use online instruction as a comparison set, not as a substitute for your measured swing data.
- Any instructor or drill should be evaluated by whether it improves: pressure shift, sequence, club path, strike quality, and driver carry consistency.
- If the instruction does not clearly influence the swing pattern, it is not a priority for this project.

This project should only keep the instruction that directly helps with the current problem: over-the-top motion, sequencing, and creating a natural, freer swing.

## Questions to answer before the next review

1. What is your current average 7-iron total distance in real play or simulation?
2. What is the most common miss pattern you see on 7-irons today?
3. Do you have a recent side-view video of your swing that shows the first move and sequencing?
4. How many swings or shots are you comfortable tracking each week?
5. Do you want the coaching loop to be driven by a simple weekly checklist, a more detailed stat review, or both?

## Success definition

This project is successful when your 7-iron average is at least 145 yards total, with fewer over-the-top swings and a more natural sequencing pattern that carries to the driver.
