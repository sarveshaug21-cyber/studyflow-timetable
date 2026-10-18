# StudyFlow Calendar Parity — Progress Log

## Mission
Reverse-engineer installed macOS calendar applications and raise StudyFlow's calendar/timetable experience to at least 99% verified parity against a documented reference specification. Never commit or push; preserve all user changes.

## Baseline (Iteration 0)
**Project root:** `/Users/Sarvesh/Dev/Learning/Student timetable maker`
**Branch:** `master`

### Repository state (must be preserved)
Uncommitted user changes (all-day session work — do NOT touch/revert):
- `M docs/CALENDAR_ENGINEERING_SPEC.md`
- `M src/components/calendar/DayView.tsx`
- `M src/components/sessions/SessionEditor.tsx`
- `M src/components/timetable/SessionBlock.tsx`
- `?? src/components/timetable/SessionBlock.test.tsx` (untracked)

### Calendar applications discovered
| App | Location | Version | Event data readable | UI inspectable |
|-----|----------|---------|---------------------|----------------|
| Apple Calendar | /System/Applications/Calendar.app | 15.0 | No — TCC -1728 | No — window not capturable |
| Fantastical | /Applications/Fantastical.app | 4.2.2 | No — timed out | No |
| Microsoft Outlook | /Applications/Microsoft Outlook.app | 16.113.2 | No — TCC -1728 | No |
| Notion Calendar | /Applications/Notion Calendar.app | 1.140.0 | No — no AppleScript dict | No — Electron |

**Limitation:** Reference-app visual UI and event semantics could NOT be observed read-only (all blocked by macOS TCC/Accessibility permissions; screencapture returns wallpaper). Bypassing permissions is prohibited. Parity spec is grounded in StudyFlow's architecture + established calendar conventions; live visual QA not possible. See `docs/calendar-research.md`.

## Iteration 1 — Multi-day event support (COMPLETED & VERIFIED)
**Requirement addressed:** F7 (multi-day events) — `Session` model had no multi-day span.

**Files changed:**
- `src/types/index.ts` — added optional `endDate?: string` to `Session` (yyyy-MM-dd; `date`..`endDate` inclusive)
- `src/utils/calendar.ts` — `sessionsOnDate` now includes one-off sessions whose [date, endDate] range covers the target date; recurring matches by weekday; single-day matches by date; defensive weekday fallback
- `src/utils/calendar.test.ts` — +4 multi-day `sessionsOnDate` tests (start date, each span day, before/after span, same-day endDate)
- `src/components/sessions/SessionEditor.tsx` — added `startDate`/`endDate` date pickers for one-off (non-recurring) events; end-date validation (>= start date); submit writes `date`/`endDate` for one-off, derives `day` from startDate; recurring flow unchanged

**Verification:**
- `npx tsc --noEmit`: exit 0 (clean)
- `npx vitest run`: **385/385 pass** (23 files; was 381 + 4 new)
- `npm run build`: exit 0, built in 7.25s
- `npm run lint`: 0 errors, 9 pre-existing warnings, exits 0

**Parity spec status:** `docs/calendar-parity.md` F7 → IMPLEMENTED + TESTED; overall gaps remaining: F9 (recurrence rules), F10 (midnight), F14 (drag-to-create), F17 (conflict visual).

## Iteration 2 — F14 Drag to create events (COMPLETED & VERIFIED)
**Requirement addressed:** F14 (drag/click-to-create on empty time slot) — StudyFlow had no way to create a session by interacting with the calendar grid.

**Files changed:**
- `src/hooks/useCreateSession.ts` (NEW) — hook handling pointerdown/pointermove/pointerup/pointercancel on the grid container; snap-to-increment; range clamping; default-duration for clicks; session-click exclusion via `[data-session-id]`; touch/pointercancel abort; preview bar state
- `src/hooks/useCreateSession.test.tsx` (NEW) — 10 tests: click-to-create, drag-to-create, snap-to-increment, range-end clamp, default duration, session-click exclusion, pointercancel abort, preview bar show/hide, pointer-type filtering, configured date
- `src/components/timetable/DayColumn.tsx` — added `date` and `onCreateSession` props; wired `useCreateSession` to the grid container; renders preview bar
- `src/components/calendar/DayView.tsx` — added `onCreateSession` prop; wired `useCreateSession` to the single-day grid container; renders preview bar
- `src/components/timetable/TimetableGrid.tsx` — computes per-column date from `weekStartISO` via `getWeekDates`/`getDayDate`; passes `date` and `onCreateSession` to each `DayColumn`
- `src/App.tsx` — added `handleCreateSession(date, startTime, endTime, day)` which prefills `SessionEditor` with `recurring: false`; passes `onCreateSession` to `TimetableGrid` and `DayView`

