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
 * A session matches if it has a `date` equal to the target (one-off), or if it
 * is recurring (`date` undefined) and its `day` of week matches the target's
 * weekday.
 */
export function sessionsOnDate(sessions: Session[], dateISO: string): Session[] {
  const d = new Date(`${dateISO}T00:00:00`);
  const dayOfWeek = d.getDay() as DayOfWeek;
  return sessions
    .filter((s) => {
      if (s.date) return s.date === dateISO;
      return s.day === dayOfWeek;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** True if two [start, end) time intervals (HH:mm) overlap. */
export function timeOverlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
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

/** Duration in minutes between two HH:mm times. */
export function durationMinutes(startTime: string, endTime: string): number {
  const [ah, am] = startTime.split(':').map(Number);
  const [bh, bm] = endTime.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

/** Add minutes to a HH:mm time (clamped to a single day, no wrap). */
export function addMinutes(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Shift a session by a pixel delta on the time grid, snapping to the
 * increment and clamping so the session stays inside `timeRange`.
 * Returns the new { startTime, endTime }.
 */
export function shiftSessionByPixels(
  session: Pick<Session, 'startTime' | 'endTime'>,
  deltaPixels: number,
  pixelsPerMinute: number,
  timeRange: TimeRange,
  increment: 30 | 60,
): { startTime: string; endTime: string } {
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

