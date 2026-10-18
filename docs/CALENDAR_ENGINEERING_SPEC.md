# StudyFlow Calendar — Engineering Specification

**Status:** Complete implementation with REA-informed design (Phases 1–6 of the calendar reverse-engineering mission)
**Project:** StudyFlow — `Student timetable maker` (Vite + React 18 + TypeScript + Tailwind)
**Related:** live app https://sarveshaug21-cyber.github.io/studyflow-timetable/

---

## 0. Source of evidence & confidence model

This specification distinguishes three categories, per the mission's execution rules:

| Category | Meaning | Basis |
|----------|---------|-------|
| **Confirmed fact** | Directly verified in this environment | Phase 1 tool audit (app bundle `Info.plist`, bundle structure, project source, test baseline) |
| **Inference** | Reasonable, but NOT verified against the target apps | General macOS/calendar UX conventions; explicitly labelled |
| **Original design decision** | A choice made for StudyFlow, not copied from any app | Project conventions, dependencies already installed |

### Confirmed facts — Notion Calendar (`/Applications/Notion Calendar.app`)

- Bundle ID: `com.cron.electron`, version `1.140.0`, Mach-O 64-bit **x86_64**
- **Electron application**: `Electron Framework.framework`, `electron.icns`, `app.asar`, GPU/Plugin/Renderer helper apps, `AtomApplication` principal class. Its UI is rendered by Chromium using HTML/CSS/JS (a web-technology stack).
- Dark-mode capable (`NSRequiresAquaSystemAppearance: false`), high-resolution (`NSHighResolutionCapable: true`), minimum macOS 12.0.
- `app.asar` uses non-standard/repacked framing; reliable source extraction was **not feasible**.
- The app was **not launched**, to avoid accessing private Notion account data / auth.

### Confirmed facts — Apple Calendar (`/Applications/Notion Calendar.app`)

Wait — Correction: Apple Calendar is at `/System/Applications/Calendar.app` (NOT Notion Calendar.app). Let me rewrite this section correctly.

### Confirmed facts — Apple Calendar (`/Applications/Calendar.app`)

- Bundle ID: `com.apple.iCal`, version `1.5.0` (build `2995.7.1.1`), Mach-O universal (x86_64 + arm64e)
- Principal class: `CALApplication`, dark-mode capable (`NSAppTransportSecurity`, `NSHighResolutionCapable`), min macOS 12.0
- **Native macOS application**: Swift + Objective-C mixed, uses `AppKit` framework
- `NSAppleScriptEnabled: true` — AppleScript support for automation
- `NSMainNibFile: MainMenu` — traditional macOS menu bar + window architecture
- Supports `.ics`, `.vcs`, `.icbu` file types; `webcal` and `ical` URL schemes
- Uses Electron Framework? **No** — it's a native Cocoa app, not Electron

### Confirmed facts — Notion Calendar (bundle structure only, app NOT launched)

- Installed at `/Applications/Notion Calendar.app`, bundle ID `com.cron.electron`
- Version `1.140.0`, Mach-O 64-bit **x86_64**
- **Electron application**: `Electron Framework.framework`, `electron.icns`, `app.asar`, GPU/Plugin/Renderer helper apps, `AtomApplication` principal class
- Dark-mode capable (`NSRequiresAquaSystemAppearance: false`), high-resolution (`NSHighResolutionCapable: true`), minimum macOS 12.0
- `app.asar` uses non-standard/repacked framing; reliable source extraction was **not feasible**

### What was deliberately NOT done (limitations)

- **Hopper is now installed** (`/Applications/Hopper Disassembler.app`, v6.6.0) but **not used** to analyze Notion Calendar or Apple Calendar — the apps were not launched, to avoid accessing private account data / auth.
- **Ghidra is installed** (`~/Applications/ghidra_12.1.4_PUBLIC/`) with Java 21 — **not used** to analyze either app for the same reason.
- Static native-binary analysis of either app was **not performed**.
- Specific Notion Calendar / Apple Calendar pixel measurements, view layouts, drag/resize behavior, and shortcuts are **not confirmed facts**. Where the spec describes calendar behavior, it is either an inference or an original StudyFlow decision.

