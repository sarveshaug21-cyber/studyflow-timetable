/**
 * Storage layer for the StudyFlow timetable.
 *
 * Split out of `TimetableContext.tsx` on purpose: everything here is a pure
 * function over data (plus guarded `localStorage` access), so it can be tested
 * without rendering React and without the module colliding with the
 * component-only export rule that applies to context files.
 *
 * Two safety principles run through this module:
 *  - *Never destroy user data.* A malformed or foreign store reads as `null`
 *    (start fresh in memory) and is never written back over the stored value.
 *  - *Never trust shape blindly.* Loaded state is normalised field by field;
 *    anything absent or invalid falls back to a sensible default instead of
 *    crashing the UI, and anything valid is passed through untouched.
 */

import type { HomeworkItem, TimetableState } from '@/types';
import { getWeekStart, normalizeHomeworkPlanningFields } from '@/types';
import { createEmptyTimetable } from '@/data/sampleData';

export const STORAGE_KEY = 'studyflow-timetable';

export function homeworkItemsToJSON(items: HomeworkItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      ...item,
      dueDate: item.dueDate.toISOString(),
    })),
  );
}

/**
 * Serialise the whole timetable for persistence.
 *
 * Homework due dates are written as ISO strings so they survive `JSON.parse`
 * as text and can be revived as `Date`s by `homeworkItemsFromJSON`. Subjects,
 * sessions (including one-off `study` sessions) and every other top-level field
 * are written verbatim — the storage format is unchanged.
 */
export function timetableStateToJSON(state: TimetableState): string {
  return JSON.stringify({
    ...state,
    homework: JSON.parse(homeworkItemsToJSON(state.homework)) as HomeworkItem[],
  });
}

/**
 * Revive `dueDate` from its stored ISO string back into a `Date` on load, and
 * fill in planning fields that older records predate.
 *
 * `dueDate` is a real `Date` everywhere else in the app, so leaving it as a
 * string would break every comparison. Legacy records that were saved before
 * `priority` / `estimatedMinutes` existed simply get their defaults filled in
 * by `normalizeHomeworkPlanningFields` — no migration of the stored format is
 * needed, and valid values are never overwritten.
 *
 * Items whose `dueDate` is missing or unparseable are dropped rather than kept
 * with an `Invalid Date`: an unparseable date would crash the UI on render and
 * could not be acted on by the student anyway. Dropping is the safe option and
 * is covered by a regression test.
 */
function homeworkItemsFromJSON(items: unknown): HomeworkItem[] {
  if (!Array.isArray(items)) return [];
  const revived: HomeworkItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const due = new Date(item.dueDate as string | number | Date);
    if (Number.isNaN(due.getTime())) continue;
    revived.push(
      normalizeHomeworkPlanningFields({
        ...(item as unknown as HomeworkItem),
        dueDate: due,
      }),
    );
  }
  return revived;
}

/**
 * Fill in defaults for a loaded timetable so partially-shaped stored data is
 * still usable. Only absent-or-invalid fields are defaulted — anything valid is
 * passed through untouched, so a user's choices are never overwritten.
 *
 * `currentWeekStart` is normalised to an ISO string, which also repairs older
 * stores that kept it as a local-noon `Date`; a bare `new Date(...)` of such a
 * value can read as the previous week in negative UTC offsets.
 */
function normalizeLoadedState(parsed: unknown): TimetableState | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;

  // Both must be present (and array-shaped) for this to be a StudyFlow store.
  // A store without them is foreign/corrupt and must not be trusted.
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.sessions)) return null;

  const empty = createEmptyTimetable();
  const timeRange =
    raw.timeRange && typeof raw.timeRange === 'object'
      ? (raw.timeRange as TimetableState['timeRange'])
      : empty.timeRange;

  return {
    subjects: raw.subjects as TimetableState['subjects'],
    sessions: raw.sessions as TimetableState['sessions'],
    homework: homeworkItemsFromJSON(raw.homework ?? []),
    currentWeekStart:
      typeof raw.currentWeekStart === 'string' && raw.currentWeekStart
        ? raw.currentWeekStart
        : getWeekStart().toISOString(),
    view: raw.view === 'agenda' || raw.view === 'weekly' ? raw.view : empty.view,
    timeIncrement: raw.timeIncrement === 60 || raw.timeIncrement === 30 ? raw.timeIncrement : empty.timeIncrement,
    showWeekends: typeof raw.showWeekends === 'boolean' ? raw.showWeekends : empty.showWeekends,
    timeRange: { start: timeRange.start || empty.timeRange.start, end: timeRange.end || empty.timeRange.end },
  };
}

/**
 * Read the persisted timetable, if any.
 *
 * This is deliberately defensive about *shape* and deliberately strict about
 * *not destroying user data*: malformed or foreign JSON yields `null` (so the
 * caller starts from an empty timetable) and is never written back over the
 * stored value. A valid store is normalised but never dropped, even when
 * individual homework items inside it are unusable.
 */
export function readStoredTimetable(): TimetableState | null {
  if (typeof window === 'undefined') return null;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can throw (privacy mode, disabled cookies). Treat as empty.
    return null;
  }
  if (!stored) return null;
  try {
    return normalizeLoadedState(JSON.parse(stored));
  } catch {
    return null;
  }
}
