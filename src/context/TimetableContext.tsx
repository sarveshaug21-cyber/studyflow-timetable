import React, { createContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type {
  TimetableState,
  Subject,
  Session,
  HomeworkItem,
  DayOfWeek,
  TimeIncrement,
  ViewMode,
} from '@/types';
import { generateId, getWeekStart } from '@/types';
import {
  STORAGE_KEY,
  homeworkItemsToJSON,
  readStoredTimetable,
  timetableStateToJSON,
} from '@/context/timetableStorage';
import { createSampleTimetable, createEmptyTimetable } from '@/data/sampleData';

export type TimeRange = {
  start: string;
  end: string;
};

export type Action =
  | { type: 'SET_STATE'; payload: TimetableState }
  | { type: 'SET_VIEW'; payload: ViewMode }
  | { type: 'SET_TIME_INCREMENT'; payload: TimeIncrement }
  | { type: 'SET_SHOW_WEEKENDS'; payload: boolean }
  | { type: 'SET_TIME_RANGE'; payload: TimeRange }
  | { type: 'SET_CURRENT_WEEK'; payload: string }
  | { type: 'NEXT_WEEK' }
  | { type: 'PREV_WEEK' }
  | { type: 'ADD_SUBJECT'; payload: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_SUBJECT'; payload: Subject }
  | { type: 'DELETE_SUBJECT'; payload: string }
  | { type: 'ADD_SESSION'; payload: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_SESSION'; payload: Session }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'ADD_HOMEWORK'; payload: HomeworkItem }
  | { type: 'UPDATE_HOMEWORK'; payload: { id: string; item: HomeworkItem } }
  | { type: 'REMOVE_HOMEWORK'; payload: string }
  | { type: 'CLEAR_HOMEWORK' }
  | { type: 'LOAD_FROM_STORAGE' };

function isDoneStatus(status: HomeworkItem['status']): boolean {
  return status === 'completed' || status === 'submitted';
}

/** Stamp / clear completedAt when a homework item's done-state changes. */
function withCompletedAt(
  item: HomeworkItem,
  prev: HomeworkItem | undefined,
): HomeworkItem {
  const wasDone = prev ? isDoneStatus(prev.status) : false;
  const isDone = isDoneStatus(item.status);
  if (isDone) {
    if (item.completedAt) return item;
    return { ...item, completedAt: prev?.completedAt ?? new Date().toISOString() };
  }
  if (wasDone || item.completedAt) {
    return { ...item, completedAt: null };
  }
  return item;
}

export function getOverdueHomeworkFromArray(homework: HomeworkItem[]): HomeworkItem[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return homework.filter((item) => {
    const itemDate = new Date(item.dueDate);
    itemDate.setHours(0, 0, 0, 0);
    return item.status !== 'completed' && item.status !== 'submitted' && itemDate.getTime() < now.getTime();
  });
}

export function getHomeworkByDateFromArray(homework: HomeworkItem[], date: Date): HomeworkItem[] {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  return homework.filter((item) => {
    const itemDate = new Date(item.dueDate);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate.getTime() === targetDate.getTime();
  });
}

export function getInitialState(): TimetableState {
  return readStoredTimetable() ?? createEmptyTimetable();
}

export function timetableReducer(state: TimetableState, action: Action): TimetableState {
  let newState: TimetableState;

  switch (action.type) {
    case 'SET_STATE':
      newState = action.payload;
      break;

    case 'SET_VIEW':
      newState = { ...state, view: action.payload };
      break;

    case 'SET_TIME_INCREMENT':
      newState = { ...state, timeIncrement: action.payload };
      break;

    case 'SET_SHOW_WEEKENDS':
      newState = { ...state, showWeekends: action.payload };
      break;

    case 'SET_TIME_RANGE':
      newState = { ...state, timeRange: action.payload };
      break;

    case 'SET_CURRENT_WEEK':
      newState = { ...state, currentWeekStart: action.payload };
      break;

    case 'NEXT_WEEK': {
      const current = new Date(state.currentWeekStart);
      current.setDate(current.getDate() + 7);
      newState = { ...state, currentWeekStart: current.toISOString() };
      break;
    }

    case 'PREV_WEEK': {
      const current = new Date(state.currentWeekStart);
      current.setDate(current.getDate() - 7);
      newState = { ...state, currentWeekStart: current.toISOString() };
      break;
    }

    case 'ADD_SUBJECT': {
      const now = new Date().toISOString();
      const newSubject: Subject = {
        ...action.payload,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      newState = { ...state, subjects: [...(state.subjects ?? []), newSubject] };
      break;
    }

    case 'UPDATE_SUBJECT': {
      newState = {
        ...state,
        subjects: (state.subjects ?? []).map((s) =>
          s.id === action.payload.id ? { ...action.payload, updatedAt: new Date().toISOString() } : s,
        ),
      };
      break;
    }

    case 'DELETE_SUBJECT': {
      newState = {
        ...state,
        subjects: (state.subjects ?? []).filter((s) => s.id !== action.payload),
        sessions: (state.sessions ?? []).filter((s) => s.subjectId !== action.payload),
      };
      break;
    }

    case 'ADD_SESSION': {
      const now = new Date().toISOString();
      const newSession: Session = {
        ...action.payload,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      newState = { ...state, sessions: [...(state.sessions ?? []), newSession] };
      break;
    }

    case 'UPDATE_SESSION': {
      newState = {
        ...state,
        sessions: (state.sessions ?? []).map((s) =>
          s.id === action.payload.id ? { ...action.payload, updatedAt: new Date().toISOString() } : s,
        ),
      };
      break;
    }

    case 'DELETE_SESSION': {
      newState = {
        ...state,
        sessions: (state.sessions ?? []).filter((s) => s.id !== action.payload),
      };
      break;
    }

    case 'ADD_HOMEWORK': {
      newState = {
        ...state,
        homework: [...state.homework, withCompletedAt(action.payload, undefined)],
      };
      break;
    }

    case 'UPDATE_HOMEWORK': {
      // Support both payload formats: { id: string; item: HomeworkItem } or HomeworkItem directly
      const payload = action.payload as HomeworkItem | { id: string; item: HomeworkItem };
      const isWrapped = 'item' in payload;
      const homeworkId = isWrapped ? payload.id : payload.id;
      const homeworkItem = isWrapped ? payload.item : payload;
      const prev = state.homework.find((item) => item.id === homeworkId);
      newState = {
        ...state,
        homework: state.homework.map((item) =>
          item.id === homeworkId ? withCompletedAt(homeworkItem, prev) : item,
        ),
      };
      break;
    }

    case 'REMOVE_HOMEWORK': {
      newState = {
        ...state,
        homework: state.homework.filter((item) => item.id !== action.payload),
      };
      break;
    }

    case 'CLEAR_HOMEWORK': {
      newState = {
        ...state,
        homework: [],
      };
      break;
    }

    case 'LOAD_FROM_STORAGE': {
      // Same reader as the initial load, so both paths agree on what "valid"
      // means and on how legacy records are revived. Nothing is normalised away
      // here beyond what `readStoredTimetable` already does.
      const loaded = readStoredTimetable();
      // No (recognisable) stored data: fall back to empty. The in-memory
      // homework is dropped only because there is genuinely nothing stored to
      // restore from — this is an explicit user-triggered reload.
      newState = loaded ?? createEmptyTimetable();
      break;
    }

    default:
      newState = state;
  }

  return newState;
}

interface TimetableContextType {
  state: TimetableState;
  dispatch: React.Dispatch<Action>;
  subjects: Subject[];
  sessions: Session[];
  homework: HomeworkItem[];
  getSessionsForDay: (day: DayOfWeek) => Session[];
  getSubject: (id: string) => Subject | undefined;
  getHomework: () => HomeworkItem[];
  getHomeworkByDate: (date: Date) => HomeworkItem[];
  getOverdueHomework: () => HomeworkItem[];
  addHomework: (item: Omit<HomeworkItem, 'id'>) => void;
  updateHomework: (item: HomeworkItem) => void;
  removeHomework: (id: string) => void;
  clearHomework: () => void;
  addSubject: (subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSubject: (subject: Subject) => void;
  deleteSubject: (id: string) => void;
  addSession: (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSession: (session: Session) => void;
  deleteSession: (id: string) => void;
  setView: (view: ViewMode) => void;
  setTimeIncrement: (increment: TimeIncrement) => void;
  setShowWeekends: (show: boolean) => void;
  setTimeRange: (range: TimeRange) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  goToWeek: (date: Date) => void;
  loadSampleData: () => void;
  clearAllData: () => void;
}

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

function TimetableProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(timetableReducer, undefined, getInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, timetableStateToJSON(state));
    } catch {
      // Quota exceeded or storage disabled. Leaving the previous stored value
      // intact is strictly safer than clearing it.
    }
  }, [state]);

  const subjects = state.subjects;
  const sessions = state.sessions;
  const homework = state.homework;

  const getSessionsForDay = useCallback((day: DayOfWeek) => {
    return (sessions ?? [])
      .filter((s) => s.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions]);

  const getSubject = useCallback((id: string) => {
    return (subjects ?? []).find((s) => s.id === id);
  }, [subjects]);

  const getHomework = useCallback((): HomeworkItem[] => {
    return homework;
  }, [homework]);

  const getHomeworkByDate = useCallback(
    (date: Date): HomeworkItem[] => {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      return homework.filter((item) => {
        const itemDate = new Date(item.dueDate);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate.getTime() === targetDate.getTime();
      });
    },
    [homework],
  );

  const getOverdueHomework = useCallback((): HomeworkItem[] => {
    return getOverdueHomeworkFromArray(homework);
  }, [homework]);

  const addHomework = useCallback(
    (item: Omit<HomeworkItem, 'id'>) => {
      dispatch({ type: 'ADD_HOMEWORK', payload: { ...item, id: generateId() } });
    },
    [],
  );

  const updateHomework = useCallback(
    (item: HomeworkItem) => {
      dispatch({ type: 'UPDATE_HOMEWORK', payload: { id: item.id, item } });
    },
    [],
  );

  const removeHomework = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_HOMEWORK', payload: id });
  }, []);

  const clearHomework = useCallback(() => {
    dispatch({ type: 'CLEAR_HOMEWORK' });
  }, []);

  const addSubject = useCallback(
    (subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_SUBJECT', payload: subject });
    },
    [],
  );

  const updateSubject = useCallback(
    (subject: Subject) => {
      dispatch({ type: 'UPDATE_SUBJECT', payload: subject });
    },
    [],
  );

  const deleteSubject = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SUBJECT', payload: id });
  }, []);

  const addSession = useCallback(
    (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_SESSION', payload: session });
    },
    [],
  );

  const updateSession = useCallback(
    (session: Session) => {
      dispatch({ type: 'UPDATE_SESSION', payload: session });
    },
    [],
  );

  const deleteSession = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SESSION', payload: id });
  }, []);

  const setView = useCallback((view: ViewMode) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }, []);

  const setTimeIncrement = useCallback((increment: TimeIncrement) => {
    dispatch({ type: 'SET_TIME_INCREMENT', payload: increment });
  }, []);

  const setShowWeekends = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_WEEKENDS', payload: show });
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    dispatch({ type: 'SET_TIME_RANGE', payload: range });
  }, []);

  const nextWeek = useCallback(() => {
    dispatch({ type: 'NEXT_WEEK' });
  }, []);

  const prevWeek = useCallback(() => {
    dispatch({ type: 'PREV_WEEK' });
  }, []);

  const goToWeek = useCallback((date: Date) => {
    const weekStart = getWeekStart(date);
    dispatch({ type: 'SET_CURRENT_WEEK', payload: weekStart.toISOString() });
  }, []);

  const loadSampleData = useCallback(() => {
    const sample = createSampleTimetable();
    dispatch({ type: 'SET_STATE', payload: sample });
  }, []);

  const clearAllData = useCallback(() => {
    const empty = createEmptyTimetable();
    dispatch({ type: 'SET_STATE', payload: empty });
  }, []);

  const value = useMemo(() => ({
    state,
    dispatch,
    subjects,
    sessions,
    homework,
    getSessionsForDay,
    getSubject,
    getHomework,
    getHomeworkByDate,
    getOverdueHomework,
    addHomework,
    updateHomework,
    removeHomework,
    clearHomework,
    addSubject,
    updateSubject,
    deleteSubject,
    addSession,
    updateSession,
    deleteSession,
    setView,
    setTimeIncrement,
    setShowWeekends,
    setTimeRange,
    nextWeek,
    prevWeek,
    goToWeek,
    loadSampleData,
    clearAllData,
  }), [
    state,
    subjects,
    sessions,
    homework,
    getSessionsForDay,
    getSubject,
    getHomework,
    getHomeworkByDate,
    getOverdueHomework,
    addHomework,
    updateHomework,
    removeHomework,
    clearHomework,
    addSubject,
    updateSubject,
    deleteSubject,
    addSession,
    updateSession,
    deleteSession,
    setView,
    setTimeIncrement,
    setShowWeekends,
    setTimeRange,
    nextWeek,
    prevWeek,
    goToWeek,
    loadSampleData,
    clearAllData,
  ]);

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
}

export { TimetableContext, TimetableProvider, homeworkItemsToJSON };