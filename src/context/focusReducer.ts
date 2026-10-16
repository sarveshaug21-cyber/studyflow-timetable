import type { FocusSession, FocusState } from '@/types';
import {
  FOCUS_STORAGE_KEY,
  MIN_RECORDABLE_CANCEL_SEC,
  createActiveTimer,
  finalizeActiveTimer,
  getElapsedSeconds,
  parseFocusState,
  pauseActiveTimer,
  resumeActiveTimer,
} from '@/utils/focus';

export type FocusAction =
  | {
      type: 'START';
      payload: {
        plannedDurationSec: number;
        homeworkId?: string | null;
        homeworkTitle?: string | null;
        subjectName?: string | null;
        now: Date;
      };
    }
  | { type: 'PAUSE'; payload: { now: Date } }
  | { type: 'RESUME'; payload: { now: Date } }
  | { type: 'RESET'; payload: { now: Date } }
  | { type: 'FINISH_EARLY'; payload: { now: Date } }
  | { type: 'COMPLETE'; payload: { now: Date } }
  | { type: 'DELETE_HISTORY_ITEM'; payload: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_STATE'; payload: FocusState };

export const EMPTY_FOCUS_STATE: FocusState = { active: null, history: [] };

function cancelActive(state: FocusState, now: Date, note: string): FocusState {
  const timer = state.active;
  if (!timer) return state;
  const elapsed = getElapsedSeconds(timer, now);
  if (elapsed < MIN_RECORDABLE_CANCEL_SEC) {
    return { ...state, active: null };
  }
  const session: FocusSession = finalizeActiveTimer(timer, now, 'cancelled', note);
  return { active: null, history: [...state.history, session] };
}

export function focusReducer(state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case 'START': {
      const { now, ...opts } = action.payload;
      const timer = createActiveTimer({ ...opts, now });
      return { ...state, active: timer };
    }

    case 'PAUSE': {
      if (!state.active || state.active.endAt === null) return state;
      return { ...state, active: pauseActiveTimer(state.active, action.payload.now) };
    }

    case 'RESUME': {
      if (!state.active || state.active.endAt !== null) return state;
      return { ...state, active: resumeActiveTimer(state.active, action.payload.now) };
    }

    case 'RESET': {
      return cancelActive(state, action.payload.now, 'Session reset by user.');
    }

    case 'FINISH_EARLY': {
      return cancelActive(state, action.payload.now, 'Session ended early by user.');
    }

    case 'COMPLETE': {
      const timer = state.active;
      if (!timer || timer.endAt === null) return state;
      const session: FocusSession = finalizeActiveTimer(timer, action.payload.now, 'completed');
      return { active: null, history: [...state.history, session] };
    }

    case 'DELETE_HISTORY_ITEM': {
      return {
        ...state,
        history: state.history.filter((s) => s.id !== action.payload),
      };
    }

    case 'CLEAR_HISTORY': {
      return { ...state, history: [] };
    }

    case 'LOAD_STATE': {
      return action.payload;
    }

    default:
      return state;
  }
}

export function getInitialFocusState(): FocusState {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(FOCUS_STORAGE_KEY);
    if (stored) {
      return parseFocusState(stored, new Date());
    }
  }
  return EMPTY_FOCUS_STATE;
}
