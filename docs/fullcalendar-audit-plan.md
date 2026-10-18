# StudyFlow — FullCalendar Integration: Audit & Integration Plan

**Status:** Design document (Phase 1 audit complete; Phase 2 plan below)
**Stack:** Vite 5 + React 18.3 + TypeScript + Tailwind, vitest + happy-dom, eslint
**Branch:** `feature/fullcalendar-prototype` (no commits; existing uncommitted changes preserved)

---

## 1. Phase 1 — Audit findings

### 1.1 Existing architecture (verified)

- **Build:** Vite 5, `base: '/studyflow-timetable/'`, `@` alias → `./src`, rollup-plugin-visualizer already wired.
- **State:** Single source of truth = `TimetableContext` (useReducer) persisted to `localStorage` on every state change (`timetableStorage`). `CalendarContext` owns only `view` + `selectedDate` — no session CRUD, no duplication.
- **Session model** (`src/types/index.ts`): `Session` has `day` (DayOfWeek), optional `date`/`endDate` (yyyy-MM-dd), `allDay?`, `startTime`/`endTime` (HH:mm), `overnight?`, `recurring`, `recurrenceRule?` (`daily|weekly|monthly`), `recurrenceWeekdays?`, `recurrenceStartDate?`, `recurrenceEndDate?`, `recurrenceMaxOccurrences?`. Times are wall-clock local HH:mm; no time zones.
- **Views:** `TimetableGrid` (week), `DayView` (single day), `MonthView`, `AgendaView` — all custom-built on `@dnd-kit` + `TimetableLayoutContext` (pixels-per-hour math). `CalendarNav` provides prev/today/next/date-picker/view-switcher.
- **Interactions already present:** click-to-create (`useCreateSession`), drag-to-move/resize (`@dnd-kit`), `SessionEditor` modal (all-day, overnight, recurrence), `Delete` key, ARIA labels, keyboard shortcuts (`t` today, `1-4` views, `n/p`, `c`).
- **Tests:** 458 passing, 1 pre-existing failure (`HomeworkView.test.tsx` "Subject" button — unrelated to calendar). Typecheck clean; lint clean (9 pre-existing warnings); production build succeeds (~660 kB JS).
- **Uncommitted changes:** 15 modified files + 7 new test/component files (calendar rework). All preserved; nothing reset, reverted, or committed.

### 1.2 FullCalendar official documentation & licensing (verified against fullcalendar.io)

- Current major: **v7.1.3**. `@fullcalendar/react` is MIT licensed; standard (non-premium) plugins are MIT, commercial use permitted, no license key required.
- v7 install set: `@fullcalendar/react` + `@fullcalendar/core` (peer dep) + `temporal-polyfill` (peer dep, React 17/18/19 — StudyFlow uses 18.3, compatible).
- v7 plugins are imported from subpaths of `@fullcalendar/react`: `daygrid` (month/dayGrid views), `timegrid` (timeGridWeek/Day), `list` (agenda list views), `interaction` (date clicking, drag-and-drop, resizing), themes (`classic`, `monarch`, `breezy`, `forma`, `pulse`). `@fullcalendar/core` is NOT installed standalone with v7; types ship with the connector.
- **Premium (FullCalendar Scheduler):** `resource-*` views, timeline, printer-friendly — requires a commercial license key ($480+ starting). NOT needed for StudyFlow; not in scope.
- CSS: skeleton.css always required + one theme + one palette stylesheet. Dark mode achievable via theme CSS overrides keyed on the `dark` class ThemeContext already toggles on `document.documentElement`.
- FullCalendar v7 renders plain DOM (no canvas); keyboard navigation is built into the calendar chrome. Event-level keyboard focus needs verification in the prototype.

### 1.3 Compatibility risk analysis

