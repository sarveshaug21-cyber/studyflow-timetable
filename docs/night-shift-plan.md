# StudyFlow Night Shift — Prioritised Backlog

## Priority A — Correctness first (cross-midnight)

### A1: F10 Cross-midnight events (CONFIRMED DEFECT)
**Problem:** A session from 23:00 to 01:00 cannot be represented. `startTime`/`endTime` are same-day HH:mm; `durationMinutes` returns negative; `sessionsOnDate` won't match the next day; `timeOverlaps` breaks.
**Acceptance criteria:**
- User can create a 23:00→01:00 overnight session
- Session appears on both dates in day/week views
- Duration computed correctly (2 hours)
- Persistent storage stores one session (not duplicated)
- Editing/moving doesn't corrupt dates/times
- Recurrence, overlap layout, all-day sessions remain correct
**Files:** `src/types/index.ts`, `src/utils/date.ts`, `src/utils/calendar.ts`, `src/components/sessions/SessionEditor.tsx`, `src/components/timetable/SessionBlock.tsx`, `src/components/timetable/DayColumn.tsx`, `src/components/calendar/DayView.tsx`

## Priority B — Major functional improvements

### B1: Better calendar navigation / date selection
**Problem:** No visual date picker; navigating by week/month only via Prev/Next/Today buttons.
**Value:** Medium. Users want to jump to arbitrary dates.
**Files:** `src/components/calendar/CalendarNav.tsx`, `src/components/calendar/MonthView.tsx`

### B2: Clearer recurrence controls / validation feedback
**Problem:** Recurrence end date before start date shows error but UI could be clearer.
**Value:** Low-Medium. Already implemented in F9.
**Files:** `src/components/sessions/SessionEditor.tsx`

### B3: Agenda/upcoming-deadline summary
**Problem:** Agenda view shows sessions but no upcoming homework deadlines.
**Value:** Medium.
**Files:** `src/components/agenda/AgendaView.tsx`, `src/components/homework/`

### B4: Keyboard shortcuts for calendar
**Problem:** No keyboard shortcut to jump to today, toggle views, or create session.
**Value:** Medium (accessibility).
**Files:** `src/components/calendar/CalendarNav.tsx`, `src/App.tsx`

## Priority C — Professional polish

### C1: Session readability for short blocks
**Problem:** Short sessions (< 30 min) have cramped text in day view.
**Value:** Low.
**Files:** `src/components/timetable/SessionBlock.tsx`

### C2: Empty states for day/week views
**Problem:** Day view with no sessions shows nothing; no guidance.
**Value:** Low.
**Files:** `src/components/timetable/DayColumn.tsx`, `src/components/calendar/DayView.tsx`

## Priority D — Reliability and performance

### D1: Date arithmetic DST safety
**Problem:** All dates stored as local yyyy-MM-dd; no DST conversion issues observed but not explicitly tested.
**Value:** Low. Already covered by R10.
**Files:** `src/utils/date.ts`, `src/utils/calendar.ts`

### D2: Missing regression tests
**Problem:** Some UI components lack tests (AgendaView, HomeworkView, ImportDialog).
**Value:** Medium.
**Files:** Various `*.test.tsx`

## Decision log
- F10 cross-midnight is the only remaining functional gap; start there.
- All other items are lower priority and will be addressed if time permits after F10 is verified.
