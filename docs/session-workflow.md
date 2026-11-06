# Week-by-week workflow

## Navigation and repository layout

- `/` — journal, dated session cards, month filter, latest metrics.
- `/coach/plan.html` — plan a new dated session.
- `/coach/session.html?id=YYYY-MM-DD-slug` — that session’s saved plan and results.
- `/coach/import.html` — attach captured data to a saved plan or restore a downloaded bundle.
- `/coach/progress.html` — full completed-session table and trend.
- `/coach/library.html` — original research, reference diagrams and repository history.
- `data/archive.json` — canonical session index, initial baseline, and goal.
- `data/drills.json` — current drill library; every drill includes purpose, setup, steps, feel, repetitions, and troubleshooting.
- `sessions/YYYY-MM-DD-slug/session.json` — canonical plan snapshot and measured result, if recorded.
- `scripts/publish_session.py` — validates browser exports and adds/updates the archive.
- `.github/workflows/pages.yml` — tests and deploys the public journal on pushes to main.

## Before practice

1. Open the journal. Select a dated saved plan, or choose **Plan**.
2. Choose a date, title, and slug (e.g. `session-02`). A second session on the same day needs a different slug.
3. The generator looks only at completed sessions on dates before the planned session. It records the source session ID and its distance context. It does not use missing self-scores as diagnoses.
4. Review the practical drill instructions. The plan is a heuristic starting point, not a substitute for review of your shot export and video.
5. **Download session bundle** and return it to this workspace for check-in if you want it available on all devices before practice.

## After practice

1. Open **Record results** and select the exact saved plan.
2. Import shot CSV in the format below, or enter measured session carry/total from an uploaded report. No sequencing grade is requested.
3. Add optional observations and play-through holes. Play-through is separate from the normal practice sample.
4. Save the local draft, review its numbers, and download its session bundle. Saving on a phone does not automatically update GitHub.
5. Upload that bundle into the workspace and ask the assistant to publish it. The assistant runs `python scripts/publish_session.py <bundle-path>`, reviews the diff, commits and pushes.
6. Open the journal after the Pages deployment completes. That committed result is now visible on every device. Next week’s saved plan references it.

The publication script accepts a downloaded bundle `{ "schemaVersion": 1, "session": { ... } }`. It adds the session directory and manifest entry, rejects unsafe paths, preserves old plans, and requires an explicit `--replace-results` for corrections to already recorded results. Publish a referenced earlier session first. Git history preserves result corrections.

An unplanned exploratory session can first be preserved in a dated session folder with its original export in `sources/` and a provisional `review.json`. Do not invent a prior plan or mark an earlier tentative plan completed. If the player requests a journal entry before practice/drill boundaries are known, record the all-shot aggregate as an explicitly exploratory `uploaded-summary` with its sample context; never relabel unclassified shots as normal CSV rows. A copied original plan can be retained as intended-but-not-followed work, linked by `intendedPlanSessionId`, while the original record remains unchanged.

The November 6 review is reproduced with `python scripts/review_session_03.py`, using player observations and a shot-key-specific club correction in that session's `notes/observations.json`, plus the saved interpretation in `notes/analysis.json`. Add `--publish` to record that reviewed session in the local archive; the script does not commit or push, and corrections to an already recorded result still require the publication script's explicit correction workflow. The raw CSV remains unchanged. Its four 40-shot windows cover only the originally I7-labeled rows and describe chronology, not confirmed experiment blocks; the corrected initial shot is included in the overall I7 summary. Longest-carry and fastest-ball-speed selections are illustrative rankings, never replacements for all-shot averages.

Progress shows exploratory results as separate amber markers with their sample context, not a connected normal-block trend or a standardized gap-to-goal check. Reviews appear on both Progress and the full session page. Browser result edits preserve an existing exploratory designation and do not regenerate the source-based review; review corrections need workspace analysis and a reviewed bundle.

## Shot CSV

Distances must be **yards**. Supported columns are `club,block,carry,total`; extra columns are accepted by the parser but not retained in the normalized shots. Quoted CSV cells are supported. Retain your original device export separately if you need additional metrics.

Example structure (illustrative only; not an actual recorded session):

    club,block,carry,total
    7i,drill,60,70
    7i,normal,110,120
    7i,play,115,125

- Club accepts `7i`, `7 iron`, or `iron7` (case-insensitive).
- Block is `normal`, `drill`, or `play`; blank block defaults to `normal`. Label drill rows before import.
- All normal 7i shots, including mishits, contribute. No best-shot selection.
- Carry and total each use their own count of available measurements. Missing distance is not zero.
- Drill/play rows are saved but excluded from the main trend. Driver rows can be retained but are not coached or charted.
- XLSX and vendor-specific schemas need conversion before import. Do not rename an XLSX file to CSV.
- Summary-only imports can omit sample size; progress marks it unknown rather than inventing it.

## Published versus local

Committed JSON is the cross-device source of truth. Drafts use `golfwork.sessionDrafts.v1` in the current browser and origin only. A draft overrides the same published session locally and is clearly labeled. Export drafts before clearing browser storage. Once an identical bundle is published, its badge becomes Published. If another device publishes a different version, restore the reviewed bundle before further editing; there is no background conflict resolution.

The earlier apps used `golfCoachAppHistory` and `golfSessionHistory`. Those keys are left untouched and are not silently imported: sample/example data must not become real sessions. If there is genuine old history, ask for a reviewed migration into dated records, preserving uncertainty and sample sizes.

## GitHub Pages setup and privacy

In repository Settings → Pages, set Source to **GitHub Actions**. The workflow stages `index.html`, `assets/`, `coach/`, `data/`, session JSON, and `research/pages/`. Raw session `sources/` and provisional `notes/` folders are removed from the artifact. It does not serve research workbooks, video, WordPress export, legacy pages, templates, scripts or tests. Standard Pages sites are public: feedback and normalized shots embedded in session JSON will be public. Private repository support depends on the GitHub plan. A public repository exposes its committed source assets regardless of the selective Pages artifact.

Do not put tokens, credentials, or private observations in published session bundles. No login or backend is supplied by this static app.

## Verification

- `python scripts/publish_session.py --validate` checks manifest and every saved record.
- `python -m unittest discover -s tests -p 'test_*.py'` checks publication, correction rules and saved-plan lineage.
- `node --test tests/model.test.mjs` checks plan selection, snapshots and CSV aggregation.
- Serve locally over HTTP (e.g. the existing Python server); direct file URLs cannot fetch the JSON archive.

The initial 117.2-yard total / 109.7-yard carry benchmark is context, not a plotted weekly result. The historical CSV example in `templates/` is never seeded as a completed session. Total distance is influenced by conditions and launch-monitor settings, and does not directly measure pressure shift or body sequencing.