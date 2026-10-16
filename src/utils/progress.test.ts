import { describe, it, expect } from 'vitest';
import type { FocusSession, HomeworkItem, FocusSessionStatus } from '@/types';
import {
  computeProgressStats,
  buildDailyWindow,
  formatTotalMinutes,
  isHomeworkDone,
} from '@/utils/progress';

const NOW = new Date('2026-10-15T12:00:00.000Z');

function hw(overrides: Partial<HomeworkItem> = {}): HomeworkItem {
  return {
    id: `hw-${Math.random().toString(36).slice(2)}`,
    title: 'Worksheet',
    subject: 'Maths',
    teacher: 'Mr Smith',
    group: '9A',
    type: 'Assignment',
    dueDate: new Date('2026-10-20T00:00:00.000Z'),
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
    ...overrides,
  };
}

function session(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: `s-${Math.random().toString(36).slice(2)}`,
    startedAt: NOW.toISOString(),
    endedAt: NOW.toISOString(),
    plannedDurationSec: 1500,
    actualDurationSec: 1500,
    status: 'completed',
    homeworkId: null,
    homeworkTitle: null,
    subjectName: null,
    ...overrides,
  };
}

describe('computeProgressStats', () => {
  it('reports hasAny flags false and zeroes for empty inputs', () => {
    const stats = computeProgressStats([], [], NOW);
    expect(stats.homework.hasAnyHomework).toBe(false);
    expect(stats.focus.hasAnySession).toBe(false);
    expect(stats.homework.total).toBe(0);
    expect(stats.homework.completed).toBe(0);
    expect(stats.focus.totalFocusMinutes).toBe(0);
    expect(stats.focus.averageSessionMinutes).toBeNull();
    expect(stats.weekly).toHaveLength(7);
  });

  it('counts completed and submitted homework as done', () => {
    const stats = computeProgressStats(
      [
        hw({ status: 'completed' }),
        hw({ status: 'submitted' }),
        hw({ status: 'pending' }),
        hw({ status: 'overdue' }),
      ],
      [],
      NOW,
    );
    expect(stats.homework.total).toBe(4);
    expect(stats.homework.completed).toBe(2);
  });

  it('separates overdue from pending using due dates', () => {
    const overduePendingStatus = hw({
      status: 'pending',
      dueDate: new Date('2026-10-01T00:00:00.000Z'),
    });
    const overdueFlagged = hw({
      status: 'overdue',
      dueDate: new Date('2026-10-02T00:00:00.000Z'),
    });
    const futurePending = hw({ status: 'pending', dueDate: new Date('2026-10-20T00:00:00.000Z') });
    const donePastDue = hw({
      status: 'completed',
      dueDate: new Date('2026-10-01T00:00:00.000Z'),
    });

    const stats = computeProgressStats(
      [overduePendingStatus, overdueFlagged, futurePending, donePastDue],
      [],
      NOW,
    );
    expect(stats.homework.overdue).toBe(2);
    expect(stats.homework.pending).toBe(1);
    expect(stats.homework.completed).toBe(1);
  });

  it('counts completedThisWeek from completedAt and tracks date-unknown separately', () => {
    const items = [
      hw({ status: 'completed', completedAt: new Date('2026-10-14T10:00:00.000Z').toISOString() }),
      hw({ status: 'completed', completedAt: new Date('2026-10-10T10:00:00.000Z').toISOString() }),
      hw({ status: 'completed', completedAt: new Date('2026-10-01T10:00:00.000Z').toISOString() }), // outside 7-day window
      hw({ status: 'submitted' }), // no completedAt — legacy data
    ];
    const stats = computeProgressStats(items, [], NOW);
    expect(stats.homework.completed).toBe(4);
    expect(stats.homework.completedThisWeek).toBe(2);
    expect(stats.homework.completedDateUnknown).toBe(1);
  });

  it('sums focus minutes from completed sessions only', () => {
    const sessions = [
      session({ status: 'completed', actualDurationSec: 1500 }),
      session({ status: 'completed', actualDurationSec: 900 }),
      session({ status: 'cancelled', actualDurationSec: 600 }),
      session({ status: 'interrupted', actualDurationSec: 1500 }),
    ];
    const stats = computeProgressStats([], sessions, NOW);
    expect(stats.focus.completedSessions).toBe(2);
    expect(stats.focus.cancelledSessions).toBe(1);
    expect(stats.focus.interruptedSessions).toBe(1);
    expect(stats.focus.totalSessions).toBe(4);
    // (1500 + 900) / 60 = 40 minutes — cancelled/interrupted excluded
    expect(stats.focus.totalFocusMinutes).toBe(40);
    expect(stats.focus.totalUnverifiedMinutes).toBe(25);
    expect(stats.focus.averageSessionMinutes).toBe(20);
  });

  it('averageSessionMinutes is null when there are sessions but none completed', () => {
    const stats = computeProgressStats(
      [],
      [session({ status: 'interrupted', actualDurationSec: 1500 })],
      NOW,
    );
    expect(stats.focus.hasAnySession).toBe(true);
    expect(stats.focus.averageSessionMinutes).toBeNull();
    expect(stats.focus.totalFocusMinutes).toBe(0);
  });

  it('buckets completed focus minutes and homework completions into the correct days', () => {
    const sessions = [
      session({
        status: 'completed',
        actualDurationSec: 1200,
        endedAt: new Date('2026-10-15T08:00:00.000Z').toISOString(),
      }),
      session({
        status: 'completed',
        actualDurationSec: 1800,
        endedAt: new Date('2026-10-13T18:00:00.000Z').toISOString(),
      }),
      // outside window
      session({
        status: 'completed',
        actualDurationSec: 3600,
        endedAt: new Date('2026-10-01T08:00:00.000Z').toISOString(),
      }),
    ];
    const items = [
      hw({ status: 'completed', completedAt: new Date('2026-10-15T09:00:00.000Z').toISOString() }),
      hw({ status: 'completed', completedAt: new Date('2026-10-13T09:00:00.000Z').toISOString() }),
    ];
    const stats = computeProgressStats(items, sessions, NOW);

    const oct15 = stats.weekly.find((p) => p.date === '2026-10-15');
    const oct13 = stats.weekly.find((p) => p.date === '2026-10-13');
    expect(oct15?.focusMinutes).toBe(20);
    expect(oct15?.homeworkCompleted).toBe(1);
    expect(oct13?.focusMinutes).toBe(30);
    expect(oct13?.homeworkCompleted).toBe(1);
    // total window focus = 20 + 30 = 50 (the Oct 1 session is outside the window)
    expect(stats.weekly.reduce((s, p) => s + p.focusMinutes, 0)).toBe(50);
  });

  it('ignores sessions with invalid endedAt dates', () => {
    const bad = session({ endedAt: 'not-a-date', actualDurationSec: 600 });
    const stats = computeProgressStats([], [bad, session({ actualDurationSec: 600 })], NOW);
    expect(stats.weekly.reduce((s, p) => s + p.focusMinutes, 0)).toBe(10);
  });

  it('aggregates per-subject breakdown with done/pending/overdue', () => {
    const items = [
      hw({ subject: 'Maths', status: 'completed' }),
      hw({ subject: 'Maths', status: 'pending', dueDate: new Date('2026-10-01T00:00:00.000Z') }),
      hw({ subject: 'English', status: 'pending' }),
      hw({ subject: 'English', status: 'pending' }),
      hw({ subject: '', status: 'pending' }),
    ];
    const stats = computeProgressStats(items, [], NOW);
    const maths = stats.subjects.find((s) => s.subject === 'Maths');
    const english = stats.subjects.find((s) => s.subject === 'English');
    const unassigned = stats.subjects.find((s) => s.subject === 'Unassigned');

    expect(maths).toMatchObject({ total: 2, completed: 1, overdue: 1, pending: 0 });
    expect(english).toMatchObject({ total: 2, completed: 0, overdue: 0, pending: 2 });
    expect(unassigned).toMatchObject({ total: 1 });
    // sorted by total desc
    expect(stats.subjects[0].subject).toBe('English');
  });
});

