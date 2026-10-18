import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  getMonthDays,
  chunkWeeks,
  getWeekDates,
  getWeekStartISO,
  getMonthLabel,
  sessionsOnDate,
  timeOverlaps,
  snapToIncrement,
  addMinutes,
  shiftSessionByPixels,
  durationMinutes,
  assignColumns,
  occursOnDate,
  occurrenceOrdinal,
  dateDiffDays,
} from './calendar';
import type { Session, TimeRange, DayOfWeek, RecurrenceFrequency } from '@/types';

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayISO = format(today, 'yyyy-MM-dd');

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  subjectId: 'subj',
  day: 1,
  startTime: '09:00',
  endTime: '10:00',
  type: 'lecture',
  recurring: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('getMonthDays', () => {
  it('returns a whole number of weeks (28-42 days)', () => {
    const days = getMonthDays(2025, 9); // October 2025
    expect(days.length).toBeGreaterThanOrEqual(28);
    expect(days.length).toBeLessThanOrEqual(42);
    expect(days.length % 7).toBe(0);
  });

  it('starts on a Monday', () => {
    const days = getMonthDays(2025, 9);
    expect(days[0].dayOfWeek).toBe(1); // Monday
    expect(days[6].dayOfWeek).toBe(0); // Sunday
  });

  it('marks today correctly', () => {
    const days = getMonthDays(today.getFullYear(), today.getMonth());
    const todayCell = days.find((d) => d.date === todayISO);
    expect(todayCell?.isToday).toBe(true);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it('marks out-of-month days and includes the full month', () => {
    const days = getMonthDays(2025, 9);
    const inMonth = days.filter((d) => d.isCurrentMonth);
    expect(inMonth.length).toBe(31); // October has 31 days
    expect(inMonth.every((d) => d.date.startsWith('2025-10'))).toBe(true);
    expect(days.some((d) => !d.isCurrentMonth)).toBe(true);
  });
});

describe('chunkWeeks', () => {
  it('chunks into rows of 7 covering all days', () => {
    const days = getMonthDays(2025, 9);
    const weeks = chunkWeeks(days);
    expect(weeks.length).toBe(days.length / 7);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates starting Monday', () => {
    const dates = getWeekDates('2025-10-15'); // Wednesday
    expect(dates).toHaveLength(7);
    const start = new Date(dates[0]);
    expect(start.getDay()).toBe(1); // Monday
    expect(dates[0]).toBe('2025-10-13');
    expect(dates[6]).toBe('2025-10-19');
  });
});

describe('getWeekStartISO', () => {
  it('returns the Monday of the week', () => {
    expect(getWeekStartISO('2025-10-15')).toBe('2025-10-13');
    expect(getWeekStartISO('2025-10-13')).toBe('2025-10-13');
  });
});

describe('getMonthLabel', () => {
  it('formats month and year', () => {
    expect(getMonthLabel(2025, 9)).toBe('October 2025');
    expect(getMonthLabel(2025, 0)).toBe('January 2025');
  });
});

describe('sessionsOnDate', () => {
  const sessions: Session[] = [
    session({ id: 'oneoff', date: '2025-10-15', day: 2 }), // one-off on Wed 15th
    session({ id: 'recurringMon', date: undefined, day: 1 }), // recurring Monday
    session({ id: 'recurringTue', date: undefined, day: 2 }), // recurring Tuesday
  ];

  it('matches one-off sessions by date', () => {
    const found = sessionsOnDate(sessions, '2025-10-15');
    expect(found.map((s) => s.id)).toEqual(['oneoff']);
  });

  it('matches recurring sessions by weekday', () => {
    // 2025-10-13 is a Monday
    const found = sessionsOnDate(sessions, '2025-10-13');
    expect(found.map((s) => s.id)).toEqual(['recurringMon']);
    // 2025-10-14 is a Tuesday
    const foundTue = sessionsOnDate(sessions, '2025-10-14');
    expect(foundTue.map((s) => s.id)).toEqual(['recurringTue']);
  });

  it('sorts by start time', () => {
    const unsorted: Session[] = [
      session({ id: 'late', startTime: '14:00', endTime: '15:00' }),
      session({ id: 'early', startTime: '09:00', endTime: '10:00' }),
    ];
    const found = sessionsOnDate(unsorted, '2025-10-13');
    expect(found.map((s) => s.id)).toEqual(['early', 'late']);
  });
});

describe('sessionsOnDate — multi-day sessions', () => {
  const multiDaySessions: Session[] = [
    session({
      id: 'multi',
      date: '2025-10-13',
      endDate: '2025-10-15',
      day: 1,
      startTime: '09:00',
      endTime: '10:00',
    }), // Mon 13th -> Wed 15th
    session({
      id: 'single',
      date: '2025-10-14',
      day: 2,
      startTime: '11:00',
      endTime: '12:00',
    }), // Tue 14th only
  ];

  it('returns a multi-day session on its start date', () => {
    expect(sessionsOnDate(multiDaySessions, '2025-10-13').map((s) => s.id)).toEqual([
      'multi',
    ]);
  });

  it('returns a multi-day session on each day of its span', () => {
    expect(sessionsOnDate(multiDaySessions, '2025-10-14').map((s) => s.id)).toEqual([
      'multi',
      'single',
    ]);
    expect(sessionsOnDate(multiDaySessions, '2025-10-15').map((s) => s.id)).toEqual([
      'multi',
    ]);
  });

  it('does not return a multi-day session before its start or after its end', () => {
    expect(sessionsOnDate(multiDaySessions, '2025-10-12').map((s) => s.id)).toEqual([]);
    expect(sessionsOnDate(multiDaySessions, '2025-10-16').map((s) => s.id)).toEqual([]);
  });

  it('treats endDate equal to date as single-day', () => {
    const sameDay = session({
      id: 'same',
      date: '2025-10-13',
      endDate: '2025-10-13',
      day: 1,
    });
    expect(sessionsOnDate([sameDay], '2025-10-13').map((s) => s.id)).toEqual(['same']);
    expect(sessionsOnDate([sameDay], '2025-10-14').map((s) => s.id)).toEqual([]);
  });
});

describe('timeOverlaps', () => {
  it('detects overlap', () => {
    expect(timeOverlaps('09:00', '10:00', '09:30', '10:30')).toBe(true);
  });
  it('detects no overlap when adjacent', () => {
    expect(timeOverlaps('09:00', '10:00', '10:00', '11:00')).toBe(false);
  });
  it('detects containment', () => {
    expect(timeOverlaps('09:00', '11:00', '09:30', '10:00')).toBe(true);
  });
});

describe('assignColumns', () => {
  const session = (id: string, startTime: string, endTime: string) => ({
    id,
    subjectId: 'subj',
    day: 1 as DayOfWeek,
    startTime,
    endTime,
    type: 'lecture' as Session['type'],
    recurring: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  it('returns an empty array for no sessions', () => {
    expect(assignColumns([])).toEqual([]);
  });

  it('assigns column 0 to a single session', () => {
    const result = assignColumns([session('a', '09:00', '10:00')]);
    expect(result).toHaveLength(1);
    expect(result[0].column).toBe(0);
  });

  it('assigns different columns to overlapping sessions', () => {
    const result = assignColumns([
      session('a', '09:00', '10:00'),
      session('b', '09:30', '10:30'),
    ]);
    expect(result.map((s) => s.column)).toEqual([0, 1]);
  });

  it('shares a column for adjacent sessions (end == start is not overlap)', () => {
    const result = assignColumns([
      session('a', '09:00', '10:00'),
      session('b', '10:00', '11:00'),
    ]);
    expect(result.map((s) => s.column)).toEqual([0, 0]);
  });

  it('uses 3 columns for 3 mutually overlapping sessions', () => {
    const result = assignColumns([
      session('a', '09:00', '10:30'),
      session('b', '09:30', '11:00'),
      session('c', '10:00', '11:30'),
    ]);
    expect(result.map((s) => s.column)).toEqual([0, 1, 2]);
  });

  it('reuses columns for non-overlapping sessions', () => {
    const result = assignColumns([
      session('a', '09:00', '10:00'),
      session('b', '09:30', '10:30'),
      session('c', '11:00', '12:00'),
    ]);
    // 'a' and 'b' overlap -> columns 0 and 1. 'c' overlaps neither -> column 0.
    expect(result.map((s) => s.column)).toEqual([0, 1, 0]);
  });

  it('preserves the original session fields', () => {
    const result = assignColumns([session('a', '09:00', '10:00')]);
    expect(result[0].id).toBe('a');
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('10:00');
  });
});

describe('snapToIncrement', () => {
  it('snaps to nearest 30 minutes', () => {
    expect(snapToIncrement('09:07', 30)).toBe('09:00');
    expect(snapToIncrement('09:22', 30)).toBe('09:30');
    expect(snapToIncrement('09:45', 30)).toBe('10:00'); // 585/30 = 19.5 -> round 20 -> 600 min = 10:00
    expect(snapToIncrement('09:46', 30)).toBe('10:00');
  });
  it('snaps to nearest hour', () => {
    expect(snapToIncrement('09:40', 60)).toBe('10:00');
    expect(snapToIncrement('09:20', 60)).toBe('09:00');
  });
});

describe('durationMinutes', () => {
  it('computes duration', () => {
    expect(durationMinutes('09:00', '10:00')).toBe(60);
    expect(durationMinutes('09:30', '10:15')).toBe(45);
    expect(durationMinutes('09:00', '09:00')).toBe(0);
  });
});

describe('addMinutes', () => {
  it('adds minutes within the hour', () => {
    expect(addMinutes('09:00', 30)).toBe('09:30');
    expect(addMinutes('09:45', 15)).toBe('10:00');
  });
  it('rolls over the hour', () => {
    expect(addMinutes('09:50', 20)).toBe('10:10');
  });
});

describe('shiftSessionByPixels', () => {
  const range: TimeRange = { start: '08:00', end: '18:00' };
  const session = { startTime: '09:00', endTime: '10:00' };

  it('moves forward by pixels (30 min = 30px at 60px/h)', () => {
    const result = shiftSessionByPixels(session, 60, 1, range, 30); // 60 min
    expect(result).toEqual({ startTime: '10:00', endTime: '11:00' });
  });

  it('moves backward by pixels', () => {
    const result = shiftSessionByPixels(session, -30, 1, range, 30);
    expect(result).toEqual({ startTime: '08:30', endTime: '09:30' });
  });

  it('snaps to the increment', () => {
    const result = shiftSessionByPixels({ startTime: '09:07', endTime: '09:37' }, 0, 1, range, 30);
    expect(result.startTime).toBe('09:00');
    expect(result.endTime).toBe('09:30');
  });

  it('clamps start at range start', () => {
    const result = shiftSessionByPixels(session, -500, 1, range, 30); // way before 08:00
    expect(result.startTime).toBe('08:00');
    expect(result.endTime).toBe('09:00');
  });

  it('clamps end at range end', () => {
    const late = { startTime: '17:00', endTime: '18:00' };
    const result = shiftSessionByPixels(late, 300, 1, range, 30); // would end 23:00
    expect(result.endTime).toBe('18:00');
    expect(result.startTime).toBe('17:00');
  });

  it('preserves duration when shifting', () => {
    const result = shiftSessionByPixels({ startTime: '10:30', endTime: '12:00' }, 90, 1, range, 30);
    expect(durationMinutes(result.startTime, result.endTime)).toBe(90);
  });
});

describe('dateDiffDays', () => {
  it('computes signed day differences', () => {
    expect(dateDiffDays('2026-10-14', '2026-10-17')).toBe(3);
    expect(dateDiffDays('2026-10-17', '2026-10-14')).toBe(-3);
    expect(dateDiffDays('2026-10-14', '2026-10-14')).toBe(0);
  });
});

describe('occursOnDate / occurrenceOrdinal', () => {
  const dailySession = (id: string, startISO: string, rule: RecurrenceFrequency, endISO?: string, maxOcc?: number): Session => ({
    id,
    subjectId: 'subj',
    day: 1,
    startTime: '09:00',
    endTime: '10:00',
    type: 'lecture',
    recurring: true,
    date: startISO,
    recurrenceRule: rule,
    recurrenceStartDate: startISO,
    ...(endISO ? { recurrenceEndDate: endISO } : {}),
    ...(maxOcc !== undefined ? { recurrenceMaxOccurrences: maxOcc } : {}),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  const weeklySession = (id: string, startISO: string, weekdays: DayOfWeek[], endISO?: string): Session => ({
    id,
    subjectId: 'subj',
    day: 1,
    startTime: '09:00',
    endTime: '10:00',
    type: 'lecture',
    recurring: true,
    date: startISO,
    recurrenceRule: 'weekly',
    recurrenceStartDate: startISO,
    recurrenceWeekdays: weekdays,
    ...(endISO ? { recurrenceEndDate: endISO } : {}),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  it('daily recurrence occurs every day from start', () => {
    const s = dailySession('a', '2026-10-13', 'daily');
    expect(occursOnDate(s, '2026-10-13')).toBe(true);
    expect(occursOnDate(s, '2026-10-14')).toBe(true);
    expect(occursOnDate(s, '2026-10-15')).toBe(true);
    expect(occursOnDate(s, '2026-10-12')).toBe(false); // before start
  });

  it('daily recurrence stops at max occurrences', () => {
    const s = dailySession('a', '2026-10-13', 'daily', undefined, 3);
    expect(occursOnDate(s, '2026-10-13')).toBe(true); // ordinal 1
    expect(occursOnDate(s, '2026-10-14')).toBe(true); // ordinal 2
    expect(occursOnDate(s, '2026-10-15')).toBe(true); // ordinal 3
    expect(occursOnDate(s, '2026-10-16')).toBe(false); // ordinal 4 > max 3
  });

  it('daily recurrence stops at end date', () => {
    const s = dailySession('a', '2026-10-13', 'daily', '2026-10-15');
    expect(occursOnDate(s, '2026-10-13')).toBe(true);
    expect(occursOnDate(s, '2026-10-15')).toBe(true);
    expect(occursOnDate(s, '2026-10-16')).toBe(false); // after end
  });

  it('weekly recurrence occurs on selected weekdays', () => {
    const s = weeklySession('a', '2026-10-12', [1, 3, 5]); // Mon, Wed, Fri
    expect(occursOnDate(s, '2026-10-12')).toBe(true); // Monday
    expect(occursOnDate(s, '2026-10-13')).toBe(false); // Tuesday
    expect(occursOnDate(s, '2026-10-14')).toBe(true); // Wednesday
    expect(occursOnDate(s, '2026-10-15')).toBe(false); // Thursday
    expect(occursOnDate(s, '2026-10-16')).toBe(true); // Friday
  });

  it('weekly recurrence defaults weekdays to session day', () => {
    const s = weeklySession('a', '2026-10-12', []); // day: 1 (Monday), no weekdays -> defaults to [1]
    expect(occursOnDate(s, '2026-10-12')).toBe(true); // Monday
    expect(occursOnDate(s, '2026-10-13')).toBe(false); // Tuesday
  });

  it('monthly recurrence occurs on same day-of-month', () => {
    const s: Session = {
      id: 'a',
      subjectId: 'subj',
      day: 1,
      startTime: '09:00',
      endTime: '10:00',
      type: 'lecture',
      recurring: true,
      date: '2026-10-15',
      recurrenceRule: 'monthly',
      recurrenceStartDate: '2026-10-15',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(occursOnDate(s, '2026-10-15')).toBe(true);
    expect(occursOnDate(s, '2026-11-15')).toBe(true);
    expect(occursOnDate(s, '2026-11-14')).toBe(false);
    expect(occursOnDate(s, '2026-10-14')).toBe(false);
  });

  it('monthly recurrence clamps day-of-month at month end', () => {
    // Start Jan 31 → February has no 31st, clamps to Feb 28
    const s: Session = {
      id: 'a',
      subjectId: 'subj',
      day: 1,
      startTime: '09:00',
      endTime: '10:00',
      type: 'lecture',
      recurring: true,
      date: '2026-01-31',
      recurrenceRule: 'monthly',
      recurrenceStartDate: '2026-01-31',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(occursOnDate(s, '2026-01-31')).toBe(true);
    expect(occursOnDate(s, '2026-02-28')).toBe(true); // clamped to last day
    expect(occursOnDate(s, '2026-03-31')).toBe(true);
    expect(occursOnDate(s, '2026-02-27')).toBe(false);
  });

  it('occurrenceOrdinal returns 1-based position', () => {
    const s = dailySession('a', '2026-10-13', 'daily');
    expect(occurrenceOrdinal(s, '2026-10-13')).toBe(1);
    expect(occurrenceOrdinal(s, '2026-10-14')).toBe(2);
    expect(occurrenceOrdinal(s, '2026-10-15')).toBe(3);
    expect(occurrenceOrdinal(s, '2026-10-12')).toBe(null);
  });
});

describe('sessionsOnDate with recurrence', () => {
  const recurringSession = (id: string, startISO: string, rule: RecurrenceFrequency, weekdays?: DayOfWeek[]): Session => ({
    id,
    subjectId: 'subj',
    day: 1,
    startTime: '09:00',
    endTime: '10:00',
    type: 'lecture',
    recurring: true,
    date: startISO,
    recurrenceRule: rule,
    recurrenceStartDate: startISO,
    ...(weekdays ? { recurrenceWeekdays: weekdays } : {}),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  it('legacy recurring session without recurrenceRule matches by weekday', () => {
    const sessions: Session[] = [
      { id: 'a', subjectId: 'subj', day: 1, startTime: '09:00', endTime: '10:00', type: 'lecture', recurring: true, date: undefined, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    ];
    const found = sessionsOnDate(sessions, '2026-10-12'); // Monday
    expect(found.map((s) => s.id)).toEqual(['a']);
    const notFound = sessionsOnDate(sessions, '2026-10-13'); // Tuesday
    expect(notFound.map((s) => s.id)).toEqual([]);
  });

  it('daily recurring session matches every day from start', () => {
    const s = recurringSession('a', '2026-10-13', 'daily');
    expect(sessionsOnDate([s], '2026-10-13').map((s) => s.id)).toEqual(['a']);
    expect(sessionsOnDate([s], '2026-10-14').map((s) => s.id)).toEqual(['a']);
    expect(sessionsOnDate([s], '2026-10-12').map((s) => s.id)).toEqual([]);
  });

  it('weekly recurring session matches only selected weekdays', () => {
    const s = recurringSession('a', '2026-10-12', 'weekly', [1, 3]); // Mon, Wed
    expect(sessionsOnDate([s], '2026-10-12').map((s) => s.id)).toEqual(['a']); // Monday
    expect(sessionsOnDate([s], '2026-10-13').map((s) => s.id)).toEqual([]); // Tuesday
    expect(sessionsOnDate([s], '2026-10-14').map((s) => s.id)).toEqual(['a']); // Wednesday
  });

  it('daily recurring session with max occurrences stops generating', () => {
    const s = recurringSession('a', '2026-10-13', 'daily');
    // Override max occurrences
    const limited: Session = { ...s, recurrenceMaxOccurrences: 2 };
    expect(sessionsOnDate([limited], '2026-10-13').map((s) => s.id)).toEqual(['a']); // ordinal 1
    expect(sessionsOnDate([limited], '2026-10-14').map((s) => s.id)).toEqual(['a']); // ordinal 2
    expect(sessionsOnDate([limited], '2026-10-15').map((s) => s.id)).toEqual([]); // ordinal 3 > max 2
  });
});

describe('durationMinutes overnight', () => {
  it('computes same-day duration normally', () => {
    expect(durationMinutes('09:00', '10:00')).toBe(60);
    expect(durationMinutes('14:30', '16:15')).toBe(105);
  });

  it('computes overnight duration (end before start)', () => {
    expect(durationMinutes('23:00', '01:00')).toBe(120); // 2 hours
    expect(durationMinutes('22:30', '00:30')).toBe(120); // 2 hours
    expect(durationMinutes('23:59', '00:01')).toBe(2); // 2 minutes
  });
});

describe('timeOverlaps overnight', () => {
  it('detects overlap between overnight and early-morning session', () => {
    // Overnight 23:00-01:00 overlaps early-morning 00:30-01:30
    expect(timeOverlaps('23:00', '01:00', '00:30', '01:30')).toBe(true);
  });

  it('detects overlap between same-day evening and overnight', () => {
    // Same-day 22:00-23:30 overlaps overnight 23:00-01:00
    expect(timeOverlaps('22:00', '23:30', '23:00', '01:00')).toBe(true);
  });

  it('detects no overlap when overnight ends before other starts', () => {
    // Overnight 23:00-01:00, same-day 02:00-03:00 — no overlap
    expect(timeOverlaps('23:00', '01:00', '02:00', '03:00')).toBe(false);
  });

  it('treats boundary touch as no overlap for overnight', () => {
    // Overnight 23:00-01:00, same-day 01:00-02:00 — boundary touch at 01:00
    expect(timeOverlaps('23:00', '01:00', '01:00', '02:00')).toBe(false);
  });

  it('handles two overnight sessions overlapping', () => {
    // Overnight 23:00-01:00 and overnight 00:30-02:30 overlap
    expect(timeOverlaps('23:00', '01:00', '00:30', '02:30')).toBe(true);
  });

  it('conservatively flags overnight vs early-morning same-date as overlap', () => {
    // Overnight 23:00-01:00 (start date D) vs same-day 00:00-00:30 (date D).
    // On date D, overnight renders 23:00-24:00 and same-day renders 00:00-00:30 —
    // they do NOT overlap on date D. However, timeOverlaps has no date context
    // and conservatively reports overlap (the overnight session's early-morning
    // portion belongs to date D+1). This is a false positive that wastes a column
    // but never causes visual double-booking.
    expect(timeOverlaps('23:00', '01:00', '00:00', '00:30')).toBe(true);
  });
});

describe('sessionsOnDate overnight', () => {
  const overnightSession = (id: string, dateISO: string): Session => ({
    id,
    subjectId: 'subj',
    day: 1,
    startTime: '23:00',
    endTime: '01:00',
    type: 'lecture',
    recurring: false,
    date: dateISO,
    overnight: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });

  it('matches overnight session on its start date', () => {
    const s = overnightSession('a', '2026-10-14');
    expect(sessionsOnDate([s], '2026-10-14').map((s) => s.id)).toEqual(['a']);
  });

  it('matches overnight session on the following day', () => {
    const s = overnightSession('a', '2026-10-14');
    expect(sessionsOnDate([s], '2026-10-15').map((s) => s.id)).toEqual(['a']);
  });

  it('does not match overnight session before its start date', () => {
    const s = overnightSession('a', '2026-10-14');
    expect(sessionsOnDate([s], '2026-10-13').map((s) => s.id)).toEqual([]);
  });

  it('does not match overnight session two days after its start', () => {
    const s = overnightSession('a', '2026-10-14');
    expect(sessionsOnDate([s], '2026-10-16').map((s) => s.id)).toEqual([]);
  });

  it('does not match non-overnight session as overnight', () => {
    const s: Session = {
      id: 'b',
      subjectId: 'subj',
      day: 1,
      startTime: '23:00',
      endTime: '23:30',
      type: 'lecture',
      recurring: false,
      date: '2026-10-14',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(sessionsOnDate([s], '2026-10-15').map((s) => s.id)).toEqual([]);
  });

  it('matches overnight session ending exactly at midnight on both dates', () => {
    // Overnight 23:30-00:00 matches on its start date and the following day.
    const s = overnightSession('a', '2026-10-14');
    s.endTime = '00:00';
    expect(sessionsOnDate([s], '2026-10-14').map((s) => s.id)).toEqual(['a']);
    expect(sessionsOnDate([s], '2026-10-15').map((s) => s.id)).toEqual(['a']);
  });
});

describe('shiftSessionByPixels overnight', () => {
  const range: TimeRange = { start: '00:00', end: '24:00' };

  it('returns overnight session unchanged', () => {
    const session = { startTime: '23:00', endTime: '01:00', overnight: true };
    const result = shiftSessionByPixels(session, 60, 1, range, 30);
    expect(result).toEqual({ startTime: '23:00', endTime: '01:00' });
  });
});

