import { describe, it, expect } from 'vitest';
import {
  snapshotKey,
  describePlanChanges,
  findConfirmedStudyConflicts,
  replanAvoidingConfirmed,
  type PlannerSnapshot,
} from '@/utils/adaptivePlanner';
import type { SchedulePlan, StudySuggestion } from '@/utils/scheduler';
import { planStudySessions } from '@/utils/scheduler';
import type { FocusSession, HomeworkItem, Session, Subject } from '@/types';

const subject: Subject = {
  id: 'sub-maths',
  name: 'Maths',
  code: 'MATH101',
  color: '#0000ff',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function makeHomework(overrides: Partial<HomeworkItem> = {}): HomeworkItem {
  return {
    id: 'hw-1',
    title: 'Chapter 3',
    subject: 'Maths',
    teacher: 'Mr. Smith',
    group: '9A',
    type: 'Homework',
    dueDate: new Date('2026-10-20T00:00:00.000Z'),
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
    priority: 'high',
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    subjectId: 'sub-maths',
    day: 1,
    startTime: '09:00',
    endTime: '10:00',
    type: 'lecture',
    location: 'Room 1',
    notes: '',
    recurring: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<PlannerSnapshot> = {}): PlannerSnapshot {
  return {
    homework: [makeHomework()],
    sessions: [],
    subjects: [subject],
    focusHistory: [],
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<StudySuggestion> = {}): StudySuggestion {
  return {
    homeworkId: 'hw-1',
    title: 'Chapter 3',
    subject: 'Maths',
    subjectId: 'sub-maths',
    priority: 'high',
    date: '2026-10-16',
    day: 5,
    startMin: 600,
    endMin: 650,
    minutes: 50,
    explanation: 'test',
    ...overrides,
  };
}

function makePlan(suggestions: StudySuggestion[]): SchedulePlan {
  return { suggestions, unscheduled: [], coverageGaps: [] };
}

// A fixed clock keeps the planner output deterministic across runs.
const NOW = new Date('2026-10-15T08:00:00.000Z');

describe('snapshotKey', () => {
  it('is stable for two snapshots describing the same inputs', () => {
    expect(snapshotKey(makeSnapshot())).toBe(snapshotKey(makeSnapshot()));
  });

  it('changes when a homework due date moves', () => {
    const a = makeSnapshot();
    const b = makeSnapshot({
      homework: [makeHomework({ dueDate: new Date('2026-10-22T00:00:00.000Z') })],
    });
    expect(snapshotKey(a)).not.toBe(snapshotKey(b));
  });

  it('changes when a homework status changes', () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ homework: [makeHomework({ status: 'completed' })] });
    expect(snapshotKey(a)).not.toBe(snapshotKey(b));
  });

  it('changes when priority or estimate changes', () => {
    const base = makeSnapshot();
    expect(snapshotKey(base)).not.toBe(
      snapshotKey(makeSnapshot({ homework: [makeHomework({ priority: 'urgent' })] })),
    );
    expect(snapshotKey(base)).not.toBe(
      snapshotKey(makeSnapshot({ homework: [makeHomework({ estimatedMinutes: 45 })] })),
    );
  });

  it('treats a legacy null estimate and an absent estimate as the same input', () => {
    const absent = makeSnapshot();
    const legacyNull = makeSnapshot({
      homework: [makeHomework({ estimatedMinutes: null as unknown as number })],
    });
    expect(snapshotKey(absent)).toBe(snapshotKey(legacyNull));
  });

  it('changes when a timetable session moves', () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ sessions: [makeSession({ startTime: '11:00', endTime: '12:00' })] });
    expect(snapshotKey(a)).not.toBe(snapshotKey(b));
  });

  it('ignores subject renames (they do not move any block)', () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ subjects: [{ ...subject, name: 'Further Maths' }] });
    expect(snapshotKey(a)).toBe(snapshotKey(b));
  });

  it('ignores sub-minute focus-session timer jitter', () => {
    const focus = (sec: number): FocusSession => ({
      id: 'f-1',
      startedAt: '2026-10-14T10:00:00.000Z',
      endedAt: '2026-10-14T10:05:00.000Z',
      plannedDurationSec: 300,
      actualDurationSec: sec,
      status: 'completed',
      homeworkId: 'hw-1',
      homeworkTitle: 'Chapter 3',
      subjectName: 'Maths',
    });
    // 59s and 61s both round to the same minute: no re-plan should be implied.
    expect(snapshotKey(makeSnapshot({ focusHistory: [focus(59)] }))).toBe(
      snapshotKey(makeSnapshot({ focusHistory: [focus(61)] })),
    );
    // A whole extra minute of real focus time is a genuine change.
    expect(snapshotKey(makeSnapshot({ focusHistory: [focus(60)] }))).not.toBe(
      snapshotKey(makeSnapshot({ focusHistory: [focus(120)] })),
    );
  });
});

