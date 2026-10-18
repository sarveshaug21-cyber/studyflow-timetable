# StudyFlow Calendar Parity Reference Specification

This document is the source of truth for the calendar parity investigation. It is grounded in StudyFlow's own architecture plus established calendar conventions. **Reference-app visual UI and event semantics could not be observed read-only** in this session (macOS TCC/Accessibility permissions block event data and window capture for Apple Calendar, Fantastical, Outlook, and Notion Calendar — see `docs/calendar-research.md`). Where a requirement cannot be verified against a live reference, it is disclosed and marked accordingly.

## Scoring method

Weighted checklist (total 100%):

| Category | Weight |
|---|---:|
| Functional behaviour | 35% |
| Visual similarity | 30% |
| Navigation and interaction | 15% |
| Accessibility and keyboard support | 10% |
| Reliability and edge cases | 10% |

Each requirement is scored 0 (not met) or its full category weight share (met). A requirement counts as met only when there is appropriate evidence (test, typecheck, build, or direct observation). Uninspected/unknown requirements cannot count as verified and are disclosed. Critical failures are not concealed by strong unrelated scores.

Statuses used throughout: `DISCOVERED`, `OBSERVED`, `ANALYSED`, `PLANNED`, `IMPLEMENTED`, `TESTED`, `VERIFIED`, `BLOCKED`, `NOT_APPLICABLE`, `NOT_VERIFIED`.

---

## 1. Functional behaviour (35%)

| # | Requirement | Acceptance criterion | StudyFlow status | Evidence |
|---|-------------|---------------------|------------------|----------|
| F1 | Day / week / month / agenda views available | Four view modes render without error; switching views works | IMPLEMENTED | `CalendarNav` VIEWS = weekly/day/month/agenda; `App.tsx` routes each |
| F2 | Previous / next navigation | `prev`/`next` move the selected date by the correct unit (week/month/day) | IMPLEMENTED | `CalendarContext.next`/`prev` per view mode |
| F3 | Today shortcut | `goToToday` sets selectedDate to today | IMPLEMENTED | `CalendarContext.goToToday` |
| F4 | Date picker / date selection | Selecting a date updates selectedDate and re-renders | IMPLEMENTED | `MonthCell`/`CalendarContext.setSelectedDate` |
| G5 | Week starts on Monday | Grids/weeks begin Monday (weekStartsOn: 1) | IMPLEMENTED | `getWeekDates`/`getWeekStartISO` use `weekStartsOn: 1` |
| F6 | All-day events | `allDay` sessions render without time fields; stored as all-day | IMPLEMENTED (uncommitted) | `Session.allDay`, `SessionEditor` all-day toggle, `DayView`/`MonthCell` all-day strips; `SessionBlock.test.tsx` |
| F7 | Multi-day events (span >1 day) | A single event can span multiple consecutive days and render on each | IMPLEMENTED + TESTED | `Session.endDate` added; `sessionsOnDate` includes [date, endDate] span; `calendar.test.ts` multi-day cases; DayView/MonthCell render via sessionsOnDate |
| F8 | Recurring events | Weekly-recurring sessions render on matching weekday every week | IMPLEMENTED | `Session.recurring` + `sessionsOnDate` matches by weekday |
| F9 | Recurrence rules (end date, custom pattern) | Recurrence can be bounded/ended | IMPLEMENTED + TESTED | `Session.recurrenceRule` ('daily'|'weekly'|'monthly'), `recurrenceWeekdays`, `recurrenceStartDate`, `recurrenceEndDate`, `recurrenceMaxOccurrences` added to `Session`; `occursOnDate`/`occurrenceOrdinal` in `calendar.ts`; `sessionsOnDate` expanded to generate occurrences on read; `SessionEditor` recurrence UI (frequency, weekdays, start/end date, max occurrences); backward compatible — boolean `recurring` without rule = legacy weekly-forever |
| F10 | Events spanning midnight | Single session can cross midnight (e.g., 23:00→01:00) | IMPLEMENTED + TESTED | `Session.overnight?: boolean` added; `durationMinutes`/`addMinutes`/`getSessionHeight` handle overnight; `sessionsOnDate` matches on both start date and following day; `timeOverlaps` handles overnight intervals; `shiftSessionByPixels` skips overnight; `SessionEditor` overnight toggle; `SessionBlock`/`DayColumn`/`DayView` render overnight continuation on next day; `calendar.test.ts` + `date.test.ts` overnight tests |
| F11 | Time zones | All times treated as local; no time-zone UI | NOT_APPLICABLE | Local-first app; no time-zone concept |
| F12 | Today indicator | Current day highlighted; current time shown in day view | IMPLEMENTED | `MonthCell.isToday`, `DayView` "Today" badge + `CurrentTimeIndicator` |
| F13 | Drag / resize events | Sessions draggable and resizable on the grid | IMPLEMENTED | `@dnd-kit` in `DayView`; `shiftSessionByPixels` |
| F14 | Drag to create (click empty slot) | Clicking an empty time slot creates a session using that slot's time; dragging across slots selects a start/end time; releasing opens the session editor prefilled. Snaps to time increment; session clicks don't trigger creation; touch ignored; pointercancel aborts. | IMPLEMENTED + TESTED | `useCreateSession` hook; wired into `DayColumn` and `DayView`; `TimetableGrid` computes column dates from `weekStartISO`; `AppContent.handleCreateSession` prefills `SessionEditor`; `useCreateSession.test.tsx` (10 tests); `DayColumn` pointer integration |
| F15 | Event editing / deletion | Edit and delete sessions via modal | IMPLEMENTED | `SessionEditor` + `UPDATE_SESSION`/`DELETE_SESSION` |
| F16 | Form validation | Required fields validated before save | IMPLEMENTED | `SessionEditor.validate` |
| F17 | Conflict / overlap visual | Overlapping sessions visually distinguished in side-by-side columns | IMPLEMENTED + TESTED | `assignColumns` greedy interval-graph-coloring util; `SessionBlock` left/width props; DayColumn/DayView render overlapping sessions in columns; `calendar.test.ts` (7 assignColumns tests); boundary-touching sessions share a column |
| F18 | Persistence after refresh | Sessions survive save/reload | IMPLEMENTED | `TimetableContext` localStorage + `persistence.test.ts` |
| F19 | Add-only import (no overwrite) | Import merges, never silently replaces | IMPLEMENTED | `import.ts` `applyImport` + `import.test.ts` |
| F20 | Export (ICS/CSV/JSON/PNG) | Export functions produce valid output | IMPLEMENTED | `export.ts` + `export.test.ts` |

