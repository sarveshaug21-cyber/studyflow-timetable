import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timetableReducer, getInitialState, getOverdueHomeworkFromArray, getHomeworkByDateFromArray } from '@/context/TimetableContext';
import type { TimetableState, Subject, Session, HomeworkItem, DayOfWeek } from '@/types';
import type { Action } from '@/context/TimetableContext';
import { generateId } from '@/types';

const createHomework = (overrides: Partial<HomeworkItem> = {}): HomeworkItem => ({
  id: generateId(),
  title: 'Maths Homework',
  subject: 'Mathematics',
  teacher: 'Mr. Smith',
  group: '9A',
  type: 'Assignment',
  dueDate: new Date(Date.now() + 86400000), // Tomorrow
  status: 'pending',
  submissionType: 'online',
  hide: false,
  source: 'manual',
  ...overrides,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

const createSubject = (overrides: Partial<Subject> = {}): Subject => ({
  id: generateId(),
  name: 'Test Subject',
  code: 'TS101',
  color: '#3b82f6',
  instructor: 'Dr. Test',
  room: 'Room 101',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: generateId(),
  subjectId: 'sub-1',
  day: 1 as DayOfWeek,
  startTime: '09:00',
  endTime: '10:30',
  type: 'lecture',
  location: 'Room 101',
  notes: '',
  recurring: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Timetable Reducer', () => {
  let initialState: TimetableState;

  beforeEach(() => {
    initialState = getInitialState();
  });

  describe('ADD_SUBJECT', () => {
    it('adds a new subject with generated ID and timestamps', () => {
      const subjectData = { name: 'New Subject', code: 'NS101', color: '#ff0000' };
      const action: Action = { type: 'ADD_SUBJECT', payload: subjectData };
      const newState = timetableReducer(initialState, action);

      expect(newState.subjects).toHaveLength(1);
      expect(newState.subjects[0].name).toBe('New Subject');
      expect(newState.subjects[0].code).toBe('NS101');
      expect(newState.subjects[0].id).toBeDefined();
      expect(newState.subjects[0].createdAt).toBeDefined();
      expect(newState.subjects[0].updatedAt).toBeDefined();
    });
  });

  describe('UPDATE_SUBJECT', () => {
    it('updates existing subject', () => {
      const subject = createSubject();
      const stateWithSubject: TimetableState = { ...initialState, subjects: [subject] };

      const updatedSubject = { ...subject, name: 'Updated Name' };
      const action: Action = { type: 'UPDATE_SUBJECT', payload: updatedSubject };
      const newState = timetableReducer(stateWithSubject, action);

      expect(newState.subjects[0].name).toBe('Updated Name');
      expect(newState.subjects[0].updatedAt).toBeDefined();
      expect(typeof newState.subjects[0].updatedAt).toBe('string');
    });

    it('does not affect other subjects', () => {
      const subject1 = createSubject({ id: 'sub-1', code: 'TS101', name: 'Subject 1' });
      const subject2 = createSubject({ id: 'sub-2', code: 'TS102', name: 'Subject 2' });
      const stateWithSubjects: TimetableState = { ...initialState, subjects: [subject1, subject2] };

      const updatedSubject = { ...subject1, name: 'Updated' };
      const action: Action = { type: 'UPDATE_SUBJECT', payload: updatedSubject };
      const newState = timetableReducer(stateWithSubjects, action);

      expect(newState.subjects[0].name).toBe('Updated');
      expect(newState.subjects[1].name).toBe('Subject 2');
    });
  });

  describe('DELETE_SUBJECT', () => {
    it('deletes a subject and its associated sessions', () => {
      const subject = createSubject({ id: 'sub-1', code: 'TS101', name: 'Subject to Delete' });
      const stateWithSubject: TimetableState = { ...initialState, subjects: [subject] };

      const action: Action = { type: 'DELETE_SUBJECT', payload: 'sub-1' };
      const newState = timetableReducer(stateWithSubject, action);

      expect(newState.subjects).toHaveLength(0);
      expect(newState.sessions.filter((s: Session) => s.subjectId === 'sub-1')).toHaveLength(0);
    });
  });

  describe('ADD_SESSION', () => {
    it('adds a new session with generated ID and timestamps', () => {
      const sessionData = { subjectId: 'sub-1', day: 1 as DayOfWeek, startTime: '09:00', endTime: '10:30', type: 'lecture' as const, location: 'Room 101', notes: '', recurring: true };
      const action: Action = { type: 'ADD_SESSION', payload: sessionData };
      const newState = timetableReducer(initialState, action);

      expect(newState.sessions).toHaveLength(1);
      expect(newState.sessions[0].subjectId).toBe('sub-1');
      expect(newState.sessions[0].id).toBeDefined();
      expect(newState.sessions[0].createdAt).toBeDefined();
      expect(newState.sessions[0].updatedAt).toBeDefined();
    });
  });

  describe('UPDATE_SESSION', () => {
    it('updates existing session', () => {
      const session = createSession();
      const stateWithSession: TimetableState = { ...initialState, sessions: [session] };

      const updatedSession = { ...session, endTime: '11:30' };
      const action: Action = { type: 'UPDATE_SESSION', payload: updatedSession };
      const newState = timetableReducer(stateWithSession, action);

      expect(newState.sessions[0].endTime).toBe('11:30');
      expect(newState.sessions[0].updatedAt).toBeDefined();
    });

    it('does not affect other sessions', () => {
      const session1 = createSession({ id: 'sess-1', subjectId: 'sub-1', day: 1, startTime: '09:00', endTime: '10:30' });
      const session2 = createSession({ id: 'sess-2', subjectId: 'sub-2', day: 2, startTime: '11:00', endTime: '12:30' });
      const stateWithSessions: TimetableState = { ...initialState, sessions: [session1, session2] };

      const updatedSession = { ...session1, endTime: '11:30' };
      const action: Action = { type: 'UPDATE_SESSION', payload: updatedSession };
      const newState = timetableReducer(stateWithSessions, action);

      expect(newState.sessions[0].endTime).toBe('11:30');
      expect(newState.sessions[1].endTime).toBe('12:30');
    });
  });

  describe('DELETE_SESSION', () => {
    it('removes a session by ID', () => {
      const session = createSession({ id: 'sess-1' });
      const stateWithSession: TimetableState = { ...initialState, sessions: [session] };

      const action: Action = { type: 'DELETE_SESSION', payload: 'sess-1' };
      const newState = timetableReducer(stateWithSession, action);

      expect(newState.sessions).toHaveLength(0);
    });

    it('does not affect other sessions when removing one', () => {
      const session1 = createSession({ id: 'sess-1', subjectId: 'sub-1' });
      const session2 = createSession({ id: 'sess-2', subjectId: 'sub-2' });
      const stateWithSessions: TimetableState = { ...initialState, sessions: [session1, session2] };

      const action: Action = { type: 'DELETE_SESSION', payload: 'sess-1' };
      const newState = timetableReducer(stateWithSessions, action);

      expect(newState.sessions).toHaveLength(1);
      expect(newState.sessions[0].id).toBe('sess-2');
    });
  });

  describe('ADD_HOMEWORK', () => {
    it('adds a new homework item with generated ID', () => {
      const homework = createHomework({ title: 'English Essay', subject: 'English', teacher: 'Ms. Jones', group: '10B', type: 'Essay', dueDate: new Date(Date.now() + 172800000), status: 'pending', submissionType: 'online', source: 'manual' });
      const action: Action = { type: 'ADD_HOMEWORK', payload: homework };
      const newState = timetableReducer(initialState, action);

      expect(newState.homework).toHaveLength(1);
      expect(newState.homework[0].title).toBe('English Essay');
      expect(newState.homework[0].subject).toBe('English');
      expect(newState.homework[0].id).toBeDefined();
      expect(newState.homework[0].status).toBe('pending');
      expect(newState.homework[0].source).toBe('manual');
    });

    it('adds multiple homework items', () => {
      const action1: Action = { type: 'ADD_HOMEWORK', payload: createHomework({ title: 'Maths HW', subject: 'Maths', teacher: 'Mr. Smith', group: '9A', type: 'Assignment', dueDate: new Date(Date.now() + 86400000), status: 'pending', submissionType: 'online', source: 'manual' }) };
      const action2: Action = { type: 'ADD_HOMEWORK', payload: createHomework({ title: 'Physics Essay', subject: 'Physics', teacher: 'Dr. Brown', group: '12C', type: 'Essay', dueDate: new Date(Date.now() + 172800000), status: 'pending', submissionType: 'paper', source: 'manual' }) };

      let state = timetableReducer(initialState, action1);
      expect(state.homework).toHaveLength(1);

      state = timetableReducer(state, action2);
      expect(state.homework).toHaveLength(2);
      expect(state.homework[1].title).toBe('Physics Essay');
    });

    it('preserves existing homework when adding new item', () => {
      const action: Action = { type: 'ADD_HOMEWORK', payload: createHomework({ title: 'Maths HW', subject: 'Maths', teacher: 'Mr. Smith', group: '9A', type: 'Assignment', dueDate: new Date(Date.now() + 86400000), status: 'pending', submissionType: 'online', source: 'manual' }) };
      const initialWithHW: TimetableState = { ...initialState, homework: [createHomework()] };

      const state = timetableReducer(initialWithHW, action);
      expect(state.homework).toHaveLength(2);
    });
  });

  describe('UPDATE_HOMEWORK', () => {
    it('updates existing homework item', () => {
      const homework = createHomework();
      const initialStateWithHW: TimetableState = { ...initialState, homework: [homework] };

      const updatedHomework = { ...homework, status: 'submitted' as const, title: 'Updated Essay' };
      const action: Action = { type: 'UPDATE_HOMEWORK', payload: { id: homework.id, item: updatedHomework } };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework[0].status).toBe('submitted');
      expect(newState.homework[0].title).toBe('Updated Essay');
    });

    it('does not affect other homework items when updating one', () => {
      const hw1 = createHomework({ id: 'hw-1', title: 'Maths HW' });
      const hw2 = createHomework({ id: 'hw-2', title: 'Physics Essay' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const updatedHw1 = { ...hw1, status: 'submitted' as const };
      const action: Action = { type: 'UPDATE_HOMEWORK', payload: { id: hw1.id, item: updatedHw1 } };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework[0].status).toBe('submitted');
      expect(newState.homework[1].title).toBe('Physics Essay');
      expect(newState.homework[1].status).toBe('pending');
    });
  });

  describe('REMOVE_HOMEWORK', () => {
    it('removes a homework item by ID', () => {
      const hw1 = createHomework({ id: 'hw-1' });
      const hw2 = createHomework({ id: 'hw-2' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const action: Action = { type: 'REMOVE_HOMEWORK', payload: 'hw-1' };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework).toHaveLength(1);
      expect(newState.homework[0].id).toBe('hw-2');
    });

    it('does not affect other homework items when removing one', () => {
      const hw1 = createHomework({ id: 'hw-1' });
      const hw2 = createHomework({ id: 'hw-2' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const action: Action = { type: 'REMOVE_HOMEWORK', payload: 'hw-1' };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework).toHaveLength(1);
      expect(newState.homework[0].id).toBe('hw-2');
    });
  });

  describe('CLEAR_HOMEWORK', () => {
    it('clears all homework items', () => {
      const hw1 = createHomework({ id: 'hw-1' });
      const hw2 = createHomework({ id: 'hw-2' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const action: Action = { type: 'CLEAR_HOMEWORK' };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework).toHaveLength(0);
    });
  });

  describe('getOverdueHomework', () => {
    it('returns overdue homework items', () => {
      const overdueHw = createHomework({
        id: 'overdue-1',
        dueDate: new Date(Date.now() - 86400000), // Yesterday
      });
      const pendingHw = createHomework({
        id: 'pending-1',
        dueDate: new Date(Date.now() + 86400000), // Tomorrow
      });
      const completedHw = createHomework({
        id: 'completed-1',
        dueDate: new Date(Date.now() - 86400000), // Yesterday
        status: 'completed',
      });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [overdueHw, pendingHw, completedHw] };

      const overdue = getOverdueHomeworkFromArray(initialStateWithHW.homework);

      expect(overdue).toHaveLength(1);
      expect(overdue[0].id).toBe('overdue-1');
      expect(overdue[0].status).toBe('pending');
    });

    it('does not return completed homework even if past due', () => {
      const completedHw = createHomework({
        id: 'completed-1',
        dueDate: new Date(Date.now() - 86400000), // Yesterday
        status: 'completed',
      });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [completedHw] };

      const overdue = getOverdueHomeworkFromArray(initialStateWithHW.homework);

      expect(overdue).toHaveLength(0);
    });
  });

  describe('getHomeworkByDate', () => {
    it('returns homework due on a specific date', () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1); // Tomorrow
      const hwDueTomorrow = createHomework({
        id: 'hw-tomorrow',
        dueDate: targetDate,
      });
      const hwDueYesterday = createHomework({
        id: 'hw-yesterday',
        dueDate: new Date(Date.now() - 86400000),
      });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hwDueTomorrow, hwDueYesterday] };

      const byDate = getHomeworkByDateFromArray(initialStateWithHW.homework, targetDate);

      expect(byDate).toHaveLength(1);
      expect(byDate[0].id).toBe('hw-tomorrow');
    });
  });

  describe('LOAD_FROM_STORAGE', () => {
    it('loads state from localStorage when valid', () => {
      const stored = JSON.stringify({ subjects: [createSubject()], sessions: [createSession()] });
      localStorageMock.getItem.mockReturnValue(stored);

      const newState = timetableReducer(initialState, { type: 'LOAD_FROM_STORAGE' } as Action);

      expect(newState.subjects).toHaveLength(1);
    });

    it('ignores invalid JSON', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const newState = timetableReducer(initialState, { type: 'LOAD_FROM_STORAGE' } as Action);

      expect(newState.subjects).toEqual([]);
    });

    it('ignores state without subjects and sessions', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ homework: [createHomework()] }));

      const newState = timetableReducer(initialState, { type: 'LOAD_FROM_STORAGE' } as Action);

      expect(newState.subjects).toEqual([]);
    });
  });
});

