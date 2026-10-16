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
} from './calendar';
import type { Session, TimeRange } from '@/types';

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

