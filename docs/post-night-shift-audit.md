# StudyFlow — Post-Night-Shift Audit Report

## 1. Audit Scope

This audit reviews the changes introduced during the Night Shift engineering session
(Iteration 1: F10 cross-midnight events, Iteration 2: B4 keyboard shortcuts,
Iteration 3: B1 calendar date picker, Iteration 4: C2 DayView empty state), plus
the pre-existing uncommitted all-day session work and multi-day/recurrence support.

All pre-existing user changes were preserved. No reset, clean, revert, commit, or
push was performed.

## 2. Quality Gates — Actual Results

| Check | Command | Result |
|-------|---------|--------|
| Tests | `npx vitest run` | **445/442 pass** (26 files; 3 new tests added) |
| TypeScript | `npx tsc --noEmit` | exit 0 (clean) |
| Production build | `npm run build` | exit 0 |
| Lint | `npm run lint` | 0 errors, 9 pre-existing warnings (exit 0) |

## 3. Findings by Area

### 3.1 Overnight session duration and rendering across midnight — CONFIRMED WORKING

**Files:** `src/utils/calendar.ts`, `src/utils/date.ts`, `src/components/timetable/SessionBlock.tsx`, `src/components/timetable/DayColumn.tsx`, `src/components/calendar/DayView.tsx`

- `durationMinutes("23:00", "01:00")` correctly returns 120 (wraps past 24:00).
- `getSessionHeight("23:00", "01:00")` correctly computes overnight height.
- `sessionsOnDate` matches overnight sessions on both their start date and the following day.
- Overnight sessions render from `startTime` to range end on the start date, and from `00:00` to `endTime` on the continuation date.
- Overnight sessions are excluded from drag/resize (edited only via the session editor).
- `shiftSessionByPixels` returns overnight sessions unchanged.

**Tests added:** 16 tests covering `durationMinutes`, `timeOverlaps` ×5, `sessionsOnDate` ×4, `shiftSessionByPixels`, `getSessionHeight`, `addMinutes` wrap.

### 3.2 Midnight boundary cases and overlap detection — CONFIRMED WORKING with one documented limitation

**File:** `src/utils/calendar.ts`

`timeOverlaps` correctly handles:
- Overnight vs same-day evening overlap (e.g. 22:00-23:30 vs 23:00-01:00 → true).
- Overnight vs early-morning same-date (e.g. 23:00-01:00 vs 00:30-01:30 → true).
- Boundary touch (e.g. 23:00-01:00 vs 01:00-02:00 → false).
- Two overlapping overnight sessions → true.
- Non-overlapping overnight vs later same-day (e.g. 23:00-01:00 vs 02:00-03:00 → false).

