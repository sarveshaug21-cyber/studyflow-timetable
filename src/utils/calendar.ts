import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { timeToMinutes } from '@/utils/date';
import type { DayOfWeek, Session } from '@/types';
import type { TimeRange } from '@/types';

/** A single cell in the month grid. */
export interface MonthDay {
  date: string; // yyyy-MM-dd
  dayOfWeek: DayOfWeek;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface CalendarRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

/** Build the 6x7 month grid (Monday-first) for the given JS calendar month (0-indexed). */
export function getMonthDays(year: number, month: number): MonthDay[] {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return days.map((d) => {
    // JS getDay(): 0=Sun..6=Sat, which matches DayOfWeek (1=Mon..6=Sat, 0=Sun).
    const dayOfWeek = d.getDay() as DayOfWeek;
    return {
      date: format(d, 'yyyy-MM-dd'),
      dayOfWeek,
      isCurrentMonth: isSameMonth(d, monthStart),
      isToday: isSameDay(d, today),
    };
  });
}

/** Chunk an array of days into weeks (rows of 7). */
export function chunkWeeks<T>(items: T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < items.length; i += 7) {
    weeks.push(items.slice(i, i + 7));
  }
  return weeks;
}

/** The 7 dates (Mon..Sun) of the week containing the given ISO date. */
export function getWeekDates(dateISO: string): string[] {
  const d = new Date(`${dateISO}T00:00:00`);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  );
}

/** The Monday of the week containing the given ISO date, as yyyy-MM-dd. */
export function getWeekStartISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** Label for a month, e.g. "October 2025". */
export function getMonthLabel(year: number, month: number): string {
  return format(new Date(year, month, 1), 'MMMM yyyy');
}

/** Sessions that fall on a given date.
 *
 * A session matches if:
 *  - it is one-off with a `date` equal to the target, or
 *  - it is one-off with `date` + `endDate` spanning the target (multi-day), or
 *  - it is an overnight session (`overnight: true`) whose `date` is the target
 *    (runs from `startTime` to range end) or whose target is the day after
 *    `date` (runs from 00:00 to `endTime`), or
 *  - it is recurring (`date` undefined) and its `day` of week matches the target's
 *    weekday (legacy weekly-forever when `recurrenceRule` is undefined), or
 *  - it is recurring with a bounded `recurrenceRule` and the target date falls
 *    on an occurrence of the rule.
 *
 * Multi-day one-off sessions (`date`..`endDate` inclusive) render on every day of
 * their span. Recurring sessions are expanded on read — no stored occurrences.
 */
