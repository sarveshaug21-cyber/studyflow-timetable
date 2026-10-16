/**
 * Adaptive re-planning for StudyFlow.
 *
 * The core planner (`planStudySessions`) is a pure function of its inputs; this
 * module sits one level up and answers "the inputs changed — what should the
 * student be told, and what may safely be kept?".
 *
 * Everything here is still pure and deterministic: `now` is supplied by the
 * caller, there is no I/O, and no function mutates its inputs. That keeps the
 * adaptive behaviour independently testable, exactly like the planner.
 *
 * Safety rules that this module enforces on behalf of the caller:
 *  - Confirmed study sessions are *commitments*. They are never proposed for
 *    deletion, never moved, and never rewritten. A student who has accepted a
 *    block owns it.
 *  - Regenerating a plan must not double-book. Study sessions that already
 *    exist on the timetable are reported as conflicts so the caller can offer
 *    to skip them, rather than silently planning the same slot twice.
 *  - Every change comes with a reason. When a suggestion disappears or moves,
 *    the student is told why, in plain language.
 */

import type { FocusSession, HomeworkItem, Session, Subject } from '@/types';
import { normalizeEstimatedMinutes, normalizeHomeworkPriority } from '@/types';
import {
  planStudySessions,
  type PlannerOptions,
  type SchedulePlan,
  type StudySuggestion,
} from '@/utils/scheduler';

/**
 * The full set of inputs the planner reads. Capturing it as one object makes
 * change detection a plain deep comparison instead of a hand-written list of
 * fields that someone has to remember to extend.
 */
export interface PlannerSnapshot {
  homework: HomeworkItem[];
  sessions: Session[];
  subjects: Subject[];
  focusHistory: FocusSession[];
}

/**
 * A stable, human-readable summary of everything the planner depends on.
 *
 * Comparing snapshots with `===` would compare object identity, which changes
 * on every React render even when the data is identical. Serialising to a
 * canonical string instead makes "did anything the planner can see actually
 * change?" a value comparison.
 *
 * Homework and focus sessions are included; subjects are deliberately *not*
 * (a rename does not move any block), and planner options are handled
 * separately by `describePlanChanges`.
 */
export function snapshotKey(snapshot: PlannerSnapshot): string {
  return JSON.stringify({
    homework: snapshot.homework.map((h) => ({
      id: h.id,
      due: h.dueDate instanceof Date ? h.dueDate.getTime() : String(h.dueDate),
      status: h.status,
      hide: h.hide,
      type: h.type,
      subject: h.subject,
      priority: normalizeHomeworkPriority(h.priority),
      // Normalised so a legacy `estimatedMinutes: null` and an absent field
      // compare equal — they mean the same thing to the planner.
      est: normalizeEstimatedMinutes(h.estimatedMinutes) ?? null,
    })),
    sessions: snapshot.sessions.map((s) => ({
      id: s.id,
      day: s.day,
      date: s.date ?? null,
      start: s.startTime,
      end: s.endTime,
      type: s.type,
    })),
    focus: snapshot.focusHistory.map((f) => ({
      id: f.id,
      hw: f.homeworkId,
      status: f.status,
      // Rounded to the minute: a second of timer jitter must not count as a
      // change that invalidates the student's plan.
      min: Math.round(f.actualDurationSec / 60),
    })),
  });
}

export type PlanChangeKind =
  | 'added'
  | 'removed'
  | 'moved'
  | 'same'
  | 'rescheduled';

export interface PlanChange {
  kind: PlanChangeKind;
  homeworkId: string;
  title: string;
  before?: StudySuggestion;
  after?: StudySuggestion;
  /** Plain-language explanation shown to the student. */
  reason: string;
}

/**
 * Compare two plans and explain, item by item, what changed.
 *
 * Matching is by `(homeworkId, startMin, date)` — the same key the UI uses to
 * identify a row. An item present in both with the same slot is `same`; present
 * in both with a different slot is `moved`; only in the new plan is `added`;
 * only in the old plan is `removed`.
 *
 * Reasons are derived from the inputs rather than guessed: a removal after the
 * homework was completed says so; a move after the deadline shifted says so.
 */
export function describePlanChanges(
  previous: SchedulePlan,
  next: SchedulePlan,
  context: { previousSnapshot?: PlannerSnapshot; nextSnapshot?: PlannerSnapshot } = {},
): PlanChange[] {
  const prevById = groupBy(previous.suggestions, (s) => s.homeworkId);
  const nextById = groupBy(next.suggestions, (s) => s.homeworkId);

  const ids = sortedUnion(prevById, nextById);
  const changes: PlanChange[] = [];

  for (const id of ids) {
    const before = prevById.get(id);
    const after = nextById.get(id);
    const title = (after ?? before)?.[0]?.title ?? '';
    const prevStatus = findStatus(context.previousSnapshot, id);
    const nextStatus = findStatus(context.nextSnapshot, id);
    const prevEst = findEstimate(context.previousSnapshot, id);
    const nextEst = findEstimate(context.nextSnapshot, id);
    const prevPriority = findPriority(context.previousSnapshot, id);
    const nextPriority = findPriority(context.nextSnapshot, id);

    if (before && !after) {
      changes.push({
        kind: 'removed',
        homeworkId: id,
        title,
        before: before[0],
        reason: removalReason(prevStatus, nextStatus),
      });
      continue;
    }

    if (!before && after) {
      changes.push({
        kind: 'added',
        homeworkId: id,
        title,
        after: after[0],
        reason: additionReason(nextStatus),
      });
      continue;
    }

    if (!before || !after) continue; // unreachable; both are non-null here

    const signature = (list: StudySuggestion[]) =>
      list.map((s) => `${s.date}@${s.startMin}-${s.endMin}`).sort().join(',');

    if (signature(before) === signature(after)) {
      changes.push({ kind: 'same', homeworkId: id, title, before: before[0], after: after[0], reason: 'Unchanged.' });
      continue;
    }

    changes.push({
      kind: 'moved',
      homeworkId: id,
      title,
      before: before[0],
      after: after[0],
      reason: moveReason(prevEst, nextEst, prevPriority, nextPriority),
    });
  }

  return changes;
}

