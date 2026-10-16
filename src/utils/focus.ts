import type { ActiveFocusTimer, FocusSession, FocusState } from '@/types';
import { generateId } from '@/types';

export const FOCUS_STORAGE_KEY = 'studyflow-focus';

export type FocusTimerStatus = 'idle' | 'running' | 'paused';

export type FocusOutcome = 'completed' | 'cancelled' | 'interrupted';

export function getTimerStatus(timer: ActiveFocusTimer | null): FocusTimerStatus {
  if (!timer) return 'idle';
  return timer.endAt !== null ? 'running' : 'paused';
}

export function getRemainingSeconds(timer: ActiveFocusTimer, now: Date): number {
  if (timer.endAt === null) {
    return Math.max(0, timer.pausedRemainingSec ?? 0);
  }
  return Math.max(0, Math.round((new Date(timer.endAt).getTime() - now.getTime()) / 1000));
}

export function getElapsedSeconds(timer: ActiveFocusTimer, now: Date): number {
  return Math.max(0, timer.plannedDurationSec - getRemainingSeconds(timer, now));
}

export function isTimerExpired(timer: ActiveFocusTimer, now: Date): boolean {
  return timer.endAt !== null && getRemainingSeconds(timer, now) <= 0;
}

export function createActiveTimer(opts: {
  plannedDurationSec: number;
  homeworkId?: string | null;
  homeworkTitle?: string | null;
  subjectName?: string | null;
  now: Date;
}): ActiveFocusTimer {
  const planned = Math.max(1, Math.floor(opts.plannedDurationSec));
  return {
    id: generateId(),
    startedAt: opts.now.toISOString(),
    endAt: new Date(opts.now.getTime() + planned * 1000).toISOString(),
    pausedRemainingSec: null,
    plannedDurationSec: planned,
    homeworkId: opts.homeworkId ?? null,
    homeworkTitle: opts.homeworkTitle ?? null,
    subjectName: opts.subjectName ?? null,
  };
}

export function pauseActiveTimer(timer: ActiveFocusTimer, now: Date): ActiveFocusTimer {
  if (timer.endAt === null) return timer;
  return {
    ...timer,
    endAt: null,
    pausedRemainingSec: getRemainingSeconds(timer, now),
  };
}

export function resumeActiveTimer(timer: ActiveFocusTimer, now: Date): ActiveFocusTimer {
  if (timer.endAt !== null) return timer;
  const remaining = Math.max(0, timer.pausedRemainingSec ?? 0);
  return {
    ...timer,
    endAt: new Date(now.getTime() + remaining * 1000).toISOString(),
    pausedRemainingSec: null,
  };
}

/**
 * Convert an active timer into a historical session record.
 *
 * - completed:   the countdown reached zero while StudyFlow was open and watching.
 * - cancelled:   the user reset or ended the session early on purpose.
 * - interrupted: StudyFlow could not verify completion (e.g. the app was closed
 *                and reopened after the scheduled end). Never reported as completed.
 */
export function finalizeActiveTimer(
  timer: ActiveFocusTimer,
  now: Date,
  outcome: FocusOutcome,
  note?: string,
): FocusSession {
  const remaining = getRemainingSeconds(timer, now);
  let actualDurationSec: number;
  let endedAtIso: string;

  if (outcome === 'completed') {
    actualDurationSec = timer.plannedDurationSec;
    endedAtIso = timer.endAt ?? now.toISOString();
  } else if (outcome === 'interrupted') {
    actualDurationSec = timer.plannedDurationSec - remaining;
    endedAtIso = now.toISOString();
  } else {
    actualDurationSec = timer.plannedDurationSec - remaining;
    endedAtIso = now.toISOString();
  }

  actualDurationSec = Math.max(0, Math.min(actualDurationSec, timer.plannedDurationSec));

  return {
    id: timer.id,
    startedAt: timer.startedAt,
    endedAt: endedAtIso,
    plannedDurationSec: timer.plannedDurationSec,
    actualDurationSec,
    status: outcome,
    homeworkId: timer.homeworkId,
    homeworkTitle: timer.homeworkTitle,
    subjectName: timer.subjectName,
    ...(note ? { note } : {}),
  };
}

/** Minimum elapsed time (seconds) before a user-cancelled session is worth recording. */
export const MIN_RECORDABLE_CANCEL_SEC = 1;

export function restoreFocusState(raw: unknown, now: Date): FocusState {
  if (!raw || typeof raw !== 'object') return { active: null, history: [] };
  const candidate = raw as Partial<FocusState>;
  const history = Array.isArray(candidate.history) ? candidate.history : [];
  const active = candidate.active ?? null;
  if (!active) return { active: null, history };

  if (active.endAt === null) {
    return { active, history };
  }
  if (new Date(active.endAt).getTime() > now.getTime()) {
    return { active, history };
  }
  const session = finalizeActiveTimer(
    active,
    now,
    'interrupted',
    'StudyFlow was closed before this session finished; completion could not be verified.',
  );
  return { active: null, history: [...history, session] };
}

export function parseFocusState(json: string | null, now: Date): FocusState {
  if (!json) return { active: null, history: [] };
  try {
    return restoreFocusState(JSON.parse(json), now);
  } catch {
    return { active: null, history: [] };
  }
}

export function focusStateToJSON(state: FocusState): string {
  return JSON.stringify(state);
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type AudioContextCtor = typeof AudioContext;

export function playCompletionChime(): void {
  try {
    const w = window as Window & { webkitAudioContext?: AudioContextCtor };
    const Ctx = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    window.setTimeout(() => {
      void ctx.close();
    }, 700);
  } catch {
    // Audio is best-effort only; never break the timer over it.
  }
}