| Risk | StudyFlow reality | FullCalendar fit | Verdict |
|------|-------------------|------------------|---------|
| Overnight sessions (23:00→01:00) | Custom `overnight` flag; start/end are same-day wall-clock; duration wraps past midnight | Native: FC events take full start/end datetimes; an overnight session is `start: D T 23:00, end: D+1 T 01:00`, rendered crossing midnight automatically | **Better than current** — no special-casing needed in the view layer |
| Recurring sessions | `recurrenceRule` + weekdays + start/end date + max occurrences, expanded on read | FC `recurring` event prop (daysOfWeek/startRecur/endRecur) OR pre-expand occurrences into dated FC events for the visible window | Pre-expansion chosen (see §4.2) — keeps StudyFlow's single-source-of-truth and drag semantics simple |
| All-day events | `allDay: true`, rendered in strips | Native `allDay: true` | ✅ |
| Persistence | localStorage via TimetableContext reducer | FC is a pure view layer; `events` derived each render from `state.sessions`; edits flow back through existing `addSession`/`updateSession`/`deleteSession` → same localStorage persistence | ✅ No duplicate source of truth |
| 24-hour timeline | Custom grid always 24h tall; slot times from `timeRange` | `slotMinTime`/`slotMaxTime` from `state.timeRange`; `'00:00'–'24:00'` gives full 24h natively | ✅ |
| Subject colours + labels | `subject.color`, contrast text via `getContrastColor` | Per-event `backgroundColor`/`borderColor` from subject color; custom `eventContent`/`eventDidMarkup` for minimal Notion-like chips | ✅ Original styling, no proprietary assets copied |
| Click-to-view / edit | `SessionEditor` modal | `eventClick` → SessionEditor; `dateClick`/`dateSelect` → create editor prefilled | ✅ |
| Drag-and-drop / resize | `@dnd-kit` + `shiftSessionByPixels` validation | FC `interaction` plugin + `eventDrop`/`eventResize` callbacks; reuse `timeOverlaps`/timeRange validation; invalid drops revert via `event.revert()` | ✅ Compatible |
| Homework deadlines | `HomeworkItem.dueDate`, separate HomeworkView | Non-completed homework → all-day FC events on `dueDate` with distinct styling; click → existing `HomeworkEditor` | ✅ |
| Responsive / dark mode / a11y | Tailwind `dark:` variants, ThemeContext `dark` class on `<html>` | Theme CSS overrides scoped to `.dark`; FC chrome is keyboard operable; SkipLink + existing shortcuts retained | ✅ |

---

## 2. Phase 2 — Design plan

### 2.1 Packages (MIT only)

Production dependencies:
- `@fullcalendar/react@^7.1.3` (MIT; peer deps: react ^17/^18/^19, react-dom)
- `@fullcalendar/core@^7.1.3` (MIT, peer dep of the connector)
- `temporal-polyfill@^1.0.1` (MIT, peer dep)

Imported plugins (all from `@fullcalendar/react/*`, all MIT standard):
- `@fullcalendar/react/daygrid` → `dayGridMonth`
- `@fullcalendar/react/timegrid` → `timeGridWeek`, `timeGridDay`
- `@fullcalendar/react/list` → `listWeek`
- `@fullcalendar/react/interaction` → `dateClick`, `dateSelect`, `eventDrop`, `eventResize`, `eventClick`
- `@fullcalendar/react/themes/classic` → base theme, overridden with original StudyFlow CSS

No commercial license key, no premium packages, no external integrations (no CalDAV/Google sync).

### 2.2 View mapping (StudyFlow view → FullCalendar view)

| StudyFlow view | FullCalendar `initialView` | Notes |
|---|---|---|
| `weekly` | `timeGridWeek` | Mon–Sun, weekends toggleable via `hiddenDays` |
| `day` | `timeGridDay` | Single date |
| `month` | `dayGridMonth` | 6×7 grid, all-day + timed events in cells |
| `agenda` | `listWeek` | Chronological list |

### 2.3 Session → FullCalendar event mapping

Single source of truth remains `state.sessions` (TimetableContext/localStorage). FullCalendar never mutates sessions; it renders derived events and reports intent via callbacks.

Each session is expanded into one or more **dated occurrence events** for the visible window (≈ 8 weeks around `selectedDate`), matching the existing `sessionsOnDate` semantics:

