# StudyFlow Calendar — Engineering Specification

**Status:** Original design (Phase 4 of the Notion Calendar reverse-engineering mission)
**Project:** StudyFlow — `Student timetable maker` (Vite + React 18 + TypeScript + Tailwind)
**Related:** live app https://sarveshaug21-cyber.github.io/studyflow-timetable/

---

## 0. Source of evidence & confidence model

This specification distinguishes three categories, per the mission's execution rules:

| Category | Meaning | Basis |
|----------|---------|-------|
| **Confirmed fact** | Directly verified in this environment | Phase 1 tool audit (app bundle `Info.plist`, bundle structure, project source, test baseline) |
| **Inference** | Reasonable, but NOT verified against Notion Calendar itself | General macOS/calendar UX conventions; explicitly labelled |
| **Original design decision** | A choice made for StudyFlow, not copied from Notion | Project conventions, dependencies already installed |

### What was verified about Notion Calendar (confirmed facts)

- Installed at `/Applications/Notion Calendar.app`, bundle ID `com.cron.electron`.
- Version `1.140.0`, Mach-O 64-bit **x86_64**.
- **Electron application**: `Electron Framework.framework`, `electron.icns`, `app.asar`, GPU/Plugin/Renderer helper apps, `AtomApplication` principal class. Its UI is rendered by Chromium using HTML/CSS/JS (a web-technology stack).
- Dark-mode capable (`NSRequiresAquaSystemAppearance: false`), high-resolution (`NSHighResolutionCapable: true`), minimum macOS 12.0.
- `app.asar` uses non-standard/repacked framing; reliable source extraction was not feasible and is **not required** for an original implementation.

### What was deliberately NOT done (limitations)

- **Hopper is not installed** and was not installed (no permission to install software). Static native-binary analysis was therefore not performed.
- The app was **not launched**, to avoid accessing private Notion account data / auth.
- Specific Notion Calendar pixel measurements, view layouts, drag/resize behavior, and shortcuts are **not confirmed facts** about Notion Calendar. Where the spec describes calendar behavior, it is either an inference or an original StudyFlow decision.

### What was verified about StudyFlow

- Baseline: **298 tests pass**, `tsc --noEmit` clean.
- Stack: React 18, TypeScript, Tailwind, vitest + happy-dom + `@testing-library`.
- Dependencies already installed: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `date-fns`, `lucide-react`, `ics`.
- Existing calendar-adjacent components: `TimetableGrid` (week), `TimeAxis`, `DayColumn`, `SessionBlock`, `CurrentTimeIndicator`, `AgendaView`, `SessionEditor` modal, `TimetableLayoutContext` (pixels-per-hour grid math), `TimetableContext` (CRUD + state), `ThemeContext` (light/dark/system).

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
| C-8 | Multi-day events spanning cells | New | Event |
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

**Out of scope (v1):** recurring-series rule editing UI beyond the existing `recurring` flag, calendar sync (CalDAV/Google), time-zone support, sharing, command palette (⌘K).

---

## 2. Interaction & navigation specification

### 2.1 Views
- **Week:** 7 columns (Mon–Sun, weekends toggleable), fixed 08:00–18:00 time range by default, configurable `timeIncrement` (30/60 min). Reuses existing `TimetableGrid`.
- **Day:** single column, same time grid as week; shows one date. Header shows the full date (e.g., "Thu, Oct 16").
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

These are **original design decisions** for StudyFlow, not measurements taken from Notion Calendar.

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

No Notion colours, typography scale, spacing tokens, or distinctive expressive elements are reused.

---

## 4. Calendar data model recommendations

Extend the **existing** `Session` type rather than replacing it (keeps `ics` export, scheduler, persistence working).

### 4.1 Session (extend)
Add an optional `allDay: boolean` and keep `date` for one-off sessions:

```ts
export interface Session {
  id: string;
  subjectId: string;
  day: DayOfWeek;          // day-of-week for repeating sessions
  date?: string;           // ISO yyyy-MM-dd for one-off / moved instances
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  allDay: boolean;         // NEW: all-day event
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
Managed by a new `CalendarContext` (light wrapper over `TimetableContext` where sensible). `selectedDate` drives week start / day / month.

### 4.3 Derived calculations (new utils `src/utils/calendar.ts`)
- `getMonthDays(year, month)`: array of `{date, dayOfWeek, isCurrentMonth, isToday}` for a 6×7 grid.
- `getWeekDates(weekStartDate)`: 7 dates.
- `sessionsOnDate(sessions, date)`: sessions whose `date` matches, or recurring sessions whose `day` matches the date's weekday.
- `overlaps(a, b)`: time-interval overlap check for move/resize validation.
- `clampToRange`, `snapToIncrement`.

These are pure functions → unit-tested.

---

## 5. Component hierarchy

```
App
├── Header
├── Toolbar (onAddSession)
└── CalendarShell                      [NEW]
    ├── CalendarNav                  [NEW]  today / prev / next / date label / view switcher
    └── ViewArea
        ├── WeekView        (= existing TimetableGrid, + optional DnD/resize)
        ├── DayView         [NEW] single-day time grid
        ├── MonthView       [NEW] 6×7 grid
        └── AgendaView      (= existing)
├── SessionEditor (existing, reused)
├── MonthCell                 [NEW]
├── MonthEvent                [NEW]
├── AllDayStrip               [NEW]
└── Drag overlays (@dnd-kit)
```

`WeekView`/`DayView` share a `TimeGrid` layer built on `TimetableLayoutContext` so hour alignment stays identical.

---

## 6. State-management & event-update flows

- Reads: `useTimetable()` for `state.sessions`, `state.subjects`, CRUD (`addSession`, `updateSession`, `deleteSession`), `state.timeRange`, `state.timeIncrement`.
- Writes flow for move/resize/create:
  1. User gesture → compute candidate `startTime`/`endTime`/`day`/`date` from pixel position (`pixelsToTime` + `timeToPixels` inverses).
  2. Validate: `startTime < endTime`, within `timeRange`, no hard overlap (warning only v1).
  3. Dispatch `updateSession({...session, date, day, startTime, endTime})` or `addSession(...)`.
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
- Cross-day drag, recurring-series instance editing, and time-zone support are deferred.
- Drag/resize pixel→time conversion assumes a uniform `pixelsPerHour`; DST boundary days are not specially handled (sessions stored as local `HH:mm`).
- `@dnd-kit` drag on absolutely-positioned blocks inside a scrolling container requires correct pointer-coordinate offset handling (tested explicitly).

---

## 11. Prioritised implementation roadmap

| Priority | Item | Phase |
|----------|------|-------|
| P0 | `src/utils/calendar.ts` pure date math + tests | Phase 5 |
| P0 | `CalendarContext` (`view`, `selectedDate`) | Phase 5 |
| P0 | `MonthView` + `MonthCell` + all-day strip | Phase 5 |
| P0 | `DayView` single-day time grid | Phase 5 |
| P0 | `CalendarNav` (today/prev/next/view switcher) + wire into `App` | Phase 5 |
| P0 | Drag-to-move + resize on week/day (`@dnd-kit`) | Phase 5 |
| P0 | Keyboard navigation + ARIA on cells/events | Phase 5 |
| P0 | Tests: date math, overlap, move/resize, a11y | Phase 5/6 |
| P1 | Create-by-drag time range | Phase 5 (if time) |
| P1 | "+N more" overflow in month cells | Phase 5 (if time) |
| P2 | Command palette, recurring-series UI, sync | Deferred |

---

*End of specification. Observed facts are separated from inferences and original decisions throughout.*