export function sessionsOnDate(sessions: Session[], dateISO: string): Session[] {
  const d = new Date(`${dateISO}T00:00:00`);
  const dayOfWeek = d.getDay() as DayOfWeek;
  return sessions
    .filter((s) => {
      if (s.recurring) {
        if (s.recurrenceRule) return occursOnDate(s, dateISO);
        // Legacy weekly-forever on `day`.
        return s.day === dayOfWeek;
      }
      // One-off session.
      if (s.date && s.endDate) {
        // ISO yyyy-MM-dd strings compare lexicographically in chronological order.
        return dateISO >= s.date && dateISO <= s.endDate;
      }
      if (s.date) {
        // Overnight session: matches on its start date and on the following day.
        if (s.overnight) {
          const nextDay = format(addDays(s.date, 1), 'yyyy-MM-dd');
          return dateISO === s.date || dateISO === nextDay;
        }
        return s.date === dateISO;
      }
      // No date at all: fall back to matching by weekday (defensive for sessions
      // that are neither recurring nor dated).
      return s.day === dayOfWeek;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** True if `targetISO` falls on an occurrence of the recurring session `s`. */
export function occursOnDate(s: Session, targetISO: string): boolean {
  if (!s.recurrenceRule) return false;

  // Series anchor: recurrenceStartDate > date > today.
  const todayISO = new Date().toISOString().slice(0, 10);
  const startISO = s.recurrenceStartDate ?? s.date ?? todayISO;

  // Target must be at or after the series start.
  if (targetISO < startISO) return false;

  // Upper bound by end date.
  if (s.recurrenceEndDate && targetISO > s.recurrenceEndDate) return false;

  // Upper bound by occurrence count.
  const ordinal = occurrenceOrdinal(s, targetISO);
  if (ordinal === null) return false;
  if (s.recurrenceMaxOccurrences && ordinal > s.recurrenceMaxOccurrences) return false;

  return true;
}

/**
 * 1-based ordinal of `targetISO` within the recurring series, or null if
 * `targetISO` is not an occurrence day of the series.
 */
export function occurrenceOrdinal(s: Session, targetISO: string): number | null {
  const startISO = s.recurrenceStartDate ?? s.date;
  if (!startISO) return null;
  if (targetISO < startISO) return null;

  const startDay = new Date(`${startISO}T00:00:00`).getDay();
  const targetDay = new Date(`${targetISO}T00:00:00`).getDay();

  const weekdays = s.recurrenceWeekdays?.length ? s.recurrenceWeekdays : [startDay as DayOfWeek];

  switch (s.recurrenceRule) {
    case 'daily':
      // Every day from start is an occurrence.
      return dateDiffDays(startISO, targetISO) + 1;

    case 'weekly':
      // Valid only if target's weekday is in the rule's weekdays.
      if (!weekdays.includes(targetDay as unknown as DayOfWeek)) return null;
      // Count occurrences from start to target inclusive, stepping by weeks.
      return countWeekdaysBetween(startISO, targetISO, weekdays);

    case 'monthly': {
      // Valid if target's day-of-month matches the start's day-of-month
      // (clamped to month length).
      const startDom = new Date(`${startISO}T00:00:00`).getDate();
      const targetDom = new Date(`${targetISO}T00:00:00`).getDate();
      if (targetDom !== clampDayOfMonth(startDom, targetISO)) return null;
      return countMonthAnniversariesBetween(startISO, targetISO, startDom);
    }

    default:
      return null;
  }
}

/** Difference in calendar days from `fromISO` to `toISO` (positive when later). */
export function dateDiffDays(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

/** Count occurrences of any weekday in `weekdays` between `fromISO` and `toISO` inclusive. */
function countWeekdaysBetween(fromISO: string, toISO: string, weekdays: DayOfWeek[]): number {
  let count = 0;
  const d = new Date(`${fromISO}T00:00:00`);
  const end = new Date(`${toISO}T00:00:00`);
  while (d <= end) {
    if (weekdays.includes(d.getDay() as unknown as DayOfWeek)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Clamp a day-of-month to the last day of the target ISO month. */
function clampDayOfMonth(day: number, iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(1); // first day of iso's month
  d.setMonth(d.getMonth() + 1); // first day of next month
  d.setDate(0); // last day of iso's month
  const lastDay = d.getDate();
  return Math.min(day, lastDay);
}

/** Count month-anniversaries of `startDom` between `fromISO` and `toISO` inclusive. */
function countMonthAnniversariesBetween(fromISO: string, toISO: string, startDom: number): number {
  let count = 0;
  const d = new Date(`${fromISO}T00:00:00`);
  d.setDate(1); // start of fromISO month
  const end = new Date(`${toISO}T00:00:00`);
  while (d <= end) {
    const dom = clampDayOfMonth(startDom, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    // Only count if this month's anniversary falls on or before toISO.
    const candidate = new Date(d);
    candidate.setDate(dom);
    if (candidate <= end) count++;
    d.setMonth(d.getMonth() + 1);
  }
  return count;
}

/** True if two [start, end) time intervals (HH:mm) overlap.
 *
 * Handles overnight sessions where `endTime` < `startTime` (session spans
 * midnight). Boundary-touching sessions (end == start) do not overlap.
 */
export function timeOverlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aStartMin = timeToMinutes(aStart);
  const aEndMin = timeToMinutes(aEnd);
  const bStartMin = timeToMinutes(bStart);
  const bEndMin = timeToMinutes(bEnd);

  // Normalize overnight sessions (end wraps past midnight).
  const aEndNorm = aEndMin <= aStartMin ? aEndMin + 1440 : aEndMin;
  const bEndNorm = bEndMin <= bStartMin ? bEndMin + 1440 : bEndMin;

  // Normal overlap check in normalized space.
  if (aStartMin < bEndNorm && bStartMin < aEndNorm) return true;

  // Cross-midnight: A overnight overlaps B early next morning (B shifted +1440).
  if (
    aEndMin <= aStartMin &&
    aStartMin < bEndNorm + 1440 &&
    bStartMin + 1440 < aEndNorm
  ) {
    return true;
  }

  // Cross-midnight: B overnight overlaps A early next morning (A shifted +1440).
  if (
    bEndMin <= bStartMin &&
    bStartMin < aEndNorm + 1440 &&
    aStartMin + 1440 < bEndNorm
  ) {
    return true;
  }

  return false;
}

/** Snap a HH:mm time to the nearest increment (30 or 60 minutes). */
export function snapToIncrement(time: string, increment: 30 | 60): string {
  const [hours, minutes] = time.split(':').map(Number);
  const total = hours * 60 + minutes;
  const snapped = Math.round(total / increment) * increment;
  const snappedHours = Math.floor(snapped / 60);
  const snappedMinutes = snapped % 60;
  return `${snappedHours.toString().padStart(2, '0')}:${snappedMinutes
    .toString()
    .padStart(2, '0')}`;
}

/** Duration in minutes between two HH:mm times.
 *
 * If `endTime` is lexicographically before `startTime` (e.g. '23:00' → '01:00'),
 * the session is treated as spanning midnight: duration wraps past 24:00.
 */
export function durationMinutes(startTime: string, endTime: string): number {
  const [ah, am] = startTime.split(':').map(Number);
  const [bh, bm] = endTime.split(':').map(Number);
  const start = ah * 60 + am;
  const end = bh * 60 + bm;
  return end >= start ? end - start : end + 1440 - start;
}

/** Add minutes to a HH:mm time.
 *
 * By default the result can exceed 24:00 (e.g. '23:00' + 120 → '25:00'); callers
 * that need a wall-clock time should pass `wrap: true`, which returns the time
 * modulo 1440 minutes (e.g. '23:00' + 120 → '01:00').
 */
export function addMinutes(time: string, minutes: number, wrap = false): string {
  const total = timeToMinutes(time) + minutes;
  const wrapped = wrap ? total % 1440 : total;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Shift a session by a pixel delta on the time grid, snapping to the
 * increment and clamping so the session stays inside `timeRange`.
 * Returns the new { startTime, endTime }.
 *
 * Overnight sessions (`endTime` < `startTime`) are not shifted: they can only
 * be edited through the session editor. Returns the session unchanged.
 */
export function shiftSessionByPixels(
  session: Pick<Session, 'startTime' | 'endTime'> & { overnight?: boolean },
  deltaPixels: number,
  pixelsPerMinute: number,
  timeRange: TimeRange,
  increment: 30 | 60,
): { startTime: string; endTime: string } {
  if (session.overnight) return { startTime: session.startTime, endTime: session.endTime };

  const deltaMinutes = Math.round(deltaPixels / pixelsPerMinute);
  const duration = durationMinutes(session.startTime, session.endTime);
  let start = snapToIncrement(addMinutes(session.startTime, deltaMinutes), increment);
  let end = addMinutes(start, duration);

  const rangeStartMinutes = timeToMinutes(timeRange.start);
  const rangeEndMinutes = timeToMinutes(timeRange.end);
  const startMinutes = timeToMinutes(start);

  if (startMinutes < rangeStartMinutes) {
    start = timeRange.start;
    end = addMinutes(start, duration);
  }
  if (timeToMinutes(end) > rangeEndMinutes) {
    end = timeRange.end;
    start = addMinutes(end, -duration);
    if (timeToMinutes(start) < rangeStartMinutes) {
      start = timeRange.start;
      end = addMinutes(start, duration);
    }
  }
  return { startTime: start, endTime: end };
}

/** A session annotated with its assigned column for side-by-side rendering. */
export interface SessionWithColumn extends Session {
  column: number;
}

/**
 * Assign columns to sessions so that overlapping sessions get different columns.
 *
 * Uses greedy interval graph coloring: sessions are processed in start-time
 * order, and each is placed in the first column where it does not overlap any
 * session already assigned to that column. Boundary-touching sessions
 * (end == start) share a column because `timeOverlaps` returns false for them.
 *
 * Returns sessions annotated with a `column` index (0-based). Callers compute
 * `columnWidth = 100 / (maxColumn + 1)` and position each block at
 * `left = column * columnWidth`, `width = columnWidth`.
 */
export function assignColumns(sessions: Session[]): SessionWithColumn[] {
  if (sessions.length === 0) return [];

  // Sort by start time (defensive; sessionsOnDate already sorts).
  const sorted = [...sessions].sort(
    (a, b) => a.startTime.localeCompare(b.startTime),
  );

  // columns[c] = sessions already assigned to column c.
  const columns: Session[][] = [];

  const result: SessionWithColumn[] = [];

  for (const session of sorted) {
    let assigned = false;
    for (let c = 0; c < columns.length; c++) {
      const overlaps = columns[c].some((existing) =>
        timeOverlaps(
          existing.startTime,
          existing.endTime,
          session.startTime,
          session.endTime,
        ),
      );
      if (!overlaps) {
        columns[c].push(session);
        result.push({ ...session, column: c });
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      const c = columns.length;
      columns.push([session]);
      result.push({ ...session, column: c });
    }
  }

  return result;
}

