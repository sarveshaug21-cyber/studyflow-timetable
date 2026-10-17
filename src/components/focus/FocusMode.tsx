import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useFocus } from '@/hooks/useFocus';
import { useSettings } from '@/hooks/useSettings';
import { useTimetable } from '@/hooks/useTimetable';
import {
  formatClock,
  getElapsedSeconds,
  getRemainingSeconds,
  isTimerExpired,
  playCompletionChime,
} from '@/utils/focus';
import type { FocusSessionStatus } from '@/types';
import { cn } from '@/utils/cn';

const DURATION_PRESETS_MIN = [5, 15, 25, 45, 60];

const STATUS_META: Record<
  FocusSessionStatus,
  { label: string; className: string }
> = {
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  },
  interrupted: {
    label: 'Interrupted',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
};

function ProgressRing({ progress }: { progress: number }) {
  const clamped = Math.min(1, Math.max(0, progress));
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className="h-48 w-48" aria-hidden="true">
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        strokeWidth="8"
        className="stroke-neutral-200 dark:stroke-neutral-800"
      />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        stroke="currentColor"
        className="text-brand-600 transition-[stroke-dashoffset] duration-300"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        transform="rotate(-90 64 64)"
      />
    </svg>
  );
}

export function FocusMode() {
  const {
    active,
    history,
    status,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetFocus,
    finishFocus,
    completeFocus,
    deleteFocusSession,
    clearFocusHistory,
  } = useFocus();
  const { settings, updateSettings } = useSettings();
  const { homework } = useTimetable();
  const { toast } = useToast();

  const [now, setNow] = useState(() => new Date());
  const [durationMin, setDurationMin] = useState(() => settings.focusDuration);
  const [linkedHomeworkId, setLinkedHomeworkId] = useState<string>('');
  const completedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 250);
    const sync = () => setNow(new Date());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    if (!active || active.endAt === null) {
      completedRef.current = false;
      return;
    }
    if (isTimerExpired(active, now) && !completedRef.current) {
      completedRef.current = true;
      completeFocus();
      toast({
        type: 'success',
        title: 'Focus session complete',
        message: active.homeworkTitle
          ? `Nice work on ${active.homeworkTitle}.`
          : 'Nice work — session logged.',
      });
      if (settings.focusSoundEnabled) {
        playCompletionChime();
      }
    }
  }, [now, active, completeFocus, toast, settings.focusSoundEnabled]);

  const linkableHomework = useMemo(
    () =>
      homework
        .filter((h) => h.status === 'pending' || h.status === 'overdue')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [homework],
  );

  const remaining = active ? getRemainingSeconds(active, now) : durationMin * 60;
  const planned = active ? active.plannedDurationSec : durationMin * 60;
  const elapsed = active ? getElapsedSeconds(active, now) : 0;
  const progress = planned > 0 ? elapsed / planned : 0;

  const handleDurationChange = (value: string) => {
    const min = Number(value);
    setDurationMin(min);
    updateSettings({ focusDuration: min });
  };

  const handleStart = () => {
    const linked = linkableHomework.find((h) => h.id === linkedHomeworkId);
    completedRef.current = false;
    startFocus({
      durationMinutes: durationMin,
      homeworkId: linked?.id ?? null,
      homeworkTitle: linked?.title ?? null,
      subjectName: linked?.subject ?? null,
    });
  };

  const handlePauseResume = useCallback(() => {
    if (status === 'running') pauseFocus();
    else if (status === 'paused') resumeFocus();
  }, [status, pauseFocus, resumeFocus]);

  // Keyboard: Space starts/pauses the timer when not typing in an input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handlePauseResume();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePauseResume]);

  const handleReset = () => {
    resetFocus();
    toast({ type: 'info', title: 'Timer reset', message: 'Session was not counted as completed.' });
  };

  const handleFinish = () => {
    finishFocus();
    toast({ type: 'info', title: 'Session ended', message: 'Recorded as cancelled, not completed.' });
  };

  const durationOptions = DURATION_PRESETS_MIN.map((min) => ({
    value: String(min),
    label: `${min} minutes`,
  }));
  if (!DURATION_PRESETS_MIN.includes(durationMin)) {
    durationOptions.unshift({ value: String(durationMin), label: `${durationMin} minutes` });
  }

  const homeworkOptions = [
    { value: '', label: 'No linked homework' },
    ...linkableHomework.map((h) => ({
      value: h.id,
      label: `${h.title} (${h.subject})`,
    })),
  ];

  const recentHistory = useMemo(() => [...history].reverse().slice(0, 20), [history]);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <Timer className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Focus Mode</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Timestamp-based timer — accurate even in background tabs.
            </p>
          </div>
        </header>

        <section
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 md:p-8"
          aria-label="Focus timer"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex items-center justify-center">
              <ProgressRing progress={progress} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  role="timer"
                  aria-live="polite"
                  aria-atomic="true"
                  className="font-mono text-4xl md:text-5xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50"
                >
                  {formatClock(remaining)}
                </span>
                <span className="mt-1 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {status === 'running' ? 'Focusing' : status === 'paused' ? 'Paused' : 'Ready'}
                </span>
              </div>
            </div>

            {active?.homeworkTitle && (
              <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Linked to <span className="font-medium">{active.homeworkTitle}</span>
                {active.subjectName && <span className="text-neutral-400">· {active.subjectName}</span>}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {status === 'idle' && (
                <Button onClick={handleStart} size="lg" aria-label="Start focus session">
                  <Play className="h-5 w-5" aria-hidden="true" />
                  Start Focus
                </Button>
              )}
              {status !== 'idle' && (
                <Button onClick={handlePauseResume} size="lg" aria-label={status === 'running' ? 'Pause focus session' : 'Resume focus session'}>
                  {status === 'running' ? (
                    <>
                      <Pause className="h-5 w-5" aria-hidden="true" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" aria-hidden="true" />
                      Resume
                    </>
                  )}
                </Button>
              )}
              {status !== 'idle' && (
                <>
                  <Button variant="outline" onClick={handleReset} aria-label="Reset timer">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reset
                  </Button>
                  <Button variant="secondary" onClick={handleFinish} aria-label="Finish session early">
                    <Square className="h-4 w-4" aria-hidden="true" />
                    Finish
                  </Button>
                </>
              )}
            </div>

            <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Focus duration"
                options={durationOptions}
                value={String(durationMin)}
                onChange={(e) => handleDurationChange(e.target.value)}
                disabled={status !== 'idle'}
                data-testid="focus-duration-select"
              />
              <Select
                label="Link homework"
                options={homeworkOptions}
                value={active?.homeworkId ?? linkedHomeworkId}
                onChange={(e) => setLinkedHomeworkId(e.target.value)}
                disabled={status !== 'idle'}
                data-testid="focus-homework-select"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.focusSoundEnabled}
                onChange={(e) => updateSettings({ focusSoundEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              {settings.focusSoundEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              )}
              Play a sound when the session completes
            </label>
          </div>
        </section>

        <section
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
          aria-label="Session history"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Session history
            </h2>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFocusHistory} aria-label="Clear all focus history">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear all
              </Button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No focus sessions recorded yet. Start a session above — completed, cancelled and
              interrupted sessions will all be logged here honestly.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {recentHistory.map((session) => {
                const meta = STATUS_META[session.status];
                return (
                  <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {session.homeworkTitle ?? 'General focus'}
                        {session.subjectName && (
                          <span className="ml-2 font-normal text-neutral-500">{session.subjectName}</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {format(new Date(session.startedAt), 'MMM d, yyyy HH:mm')} ·{' '}
                        {formatClock(session.actualDurationSec)} / {formatClock(session.plannedDurationSec)}
                        {session.note ? ` · ${session.note}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                      <button
                        onClick={() => deleteFocusSession(session.id)}
                        className="rounded p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                        aria-label={`Delete ${meta.label.toLowerCase()} session from history`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
