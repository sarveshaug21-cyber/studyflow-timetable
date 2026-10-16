import { describe, it, expect } from 'vitest';
import type { DayOfWeek, FocusSession, HomeworkItem, Session, Subject } from '@/types';
import {
  planStudySessions,
  estimateStudyMinutes,
  focusedMinutesForHomework,
  findFreeWindowsForDate,
  buildStudyBlocks,
  explainConflict,
  addDays,
  daysBetween,
  toIsoDate,
  parseIsoDate,
  ISO_DATE_RE,
  type TimeWindow,
} from '@/utils/scheduler';

// ---------------------------------------------------------------------------
// Fixture helpers — all fixtures use fixed dates so tests are deterministic.
// ---------------------------------------------------------------------------

/** A Wednesday. 2026-10-15 is a Thursday, so we build from a known anchor. */
const ANCHOR = new Date(2026, 9, 14, 9, 0, 0); // Wed Oct 14 2026, 09:00 local

function iso(offsetDays: number): string {
  const d = new Date(ANCHOR);
  d.setDate(d.getDate() + offsetDays);
  return toIsoDate(d);
}

function hw(overrides: Partial<HomeworkItem> & { id: string; dueDate: Date }): HomeworkItem {
  return {
    title: `HW ${overrides.id}`,
    subject: 'Maths',
    teacher: 'Ms T',
    group: 'A',
    type: 'Homework',
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
    priority: 'medium',
    ...overrides,
  } as HomeworkItem;
}