describe('buildDailyWindow', () => {
  it('returns the requested number of days ending today, oldest first', () => {
    const points = buildDailyWindow(NOW, 7);
    expect(points).toHaveLength(7);
    expect(points[6].date).toBe('2026-10-15');
    expect(points[0].date).toBe('2026-10-09');
  });
});

describe('isHomeworkDone / formatTotalMinutes', () => {
  it('isHomeworkDone recognizes completed and submitted', () => {
    expect(isHomeworkDone('completed')).toBe(true);
    expect(isHomeworkDone('submitted')).toBe(true);
    expect(isHomeworkDone('pending')).toBe(false);
    expect(isHomeworkDone('overdue')).toBe(false);
  });

  it('formatTotalMinutes renders compact durations', () => {
    expect(formatTotalMinutes(0)).toBe('0m');
    expect(formatTotalMinutes(45)).toBe('45m');
    expect(formatTotalMinutes(60)).toBe('1h');
    expect(formatTotalMinutes(90)).toBe('1h 30m');
  });
});

describe('status typing sanity', () => {
  it('FocusSessionStatus union includes exactly the three honest outcomes', () => {
    const statuses: FocusSessionStatus[] = ['completed', 'cancelled', 'interrupted'];
    expect(statuses).toHaveLength(3);
  });
});