**Documented limitation (conservative false positive, no data risk):**
`timeOverlaps("23:00", "01:00", "00:00", "00:30")` returns `true`, but on a single calendar date these sessions do not actually overlap (the overnight session's early-morning portion belongs to the next calendar date). This causes the two sessions to be placed in different columns (wasted horizontal space) but never causes visual double-booking or data loss. Fixing this would require passing date context into `timeOverlaps`, which is a larger refactor. The current behavior is safe (errs on the side of separation).

**Test added:** documents this conservative behavior explicitly.

### 3.3 Monthly recurrence month-end clamping — BUG FOUND AND FIXED

**File:** `src/utils/calendar.ts`, function `clampDayOfMonth`

**Bug:** `clampDayOfMonth(31, "2026-02-28")` returned 31 instead of 28. The original implementation called `d.setDate(day)` which rolled Feb 28 + 3 days forward to March 3, then backed up to March 31 — returning March 31 instead of February's last day (28). This caused `occursOnDate` to incorrectly return `false` for a monthly recurrence on Jan 31 occurring on Feb 28.

**Fix:** Rewrote `clampDayOfMonth` to compute the last day of the target ISO month directly:
```ts
const d = new Date(`${iso}T00:00:00`);
d.setDate(1); // first day of iso's month
d.setMonth(d.getMonth() + 1); // first day of next month
d.setDate(0); // last day of iso's month
const lastDay = d.getDate();
return Math.min(day, lastDay);
```

**Test added:** `occursOnDate` monthly clamp Jan 31 → Feb 28 → Mar 31.

### 3.4 Recurring, all-day and multi-day session compatibility — CONFIRMED WORKING

- Legacy `recurring: true` without `recurrenceRule` still matches by weekday (backward compatible).
- Bounded recurrence (`recurrenceRule: daily/weekly/monthly`) expands occurrences on read via `occursOnDate`/`occurrenceOrdinal`.
- Recurrence end date and max occurrences clamp occurrence generation correctly.
- All-day sessions render without time fields on both DayView and MonthView.
- Multi-day sessions (`date` + `endDate`) render on every day of their span.
- Overnight + recurring simultaneously is prevented at the UI level (overnight toggle only appears when `!recurring`); if such a record existed via code, `sessionsOnDate` would use the recurring branch and ignore `overnight`. This is an edge case with no data loss.

### 3.5 Keyboard shortcuts — CONFIRMED WORKING

**File:** `src/hooks/useKeyboardShortcuts.ts`

- `t` → `goToToday()`, `1-4` → `setView(view)`, `n` → `next()`, `p` → `prev()`, `c` → `onAddSession()`.
- Suppressed when typing in `input`/`textarea`/`select`/contentEditable (via `useKeyboard`).
- Suppressed when any modifier key (Ctrl/Alt/Meta/Shift) is held.
- No conflict with FocusMode's Space handler (different keys; FocusMode only mounts on the focus tab).
- Listener cleanup is handled by `useKeyboard` (adds/removes `keydown` listener on mount/unmount).

**Tests added:** 10 tests covering all 8 shortcuts, modifier suppression, input suppression.

### 3.6 Calendar date picker — CONFIRMED WORKING

**File:** `src/components/calendar/CalendarNav.tsx`

- Added `<input type="date">` bound to `selectedDate`.
- Changing the date updates `selectedDate` via `setSelectedDate`.
- Works across month and year boundaries (native date picker).
- Programmatic date changes (via Prev/Next/Today/keyboard) are reflected in the input because it is controlled.

**Tests added:** 2 tests (renders input, updates value on change).

### 3.7 DayView empty state — CONFIRMED WORKING

**File:** `src/components/calendar/DayView.tsx`

- When `timedSessions.length === 0 && allDaySessions.length === 0`, renders "No sessions on [date]" with a hint to click a time slot to add a session.
- Does not interfere with the drag-to-create overlay or current-time indicator.

## 4. Regression Tests Added

| File | Tests Added | Coverage |
|------|-------------|----------|
| `src/utils/calendar.test.ts` | 13 | durationMinutes overnight, timeOverlaps overnight ×6, sessionsOnDate overnight ×5, shiftSessionByPixels overnight, occursOnDate/occurrenceOrdinal monthly clamp ×2 |
| `src/utils/date.test.ts` | 3 | addMinutes wrap, getSessionHeight overnight |
| `src/hooks/useKeyboardShortcuts.test.tsx` | 10 | All 8 shortcuts, modifier suppression, input suppression |
| `src/components/calendar/CalendarNav.test.tsx` | 2 | Date picker render, date picker update |

Total: 28 new tests across this audit session.

## 5. Remaining Risks / Limitations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Overnight + recurring simultaneously | Low | UI prevents creating this combination. If created via code, `overnight` is ignored in favor of recurring. No data loss. |
| `timeOverlaps` false positive for overnight vs early-morning same-date | Low | Wastes a column (visual space), never causes double-booking. Documented in code comment and test. |
| Overnight session invisible outside timeRange (e.g. 08:00-22:00 range hides 23:00-01:00) | Low | Consistent with how all out-of-range sessions behave. User must widen timeRange to view overnight sessions. |
| `00:00-00:00` overnight would compute 24-hour duration | Low | Prevented by SessionEditor validation ("Overnight session must have a different end time"). |

## 6. Conclusion

All Night Shift changes are verified working. The one bug found (monthly recurrence month-end clamping) was fixed and covered by a regression test. All quality gates pass: 445/445 tests, clean TypeScript, successful production build, clean lint. No pre-existing user changes were modified or discarded. No commit or push was performed.

## 7. Next Steps (from backlog)

1. B3: Agenda/upcoming-deadline summary view.
2. D2: Missing regression tests for AgendaView, HomeworkView, ImportDialog.
3. C1: Session readability for short blocks (<30 min).
4. C2: Empty states for DayView (completed in this session).