describe('describePlanChanges', () => {
  it('reports an identical plan as all-same', () => {
    const plan = makePlan([makeSuggestion()]);
    const changes = describePlanChanges(plan, makePlan([makeSuggestion()]));
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('same');
    expect(changes[0].reason).toBe('Unchanged.');
  });

  it('reports a suggestion that only exists in the new plan as added', () => {
    const changes = describePlanChanges(
      makePlan([]),
      makePlan([makeSuggestion({ homeworkId: 'hw-new', title: 'New work' })]),
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('added');
    expect(changes[0].title).toBe('New work');
    expect(changes[0].reason.length).toBeGreaterThan(0);
  });

  it('explains a removal caused by completing the homework', () => {
    const previousSnapshot = makeSnapshot({
      homework: [makeHomework({ status: 'pending' })],
    });
    const nextSnapshot = makeSnapshot({
      homework: [makeHomework({ status: 'completed' })],
    });
    const changes = describePlanChanges(
      makePlan([makeSuggestion()]),
      makePlan([]),
      { previousSnapshot, nextSnapshot },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('removed');
    expect(changes[0].reason).toMatch(/completed/i);
    expect(changes[0].reason).toMatch(/marked completed/i);
  });

  it('explains a move caused by a changed study estimate', () => {
    const previousSnapshot = makeSnapshot({
      homework: [makeHomework({ estimatedMinutes: 30 })],
    });
    const nextSnapshot = makeSnapshot({
      homework: [makeHomework({ estimatedMinutes: 90 })],
    });
    const changes = describePlanChanges(
      makePlan([makeSuggestion({ startMin: 600, endMin: 630, minutes: 30 })]),
      makePlan([makeSuggestion({ startMin: 900, endMin: 990, minutes: 90 })]),
      { previousSnapshot, nextSnapshot },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('moved');
    expect(changes[0].reason).toMatch(/30 min to 90 min/);
  });

  it('explains a move caused by a changed priority', () => {
    const previousSnapshot = makeSnapshot({
      homework: [makeHomework({ priority: 'low' })],
    });
    const nextSnapshot = makeSnapshot({
      homework: [makeHomework({ priority: 'urgent' })],
    });
    const changes = describePlanChanges(
      makePlan([makeSuggestion({ startMin: 600, endMin: 650, priority: 'low' })]),
      makePlan([makeSuggestion({ startMin: 480, endMin: 530, priority: 'urgent' })]),
      { previousSnapshot, nextSnapshot },
    );
    expect(changes[0].kind).toBe('moved');
    expect(changes[0].reason).toMatch(/Priority changed from low to urgent/);
  });

  it('falls back to a generic reason when no input explains the move', () => {
    const changes = describePlanChanges(
      makePlan([makeSuggestion({ startMin: 600, endMin: 650 })]),
      makePlan([makeSuggestion({ startMin: 700, endMin: 750 })]),
    );
    expect(changes[0].kind).toBe('moved');
    expect(changes[0].reason).toMatch(/Free time or deadlines changed/);
  });

  it('reports a multi-block homework as moved only when its slots change', () => {
    const before = makePlan([
      makeSuggestion({ startMin: 600, endMin: 650, date: '2026-10-16' }),
      makeSuggestion({ startMin: 700, endMin: 750, date: '2026-10-17' }),
    ]);
    const after = makePlan([
      makeSuggestion({ startMin: 700, endMin: 750, date: '2026-10-17' }),
      makeSuggestion({ startMin: 600, endMin: 650, date: '2026-10-16' }),
    ]);
    const changes = describePlanChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('same');
  });
});

describe('findConfirmedStudyConflicts', () => {
  it('reports a suggestion overlapping an accepted study block', () => {
    const confirmed = makeSession({
      id: 'sess-study',
      type: 'study',
      day: 5,
      date: '2026-10-16',
      startTime: '10:00',
      endTime: '11:00',
      recurring: false,
    });
    const conflicts = findConfirmedStudyConflicts([makeSuggestion()], [confirmed]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].sessionId).toBe('sess-study');
    expect(conflicts[0].suggestion.homeworkId).toBe('hw-1');
  });

  it('ignores non-study sessions (the planner already treats them as busy)', () => {
    const lesson = makeSession({
      day: 5,
      startTime: '10:00',
      endTime: '11:00',
      recurring: true,
    });
    expect(findConfirmedStudyConflicts([makeSuggestion()], [lesson])).toHaveLength(0);
  });

  it('ignores study blocks that do not overlap in time', () => {
    const confirmed = makeSession({
      type: 'study',
      day: 5,
      date: '2026-10-16',
      startTime: '12:00',
      endTime: '13:00',
      recurring: false,
    });
    expect(findConfirmedStudyConflicts([makeSuggestion()], [confirmed])).toHaveLength(0);
  });

  it('ignores a dated study block on a different day', () => {
    const confirmed = makeSession({
      type: 'study',
      day: 5,
      date: '2026-10-23',
      startTime: '10:00',
      endTime: '11:00',
      recurring: false,
    });
    expect(findConfirmedStudyConflicts([makeSuggestion()], [confirmed])).toHaveLength(0);
  });

  it('matches a recurring study block on the same weekday', () => {
    const confirmed = makeSession({
      type: 'study',
      day: 5,
      startTime: '10:00',
      endTime: '11:00',
      recurring: true,
    });
    expect(findConfirmedStudyConflicts([makeSuggestion()], [confirmed])).toHaveLength(1);
  });
});

describe('replanAvoidingConfirmed', () => {
  it('produces a plan with no suggestion colliding with an accepted study block', () => {
    // First plan, no study blocks on the timetable yet.
    const first = replanAvoidingConfirmed({ now: NOW, snapshot: makeSnapshot() });
    expect(first.suggestions.length).toBeGreaterThan(0);

    // The student accepts one block; it lands on the timetable as a study session.
    const accepted = first.suggestions[0];
    const confirmed: Session = {
      id: 'sess-accepted',
      subjectId: accepted.subjectId ?? 'sub-maths',
      day: accepted.day,
      date: accepted.date,
      startTime: String(Math.floor(accepted.startMin / 60)).padStart(2, '0') + ':' + String(accepted.startMin % 60).padStart(2, '0'),
      endTime: String(Math.floor(accepted.endMin / 60)).padStart(2, '0') + ':' + String(accepted.endMin % 60).padStart(2, '0'),
      type: 'study',
      location: '',
      notes: '',
      recurring: false,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    };

    const second = replanAvoidingConfirmed({
      now: NOW,
      snapshot: makeSnapshot({ sessions: [confirmed] }),
    });

    // No silent duplicates: nothing planned over the block the student owns.
    expect(findConfirmedStudyConflicts(second.suggestions, [confirmed])).toHaveLength(0);
    // And the re-plan still schedules the homework elsewhere (or reports why not).
    expect(second.suggestions.length + second.unscheduled.length).toBeGreaterThan(0);
  });

  it('is deterministic: the same snapshot replans to the same slots', () => {
    const a = replanAvoidingConfirmed({ now: NOW, snapshot: makeSnapshot() });
    const b = replanAvoidingConfirmed({ now: NOW, snapshot: makeSnapshot() });
    expect(a.suggestions.map((s) => s.date + s.startMin)).toEqual(
      b.suggestions.map((s) => s.date + s.startMin),
    );
  });

  it('respects a custom planning horizon', () => {
    const plan = replanAvoidingConfirmed({
      now: NOW,
      snapshot: makeSnapshot(),
      options: { horizonDays: 1 },
    });
    const base = planStudySessions({
      now: NOW,
      homework: makeSnapshot().homework,
      sessions: [],
      subjects: [subject],
      focusHistory: [],
      options: { horizonDays: 1 },
    });
    expect(plan.suggestions.length).toBeLessThanOrEqual(base.suggestions.length);
    for (const s of plan.suggestions) {
      expect(findConfirmedStudyConflicts([s], [])).toHaveLength(0);
    }
  });
});