**Verification:**
- `npx tsc --noEmit`: exit 0 (clean)
- `npx vitest run`: **395/395 pass** (24 files; was 385 + 10 new)
- `npm run build`: exit 0, built in 7.82s
- `npm run lint`: 0 errors, 9 pre-existing warnings, exits 0

**Parity spec status:** `docs/calendar-parity.md` F14 → IMPLEMENTED + TESTED; overall gaps remaining: F9 (recurrence rules), F10 (midnight), F17 (conflict visual).

## Iteration 3 — F17 Overlap/conflict visualization (COMPLETED & VERIFIED)
**Requirement addressed:** F17 (overlapping sessions visually distinguished) — sessions overlapping in time were rendered on top of each other with no visual distinction.

**Files changed:**
- `src/utils/calendar.ts` — added `SessionWithColumn` interface and `assignColumns()` greedy interval-graph-coloring function; overlapping sessions get different columns, boundary-touching sessions share a column
- `src/utils/calendar.test.ts` — +7 `assignColumns` tests (empty, single, overlapping→different columns, adjacent→same column, 3 mutually overlapping→3 columns, reuse columns, field preservation)
- `src/components/timetable/SessionBlock.tsx` — added optional `left`/`width` props (percentages); when provided, replaces `left-1 right-1` full-width classes with absolute positioning
- `src/components/timetable/DayColumn.tsx` — computes `assignColumns` for the day's sessions; passes `left`/`width` to each `SessionBlock`
- `src/components/calendar/DayView.tsx` — same column layout for the single-day view's timed sessions

**Verification:**
- `npx tsc --noEmit`: exit 0 (clean)
- `npx vitest run`: **402/402 pass** (24 files; was 395 + 7 new)
- `npm run build`: exit 0
- `npm run lint`: 0 errors, 9 pre-existing warnings, exits 0

**Parity spec status:** `docs/calendar-parity.md` F17 → IMPLEMENTED + TESTED; remaining gaps: F9 (recurrence rules), F10 (midnight).

## Iteration 4 — F9 Bounded recurrence rules (COMPLETED & VERIFIED)
**Requirement addressed:** F9 (recurrence rules) — `Session.recurring` was boolean only with no way to bound or customize recurrence patterns.

**Files changed:**
- `src/types/index.ts` — added `RecurrenceFrequency` type ('daily'|'weekly'|'monthly'); added optional `recurrenceRule`, `recurrenceWeekdays`, `recurrenceStartDate`, `recurrenceEndDate`, `recurrenceMaxOccurrences` to `Session`
- `src/utils/calendar.ts` — `sessionsOnDate` recurring branch now uses `occursOnDate`; added `occursOnDate`, `occurrenceOrdinal`, `dateDiffDays`, `countWeekdaysBetween`, `clampDayOfMonth`, `countMonthAnniversariesBetween` helpers; occurrences generated on read (not stored)
- `src/utils/calendar.test.ts` — +12 recurrence tests (daily/weekly/monthly recurrence, max occurrences clamp, end date clamp, ordinal calculation, legacy boolean backward compatibility)
- `src/components/sessions/SessionEditor.tsx` — recurrence frequency selector (weekly forever/daily/weekly/monthly), weekday multiselect, recurrence start/end date, max occurrences; validation for end date >= start date and max occurrences >= 1; submit writes new recurrence fields

**Verification:**
- `npx tsc --noEmit`: exit 0 (clean)
- `npx vitest run`: **414/414 pass** (24 files; was 402 + 12 new)
- `npm run build`: exit 0
- `npm run lint`: 0 errors, 9 pre-existing warnings, exits 0

**Parity spec status:** `docs/calendar-parity.md` F9 → IMPLEMENTED + TESTED; remaining gap: F10 (cross-midnight).

## Next actions
1. Final verification suite + engineering report
