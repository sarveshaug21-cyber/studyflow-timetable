import { useCallback, useMemo, useState } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import { useFocus } from '@/hooks/useFocus';
import { useToast } from '@/components/ui/Toast';
import type { Session, Subject } from '@/types';
import {
  formatMinClock,
  type PlannerOptions,
  type SchedulePlan,
  type StudySuggestion,
} from '@/utils/scheduler';
import {
  describePlanChanges,
  replanAvoidingConfirmed,
  snapshotKey,
  type PlanChange,
  type PlannerSnapshot,
} from '@/utils/adaptivePlanner';

export interface UseStudyPlannerResult {
  plan: SchedulePlan | null;
  isPlanning: boolean;
  generatePlan: (options?: PlannerOptions) => void;
  clearPlan: () => void;
  /**
   * Item-by-item explanations from the most recent re-plan: what was added,
   * removed or moved and why. `null` until a plan has been regenerated at
   * least once on top of an earlier plan (there is nothing to explain then).
   */
  changes: PlanChange[] | null;
  /** True when the timetable/homework/focus inputs moved on since the plan was built. */
  inputsChanged: boolean;
  /** Dismiss the "what changed" explanation without touching the plan. */
  dismissChanges: () => void;
  /** Turn a suggestion into a real one-off `study` Session (does not save). */
  suggestionToSession: (s: StudySuggestion, subjectId: string | null) => Omit<Session, 'id' | 'createdAt' | 'updatedAt'>;
  /** Persist the confirmed suggestions as one-off study sessions. Never touches existing sessions. */
  acceptSuggestions: (picked: StudySuggestion[], subjectFallbackId?: string) => number;
  formatClock: (min: number) => string;
}

/**
 * Bridges the pure scheduling engine to StudyFlow's live context.
 *
 * Saving is additive only: it calls `addSession` for each confirmed suggestion,
 * producing non-recurring one-off `study` sessions dated to a specific day. It
 * never calls update/delete, so existing commitments cannot be overwritten.
 *
 * Regeneration is adaptive: every re-plan runs through `replanAvoidingConfirmed`
 * (so a suggestion never collides with a study block the student already
 * accepted — no silent duplicates) and is diffed against the previous plan, so
 * any move/removal comes with a plain-language reason the UI can show.
 */
export function useStudyPlanner(): UseStudyPlannerResult {
  const { state, addSession } = useTimetable();
  const { history } = useFocus();
  const { toast } = useToast();
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [planSnapshot, setPlanSnapshot] = useState<PlannerSnapshot | null>(null);
  const [changes, setChanges] = useState<PlanChange[] | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);

  const snapshot = useMemo<PlannerSnapshot>(
    () => ({
      homework: state.homework,
      sessions: state.sessions,
      subjects: state.subjects,
      focusHistory: history,
    }),
    [state.homework, state.sessions, state.subjects, history],
  );

  // A value comparison (serialised) rather than object identity: React hands
  // out new array references on unrelated renders, which must not count as
  // "the inputs changed".
  const inputsChanged =
    plan !== null &&
    planSnapshot !== null &&
    snapshotKey(planSnapshot) !== snapshotKey(snapshot);

  const generatePlan = useCallback(
    (options?: PlannerOptions) => {
      setIsPlanning(true);
      try {
        const next = replanAvoidingConfirmed({ now: new Date(), snapshot, options });
        // Only meaningful when replacing an earlier plan; a first plan has no
        // previous state to explain a difference against.
        setChanges(
          plan && planSnapshot
            ? describePlanChanges(plan, next, {
                previousSnapshot: planSnapshot,
                nextSnapshot: snapshot,
              })
            : null,
        );
        setPlan(next);
        setPlanSnapshot(snapshot);
      } finally {
        setIsPlanning(false);
      }
    },
    [snapshot, plan, planSnapshot],
  );

  const clearPlan = useCallback(() => {
    setPlan(null);
    setPlanSnapshot(null);
    setChanges(null);
  }, []);

  const dismissChanges = useCallback(() => setChanges(null), []);

  const suggestionToSession = useCallback(
    (s: StudySuggestion, subjectId: string | null): Omit<Session, 'id' | 'createdAt' | 'updatedAt'> => ({
      subjectId: subjectId ?? s.subjectId ?? '',
      day: s.day,
      date: s.date,
      startTime: formatMinClock(s.startMin),
      endTime: formatMinClock(s.endMin),
      type: 'study',
      location: '',
      notes: `Study block for "${s.title}" (${s.priority} priority).`,
      recurring: false,
    }),
    [],
  );

  const acceptSuggestions = useCallback(
    (picked: StudySuggestion[], subjectFallbackId?: string): number => {
      let saved = 0;
      for (const s of picked) {
        const subjectId = s.subjectId ?? subjectFallbackId ?? '';
        if (!subjectId) continue; // cannot attach a session without a subject
        addSession(suggestionToSession(s, subjectId));
        saved += 1;
      }
      if (saved > 0) {
        toast({
          type: 'success',
          title: `Scheduled ${saved} study session${saved === 1 ? '' : 's'}`,
          message: 'Added as one-off study blocks. Nothing existing was changed.',
        });
      } else {
        toast({
          type: 'warning',
          title: 'Nothing scheduled',
          message: 'Confirm at least one suggestion linked to a known subject.',
        });
      }
      return saved;
    },
    [addSession, suggestionToSession, toast],
  );

  const formatClock = useCallback((min: number) => formatMinClock(min), []);

  return {
    plan,
    isPlanning,
    generatePlan,
    clearPlan,
    changes,
    inputsChanged,
    dismissChanges,
    suggestionToSession,
    acceptSuggestions,
    formatClock,
  };
}

/** Subjects usable for study blocks (all of them; study blocks inherit the subject of their homework). */
export function usePlannableSubjects(): Subject[] {
  const { state } = useTimetable();
  return useMemo(() => state.subjects, [state.subjects]);
}

export function defaultSubjectIdForSuggestions(
  suggestions: StudySuggestion[],
  subjects: Subject[],
): string | null {
  const byName = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));
  for (const s of suggestions) {
    const hit = byName.get((s.subject || '').toLowerCase());
    if (hit) return hit;
  }
  return subjects[0]?.id ?? null;
}