function ses(overrides: Partial<Session> & { id: string; day: DayOfWeek; startTime: string; endTime: string }): Session {
  return {
    subjectId: 'sub-1',
    type: 'lecture',
    recurring: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as Session;
}

function subj(id: string, name: string): Subject {
  return {
    id,
    name,
    code: id.toUpperCase(),
    color: '#000000',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  };
}

function focus(overrides: Partial<FocusSession> & { id: string; homeworkId: string; status: FocusSession['status'] }): FocusSession {
  return {
    startedAt: '2026-10-13T10:00:00.000Z',
    endedAt: '2026-10-13T10:25:00.000Z',
    plannedDurationSec: 1500,
    actualDurationSec: 1500,
    homeworkTitle: null,
    subjectName: null,
    ...overrides,
  } as FocusSession;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

describe('date helpers', () => {
  it('validates ISO format', () => {
    expect(ISO_DATE_RE.test('2026-10-14')).toBe(true);
    expect(ISO_DATE_RE.test('2026-1-4')).toBe(false);
    expect(ISO_DATE_RE.test('not-a-date')).toBe(false);
  });

  it('round-trips parse/format', () => {
    const d = parseIsoDate('2026-12-31');
    expect(d).not.toBeNull();
    expect(toIsoDate(d!)).toBe('2026-12-31');
  });

  it('rejects impossible calendar dates rather than rolling over', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('2026-00-10')).toBeNull();
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('computes signed day differences', () => {
    expect(daysBetween('2026-10-14', '2026-10-17')).toBe(3);
    expect(daysBetween('2026-10-17', '2026-10-14')).toBe(-3);
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
  });

  it('handles leap-day arithmetic', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});

// ---------------------------------------------------------------------------
// Transparent duration estimates
// ---------------------------------------------------------------------------

describe('estimateStudyMinutes', () => {
  it('honours an explicit user override verbatim', () => {
    const { minutes, basis } = estimateStudyMinutes(
      hw({ id: 'a', dueDate: new Date(2026, 9, 20), estimatedMinutes: 77 }),
    );
    expect(minutes).toBe(77);
    expect(basis).toContain('user estimate');
  });

  it('ignores a non-positive or non-finite override and falls back to the heuristic', () => {
    expect(estimateStudyMinutes(hw({ id: 'a', dueDate: new Date(2026, 9, 20), estimatedMinutes: 0 })).minutes).toBe(60);
    expect(estimateStudyMinutes(hw({ id: 'b', dueDate: new Date(2026, 9, 20), estimatedMinutes: -5 })).minutes).toBe(60);
    expect(estimateStudyMinutes(hw({ id: 'c', dueDate: new Date(2026, 9, 20), estimatedMinutes: NaN })).minutes).toBe(60);
  });

  it('needs no study time for completed or submitted work', () => {
    expect(estimateStudyMinutes(hw({ id: 'a', dueDate: new Date(2026, 9, 20), status: 'completed' })).minutes).toBe(0);
    expect(estimateStudyMinutes(hw({ id: 'b', dueDate: new Date(2026, 9, 20), status: 'submitted' })).minutes).toBe(0);
  });

  it('uses larger baselines for heavier assignment types', () => {
    const essay = estimateStudyMinutes(hw({ id: 'a', dueDate: new Date(2026, 9, 20), type: 'Essay' })).minutes;
    const reading = estimateStudyMinutes(hw({ id: 'b', dueDate: new Date(2026, 9, 20), type: 'Reading' })).minutes;
    const generic = estimateStudyMinutes(hw({ id: 'c', dueDate: new Date(2026, 9, 20), type: 'Worksheet' })).minutes;
    expect(essay).toBe(120);
    expect(reading).toBe(45);
    expect(generic).toBe(60);
  });

  it('is deterministic for the same input', () => {
    const item = hw({ id: 'a', dueDate: new Date(2026, 9, 20), type: 'Project' });
    const one = estimateStudyMinutes(item);
    const two = estimateStudyMinutes(item);
    expect(one).toEqual(two);
  });
});

// ---------------------------------------------------------------------------
// Focus-history integration
// ---------------------------------------------------------------------------

describe('focusedMinutesForHomework', () => {
  it('sums only completed sessions linked to the homework', () => {
    const history: FocusSession[] = [
      focus({ id: 'f1', homeworkId: 'hw1', status: 'completed', actualDurationSec: 1500 }),
      focus({ id: 'f2', homeworkId: 'hw1', status: 'completed', actualDurationSec: 600 }),
      focus({ id: 'f3', homeworkId: 'hw1', status: 'cancelled', actualDurationSec: 1500 }),
      focus({ id: 'f4', homeworkId: 'hw1', status: 'interrupted', actualDurationSec: 1500 }),
      focus({ id: 'f5', homeworkId: 'other', status: 'completed', actualDurationSec: 1500 }),
    ];
    // 1500s + 600s = 2100s = 35 min. Cancelled/interrupted/other excluded.
    expect(focusedMinutesForHomework('hw1', history)).toBe(35);
  });

  it('returns 0 when there is no history', () => {
    expect(focusedMinutesForHomework('hw1', [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Free-window discovery
// ---------------------------------------------------------------------------

describe('findFreeWindowsForDate', () => {
  const window: TimeWindow = { startMin: 8 * 60, endMin: 22 * 60 }; // 08:00–22:00

  it('returns the whole daily window when there are no sessions', () => {
    const free = findFreeWindowsForDate([], iso(0), 3, window);
    expect(free).toEqual([{ startMin: 480, endMin: 1320 }]);
  });

  it('subtracts a blocking session into two free windows', () => {
    const sessions = [ses({ id: 's1', day: 3, startTime: '10:00', endTime: '12:00' })];
    const free = findFreeWindowsForDate(sessions, iso(0), 3, window);
    expect(free).toEqual([
      { startMin: 480, endMin: 600 }, // 08:00–10:00
      { startMin: 720, endMin: 1320 }, // 12:00–22:00
    ]);
  });

  it('merges overlapping sessions so free time is not double-counted', () => {
    const sessions = [
      ses({ id: 's1', day: 3, startTime: '10:00', endTime: '11:30' }),
      ses({ id: 's2', day: 3, startTime: '11:00', endTime: '13:00' }),
    ];
    const free = findFreeWindowsForDate(sessions, iso(0), 3, window);
    expect(free).toEqual([
      { startMin: 480, endMin: 600 },
      { startMin: 780, endMin: 1320 }, // 13:00–22:00
    ]);
  });

  it('ignores sessions on a different day of week', () => {
    const sessions = [ses({ id: 's1', day: 1, startTime: '10:00', endTime: '12:00' })];
    const free = findFreeWindowsForDate(sessions, iso(0), 3, window);
    expect(free).toEqual([{ startMin: 480, endMin: 1320 }]);
  });

  it('ignores a non-recurring session whose date does not match', () => {
    const sessions = [ses({ id: 's1', day: 3, startTime: '10:00', endTime: '12:00', recurring: false, date: iso(7) })];
    const free = findFreeWindowsForDate(sessions, iso(0), 3, window);
    expect(free).toEqual([{ startMin: 480, endMin: 1320 }]);
  });

  it('honours ignoreSessionIds so accepted blocks are not re-counted as busy', () => {
    const sessions = [ses({ id: 'keep', day: 3, startTime: '10:00', endTime: '11:00' })];
    const free = findFreeWindowsForDate(sessions, iso(0), 3, window, { ignoreSessionIds: ['keep'] });
    expect(free).toEqual([{ startMin: 480, endMin: 1320 }]);
  });

  it('clips today so the past is never offered as free time', () => {
    // now = 15:00 local (900 min); no sessions today.
    const free = findFreeWindowsForDate([], iso(0), 3, window, { nowMin: 15 * 60 });
    expect(free).toEqual([{ startMin: 900, endMin: 1320 }]);
  });

  it('drops today entirely when now is after the window closes', () => {
    const free = findFreeWindowsForDate([], iso(0), 3, window, { nowMin: 23 * 60 });
    expect(free).toEqual([]);
  });

  it('tolerates malformed session times without corrupting the result', () => {
    const sessions = [ses({ id: 'bad', day: 3, startTime: '25:99', endTime: '09:00' })];
    const free = findFreeWindowsForDate(sessions, iso(0), 3, window);
    expect(Array.isArray(free)).toBe(true);
  });

  it('returns an empty list for an inverted daily window', () => {
    const free = findFreeWindowsForDate([], iso(0), 3, { startMin: 22 * 60, endMin: 8 * 60 });
    expect(free).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Block construction
// ---------------------------------------------------------------------------

describe('buildStudyBlocks', () => {
  it('fills a window with fixed-size blocks', () => {
    const blocks = buildStudyBlocks([{ startMin: 600, endMin: 760 }], 50, 10);
    expect(blocks).toEqual([
      { date: '', day: 0, startMin: 600, endMin: 650 },
      { date: '', day: 0, startMin: 650, endMin: 700 },
      { date: '', day: 0, startMin: 700, endMin: 750 },
    ]);
  });

  it('skips a leftover gap shorter than one block', () => {
    const blocks = buildStudyBlocks([{ startMin: 600, endMin: 740 }], 50, 10);
    // 600-650, 650-700, then only 40 min left -> stop.
    expect(blocks).toHaveLength(2);
  });

  it('respects the limit', () => {
    const blocks = buildStudyBlocks([{ startMin: 0, endMin: 1440 }], 50, 3);
    expect(blocks).toHaveLength(3);
  });

  it('returns nothing for a zero-size block request', () => {
    expect(buildStudyBlocks([{ startMin: 0, endMin: 600 }], 0, 5)).toEqual([]);
    expect(buildStudyBlocks([{ startMin: 0, endMin: 600 }], 50, 0)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Conflict explanation
// ---------------------------------------------------------------------------

describe('explainConflict', () => {
  it('reports no conflict when windows are disjoint', () => {
    const s = {
      homeworkId: 'h', title: 't', subject: 'Maths', subjectId: null,
      priority: 'medium' as const, date: iso(0), day: 3 as DayOfWeek,
      startMin: 600, endMin: 650, minutes: 50, explanation: '',
    };
    // Session starts at 10:50 (650), exactly where the block ends -> no overlap ([start,end) semantics).
    const sessions = [ses({ id: 's1', day: 3, startTime: '10:50', endTime: '12:00' })];
    const res = explainConflict(s, sessions);
    expect(res.conflicts).toBe(false);
  });

  it('reports a conflict with a clear detail string when overlapping', () => {
    const s = {
      homeworkId: 'h', title: 't', subject: 'Maths', subjectId: null,
      priority: 'medium' as const, date: iso(0), day: 3 as DayOfWeek,
      startMin: 600, endMin: 650, minutes: 50, explanation: '',
    };
    const sessions = [ses({ id: 's1', day: 3, startTime: '10:20', endTime: '12:00' })];
    const res = explainConflict(s, sessions);
    expect(res.conflicts).toBe(true);
    expect(res.detail).toContain('10:20');
  });
});

// ---------------------------------------------------------------------------
// The planner: priorities, deadlines, non-mutation, coverage
// ---------------------------------------------------------------------------

describe('planStudySessions', () => {
  const subjects = [subj('sub-m', 'Maths'), subj('sub-e', 'English')];
  const dailyWindow: TimeWindow = { startMin: 8 * 60, endMin: 22 * 60 };

  function run(input: {
    homework: HomeworkItem[];
    sessions?: Session[];
    focusHistory?: FocusSession[];
    options?: Parameters<typeof planStudySessions>[0]['options'];
  }) {
    return planStudySessions({
      now: ANCHOR,
      homework: input.homework,
      sessions: input.sessions ?? [],
      subjects,
      focusHistory: input.focusHistory ?? [],
      options: { dailyWindow, blockMinutes: 50, maxBlocksPerDay: 5, ...input.options },
    });
  }

  it('schedules urgent work before relaxed work', () => {
    const plan = run({
      homework: [
        hw({ id: 'relaxed', title: 'Relaxed', dueDate: new Date(2026, 9, 30), priority: 'low', type: 'Essay' }),
        hw({ id: 'urgent', title: 'Urgent', dueDate: new Date(2026, 9, 16), priority: 'high', type: 'Essay' }),
      ],
    });
    expect(plan.suggestions.length).toBeGreaterThan(0);
    expect(plan.suggestions[0].homeworkId).toBe('urgent');
  });

  it('never schedules a block past the due date', () => {
    const plan = run({
      homework: [hw({ id: 'due-soon', dueDate: new Date(2026, 9, 15), type: 'Essay' })],
      options: { horizonDays: 7 },
    });
    const dueIso = iso(1); // Oct 15
    for (const s of plan.suggestions) {
      expect(s.date <= dueIso).toBe(true);
    }
  });

  it('never schedules into the past on the current day', () => {
    const plan = run({
      homework: [hw({ id: 'today', dueDate: new Date(2026, 9, 30), type: 'Essay' })],
    });
    const todayIso = iso(0);
    for (const s of plan.suggestions.filter((x) => x.date === todayIso)) {
      // ANCHOR is 09:00 = 540 min; nothing should start before that.
      expect(s.startMin).toBeGreaterThanOrEqual(540);
    }
  });

  it('does not mutate the homework or session inputs', () => {
    const homework = [hw({ id: 'h1', dueDate: new Date(2026, 9, 20), type: 'Essay' })];
    const sessions = [ses({ id: 's1', day: 3, startTime: '10:00', endTime: '11:00' })];
    const hwSnapshot = JSON.stringify(homework);
    const sesSnapshot = JSON.stringify(sessions);
    run({ homework, sessions });
    expect(JSON.stringify(homework)).toBe(hwSnapshot);
    expect(JSON.stringify(sessions)).toBe(sesSnapshot);
  });

  it('accounts for completed focus time so it does not double-schedule', () => {
    // 60 min generic estimate, 60 min already focused -> nothing left to plan.
    const plan = run({
      homework: [hw({ id: 'half', dueDate: new Date(2026, 9, 20), type: 'Homework' })],
      focusHistory: [focus({ id: 'f1', homeworkId: 'half', status: 'completed', actualDurationSec: 3600 })],
    });
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.unscheduled.some((u) => u.homeworkId === 'half' && /focus/i.test(u.reason))).toBe(true);
  });

  it('never double-books two suggestions into the same slot', () => {
    const plan = run({
      homework: [
        hw({ id: 'a', title: 'A', dueDate: new Date(2026, 9, 15), type: 'Essay' }),
        hw({ id: 'b', title: 'B', dueDate: new Date(2026, 9, 16), type: 'Essay' }),
      ],
      options: { horizonDays: 2, maxBlocksPerDay: 10 },
    });
    const keys = plan.suggestions.map((s) => `${s.date}|${s.startMin}|${s.endMin}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not overlap any existing commitment', () => {
    const sessions = [ses({ id: 's1', day: 3, startTime: '08:00', endTime: '10:00' })];
    const plan = run({
      homework: [hw({ id: 'h', dueDate: new Date(2026, 9, 20), type: 'Essay' })],
      sessions,
      options: { horizonDays: 1 },
    });
    for (const s of plan.suggestions) {
      // Oct 14 is a Wednesday (day 3). Blocks must start at/after 10:00 (600 min).
      expect(s.day).toBe(3);
      expect(s.startMin).toBeGreaterThanOrEqual(600);
    }
  });

  it('schedules onto the deadline day itself, filling it until the estimate runs out', () => {
    // Due Oct 16 (Fri). Wed+Thu fully booked, so all work lands on Friday: three
    // blocks (50+50+20) = the full 120-min estimate, no gap.
    const sessions = [
      ses({ id: 's1', day: 3, startTime: '08:20', endTime: '22:00' }), // Wed busy
      ses({ id: 's2', day: 4, startTime: '08:00', endTime: '22:00' }), // Thu busy
    ];
    const plan = run({
      homework: [hw({ id: 'tight', dueDate: new Date(2026, 9, 16), type: 'Essay' })],
      sessions,
      options: { horizonDays: 3 },
    });
    expect(plan.suggestions.map((s) => s.minutes)).toEqual([50, 50, 20]);
    for (const s of plan.suggestions) expect(s.date).toBe(iso(2));
    expect(plan.coverageGaps).toHaveLength(0);
    expect(plan.unscheduled).toHaveLength(0);
  });

  it('reports the honest shortfall when a same-day deadline cannot absorb the estimate', () => {
    // Due today (so already overdue -> 120 + 15 buffer = 135 min). Free time is only
    // 09:00–10:30 before the 10:30 commitment, so a single 50-min block fits and
    // 85 min is honestly reported as short rather than silently dropped.
    const plan = run({
      homework: [hw({ id: 'today', dueDate: new Date(2026, 9, 14), type: 'Essay' })],
      sessions: [ses({ id: 's1', day: 3, startTime: '10:30', endTime: '22:00' })],
      options: { horizonDays: 1 },
    });
    expect(plan.suggestions.map((s) => s.minutes)).toEqual([50]);
    expect(plan.coverageGaps).toHaveLength(1);
    expect(plan.coverageGaps[0].estimatedMinutes).toBe(135);
    expect(plan.coverageGaps[0].shortfallMinutes).toBe(85);
  });

  it('adds an overdue buffer and still schedules overdue work', () => {
    // Overdue by 3 days: estimate grows from the 120-min essay baseline to 135,
    // and the work is still planned (past-due dates are not dropped).
    const plan = run({
      homework: [hw({ id: 'late', dueDate: new Date(2026, 9, 11), type: 'Essay' })],
      options: { horizonDays: 5 },
    });
    expect(plan.suggestions.length).toBeGreaterThan(0);
    expect(plan.suggestions[0].explanation).toMatch(/overdue/i);
    const total = plan.suggestions.reduce((n, s) => n + s.minutes, 0);
    expect(total).toBeLessThanOrEqual(135);
  });

  it('flags hidden homework as unscheduled rather than planning it', () => {
    const plan = run({
      homework: [hw({ id: 'hidden', dueDate: new Date(2026, 9, 20), hide: true, type: 'Essay' })],
    });
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.unscheduled.find((u) => u.homeworkId === 'hidden')?.reason).toMatch(/hidden/i);
  });

  it('flags homework with a missing or invalid due date', () => {
    const plan = run({
      homework: [hw({ id: 'bad', dueDate: new Date('nonsense'), type: 'Essay' })],
    });
    expect(plan.unscheduled.find((u) => u.homeworkId === 'bad')?.reason).toMatch(/due date/i);
  });

  it('flags already-completed homework as needing no study', () => {
    const plan = run({
      homework: [hw({ id: 'done', dueDate: new Date(2026, 9, 20), status: 'completed', type: 'Essay' })],
    });
    expect(plan.unscheduled.find((u) => u.homeworkId === 'done')?.reason).toMatch(/completed\/submitted/i);
  });

  it('is fully deterministic across repeated runs', () => {
    const homework = [
      hw({ id: 'a', title: 'A', dueDate: new Date(2026, 9, 16), type: 'Essay' }),
      hw({ id: 'b', title: 'B', dueDate: new Date(2026, 9, 17), priority: 'high', type: 'Reading' }),
      hw({ id: 'c', title: 'C', dueDate: new Date(2026, 9, 25), priority: 'low', type: 'Homework' }),
    ];
    const one = run({ homework });
    const two = run({ homework });
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });

  it('produces an explanation for every suggestion', () => {
    const plan = run({
      homework: [hw({ id: 'h', dueDate: new Date(2026, 9, 20), type: 'Essay' })],
    });
    for (const s of plan.suggestions) {
      expect(s.explanation.length).toBeGreaterThan(0);
    }
  });

  it('attaches the matched subject id when the homework subject exists', () => {
    const plan = run({
      homework: [hw({ id: 'h', subject: 'English', dueDate: new Date(2026, 9, 20), type: 'Essay' })],
    });
    expect(plan.suggestions[0].subjectId).toBe('sub-e');
  });

  it('yields an empty plan when there is no homework at all', () => {
    const plan = run({ homework: [] });
    expect(plan).toEqual({ suggestions: [], unscheduled: [], coverageGaps: [] });
  });

  it('respects a narrow allowedDays set', () => {
    const plan = run({
      homework: [hw({ id: 'h', dueDate: new Date(2026, 9, 30), type: 'Essay' })],
      options: { allowedDays: [1, 5] }, // Mondays and Fridays only
    });
    for (const s of plan.suggestions) {
      expect([1, 5]).toContain(s.day);
    }
  });
});