describe('Homework Integration', () => {
  let initialState: TimetableState;

  beforeEach(() => {
    initialState = getInitialState();
  });

  describe('ADD_HOMEWORK', () => {
    it('adds a new homework item with generated ID', () => {
      const homework = createHomework({ title: 'English Essay', subject: 'English', teacher: 'Ms. Jones', group: '10B', type: 'Essay', dueDate: new Date(Date.now() + 172800000), status: 'pending', submissionType: 'online', source: 'manual' });
      const action: Action = { type: 'ADD_HOMEWORK', payload: homework };
      const newState = timetableReducer(initialState, action);

      expect(newState.homework).toHaveLength(1);
      expect(newState.homework[0].title).toBe('English Essay');
      expect(newState.homework[0].subject).toBe('English');
      expect(newState.homework[0].id).toBeDefined();
      expect(newState.homework[0].status).toBe('pending');
      expect(newState.homework[0].source).toBe('manual');
    });

    it('adds multiple homework items', () => {
      const action1: Action = { type: 'ADD_HOMEWORK', payload: createHomework({ title: 'Maths HW', subject: 'Maths', teacher: 'Mr. Smith', group: '9A', type: 'Assignment', dueDate: new Date(Date.now() + 86400000), status: 'pending', submissionType: 'online', source: 'manual' }) };
      const action2: Action = { type: 'ADD_HOMEWORK', payload: createHomework({ title: 'Physics Essay', subject: 'Physics', teacher: 'Dr. Brown', group: '12C', type: 'Essay', dueDate: new Date(Date.now() + 172800000), status: 'pending', submissionType: 'paper', source: 'manual' }) };

      let state = timetableReducer(initialState, action1);
      expect(state.homework).toHaveLength(1);

      state = timetableReducer(state, action2);
      expect(state.homework).toHaveLength(2);
      expect(state.homework[1].title).toBe('Physics Essay');
    });

    it('preserves existing homework when adding new item', () => {
      const action: Action = { type: 'ADD_HOMEWORK', payload: createHomework({ title: 'Maths HW', subject: 'Maths', teacher: 'Mr. Smith', group: '9A', type: 'Assignment', dueDate: new Date(Date.now() + 86400000), status: 'pending', submissionType: 'online', source: 'manual' }) };
      const initialWithHW: TimetableState = { ...initialState, homework: [createHomework()] };

      const state = timetableReducer(initialWithHW, action);
      expect(state.homework).toHaveLength(2);
    });
  });

  describe('UPDATE_HOMEWORK', () => {
    it('updates existing homework item', () => {
      const homework = createHomework();
      const initialStateWithHW: TimetableState = { ...initialState, homework: [homework] };

      const updatedHomework = { ...homework, status: 'submitted' as const, title: 'Updated Essay' };
      const action: Action = { type: 'UPDATE_HOMEWORK', payload: { id: homework.id, item: updatedHomework } };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework[0].status).toBe('submitted');
      expect(newState.homework[0].title).toBe('Updated Essay');
    });

    it('does not affect other homework items when updating one', () => {
      const hw1 = createHomework({ id: 'hw-1', title: 'Maths HW' });
      const hw2 = createHomework({ id: 'hw-2', title: 'Physics Essay' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const updatedHw1 = { ...hw1, status: 'submitted' as const };
      const action: Action = { type: 'UPDATE_HOMEWORK', payload: { id: hw1.id, item: updatedHw1 } };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework[0].status).toBe('submitted');
      expect(newState.homework[1].title).toBe('Physics Essay');
      expect(newState.homework[1].status).toBe('pending');
    });
  });

  describe('REMOVE_HOMEWORK', () => {
    it('removes a homework item by ID', () => {
      const hw1 = createHomework({ id: 'hw-1' });
      const hw2 = createHomework({ id: 'hw-2' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const action: Action = { type: 'REMOVE_HOMEWORK', payload: 'hw-1' };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework).toHaveLength(1);
      expect(newState.homework[0].id).toBe('hw-2');
    });

    it('does not affect other homework items when removing one', () => {
      const hw1 = createHomework({ id: 'hw-1' });
      const hw2 = createHomework({ id: 'hw-2' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const action: Action = { type: 'REMOVE_HOMEWORK', payload: 'hw-1' };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework).toHaveLength(1);
      expect(newState.homework[0].id).toBe('hw-2');
    });
  });

  describe('CLEAR_HOMEWORK', () => {
    it('clears all homework items', () => {
      const hw1 = createHomework({ id: 'hw-1' });
      const hw2 = createHomework({ id: 'hw-2' });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hw1, hw2] };

      const action: Action = { type: 'CLEAR_HOMEWORK' };
      const newState = timetableReducer(initialStateWithHW, action);

      expect(newState.homework).toHaveLength(0);
    });
  });

  describe('getOverdueHomework', () => {
    it('returns overdue homework items', () => {
      const overdueHw = createHomework({
        id: 'overdue-1',
        dueDate: new Date(Date.now() - 86400000), // Yesterday
      });
      const pendingHw = createHomework({
        id: 'pending-1',
        dueDate: new Date(Date.now() + 86400000), // Tomorrow
      });
      const completedHw = createHomework({
        id: 'completed-1',
        dueDate: new Date(Date.now() - 86400000), // Yesterday
        status: 'completed',
      });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [overdueHw, pendingHw, completedHw] };

      const overdue = getOverdueHomeworkFromArray(initialStateWithHW.homework);

      expect(overdue).toHaveLength(1);
      expect(overdue[0].id).toBe('overdue-1');
      expect(overdue[0].status).toBe('pending');
    });

    it('does not return completed homework even if past due', () => {
      const completedHw = createHomework({
        id: 'completed-1',
        dueDate: new Date(Date.now() - 86400000), // Yesterday
        status: 'completed',
      });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [completedHw] };

      const overdue = getOverdueHomeworkFromArray(initialStateWithHW.homework);

      expect(overdue).toHaveLength(0);
    });
  });

  describe('getHomeworkByDate', () => {
    it('returns homework due on a specific date', () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1); // Tomorrow
      const hwDueTomorrow = createHomework({
        id: 'hw-tomorrow',
        dueDate: targetDate,
      });
      const hwDueYesterday = createHomework({
        id: 'hw-yesterday',
        dueDate: new Date(Date.now() - 86400000),
      });
      const initialStateWithHW: TimetableState = { ...initialState, homework: [hwDueTomorrow, hwDueYesterday] };

      const byDate = getHomeworkByDateFromArray(initialStateWithHW.homework, targetDate);

      expect(byDate).toHaveLength(1);
      expect(byDate[0].id).toBe('hw-tomorrow');
    });
  });
});