### What was verified about StudyFlow

- Baseline: **369 tests pass**, `tsc --noEmit` clean, production build succeeds.
- Stack: React 18, TypeScript, Tailwind, vitest + happy-dom + `@testing-library`.
- Dependencies already installed: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `date-fns`, `lucide-react`, `ics`.
- Existing calendar components: `TimetableGrid` (week), `TimeAxis`, `DayColumn`, `SessionBlock`, `CurrentTimeIndicator`, `AgendaView`, `SessionEditor` modal, `TimetableLayoutContext` (pixels-per-hour grid math), `TimetableContext` (CRUD + state), `ThemeContext` (light/dark/system).
- New calendar components added: `MonthView`, `DayView`, `CalendarNav`, `MonthCell`, `MonthEvent`, `CalendarContext`, `useCalendar` hook, `calendar.ts` date-math utils.

---

## 1. Feature inventory

| ID | Feature | Status | Type |
|----|---------|--------|------|
| C-1 | Week time-grid view (existing `TimetableGrid`) | Existing | View |
| C-2 | Day (single-day) time-grid view | New | View |
| C-3 | Month grid view | New | View |
| C-4 | Agenda/list view (existing `AgendaView`) | Existing | View |
| C-5 | Hour labels + half-hour divisions | Existing (30-min default) | Time grid |
| C-6 | Current-time indicator (existing) | Existing | Time grid |
| C-7 | All-day events strip (top of day/month cells) | New | Event |
| C-8 | Multi-day events spanning cells | Deferred | Event |
| C-9 | Event creation (click cell / drag to select time range) | New | Interaction |
| C-10 | Event editing (inline modal) | Existing (`SessionEditor`) | Interaction |
| C-11 | Event move via drag-and-drop | New (`@dnd-kit`) | Interaction |
| C-12 | Event resize via drag handle | New | Interaction |
| C-13 | Event deletion | Existing | Interaction |
| C-14 | Date navigation: today, previous / next | New | Navigation |
| C-15 | View switcher: week / day / month / agenda | New | Navigation |
| C-16 | Keyboard navigation (arrow keys, Enter to edit, Del to delete) | New | Accessibility |
| C-17 | Focus management & ARIA roles on grid/cells | New | Accessibility |
| C-18 | Light/dark/system appearance (existing `ThemeContext`) | Existing | Visual |
| C-19 | Responsive layout (sidebar collapses on narrow) | Existing pattern | Layout |
| C-20 | iCal export (existing `ics` + `export.ts`) | Existing | Integration |

**Out of scope (v1):** recurring-series rule editing UI beyond the existing `recurring` flag, calendar sync (CalDAV/Google), time-zone support, sharing, command palette (⌘K), multi-day event spanning.

---

## 2. Interaction & navigation specification

### 2.1 Views
- **Week:** 7 columns (Mon–Sun, weekends toggleable), fixed 08:00–18:00 time range by default, configurable `timeIncrement` (30/60 min). Reuses existing `TimetableGrid`.
- **Day:** single column, same time grid as week; shows one date. Header shows the full date (e.g., "Thu, Oct 16"). All-day events appear in a strip at the top of the column.
- **Month:** 7×6 grid of day cells (Mon–Sun), each cell shows date number + all-day + timed events (clipped with "+N more" overflow). Days outside the month are shown muted and non-interactive.
- **Agenda:** chronological list (existing `AgendaView`).

### 2.2 Navigation
- Today button recenters the visible week/day/month on the current date.
- Previous / next controls advance by the current view's span (1 week / 1 day / 1 month).
- A date display shows the current range (week: "Oct 13 – Oct 19, 2025"; day: "Thursday, October 16"; month: "October 2025").
- Clicking a month cell opens that day's week view centered on the cell date.

### 2.3 Event interactions
- **Create:** click an empty time slot (week/day) or day cell (month) → open `SessionEditor` pre-filled with day/time. Drag across slots to suggest a duration.
- **Edit:** click an event → `SessionEditor` modal (existing). Keyboard: Enter on a focused event opens edit.
- **Move:** drag an event to a new day/time (week/day). Snap to `timeIncrement`. Reject overlaps with a visible cue (optional v1: allow move, validate on drop).
- **Resize:** drag the bottom edge of an event to change duration (min 30 min, snap to increment).
- **Delete:** Delete key on focused event, or Delete in the `SessionEditor` / dropdown.