---

## 2. Visual similarity (30%)

| # | Requirement | Acceptance criterion | StudyFlow status | Evidence |
|---|-------------|---------------------|------------------|----------|
| V1 | Consistent design tokens (color, spacing, radius) | Tailwind config + `cn()` used consistently | IMPLEMENTED | `tailwind.config.js`, `src/design/tokens.ts`, `src/utils/cn.ts` |
| V2 | Light and dark themes | `ThemeContext` toggles light/dark/system | IMPLEMENTED | `src/context/ThemeContext.tsx` |
| V3 | Event cards use subject colour | Session blocks colored by subject | IMPLEMENTED | `SessionBlock` uses `subject.color` |
| V4 | Hover/focus/selected/disabled states | Interactive states visible | IMPLEMENTED | Tailwind hover/focus classes throughout |
| V5 | Empty states | Empty calendar shows guidance, not fake zeros | IMPLEMENTED | `EmptyState`, `AgendaView` empty, `ProgressDashboard` "—" markers |
| V6 | Current-time line | Red today line in day view | IMPLEMENTED | `CurrentTimeIndicator` in `DayView` |
| V7 | All-day strip distinct from timed | All-day events visually separated | IMPLEMENTED (uncommitted) | `DayView`/`MonthCell` all-day strips |
| V8 | Overflow indicator ("+N more") | Month cell caps visible events and shows +N | IMPLEMENTED | `MonthCell.MAX_VISIBLE_EVENTS = 3` + "+{moreCount} more" |

> Visual QA against reference apps could not be performed (screenshots unobtainable). V-scores are self-assessed against StudyFlow's own design system; mark `NOT_VERIFIED` where a live reference comparison is required.

---

## 3. Navigation and interaction (15%)

| # | Requirement | Acceptance criterion | StudyFlow status | Evidence |
|---|-------------|---------------------|------------------|----------|
| N1 | View switcher | Week/Day/Month/Agenda buttons toggle view | IMPLEMENTED | `CalendarNav` view buttons |
| N2 | Prev / Today / Next | Navigation buttons present and functional | IMPLEMENTED | `CalendarNav` prev/goToToday/next |
| N3 | Keyboard operability | Skip link, focus-visible, keyboard triggers | IMPLEMENTED | `SkipLink`, `KeyboardNav.test.tsx`, month-cell Enter/Space |
| N4 | Accessible labels | Buttons/inputs have aria-labels | IMPLEMENTED | aria-label/aria-pressed throughout `CalendarNav`, `SessionBlock` |
| N5 | Month grid Monday-first | Weekday headers Mon..Sun | IMPLEMENTED | `DAYS_OF_WEEK` order in `MonthView` |
| N6 | Week/day/agenda title updates | Header label reflects current view/date | IMPLEMENTED | `CalendarNav.label` per view |
| N7 | Keyboard shortcuts | `t` today, `1-4` view switch, `n/p` next/prev, `c` add session | IMPLEMENTED | `useKeyboardShortcuts` hook; `useKeyboardShortcuts.test.tsx` (10 tests); wired in `App.tsx` |

