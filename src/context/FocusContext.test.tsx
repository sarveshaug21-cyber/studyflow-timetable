import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  focusReducer,
  getInitialFocusState,
  type FocusAction,
} from '@/context/focusReducer';
import type { FocusState, ActiveFocusTimer } from '@/types';
import { FOCUS_STORAGE_KEY } from '@/utils/focus';

const T0 = new Date('2026-10-15T09:00:00.000Z');

function at(base: Date, sec: number): Date {
  return new Date(base.getTime() + sec * 1000);
}

function startState(now: Date, plannedSec = 1500): FocusState {
  return focusReducer({ active: null, history: [] }, {
    type: 'START',
    payload: { plannedDurationSec: plannedSec, now },
  });
}

// localStorage mock that actually stores values (the shared setup mock is vi.fn-only)
function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const mock = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn((k: string) => void store.delete(k)),
    clear: vi.fn(() => store.clear()),
  };
  Object.defineProperty(window, 'localStorage', { value: mock, writable: true });
  return { store, mock };
}

describe('focusReducer', () => {
  let state: FocusState;

  beforeEach(() => {
    state = { active: null, history: [] };
  });

  it('START creates a running timer with endAt = now + planned', () => {
    const next = focusReducer(state, {
      type: 'START',
      payload: { plannedDurationSec: 1500, now: T0 },
    });
    expect(next.active).not.toBeNull();
    expect(next.active!.endAt).toBe(at(T0, 1500).toISOString());
    expect(next.active!.plannedDurationSec).toBe(1500);
    expect(next.history).toHaveLength(0);
  });

  it('PAUSE freezes the timer; RESUME restarts from frozen remaining', () => {
    let s = startState(T0);
    s = focusReducer(s, { type: 'PAUSE', payload: { now: at(T0, 600) } });
    expect(s.active!.endAt).toBeNull();
    expect(s.active!.pausedRemainingSec).toBe(900);

    s = focusReducer(s, { type: 'RESUME', payload: { now: at(T0, 4200) } });
    expect(s.active!.endAt).toBe(at(T0, 4200 + 900).toISOString());
  });

  it('PAUSE when idle or already paused is a no-op', () => {
    expect(focusReducer(state, { type: 'PAUSE', payload: { now: T0 } })).toBe(state);
    const paused = focusReducer(startState(T0), { type: 'PAUSE', payload: { now: at(T0, 100) } });
    expect(focusReducer(paused, { type: 'PAUSE', payload: { now: at(T0, 200) } })).toBe(paused);
  });

  it('RESET with zero elapsed discards the session without recording history', () => {
    let s = startState(T0);
    s = focusReducer(s, { type: 'RESET', payload: { now: at(T0, 0) } });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(0);
  });

  it('RESET mid-session records a cancelled session (never completed)', () => {
    let s = startState(T0);
    s = focusReducer(s, { type: 'RESET', payload: { now: at(T0, 600) } });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].status).toBe('cancelled');
    expect(s.history[0].actualDurationSec).toBe(600);
  });

  it('FINISH_EARLY mid-session records cancelled with an explanatory note', () => {
    let s = focusStateWithLink(T0);
    s = focusReducer(s, { type: 'FINISH_EARLY', payload: { now: at(T0, 300) } });
    expect(s.history).toHaveLength(1);
    expect(s.history[0].status).toBe('cancelled');
    expect(s.history[0].actualDurationSec).toBe(300);
    expect(s.history[0].note).toMatch(/ended early/i);
  });

  it('COMPLETE records a completed session with the full planned duration', () => {
    let s = startState(T0);
    s = focusReducer(s, { type: 'COMPLETE', payload: { now: at(T0, 1500) } });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].status).toBe('completed');
    expect(s.history[0].actualDurationSec).toBe(1500);
  });

  it('COMPLETE is a no-op when no timer is running', () => {
    expect(focusReducer(state, { type: 'COMPLETE', payload: { now: T0 } })).toBe(state);
  });

  it('COMPLETE is a no-op for a paused timer (paused is not running to completion)', () => {
    const paused = focusReducer(startState(T0), { type: 'PAUSE', payload: { now: at(T0, 100) } });
    expect(focusReducer(paused, { type: 'COMPLETE', payload: { now: at(T0, 2000) } })).toBe(paused);
  });

  it('DELETE_HISTORY_ITEM removes only the matching session', () => {
    let s = startState(T0);
    s = focusReducer(s, { type: 'COMPLETE', payload: { now: at(T0, 1500) } });
    s = focusReducer(s, {
      type: 'START',
      payload: { plannedDurationSec: 600, now: at(T0, 1600) },
    });
    s = focusReducer(s, { type: 'COMPLETE', payload: { now: at(T0, 2200) } });
    expect(s.history).toHaveLength(2);

    s = focusReducer(s, { type: 'DELETE_HISTORY_ITEM', payload: s.history[0].id });
    expect(s.history).toHaveLength(1);
    expect(s.history[0].id).toBe(s.history[1]?.id ?? s.history[0].id);
  });

  it('CLEAR_HISTORY empties history but keeps an active timer untouched', () => {
    let s = startState(T0);
    s = focusReducer(s, { type: 'COMPLETE', payload: { now: at(T0, 1500) } });
    s = focusReducer(s, {
      type: 'START',
      payload: { plannedDurationSec: 600, now: at(T0, 1600) },
    });
    s = focusReducer(s, { type: 'CLEAR_HISTORY' });
    expect(s.history).toHaveLength(0);
    expect(s.active).not.toBeNull();
  });

  it('LOAD_STATE replaces the whole state', () => {
    const loaded: FocusState = { active: null, history: [] };
    const action: FocusAction = { type: 'LOAD_STATE', payload: loaded };
    expect(focusReducer(state, action)).toBe(loaded);
  });
});