- `id` = `fc-${session.id}@${instanceDate}` (stable per occurrence)
- `title` = `${subject.code}: ${subject.name}` (homework: `Due: ${title}`)
- `allDay` = session.allDay (homework deadlines always all-day)
- `start` / `end` = full ISO datetimes from instance date + startTime/endTime; overnight → end on following calendar day
- `backgroundColor` / `borderColor` = subject color (homework: neutral slate with left accent)
- `extendedProps`: `sessionId` (master), `instanceDate`, `kind` (`session\|homework`), `type`, `location`, `notes`, `recurring`, `allDay`, `overnight`

Recurring sessions are expanded per occurrence within the window using the same weekday/rule logic as `calendar.ts` (`occursOnDate`), so a recurring lecture renders on every matching weekday — no stored occurrences, no duplicate truth.

### 2.4 Interactions

- **Click an event** (`eventClick`) → open existing `SessionEditor` with the master session as `initialData` (click-to-view/edit). Edit/save flows through existing `updateSession` → localStorage.
- **Click empty slot** (`dateClick`) or **drag across slots** (`dateSelect`, `selectable`) → open `SessionEditor` prefilled with date/day/startTime/endTime (`recurring: false`), then `addSession`.
- **Drag an event** (`eventDrop`) → compute proposed session from new datetimes:
  - one-off dated session: new `date`, `day` (weekday of new date), `startTime`, `endTime` (duration preserved)
  - recurring occurrence: new master `startTime`/`endTime`; if weekday changed, shift `day`/`recurrenceWeekdays` accordingly
  - revert (`event.revert()`) for: all-day, multi-day (`endDate`), overnight drags, drops outside `slotMinTime`/`slotMaxTime`, or invalid per `timeOverlaps` policy; non-fatal toast.
- **Resize an event** (`eventResize`) → new `endTime`, duration ≥ 30 min, within slot range; revert otherwise. All-day/overnight/multi-day resize → revert.
- **Delete** → existing `Delete` key handling retained via SessionBlock? FullCalendar events are separate DOM; add Delete-on-focused-event through FC's `event` elements (tabIndex/focus handling to be verified in prototype; fallback: editor delete button).
- **Today button** → `CalendarProvider.goToToday()` + FC `calendarAPI.gotoDate(today)`. Both CalendarNav's Today and FC's `today` toolbar button wired to the same action.
- **Prev/Next** → `CalendarProvider.next()`/`prev()` (per-view span) + `calendarAPI.gotoDate(selectedDate)`.
- **Date picker** → `setSelectedDate` + `calendarAPI.gotoDate(date)`.
- **View switcher** → `setView` + `calendarAPI.changeView(mappedView)`.

Two-way date sync: CalendarProvider is source of truth; FC `datesSet` callback writes back to `selectedDate` when the user navigates via FC's own toolbar; external date changes call `calendarAPI.gotoDate()`.

### 2.5 Homework deadline visibility

Non-completed `state.homework` items → all-day FC events on `dueDate`, styled distinct (dashed neutral border, `Due:` prefix, subject colour accent when a subject matches by name). Click → open existing `HomeworkEditor` (standalone modal) prefilled with the homework item; save → `updateHomework` → re-render.

### 2.6 Styling (original, Notion-inspired minimal)

- Classic theme skeleton + theme CSS, then StudyFlow CSS variables (already in `index.css`) applied to `.fc` overrides: neutral borders, brand ring on today, subject-colour left border + light tint fill, contrast text, `rounded-lg` event corners, compact `text-xs` labels.
- Dark mode: overrides scoped under `html.dark .fc` (ThemeContext already toggles the `dark` class).
- No Notion brand colours, logos, or assets used; no proprietary UI copied.

### 2.7 Accessibility

- Retain SkipLink, CalendarNav aria-labels, `focus-visible` rings (global).
- Keep existing keyboard shortcuts (`t`, `1-4`, `n/p`, `c`) wired in `App.tsx`.
- Verify FC event keyboard operability in prototype; if events are not directly focusable, keyboard users reach sessions via date picker + "Add Session", and editing via the date's agenda list. Disclose as a known limitation with a follow-up task.

