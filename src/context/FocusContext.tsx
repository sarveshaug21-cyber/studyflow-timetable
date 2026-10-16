import React, { createContext, useCallback, useEffect, useMemo, useReducer } from 'react';
import type { ActiveFocusTimer, FocusSession, FocusState } from '@/types';
import {
  FOCUS_STORAGE_KEY,
  focusStateToJSON,
  getRemainingSeconds,
} from '@/utils/focus';
import { focusReducer, getInitialFocusState } from './focusReducer';

interface FocusContextType {
  state: FocusState;
  active: ActiveFocusTimer | null;
  history: FocusSession[];
  status: 'idle' | 'running' | 'paused';
  startFocus: (opts: {
    durationMinutes: number;
    homeworkId?: string | null;
    homeworkTitle?: string | null;
    subjectName?: string | null;
  }) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  resetFocus: () => void;
  finishFocus: () => void;
  completeFocus: () => void;
  deleteFocusSession: (id: string) => void;
  clearFocusHistory: () => void;
  getRemaining: (now?: Date) => number;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(focusReducer, undefined, getInitialFocusState);

  useEffect(() => {
    localStorage.setItem(FOCUS_STORAGE_KEY, focusStateToJSON(state));
  }, [state]);

  const startFocus = useCallback(
    (opts: {
      durationMinutes: number;
      homeworkId?: string | null;
      homeworkTitle?: string | null;
      subjectName?: string | null;
    }) => {
      dispatch({
        type: 'START',
        payload: {
          plannedDurationSec: Math.max(1, Math.round(opts.durationMinutes * 60)),
          homeworkId: opts.homeworkId ?? null,
          homeworkTitle: opts.homeworkTitle ?? null,
          subjectName: opts.subjectName ?? null,
          now: new Date(),
        },
      });
    },
    [],
  );

  const pauseFocus = useCallback(() => dispatch({ type: 'PAUSE', payload: { now: new Date() } }), []);
  const resumeFocus = useCallback(() => dispatch({ type: 'RESUME', payload: { now: new Date() } }), []);
  const resetFocus = useCallback(() => dispatch({ type: 'RESET', payload: { now: new Date() } }), []);
  const finishFocus = useCallback(() => dispatch({ type: 'FINISH_EARLY', payload: { now: new Date() } }), []);
  const completeFocus = useCallback(() => dispatch({ type: 'COMPLETE', payload: { now: new Date() } }), []);

  const deleteFocusSession = useCallback((id: string) => {
    dispatch({ type: 'DELETE_HISTORY_ITEM', payload: id });
  }, []);

  const clearFocusHistory = useCallback(() => dispatch({ type: 'CLEAR_HISTORY' }), []);

  const getRemaining = useCallback(
    (now: Date = new Date()) => (state.active ? getRemainingSeconds(state.active, now) : 0),
    [state.active],
  );

  const status: FocusContextType['status'] = state.active
    ? state.active.endAt !== null
      ? 'running'
      : 'paused'
    : 'idle';

  const value = useMemo(
    () => ({
      state,
      active: state.active,
      history: state.history,
      status,
      startFocus,
      pauseFocus,
      resumeFocus,
      resetFocus,
      finishFocus,
      completeFocus,
      deleteFocusSession,
      clearFocusHistory,
      getRemaining,
    }),
    [
      state,
      status,
      startFocus,
      pauseFocus,
      resumeFocus,
      resetFocus,
      finishFocus,
      completeFocus,
      deleteFocusSession,
      clearFocusHistory,
      getRemaining,
    ],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export { FocusContext, FocusProvider };