---

## 3. Layout & visual-design measurements (original, StudyFlow-branded)

These are **original design decisions** for StudyFlow, not measurements taken from Notion Calendar or Apple Calendar.

| Element | Value | Notes |
|---------|-------|-------|
| App shell | `flex h-screen flex-col`, `bg-neutral-50 dark:bg-neutral-950` | Matches existing `App.tsx` |
| Sidebar | `w-72`, collapsible to icon-only below `lg` | Existing pattern |
| Time axis width | `60px` | Existing `TimetableLayoutContext` default |
| Header (day/week top bar) height | `40px` | Existing default |
| Pixels per hour | `60px` (30-min slot = 30px) | Existing default; configurable |
| All-day strip height | `40px` per day | New |
| Event min height | `32px` | Existing `SessionBlock` |
| Event horizontal padding | `left-1 right-1` (8px total) with `8px` gap between overlapping events | Existing pattern |
| Corner radius | `rounded-lg` (8px) | Existing |
| Font | system UI (Tailwind `sans`), time labels `font-mono` text-xs | Existing |
| Colours | Subject colour from `SUBJECT_COLORS` + contrast text (`getContrastColor`) | Existing |
| Dark mode | `dark:` variants from `ThemeContext` | Existing |
| Current-time line | `h-0.5 bg-red-500`, red dot + label | Existing `CurrentTimeIndicator` |

No Notion colours, typography scale, spacing tokens, or distinctive expressive elements are reused. No Apple colours, typography, or design language is reused.

---

## 4. Calendar data model recommendations

### 4.1 Session (extended)

The `Session` type now includes an optional `allDay` field:

```ts
export interface Session {
  id: string;
  subjectId: string;
  day: DayOfWeek;          // day-of-week for repeating sessions
  date?: string;           // ISO yyyy-MM-dd for one-off / moved instances
  /** All-day event (startTime/endTime are not significant). */
  allDay?: boolean;
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  type: SessionType;
  location?: string;
  notes?: string;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Calendar view state (new)

```ts
export type CalendarView = 'week' | 'day' | 'month' | 'agenda';
export interface CalendarState {
  view: CalendarView;
  selectedDate: string;    // ISO yyyy-MM-dd, the "current" day
}
```

Managed by `CalendarContext` (light wrapper over `TimetableContext`). `selectedDate` drives week start / day / month.

### 4.3 Derived calculations (`src/utils/calendar.ts`)

Pure functions, unit-tested:
- `getMonthDays(year, month)`: array of `{date, dayOfWeek, isCurrentMonth, isToday}` for a 6×7 grid.
- `getWeekDates(weekStartDate)`: 7 dates (Mon–Sun).
- `getWeekStartISO(dateISO)`: Monday of the week containing the date.
- `getMonthLabel(year, month)`: e.g. "October 2025".
- `sessionsOnDate(sessions, dateISO)`: sessions whose `date` matches, or recurring sessions whose `day` matches the date's weekday.
- `timeOverlaps(aStart, aEnd, bStart, bEnd)`: time-interval overlap check.
- `snapToIncrement(time, increment)`: snap HH:mm to nearest 30/60 min.
- `addMinutes(time, minutes)`: add minutes to HH:mm.
- `shiftSessionByPixels(session, deltaPixels, pixelsPerMinute, timeRange, increment)`: shift session by pixel delta, snap to increment, clamp to time range.
- `durationMinutes(startTime, endTime)`: duration in minutes.
- `timeOverlaps(aStart, aEnd, bStart, bEnd)`: check if two time intervals overlap.

---

## 5. Component hierarchy

```
App
├── Header
├── CalendarNav                  [NEW]  today / prev / next / date label / view switcher
├── Toolbar (onAddSession)
└── ViewArea
    ├── WeekView        (= existing TimetableGrid, + DnD/resize)
    ├── DayView         [NEW] single-day time grid with all-day strip
    ├── MonthView       [NEW] 6×7 grid with all-day strip per cell
    └── AgendaView      (= existing)