function focusStateWithLink(now: Date): FocusState {
  return focusReducer({ active: null, history: [] }, {
    type: 'START',
    payload: {
      plannedDurationSec: 1500,
      homeworkId: 'hw-1',
      homeworkTitle: 'Maths Worksheet',
      subjectName: 'Mathematics',
      now,
    },
  });
}

describe('getInitialFocusState', () => {
  it('returns empty state when nothing is stored', () => {
    installStorage();
    expect(getInitialFocusState()).toEqual({ active: null, history: [] });
  });

  it('restores a still-valid running timer from storage', () => {
    const active: ActiveFocusTimer = {
      id: 't-live',
      startedAt: T0.toISOString(),
      endAt: at(T0, 1500).toISOString(),
      pausedRemainingSec: null,
      plannedDurationSec: 1500,
      homeworkId: null,
      homeworkTitle: null,
      subjectName: null,
    };
    installStorage({
      [FOCUS_STORAGE_KEY]: JSON.stringify({ active, history: [] }),
    });
    vi.useFakeTimers();
    vi.setSystemTime(at(T0, 100)); // 100s in — timer still has 1400s to go
    const restored = getInitialFocusState();
    vi.useRealTimers();
    expect(restored.active?.id).toBe('t-live');
    expect(restored.history).toHaveLength(0);
  });

  it('converts a timer that expired while closed into an interrupted session', () => {
    const active: ActiveFocusTimer = {
      id: 't-dead',
      startedAt: T0.toISOString(),
      endAt: at(T0, 1500).toISOString(),
      pausedRemainingSec: null,
      plannedDurationSec: 1500,
      homeworkId: 'hw-2',
      homeworkTitle: 'History essay',
      subjectName: 'History',
    };
    installStorage({
      [FOCUS_STORAGE_KEY]: JSON.stringify({ active, history: [] }),
    });
    vi.useFakeTimers();
    vi.setSystemTime(at(T0, 99999)); // reopened hours later
    const restored = getInitialFocusState();
    vi.useRealTimers();
    expect(restored.active).toBeNull();
    expect(restored.history).toHaveLength(1);
    expect(restored.history[0].status).toBe('interrupted');
    expect(restored.history[0].id).toBe('t-dead');
  });

  it('does not throw on corrupt stored JSON', () => {
    installStorage({ [FOCUS_STORAGE_KEY]: '{broken json' });
    expect(getInitialFocusState()).toEqual({ active: null, history: [] });
  });
});
