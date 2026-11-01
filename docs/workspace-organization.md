# Workspace organization

## Filing rules

1. **Root is the entry point, not a filing cabinet.** Keep the home page, README, package configuration and Git configuration here.
2. **Weekly work belongs to its session.** Store original exports in `sessions/YYYY-MM-DD-slug/sources/`, saved plans/results in `session.json`, reviews in `review.json`, and working notes in `notes/`. Session-specific new video can also go under that session's `sources/`.
3. **Keep reusable knowledge separate.** General source selection, coaching policies and lesson principles belong in `knowledge/`. Do not mix a particular session's preliminary analysis into it.
4. **Original baseline research belongs in `research/`.** Browser reference pages in `pages/`, Excel files in `workbooks/`, imported content in `sources/`, initial swing video in `videos/`.
5. **Old apps are history, not another source of truth.** Preserve superseded app code in `legacy/pages/`; these pages redirect locally to current routes. Do not develop them further.
6. **Templates are not real measurements.** Keep examples in `templates/`, clearly labeled. Current CSV requirements live in the weekly workflow.
7. **Published versus preserved is explicit.** Deploy current app routes, assets, session JSON and selected research HTML. Keep raw CSVs, provisional notes, workbooks, XML, videos and legacy code out of the Pages artifact. Their availability in the repository still follows repository visibility.

## What moved in the cleanup

| Original root location | New home |
|---|---|
| Benchmark and headcover HTML | `research/pages/` |
| Three XLSX analysis files | `research/workbooks/` |
| WordPress XML export | `research/sources/` |
| Initial swing MP4 | `research/videos/` |
| Original app, planner, brief, upload and dashboard HTML | `legacy/pages/` |
| Example session CSV | `templates/session-summary-example.csv` |
| Weekly CSV worksheet (previously under knowledge) | `templates/weekly-scorecard-template.csv` |
| Provisional Session 01 practice analysis (previously under knowledge) | `sessions/2026-11-01-session-01/notes/practice-provisional.md` |

No original assets were deleted. Git renames preserve history. Active session JSON and saved drill snapshots were not rewritten by this reorganization.

## Browser navigation

Use [the journal](../index.html) for weekly work and [Research & History](../coach/library.html) for original material. Benchmark and diagram pages have links back to the library. Workbooks and original source files are linked to GitHub, since they are not deployed as raw site downloads.

Old root URLs are intentionally retired to avoid keeping duplicate entry points. Update bookmarks to the journal; opening an old prototype from its new legacy location redirects to the appropriate current page.