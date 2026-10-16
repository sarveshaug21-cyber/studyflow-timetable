import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getInitialState, timetableReducer } from '@/context/TimetableContext';
import {
  readStoredTimetable,
  timetableStateToJSON,
} from '@/context/timetableStorage';
import type { TimetableState, Subject, Session, HomeworkItem, DayOfWeek } from '@/types';
import { generateId } from '@/types';

const STORAGE_KEY = 'studyflow-timetable';

// A real in-memory store. The bare `vi.fn()` mock in src/test/setup.ts cannot
// answer getItem with a stored value, so these tests install their own.
function installStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const storage = {
    getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, String(v));
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k);
    }),
    clear: vi.fn(() => store.clear()),
  };
  vi.stubGlobal('localStorage', storage);
  return { store, storage };
}

const dueISO = '2026-10-20T00:00:00.000Z';

const sampleSubject: Subject = {
  id: 'sub-1',
  name: 'Mathematics',
  code: 'MATH1',
  color: '#3b82f6',
  instructor: 'Mr. Smith',
  room: 'Room 101',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const sampleLectureSession: Session = {
  id: 'sess-1',
  subjectId: 'sub-1',
  day: 1 as DayOfWeek,
  startTime: '09:00',
  endTime: '10:30',
  type: 'lecture',
  location: 'Room 101',
  notes: '',
  recurring: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

// A one-off (non-recurring) study session produced by the planner. This is the
// shape that regression #1 guards: it must survive a save/reload round trip
// alongside subjects and lectures, not be wiped by a homework-only write.
const sampleStudySession: Session = {
  id: 'sess-study-1',
  subjectId: 'sub-1',
  day: 2 as DayOfWeek,
  startTime: '18:00',
  endTime: '18:45',
  type: 'study',
  location: '',
  notes: 'Revise chapter 3',
  recurring: false,
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
};

const sampleHomework: HomeworkItem = {
  id: 'hw-1',
  title: 'Maths Homework',
  subject: 'Mathematics',
  teacher: 'Mr. Smith',
  group: '9A',
  type: 'Assignment',
  dueDate: new Date(dueISO),
  status: 'pending',
  submissionType: 'online',
  hide: false,
  source: 'manual',
};

function baseState(overrides: Partial<TimetableState> = {}): TimetableState {
  return {
    subjects: [sampleSubject],
    sessions: [sampleLectureSession, sampleStudySession],
    homework: [sampleHomework],
    currentWeekStart: '2026-10-12T00:00:00.000Z',
    view: 'weekly',
    timeIncrement: 30,
    showWeekends: false,
    timeRange: { start: '08:00', end: '18:00' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('persistence regression: subjects, sessions, and homework survive a save/reload', () => {
  it('round-trips the full state through JSON and back without losing sessions', () => {
    installStorage();
    const original = baseState();

    const json = timetableStateToJSON(original);
    localStorage.setItem(STORAGE_KEY, json);

    const restored = getInitialState();

    // Regression #1: the old persist effect wrote only the homework array, so
    // study sessions vanished on reload. Assert all three survive.
    expect(restored.subjects).toEqual(original.subjects);
    expect(restored.sessions).toHaveLength(2);
    expect(restored.sessions).toEqual(original.sessions);
    // The one-off planner-created session specifically.
    expect(restored.sessions.some((s) => s.type === 'study' && !s.recurring)).toBe(true);
  });

  it('revives homework dueDate as a real Date, not an ISO string', () => {
    installStorage();
    const original = baseState();

    localStorage.setItem(STORAGE_KEY, timetableStateToJSON(original));
    const restored = getInitialState();

    expect(restored.homework).toHaveLength(1);
    expect(restored.homework[0].dueDate).toBeInstanceOf(Date);
    expect(restored.homework[0].dueDate.getTime()).toBe(new Date(dueISO).getTime());
    // Regression #2: a dueDate left as a string breaks every date comparison.
    expect(Number.isNaN(restored.homework[0].dueDate.getTime())).toBe(false);
  });

  it('preserves view, timeIncrement, showWeekends, and currentWeekStart', () => {
    installStorage();
    const original = baseState({
      view: 'agenda',
      timeIncrement: 60,
      showWeekends: true,
      currentWeekStart: '2026-10-19T00:00:00.000Z',
    });

    localStorage.setItem(STORAGE_KEY, timetableStateToJSON(original));
    const restored = getInitialState();

    expect(restored.view).toBe('agenda');
    expect(restored.timeIncrement).toBe(60);
    expect(restored.showWeekends).toBe(true);
    expect(restored.currentWeekStart).toBe('2026-10-19T00:00:00.000Z');
  });

  it('round-trips an empty timetable back to an empty timetable', () => {
    installStorage();
    const empty = getInitialState();
    expect(empty.subjects).toHaveLength(0);

    localStorage.setItem(STORAGE_KEY, timetableStateToJSON(empty));
    const restored = getInitialState();

    expect(restored.subjects).toEqual([]);
    expect(restored.sessions).toEqual([]);
    expect(restored.homework).toEqual([]);
  });
});

describe('persistence regression: malformed data is safe and never overwrites categories', () => {
  it('returns an empty state for malformed JSON without throwing', () => {
    installStorage({ [STORAGE_KEY]: '{not valid json' });
    expect(() => getInitialState()).not.toThrow();
    const restored = getInitialState();
    expect(restored.subjects).toEqual([]);
    expect(restored.sessions).toEqual([]);
    expect(restored.homework).toEqual([]);
  });

  it('treats a store missing subjects or sessions as unusable', () => {
    installStorage({ [STORAGE_KEY]: JSON.stringify({ homework: [sampleHomework] }) });
    const restored = getInitialState();
    expect(restored.subjects).toEqual([]);
    expect(restored.homework).toEqual([]);
  });

  it('does not overwrite a valid stored category when the store is malformed', () => {
    // Malformed JSON must not be replaced with a wiped valid store on load.
    installStorage({ [STORAGE_KEY]: '{not valid json' });
    getInitialState();
    // The stored value is still the student's original (unreadable) data.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not valid json');
  });

  it('drops a homework item with an unparseable dueDate but keeps the valid sibling', () => {
    installStorage({
      [STORAGE_KEY]: JSON.stringify({
        subjects: [sampleSubject],
        sessions: [sampleLectureSession],
        homework: [
          { ...sampleHomework, id: 'hw-bad', dueDate: 'not-a-date' },
          { ...sampleHomework, id: 'hw-good', dueDate: dueISO },
        ],
        currentWeekStart: '2026-10-12T00:00:00.000Z',
        view: 'weekly',
        timeIncrement: 30,
        showWeekends: false,
      }),
    });

    const restored = getInitialState();
    expect(restored.homework.map((h) => h.id)).toEqual(['hw-good']);
    expect(restored.homework[0].dueDate).toBeInstanceOf(Date);
  });

  it('LOAD_FROM_STORAGE leaves subjects and homework intact for a valid store', () => {
    installStorage({
      [STORAGE_KEY]: timetableStateToJSON(baseState()),
    });
    const restored = timetableReducer(baseState({ subjects: [], sessions: [], homework: [] }), {
      type: 'LOAD_FROM_STORAGE',
    });
    expect(restored.subjects).toHaveLength(1);
    expect(restored.sessions).toHaveLength(2);
    expect(restored.homework).toHaveLength(1);
  });
});

describe('persistence regression: legacy records without priority or estimatedMinutes', () => {
  // A pre-planner record: no `priority`, no `estimatedMinutes`.
  const legacyHomework = {
    id: 'hw-legacy',
    title: 'Legacy Essay',
    subject: 'English',
    teacher: 'Ms. Jones',
    group: '10B',
    type: 'Essay',
    dueDate: dueISO,
    status: 'pending',
    submissionType: 'paper',
    hide: false,
    source: 'manual',
  };

  it('loads a legacy record without priority or estimatedMinutes', () => {
    installStorage({
      [STORAGE_KEY]: JSON.stringify({
        subjects: [sampleSubject],
        sessions: [sampleLectureSession],
        homework: [legacyHomework],
        currentWeekStart: '2026-10-12T00:00:00.000Z',
        view: 'weekly',
        timeIncrement: 30,
        showWeekends: false,
      }),
    });

    const restored = getInitialState();
    expect(restored.homework).toHaveLength(1);
    expect(restored.homework[0].title).toBe('Legacy Essay');
    // Regression #3: missing fields must not break date revival.
    expect(restored.homework[0].dueDate).toBeInstanceOf(Date);
  });

  it('falls back to defaults for a legacy record without priority or estimatedMinutes', () => {
    installStorage({
      [STORAGE_KEY]: JSON.stringify({
        subjects: [sampleSubject],
        sessions: [sampleLectureSession],
        homework: [legacyHomework],
        currentWeekStart: '2026-10-12T00:00:00.000Z',
        view: 'weekly',
        timeIncrement: 30,
        showWeekends: false,
      }),
    });

    const restored = getInitialState();
    const item = restored.homework[0];
    // `estimatedMinutes: undefined` is the documented "auto-estimate" signal
    // the scheduler falls back on; priority is filled with the default.
    expect(item.estimatedMinutes).toBeUndefined();
    expect(item.priority).toBe('medium');
  });

  it('keeps an explicit priority and estimate when they are present', () => {
    installStorage({
      [STORAGE_KEY]: JSON.stringify({
        subjects: [sampleSubject],
        sessions: [sampleLectureSession],
        homework: [
          { ...legacyHomework, priority: 'urgent', estimatedMinutes: 45 },
        ],
        currentWeekStart: '2026-10-12T00:00:00.000Z',
        view: 'weekly',
        timeIncrement: 30,
        showWeekends: false,
      }),
    });

    const restored = getInitialState();
    expect(restored.homework[0].priority).toBe('urgent');
    expect(restored.homework[0].estimatedMinutes).toBe(45);
  });
});

describe('persistence regression: readStoredTimetable', () => {
  it('returns null when there is no stored value', () => {
    installStorage();
    expect(readStoredTimetable()).toBeNull();
  });

  it('returns a normalised state for a valid store', () => {
    installStorage({ [STORAGE_KEY]: timetableStateToJSON(baseState()) });
    const restored = readStoredTimetable();
    expect(restored).not.toBeNull();
    expect(restored!.subjects).toHaveLength(1);
    expect(restored!.homework[0].dueDate).toBeInstanceOf(Date);
  });
});

describe('persistence regression: homework write does not wipe other categories', () => {
  it('re-reading after a homework edit keeps subjects and both session types', () => {
    installStorage();
    const original = baseState();
    localStorage.setItem(STORAGE_KEY, timetableStateToJSON(original));

    // Reload, then add one more homework item and persist again.
    const restored = getInitialState();
    const withNewHw = timetableReducer(restored, {
      type: 'ADD_HOMEWORK',
      payload: {
        ...sampleHomework,
        id: generateId(),
        title: 'Second Essay',
        dueDate: new Date(dueISO),
      } as HomeworkItem,
    });
    localStorage.setItem(STORAGE_KEY, timetableStateToJSON(withNewHw));

    const reloaded = getInitialState();
    expect(reloaded.homework.map((h) => h.title)).toEqual(['Maths Homework', 'Second Essay']);
    // Regression #1 again, from the write side: subjects and the one-off study
    // session are still present after the homework write.
    expect(reloaded.subjects).toEqual(original.subjects);
    expect(reloaded.sessions.some((s) => s.type === 'study' && !s.recurring)).toBe(true);
    expect(reloaded.sessions).toHaveLength(2);
  });
});
