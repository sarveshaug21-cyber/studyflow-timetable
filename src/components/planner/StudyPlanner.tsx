import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarPlus, CheckCircle2, AlertTriangle, RefreshCw, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useStudyPlanner, usePlannableSubjects, defaultSubjectIdForSuggestions } from '@/hooks/useStudyPlanner';
import { useTimetable } from '@/hooks/useTimetable';
import type { Session } from '@/types';
import { explainConflict, formatMinClock, type StudySuggestion } from '@/utils/scheduler';
import { cn } from '@/utils/cn';

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
        className,
      )}
    >
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = parseISO(iso);
  if (!isValid(d)) return iso;
  return format(d, 'EEE, MMM d');
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

interface SuggestionRowProps {
  s: StudySuggestion;
  checked: boolean;
  sessions: Session[];
  onToggle: (id: string) => void;
}

function suggestionKey(s: StudySuggestion): string {
  return `${s.homeworkId}|${s.date}|${s.startMin}`;
}

function SuggestionRow({ s, checked, sessions, onToggle }: SuggestionRowProps) {
  const key = suggestionKey(s);
  const conflict = explainConflict(s, sessions);
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        checked
          ? 'border-brand-300 bg-brand-50/50 dark:border-brand-700 dark:bg-brand-900/20'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(key)}
        className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        aria-label={`Select study block for ${s.title}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{s.title}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              PRIORITY_STYLES[s.priority] ?? PRIORITY_STYLES.medium,
            )}
          >
            {s.priority}
          </span>
          {conflict.conflicts && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" /> Conflict
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          {formatDate(s.date)} · {formatMinClock(s.startMin)}–{formatMinClock(s.endMin)} ({s.minutes} min)
          {s.subject ? ` · ${s.subject}` : ''}
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{s.explanation}</p>
      </div>
    </li>
  );
}

export function StudyPlanner() {
  const {
    plan,
    isPlanning,
    generatePlan,
    clearPlan,
    acceptSuggestions,
    changes,
    inputsChanged,
    dismissChanges,
  } = useStudyPlanner();
  const { state } = useTimetable();
  const subjects = usePlannableSubjects();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSavedCount, setLastSavedCount] = useState(0);

  const allKeys = useMemo(
    () => (plan ? plan.suggestions.map(suggestionKey) : []),
    [plan],
  );

  const handleToggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGenerate = () => {
    generatePlan();
    setLastSavedCount(0);
    // Selection keys that still exist in the regenerated plan stay selected;
    // keys for removed suggestions are harmless (they match no row) and are
    // dropped naturally by the filter over `plan.suggestions`.
  };

  const handleSelectAll = () => setSelected(new Set(allKeys));
  const handleSelectNone = () => setSelected(new Set());

  const handleConfirm = () => {
    if (!plan) return;
    const picked = plan.suggestions.filter((s) => selected.has(suggestionKey(s)));
    const fallback = defaultSubjectIdForSuggestions(picked, subjects);
    const saved = acceptSuggestions(picked, fallback ?? undefined);
    if (saved > 0) {
      setLastSavedCount(saved);
      setSelected(new Set());
      clearPlan();
    }
  };

  const selectedSuggestions = plan
    ? plan.suggestions.filter((s) => selected.has(suggestionKey(s)))
    : [];

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              <Sparkles className="h-4 w-4 text-brand-500" /> Study Planner
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              Suggests study blocks around your lessons. Review and confirm — nothing is saved
              until you approve it, and existing commitments are never changed.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={isPlanning} className="gap-2">
              {isPlanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {plan ? 'Re-plan' : 'Plan my study'}
            </Button>
      {inputsChanged && (
        <Panel className="flex flex-wrap items-center gap-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">
            Your timetable or homework changed since this plan was built. The suggestions below
            are unchanged so far — re-plan to see the updated version.
          </span>
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isPlanning}>
            Re-plan now
          </Button>
        </Panel>
      )}

      {plan && changes && changes.some((c) => c.kind !== 'same') && (
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <RefreshCw className="h-4 w-4 text-brand-500" /> What changed in this plan
            </h3>
            <Button variant="ghost" size="sm" onClick={dismissChanges}>
              Dismiss
            </Button>
          </div>
          <ul className="space-y-1">
            {changes
              .filter((c) => c.kind !== 'same')
              .map((c) => (
                <li
                  key={`${c.kind}-${c.homeworkId}`}
                  className="text-sm text-neutral-600 dark:text-neutral-300"
                >
                  <span className="font-medium">{c.title}</span>{' '}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-medium',
                      c.kind === 'removed'
                        ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                        : c.kind === 'added'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                    )}
                  >
                    {c.kind === 'same' ? 'unchanged' : c.kind}
                  </span>{' '}
                  — {c.reason}
                </li>
              ))}
          </ul>
        </Panel>
      )}

      {plan && (
              <Button variant="ghost" onClick={clearPlan} className="gap-2">
                <XCircle className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {lastSavedCount > 0 && (
        <Panel className="flex items-center gap-2 border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Scheduled {lastSavedCount} study session{lastSavedCount === 1 ? '' : 's'}. Nothing existing was overwritten.
        </Panel>
      )}

      {plan && (
        <Panel className="p-4">
          {plan.suggestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No study blocks could be scheduled. Every item is already completed or
              submitted, fully covered by completed focus time, or there is no free time
              in the planning window. See “Not scheduled” below for the reason per item.
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  {plan.suggestions.length} suggestion{plan.suggestions.length === 1 ? '' : 's'} ·{' '}
                  {selectedSuggestions.length} selected
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>Select all</Button>
                  <Button variant="ghost" size="sm" onClick={handleSelectNone}>Select none</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {plan.suggestions.map((s) => (
                  <SuggestionRow
                    key={suggestionKey(s)}
                    s={s}
                    checked={selected.has(suggestionKey(s))}
                    sessions={state.sessions}
                    onToggle={handleToggle}
                  />
                ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleConfirm}
                  disabled={selectedSuggestions.length === 0}
                  className="gap-2"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Schedule {selectedSuggestions.length} selected
                </Button>
              </div>
            </>
          )}

          {plan.unscheduled.length > 0 && (
            <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <h3 className="flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Not scheduled ({plan.unscheduled.length})
              </h3>
              <ul className="mt-2 space-y-1">
                {plan.unscheduled.map((u) => (
                  <li key={u.homeworkId} className="text-sm text-neutral-600 dark:text-neutral-300">
                    <span className="font-medium">{u.title}</span> — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.coverageGaps.length > 0 && (
            <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <h3 className="flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Partial coverage ({plan.coverageGaps.length})
              </h3>
              <ul className="mt-2 space-y-1">
                {plan.coverageGaps.map((g) => (
                  <li key={g.homeworkId} className="text-sm text-neutral-600 dark:text-neutral-300">
                    <span className="font-medium">{g.title}</span> — {g.scheduledMinutes} of{' '}
                    {g.estimatedMinutes} min scheduled; {g.shortfallMinutes} min shortfall before the deadline.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