describe('Homework completedAt tracking', () => {
  let initialState: TimetableState;

  beforeEach(() => {
    initialState = getInitialState();
  });

  it('stamps completedAt when adding homework already in a done state', () => {
    const homework = createHomework({ id: 'hw-done', status: 'completed' });
    const newState = timetableReducer(initialState, { type: 'ADD_HOMEWORK', payload: homework });
    expect(newState.homework[0].completedAt).toBeTruthy();
    expect(typeof newState.homework[0].completedAt).toBe('string');
  });

  it('leaves completedAt unset for pending homework', () => {
    const homework = createHomework({ id: 'hw-pending', status: 'pending' });
    const newState = timetableReducer(initialState, { type: 'ADD_HOMEWORK', payload: homework });
    expect(newState.homework[0].completedAt).toBeUndefined();
  });

  it('stamps completedAt when a pending item transitions to completed', () => {
    const homework = createHomework({ id: 'hw-1', status: 'pending' });
    const withHw = timetableReducer(initialState, { type: 'ADD_HOMEWORK', payload: homework });
    const updated = { ...homework, status: 'completed' as const };
    const newState = timetableReducer(withHw, {
      type: 'UPDATE_HOMEWORK',
      payload: { id: 'hw-1', item: updated },
    });
    expect(newState.homework[0].completedAt).toBeTruthy();
  });

  it('preserves the original completedAt across later updates of a done item', () => {
    const homework = createHomework({ id: 'hw-1', status: 'pending' });
    const withHw = timetableReducer(initialState, { type: 'ADD_HOMEWORK', payload: homework });
    const completed = timetableReducer(withHw, {
      type: 'UPDATE_HOMEWORK',
      payload: { id: 'hw-1', item: { ...homework, status: 'completed' as const } },
    });
    const stamped = completed.homework[0].completedAt!;

    const edited = timetableReducer(completed, {
      type: 'UPDATE_HOMEWORK',
      payload: {
        id: 'hw-1',
        item: { ...homework, status: 'completed' as const, title: 'Renamed' },
      },
    });
    expect(edited.homework[0].completedAt).toBe(stamped);
  });

  it('clears completedAt when an item goes back to pending', () => {
    const homework = createHomework({ id: 'hw-1', status: 'completed' });
    const withHw = timetableReducer(initialState, { type: 'ADD_HOMEWORK', payload: homework });
    expect(withHw.homework[0].completedAt).toBeTruthy();

    const reopened = timetableReducer(withHw, {
      type: 'UPDATE_HOMEWORK',
      payload: { id: 'hw-1', item: { ...homework, status: 'pending' as const } },
    });
    expect(reopened.homework[0].completedAt).toBeNull();
  });
});