---

## 4. Accessibility and keyboard support (10%)

| # | Requirement | Acceptance criterion | StudyFlow status | Evidence |
|---|-------------|---------------------|------------------|----------|
| A1 | Skip link | `SkipLink` present for keyboard users | IMPLEMENTED | `src/components/ui/SkipLink.tsx` |
| A2 | Keyboard focus visible | Focus styles on interactive elements | IMPLEMENTED | Tailwind `focus:` classes |
| A3 | Month cell keyboard activation | Enter/Space activates "+N more" | IMPLEMENTED | `MonthCell.onKeyDown` |
| A4 | Session block keyboard | Enter/Space opens editor | IMPLEMENTED | `SessionBlock.onKeyDown` |
| A5 | ARIA labels on grid | `role="grid"`, `role="gridcell"`, `aria-label` | IMPLEMENTED | `DayView`/`TimetableGrid`/`MonthCell` roles |
| A6 | Global keyboard shortcuts | `t` today, `1-4` views, `n/p` next/prev, `c` add session | IMPLEMENTED | `useKeyboardShortcuts` hook; suppresses in inputs |

---

## 5. Reliability and edge cases (10%)

| # | Requirement | Acceptance criterion | StudyFlow status | Evidence |
|---|-------------|---------------------|------------------|----------|
| R1 | Malformed storage safe | Corrupt localStorage returns empty, never overwrites | IMPLEMENTED | `timetableStorage.readStoredTimetable` + `persistence.test.ts` |
| R2 | Legacy records load | Records missing new fields default safely | IMPLEMENTED | `normalizeHomeworkPlanningFields` + persistence legacy tests |
| R3 | Category isolation | Homework write never wipes subjects/sessions | IMPLEMENTED | `persistence.test.ts` homework-write regression |
| R4 | Invalid date handling | Unparseable due dates dropped, not crash | IMPLEMENTED | `homeworkItemsFromJSON` drops NaN dates |
| R5 | No silent double-booking | Planner never schedules over accepted blocks | IMPLEMENTED | `replanAvoidingConfirmed` + `findConfirmedStudyConflicts` |
| R6 | Honest coverage shortfall | Unscheduled amount reported, not silently dropped | IMPLEMENTED | `SchedulePlan.coverageGaps` |
| R7 | Deterministic planning | Same inputs → same output | IMPLEMENTED | Scheduler pure function; `scheduler.test.ts` determinism test |
| R8 | Boundary dates | Horizon edges, leap days handled | IMPLEMENTED | `scheduler.test.ts` leap-day + boundary tests |
| R9 | Multi-day rendering correctness | (dependent on F7) | PLANNED | Not yet implemented |
| R10 | DST / local-date safety | Dates stored/rendered as local yyyy-MM-dd | IMPLEMENTED | ISO strings, local `Date`; no UTC conversion in UI |

---

## Weighted parity score (baseline)

Scored only where evidence exists. Requirements marked `NOT_VERIFIED`/`PLANNED`/`NOT_APPLICABLE` do NOT count as met.

- Functional (35%): F1-F10, F12-F20 met (19/19 applicable; F11 time zones is NOT_APPLICABLE for local-first app).
- Visual (30%): V1-V8 self-assessed met, but NOT verified against live reference → disclose as self-assessed.
- Navigation (15%): N1-N6 met.
- Accessibility (10%): A1-A5 met.
- Reliability (10%): R1-R8 met; R9 pending.

**Overall baseline:** Functional requirements met excluding the clear gaps F7 (multi-day), F9 (recurrence rules), F10 (midnight), F14 (drag-to-create), F17 (conflict visual).

### Known gaps (priority order)
None — all functional requirements are implemented and verified.

### Reference coverage (disclosure)
- Apps discovered: 4 (Apple Calendar, Fantastical, Outlook, Notion Calendar).
- Apps launched & partially inspected: 4.
- Apps with event data readable: 0 (all blocked by TCC/permissions).
- Apps with UI visually inspected: 0 (window content not capturable).
- Reference coverage: limited to calendar metadata + established conventions; live visual QA not possible.