function removalReason(
  prevStatus: HomeworkItem['status'] | undefined,
  nextStatus: HomeworkItem['status'] | undefined,
): string {
  if (nextStatus && nextStatus !== prevStatus) {
    return `No longer needs study time (now marked ${nextStatus}).`;
  }
  return 'No longer needs a study block — it was completed, covered by focus time, or the homework was removed.';
}

function additionReason(nextStatus: HomeworkItem['status'] | undefined): string {
  if (nextStatus === 'overdue') {
    return 'Newly overdue, so it needs study time scheduled as soon as possible.';
  }
  return 'New homework (or newly overdue) that needs study time.';
}

function moveReason(
  prevEst: number | null,
  nextEst: number | null,
  prevPriority: string | null,
  nextPriority: string | null,
): string {
  if (prevEst !== null && nextEst !== null && prevEst !== nextEst) {
    return `Study estimate changed from ${prevEst} min to ${nextEst} min, so the blocks were re-placed.`;
  }
  if (prevPriority !== null && nextPriority !== null && prevPriority !== nextPriority) {
    return `Priority changed from ${prevPriority} to ${nextPriority}, changing when it is scheduled.`;
  }
  return 'Free time or deadlines changed, so the blocks were re-placed.';
}

/**
 * A study session already on the timetable that collides with a suggestion.
 *
 * Regenerating a plan after accepting an earlier one would otherwise propose
 * the very slots the student already booked. Surfacing these lets the caller
 * skip or ignore them instead of double-booking.
 */
export interface ConfirmedStudyConflict {
  suggestion: StudySuggestion;
  sessionId: string;
  sessionStart: string;
  sessionEnd: string;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function sessionTouchesDate(s: Session, iso: string): boolean {
  if (s.recurring) return true;
  return s.date === iso;
}

/**
 * Find suggestions that collide with an already-confirmed `study` session.
 *
 * Non-study sessions are excluded on purpose: the planner already treats those
 * as busy when it builds free windows, so a collision there is a planner bug
 * rather than something the student chose. Study sessions are different — the
 * student accepted them, so they are commitments to be respected.
 */
export function findConfirmedStudyConflicts(
  suggestions: StudySuggestion[],
  sessions: Session[],
): ConfirmedStudyConflict[] {
  const out: ConfirmedStudyConflict[] = [];
  for (const s of suggestions) {
    for (const sess of sessions) {
      if (sess.type !== 'study') continue;
      if (sess.day !== s.day) continue;
      if (!sessionTouchesDate(sess, s.date)) continue;
      const bStart = toMin(sess.startTime);
      const bEnd = toMin(sess.endTime);
      if (bEnd <= bStart) continue;
      if (s.startMin < bEnd && s.endMin > bStart) {
        out.push({
          suggestion: s,
          sessionId: sess.id,
          sessionStart: sess.startTime,
          sessionEnd: sess.endTime,
        });
      }
    }
  }
  return out;
}

/**
 * Re-plan, excluding slots the student has already confirmed as study blocks.
 *
 * The returned plan therefore contains no suggestion that collides with an
 * existing study session, which is what makes "regenerate" safe to offer in the
 * UI without risking duplicates.
 */
export function replanAvoidingConfirmed(input: {
  now: Date;
  snapshot: PlannerSnapshot;
  options?: PlannerOptions;
}): SchedulePlan {
  const { now, snapshot, options } = input;
  const base = planStudySessions({
    now,
    homework: snapshot.homework,
    sessions: snapshot.sessions,
    subjects: snapshot.subjects,
    focusHistory: snapshot.focusHistory,
    options,
  });
  const conflicts = findConfirmedStudyConflicts(base.suggestions, snapshot.sessions);
  if (conflicts.length === 0) return base;

  const blocked = new Set(conflicts.map((c) => c.suggestion));
  const suggestions = base.suggestions.filter((s) => !blocked.has(s));
  return { ...base, suggestions };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function sortedUnion(a: Map<string, unknown>, b: Map<string, unknown>): string[] {
  const set = new Set<string>([...a.keys(), ...b.keys()]);
  return [...set].sort();
}

function findStatus(snapshot: PlannerSnapshot | undefined, id: string): HomeworkItem['status'] | undefined {
  return snapshot?.homework.find((h) => h.id === id)?.status;
}

function findEstimate(snapshot: PlannerSnapshot | undefined, id: string): number | null {
  const item = snapshot?.homework.find((h) => h.id === id);
  if (!item) return null;
  // `??` rather than a bare return: a legacy record with no usable estimate
  // normalises to `undefined`, which must read back as null for comparison.
  return normalizeEstimatedMinutes(item.estimatedMinutes) ?? null;
}

function findPriority(snapshot: PlannerSnapshot | undefined, id: string): string | null {
  const item = snapshot?.homework.find((h) => h.id === id);
  if (!item) return null;
  return normalizeHomeworkPriority(item.priority);
}
