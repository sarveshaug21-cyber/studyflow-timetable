import { describe, it, expect } from 'vitest';
import type { ActiveFocusTimer } from '@/types';
import {
  createActiveTimer,
  pauseActiveTimer,
  resumeActiveTimer,
  finalizeActiveTimer,
  getRemainingSeconds,
  getElapsedSeconds,
  isTimerExpired,
  getTimerStatus,
  restoreFocusState,
  parseFocusState,
  formatClock,
  formatMinutes,
  MIN_RECORDABLE_CANCEL_SEC,
} from '@/utils/focus';

const T0 = new Date('2026-10-15T10:00:00.000Z');

function makeTimer(overrides: Partial<ActiveFocusTimer> = {}): ActiveFocusTimer {
  return {
    id: 'timer-1',
    startedAt: T0.toISOString(),
    endAt: new Date(T0.getTime() + 25 * 60 * 1000).toISOString(),
    pausedRemainingSec: null,
    plannedDurationSec: 25 * 60,
    homeworkId: null,
    homeworkTitle: null,
    subjectName: null,
    ...overrides,
  };
}

function secondsAfter(base: Date, sec: number): Date {
  return new Date(base.getTime() + sec * 1000);
}

describe('focus timer utils', () => {
  describe('createActiveTimer', () => {
    it('sets endAt to now + planned duration', () => {
      const timer = createActiveTimer({ plannedDurationSec: 1500, now: T0 });
      expect(timer.endAt).toBe(new Date(T0.getTime() + 1500 * 1000).toISOString());
      expect(timer.startedAt).toBe(T0.toISOString());
      expect(timer.pausedRemainingSec).toBeNull();
      expect(timer.plannedDurationSec).toBe(1500);
    });

    it('carries homework link fields', () => {
      const timer = createActiveTimer({
        plannedDurationSec: 60,
        homeworkId: 'hw-1',
        homeworkTitle: 'Essay',
        subjectName: 'English',
        now: T0,
      });
      expect(timer.homeworkId).toBe('hw-1');
      expect(timer.homeworkTitle).toBe('Essay');
      expect(timer.subjectName).toBe('English');
    });

    it('clamps duration to at least 1 second', () => {
      const timer = createActiveTimer({ plannedDurationSec: 0, now: T0 });
      expect(timer.plannedDurationSec).toBe(1);
    });
  });

  describe('getRemainingSeconds / getElapsedSeconds', () => {
    it('computes remaining from end timestamp for a running timer', () => {
      const timer = makeTimer();
      expect(getRemainingSeconds(timer, secondsAfter(T0, 600))).toBe(900);
      expect(getElapsedSeconds(timer, secondsAfter(T0, 600))).toBe(600);
    });

    it('clamps remaining at zero after end time', () => {
      const timer = makeTimer();
      expect(getRemainingSeconds(timer, secondsAfter(T0, 2000))).toBe(0);
      expect(getElapsedSeconds(timer, secondsAfter(T0, 2000))).toBe(1500);
    });

    it('uses frozen pausedRemainingSec when paused', () => {
      const timer = makeTimer({ endAt: null, pausedRemainingSec: 420 });
      expect(getRemainingSeconds(timer, secondsAfter(T0, 9999))).toBe(420);
      expect(getElapsedSeconds(timer, secondsAfter(T0, 9999))).toBe(1500 - 420);
    });
  });

  describe('pause / resume', () => {
    it('pause freezes remaining time and clears endAt', () => {
      const timer = makeTimer();
      const paused = pauseActiveTimer(timer, secondsAfter(T0, 600));
      expect(paused.endAt).toBeNull();
      expect(paused.pausedRemainingSec).toBe(900);
      expect(getTimerStatus(paused)).toBe('paused');
    });

    it('resume restarts from the frozen remaining time', () => {
      const timer = makeTimer();
      const paused = pauseActiveTimer(timer, secondsAfter(T0, 600));
      const resumed = resumeActiveTimer(paused, secondsAfter(T0, 3600));
      expect(resumed.endAt).toBe(secondsAfter(T0, 3600 + 900).toISOString());
      expect(resumed.pausedRemainingSec).toBeNull();
      expect(getTimerStatus(resumed)).toBe('running');
    });

    it('paused time does not count as focus time', () => {
      const timer = makeTimer();
      const paused = pauseActiveTimer(timer, secondsAfter(T0, 600));
      const resumed = resumeActiveTimer(paused, secondsAfter(T0, 7200));
      // 2 hours of pause wall-clock must not inflate elapsed
      expect(getElapsedSeconds(resumed, secondsAfter(T0, 7200))).toBe(600);
    });

    it('pausing an already-paused timer is a no-op', () => {
      const paused = pauseActiveTimer(makeTimer(), secondsAfter(T0, 100));
      const again = pauseActiveTimer(paused, secondsAfter(T0, 500));
      expect(again).toBe(paused);
    });

    it('resuming a running timer is a no-op', () => {
      const timer = makeTimer();
      expect(resumeActiveTimer(timer, secondsAfter(T0, 10))).toBe(timer);
    });
  });

  describe('isTimerExpired', () => {
    it('is false before end and true at/after end', () => {
      const timer = makeTimer();
      expect(isTimerExpired(timer, secondsAfter(T0, 1499))).toBe(false);
      expect(isTimerExpired(timer, secondsAfter(T0, 1500))).toBe(true);
      expect(isTimerExpired(timer, secondsAfter(T0, 1501))).toBe(true);
    });

    it('is never true for a paused timer', () => {
      const paused = makeTimer({ endAt: null, pausedRemainingSec: 0 });
      expect(isTimerExpired(paused, secondsAfter(T0, 9999))).toBe(false);
    });
  });

  describe('finalizeActiveTimer', () => {
    it('completed records the full planned duration and uses scheduled end as endedAt', () => {
      const timer = makeTimer();
      const session = finalizeActiveTimer(timer, secondsAfter(T0, 1500), 'completed');
      expect(session.status).toBe('completed');
      expect(session.actualDurationSec).toBe(1500);
      expect(session.endedAt).toBe(timer.endAt);
      expect(session.plannedDurationSec).toBe(1500);
    });

    it('cancelled mid-way records only actually-elapsed time', () => {
      const timer = makeTimer();
      const session = finalizeActiveTimer(timer, secondsAfter(T0, 600), 'cancelled', 'Session reset by user.');
      expect(session.status).toBe('cancelled');
      expect(session.actualDurationSec).toBe(600);
      expect(session.note).toBe('Session reset by user.');
    });

    it('interrupted after end across a reload records wall-clock but stays interrupted', () => {
      const timer = makeTimer();
      const session = finalizeActiveTimer(
        timer,
        secondsAfter(T0, 9999),
        'interrupted',
        'could not be verified',
      );
      expect(session.status).toBe('interrupted');
      expect(session.actualDurationSec).toBe(1500);
      expect(session.status).not.toBe('completed');
    });

    it('preserves homework link metadata on the session', () => {
      const timer = makeTimer({ homeworkId: 'hw-9', homeworkTitle: 'Lab report', subjectName: 'Physics' });
      const session = finalizeActiveTimer(timer, secondsAfter(T0, 1500), 'completed');
      expect(session.homeworkId).toBe('hw-9');
      expect(session.homeworkTitle).toBe('Lab report');
      expect(session.subjectName).toBe('Physics');
      expect(session.id).toBe('timer-1');
    });
  });

  describe('restoreFocusState', () => {
    it('returns empty state for null / invalid input', () => {
      const now = T0;
      expect(restoreFocusState(null, now)).toEqual({ active: null, history: [] });
      expect(restoreFocusState(undefined, now)).toEqual({ active: null, history: [] });
      expect(parseFocusState(null, now)).toEqual({ active: null, history: [] });
      expect(parseFocusState('not-json{{{', now)).toEqual({ active: null, history: [] });
    });

    it('keeps a paused timer paused', () => {
      const paused = { ...makeTimer({ endAt: null, pausedRemainingSec: 300 }) };
      const restored = restoreFocusState({ active: paused, history: [] }, secondsAfter(T0, 86400));
      expect(restored.active?.pausedRemainingSec).toBe(300);
      expect(restored.history).toHaveLength(0);
    });

    it('keeps a still-running timer running (timestamps remain accurate)', () => {
      const timer = makeTimer();
      const restored = restoreFocusState({ active: timer, history: [] }, secondsAfter(T0, 300));
      expect(restored.active?.endAt).toBe(timer.endAt);
      expect(getRemainingSeconds(restored.active!, secondsAfter(T0, 300))).toBe(1200);
      expect(restored.history).toHaveLength(0);
    });

    it('marks a timer that expired while the app was closed as interrupted, never completed', () => {
      const timer = makeTimer();
      const restored = restoreFocusState({ active: timer, history: [] }, secondsAfter(T0, 99999));
      expect(restored.active).toBeNull();
      expect(restored.history).toHaveLength(1);
      expect(restored.history[0].status).toBe('interrupted');
      expect(restored.history[0].note).toMatch(/could not be verified/i);
    });

    it('preserves existing history through restore', () => {
      const existing = finalizeActiveTimer(makeTimer({ id: 'old-1' }), secondsAfter(T0, 1500), 'completed');
      const restored = restoreFocusState(
        { active: null, history: [existing] },
        secondsAfter(T0, 2000),
      );
      expect(restored.history).toHaveLength(1);
      expect(restored.history[0].id).toBe('old-1');
    });
  });

  describe('formatClock / formatMinutes', () => {
    it('formats MM:SS under an hour', () => {
      expect(formatClock(0)).toBe('00:00');
      expect(formatClock(59)).toBe('00:59');
      expect(formatClock(600)).toBe('10:00');
      expect(formatClock(1500)).toBe('25:00');
    });

    it('formats H:MM:SS for durations of an hour or more', () => {
      expect(formatClock(3600)).toBe('1:00:00');
      expect(formatClock(3661)).toBe('1:01:01');
    });

    it('clamps negatives to zero', () => {
      expect(formatClock(-5)).toBe('00:00');
    });

    it('formatMinutes renders compact human durations', () => {
      expect(formatMinutes(0)).toBe('0m');
      expect(formatMinutes(90)).toBe('2m');
      expect(formatMinutes(3600)).toBe('1h');
      expect(formatMinutes(5400)).toBe('1h 30m');
    });
  });

  describe('MIN_RECORDABLE_CANCEL_SEC', () => {
    it('is at least 1 second', () => {
      expect(MIN_RECORDABLE_CANCEL_SEC).toBeGreaterThanOrEqual(1);
    });
  });
});