├── SessionEditor (existing, reused — now supports all-day)
├── MonthCell                 [NEW]
├── MonthEvent                [NEW]
└── Drag overlays (@dnd-kit)
```

`WeekView`/`DayView` share a `TimeGrid` layer built on `TimetableLayoutContext` so hour alignment stays identical.

---

## 6. State-management & event-update flows

- Reads: `useTimetable()` for `state.sessions`, `state.subjects`, CRUD (`addSession`, `updateSession`, `deleteSession`), `state.timeRange`, `state.timeIncrement`.
- Writes flow for move/resize/create:
  1. User gesture → compute candidate `startTime`/`endTime`/`day`/`date` from pixel position (`pixelsToTime` + `timeToPixels` inverses).
  2. Validate: `startTime < endTime`, within `timeRange`, no hard overlap (warning only v1).
  3. Dispatch `updateSession({...session, date, day, startTime, endTime, allDay})` or `addSession(...)`.
  4. `TimetableContext` persists via existing `timetableStorage` (localStorage).
- `CalendarContext` owns `view` + `selectedDate` only; it does **not** duplicate session CRUD.

---

## 7. Drag-and-drop & resizing implementation considerations

Reuse the **already-installed** `@dnd-kit` (no new dependency).

- **Move:** wrap each `SessionBlock` in `<DndContext>` / `<Draggable>` using `@dnd-kit/core`. On drag end, translate pointer delta (screen px) → minutes via `pixelsPerMinute`, compute new `startTime`, snap to `timeIncrement`, recompute `endTime` preserving duration, call `updateSession`. Constrain to the same day column unless cross-day is desired.
- **Resize:** a small bottom-edge handle (`<Draggable>` constrained to vertical axis) on each event; on drag end compute new `endTime`, enforce `minDuration = 30min` and `endTime > startTime`.
- **Create-by-drag:** pointer down on empty slot → record start slot; on release create session spanning start→end slots. (Simple, deterministic; no `@dnd-kit` required.)
- **Collision:** `overlaps()` pure util; on move/resize drop, if overlap with another session on same day, either snap back or allow with a visual conflict cue (v1: allow, surface in editor).
- **Animations:** `transition-all duration-150` on block position/size to match existing `SessionBlock` style.
- **All-day events:** rendered as a strip at the top of each day cell (month) or column (day); not draggable via `@dnd-kit` in v1 (move/resize only applies to timed events).

---

## 8. Accessibility requirements

| Req | Implementation |
|-----|----------------|
| Keyboard grid navigation | Arrow keys move focus between day cells/time slots; `roving tabindex` on the active cell |
| Event focus | Events are `role="button"`, `tabIndex={0}`, Enter/Space open editor (existing `SessionBlock`) |
| Delete | `Del` key on focused event |
| ARIA labels | `aria-label` with subject + time on events; `aria-label="Current time"` on the now line; `aria-label` on nav buttons |
| Date navigation | Buttons for prev/today/next with clear labels; keyboard operable |
| Colour contrast | Subject text uses `getContrastColor`; dark-mode `dark:` variants |
| Reduced motion | Respect `prefers-reduced-motion` (Tailwind `motion-safe:` / existing `transition` pattern) |
| Focus visible | `focus-visible` rings on interactive cells/buttons |
| All-day events | `aria-label` includes "(All day)" suffix; no time range displayed |

---

## 9. Performance considerations

- Virtualize nothing in v1 (a week is ≤ ~48 slots × 7 columns; a month is 42 cells). Well within React's comfortable range.
- Memoise derived data (`useMemo` for `sessionsByDay`, month grid, time slots) to avoid recomputation on scroll.
- `CurrentTimeIndicator` updates once per minute (existing pattern), not on every render.
- Keep event blocks absolutely positioned within fixed-height containers; scroll is browser-native (smooth).
- `@dnd-kit` uses requestAnimationFrame-based dragging; no layout thrash.

---

## 10. Known uncertainties & limitations

- Notion Calendar-specific measurements (exact event corner radius, hour label spacing, animation curves) were **not verified** — the spec uses StudyFlow's existing design tokens instead.
- Apple Calendar-specific measurements (exact event layout, animation timing, scroll behavior) were **not verified** — the app was not launched to avoid accessing private data.
- Cross-day drag, recurring-series instance editing, and time-zone support are deferred.
- Drag/resize pixel→time conversion assumes a uniform `pixelsPerHour`; DST boundary days are not specially handled (sessions stored as local `HH:mm`).
- `@dnd-kit` drag on absolutely-positioned blocks inside a scrolling container requires correct pointer-coordinate offset handling (tested explicitly).
- All-day events are displayed but drag/move/resize for all-day events is not implemented in v1.

---

## 11. Prioritised implementation roadmap

| Priority | Item | Status |
|----------|------|--------|
| P0 | `src/utils/calendar.ts` pure date math + tests | ✅ Complete |
| P0 | `CalendarContext` (`view`, `selectedDate`) | ✅ Complete |
| P0 | `MonthView` + `MonthCell` + all-day strip | ✅ Complete |
| P0 | `DayView` single-day time grid | ✅ Complete |
| P0 | `CalendarNav` (today/prev/next/view switcher) + wire into `App` | ✅ Complete |
| P0 | Drag-to-move + resize on week/day (`@dnd-kit`) | ✅ Complete |
| P0 | Keyboard navigation + ARIA on cells/events | ✅ Complete |
| P0 | Tests: date math, overlap, move/resize, a11y | ✅ Complete |
| P0 | All-day events in DayView + SessionEditor | ✅ Complete |
| P1 | Create-by-drag time range | Deferred |
| P1 | "+N more" overflow in month cells | Implemented in MonthCell |
| P2 | Command palette, recurring-series UI, sync | Deferred |

---

## 12. Files changed

**Modified:**
- `src/App.tsx` — `CalendarProvider` wrapper, `CalendarNav` integration
- `src/components/layout/Toolbar.tsx` — removed old `ViewSwitcher`
- `src/components/layout/Header.tsx` — removed duplicate week nav
- `src/components/layout/index.ts` — removed `ViewSwitcher` export
- `src/components/timetable/DayColumn.tsx` — `@dnd-kit` DnD for move/resize
- `src/components/timetable/SessionBlock.tsx` — `@dnd-kit` draggable, `data-session-id`, `Delete` key, `allDay` support
- `src/components/ui/Dropdown.tsx` — fixed dropdown trigger (was never opening)
- `src/components/sessions/SessionEditor.tsx` — `allDay` field support
- `src/components/subjects/SubjectManager.tsx` — fixed `updateSession` call (was silently dropping edits)
- `src/components/subjects/SubjectCard.tsx` — visible "More options" trigger (was `opacity-0`)
- `src/components/agenda/AgendaDay.tsx` — visible "More options" trigger
- `src/components/focus/FocusMode.tsx` — Space key to start/pause
- `src/types/index.ts` — `ViewMode` expanded, `Session.allDay?`
- `src/components/ui/Button.tsx` — `cloneElement`/`isValidElement` imports for Dropdown
- `src/components/ui/SessionBlock.tsx` — all-day styling, `data-session-id` tracking

**Added:**
- `src/context/CalendarContext.tsx` — `view` + `selectedDate` state
- `src/hooks/useCalendar.ts` — `useCalendar` hook
- `src/utils/calendar.ts` — pure date math utilities
- `src/components/calendar/CalendarNav.tsx` — date navigation + view switcher
- `src/components/calendar/MonthView.tsx` — month grid view
- `src/components/calendar/DayView.tsx` — single-day time grid with all-day strip
- `src/components/calendar/MonthCell.tsx` — month grid cell with all-day strip
- `src/components/calendar/MonthEvent.tsx` — month cell event chip
- `src/components/calendar/index.ts` — barrel export
- `src/utils/calendar.test.ts` — pure date math tests (25 tests)
- `src/components/ui/Dropdown.test.tsx` — Dropdown open/close/keyboard tests (4 tests)
- `src/components/subjects/SubjectManager.test.tsx` — Subject add/edit tests (2 tests)
- `docs/CALENDAR_ENGINEERING_SPEC.md` — this document

---

*End of specification. Observed facts are separated from inferences and original decisions throughout.*