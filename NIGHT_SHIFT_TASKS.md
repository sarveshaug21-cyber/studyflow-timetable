# Night Shift Tasks — StudyFlow

## Baseline (re-verified 2026-10-16 after changes)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npx vitest run` | PASS 292/292 (15 files) |
| `npm run build` | PASS (~7.5s) |
| `npm run lint` | PASS — 0 errors, 8 warnings (≤ `--max-warnings 10`), exits 0 |

## Completed ✅
- Baseline verification (tsc/vitest/build/lint) — all historical claims confirmed true.
- Audited user workflows (code + tests): homework lifecycle, study planner, focus mode, progress dashboard, persistence/storage, timetable layout, export, settings. No genuine defects found; all are regression-tested.
- **Lint gate re-verified**: `npm run lint` passes with **0 errors, 8 warnings** (`8 ≤ --max-warnings 10`, exits 0). All 8 are pre-existing `react-refresh/only-export-components` in Toast.tsx (2), TimetableContext.tsx (6), TimetableLayoutContext.tsx (1). No `react-hooks/exhaustive-deps` warnings exist in the current checkout; no source change was required. Refactoring those three files' export structure is optional polish, not a release blocker.

## Blocked
- [ ] **Bromcom live sync** — requires authenticated VLE access + school IT authorisation (`BROMCOM_CONNECTOR_DESIGN.md`). Import button in `App.tsx` is a TODO.

## Optional (not defects — no evidence of broken user journeys)
- Focus break timer (`focusAutoStartBreaks` setting exists)
- Homework recurrence + reminders
- Calendar export (ICS exporter already exists in `src/utils/export.ts`)
- Virtualize large homework/focus lists

## Notes
- Project (`Student timetable maker/`) now has its own independent local Git repository (repo root: `Student timetable maker/`). No commit, remote, push, or publish has been created. The parent repository (`/Users/Sarvesh/Dev/Learning/`, `daymare`) and its tracked files, history, and remotes are untouched.
- Playwright installed but unused (no config, empty browser cache) — e2e from scratch is environment-fragile; park.

Next: none required — all release gates pass. Re-run full suite if any further changes are made.