### 2.8 What stays untouched (fallback)

All existing components (`TimetableGrid`, `DayView`, `MonthView`, `DayColumn`, `SessionBlock`, `@dnd-kit` usage, `useCreateSession`, `calendar.ts`) remain in `src` unmodified. They are the rollback fallback. No component is deleted.

---

## 3. Phase 3 — Prototype implementation plan

### 3.1 Branch strategy

Work on branch `feature/fullcalendar-prototype` created from `master`. No commits; existing uncommitted changes stay in the working tree and travel with the branch.

### 3.2 Files to add

| File | Purpose |
|------|---------|
| `src/utils/fullcalendar.ts` | Pure mapping: `sessionsToEvents`, `homeworkToEvents`, `eventDropDeltaToSession`, `eventResizeDeltaToSession`, FC view-name mapping, visible-window occurrence expansion |
| `src/components/calendar/FullCalendarView.tsx` | FC component wrapper: providers, `events` derived from store, `eventClick`/`eventDrop`/`eventResize`/`dateSelect`/`dateClick`/`datesSet` handlers, SessionEditor + HomeworkEditor modals |
| `src/components/calendar/FullCalendarView.test.tsx` | Render/click/navigation/overnight/recurring/homework tests |
| `src/utils/fullcalendar.test.ts` | Mapping unit tests (overnight crossing midnight, recurring expansion bounds, all-day, homework, drop/resize → session deltas, validation revert cases) |

### 3.3 Files to change

| File | Change |
|------|--------|
| `package.json` | Add `@fullcalendar/react`, `@fullcalendar/core`, `temporal-polyfill` to dependencies |
| `src/main.tsx` | Import `temporal-polyfill` |
| `src/App.tsx` | Route `weekly/day/month/agenda` through `FullCalendarView`; keep legacy imports for fallback reference |
| `src/components/calendar/index.ts` | Export `FullCalendarView` |
| `vite.config.ts` | Add `vendor-calendar` manual chunk |
| `src/index.css` | FC dark/light theme overrides (original StudyFlow styling) |

### 3.4 What is NOT in scope

- Replacing `@dnd-kit` in the legacy views (remains as fallback)
- Command palette, CalDAV/Google sync, time zones, multi-select, recurring-series-instance editing UI beyond existing editor
- Committing or pushing anything

---

## 4. Phase 4 — Verification plan

1. `npm test` — existing suite + new mapping/component tests must pass; the one pre-existing `HomeworkView.test.tsx` failure must remain the only failure.
2. `npm run typecheck` — `tsc --noEmit` clean.
3. `npm run lint` — 0 errors.
4. `npm run build` — production build succeeds; inspect `vendor-calendar` chunk size via visualizer output.
5. Regression coverage (new tests):
   - Session positioning: one-off and recurring events land on correct dates/times
   - Overnight events: render across midnight; drop/resize revert
   - Recurring sessions: expansion within window, stops at `recurrenceEndDate`/`recurrenceMaxOccurrences`
   - Date navigation: prev/today/next/date-picker sync StudyFlow date ↔ FC date
   - Persistence: session created/edited via FC flows lands in `localStorage` (existing `persistence.test.ts` covers the reducer path; new test asserts round-trip through FC callbacks where feasible)
   - Event editing: `eventClick` opens editor with master data; submit updates store and re-renders
6. Browser automation: Playwright is installed but Chromium browsers are not cached in this environment. Attempt `npx playwright install`; if browsers download successfully, run a smoke test (render week view, click event, open editor, save, verify persistence). Otherwise verify via vitest/happy-dom + manual build and disclose the limitation.

---

## 5. Expected deliverables

- This document (`docs/fullcalendar-audit-plan.md`)
- Working prototype on branch `feature/fullcalendar-prototype` (uncommitted, per instructions)
- Exact list of changed/added files
- Actual test / typecheck / lint / build results
- Known limitations + next recommended action
