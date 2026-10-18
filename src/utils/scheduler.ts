import type { DayOfWeek, FocusSession, HomeworkItem, HomeworkPriority, Session, Subject } from '@/types';
import { PRIORITY_WEIGHT, normalizeEstimatedMinutes, normalizeHomeworkPriority } from '@/types';

/**
 * Deterministic smart-scheduling engine for StudyFlow.
 *
 * Design principles:
 * - Pure and deterministic: same inputs + same `now` => same output. No randomness,
 *   no wall-clock reads inside the planner (the caller supplies `now`).
 * - Read-only with respect to the timetable: it only *suggests* study blocks. It never
 *   mutates, overwrites, or invents existing commitments.
 * - Transparent: every suggestion carries a human-readable `explanation` describing why
 *   it was placed there, and every estimate carries a `basis` string.
 * - Honest: it will not claim a homework is fully covered when only part of the estimate
 *   could be scheduled before the deadline, and it will not schedule into the past.
 */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type StudyPriority = HomeworkPriority;

export interface TimeWindow {
  /** Minutes from midnight, inclusive. */
  startMin: number;
  /** Minutes from midnight, exclusive. */
  endMin: number;
}

export interface StudyBlock {
  /** ISO yyyy-MM-dd date this block falls on. */
  date: string;
  day: DayOfWeek;
  startMin: number;
  endMin: number;
}

export interface StudySuggestion {
  homeworkId: string;
  title: string;
  subject: string;
  subjectId: string | null;
  priority: StudyPriority;
  date: string;
  day: DayOfWeek;
  startMin: number;
  endMin: number;
  minutes: number;
  explanation: string;
}

export interface UnscheduledHomework {
  homeworkId: string;
  title: string;
  reason: string;
}

export interface CoverageGap {
  homeworkId: string;
  title: string;
  scheduledMinutes: number;
  estimatedMinutes: number;
  shortfallMinutes: number;
}

export interface SchedulePlan {
  suggestions: StudySuggestion[];
  unscheduled: UnscheduledHomework[];
  coverageGaps: CoverageGap[];
}

export interface PlannerOptions {
  /** Planning horizon in days, starting from `now`. Default 7. */
  horizonDays?: number;
  /** Daily planning window. Default 08:00–22:00. */
  dailyWindow?: TimeWindow;
  /** Planned study block length in minutes. Default 50 (a focus-sized block). Default 50. */
  blockMinutes?: number;
  /** Max study blocks scheduled per homework item. Default 3. */
  maxBlocksPerHomework?: number;
  /** Optional cap on total blocks scheduled per calendar day. Default 3. */
  maxBlocksPerDay?: number;
  /** Days of week to use for study. Default all seven. */
  allowedDays?: DayOfWeek[];
  /** Study-type sessions to ignore when building busy list (e.g. previously accepted suggestions). */
  ignoreSessionIds?: string[];
}

interface RankedHomework {
  item: HomeworkItem;
  priority: StudyPriority;
  remainingMinutes: number;
  rank: number;
  daysUntilDue: number;
  /** Human-readable statement of what drove this item's rank. */
  reason: string;
}

const DAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function dayOfWeekFromDate(d: Date): DayOfWeek {
  return d.getDay() as DayOfWeek;
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Whole days from `fromIso` to `toIso` (positive when `toIso` is later). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Transparent study-duration estimate (in minutes).
 *
 * Precedence:
 *  1. Explicit user override (`estimatedMinutes`), if valid and > 0.
 *  2. A type/status heuristic, so the estimate is explainable and stable.
 *
 * The returned `basis` explains which rule applied. Fully completed/submitted
 * homework needs no study time (returns 0).
 *
 * `now` is an explicit parameter (not `new Date()`) so the engine stays pure:
 * the same inputs always produce the same estimate, and tests can pin time.
 */
export function estimateStudyMinutes(
  item: HomeworkItem,
  now: Date = new Date(),
): { minutes: number; basis: string } {
  const override = normalizeEstimatedMinutes(item.estimatedMinutes);
  if (override !== undefined) {
    return {
      minutes: override,
      basis: `user estimate of ${override} min`,
    };
  }

  if (item.status === 'completed' || item.status === 'submitted') {
    return { minutes: 0, basis: 'already completed/submitted — no study needed' };
  }

  const type = (item.type || '').toLowerCase();
  let base: number;
  let typeBasis: string;
  if (type.includes('essay') || type.includes('coursework') || type.includes('project')) {
    base = 120;
    typeBasis = `essay/coursework/project baseline (120 min)`;
  } else if (type.includes('lab') || type.includes('report')) {
    base = 90;
    typeBasis = `lab/report baseline (90 min)`;
  } else if (type.includes('reading')) {
    base = 45;
    typeBasis = `reading baseline (45 min)`;
  } else {
    base = 60;
    typeBasis = `generic homework baseline (60 min)`;
  }

  // Overdue work gets a small extra buffer so the plan reflects the recovery cost.
  const due = new Date(item.dueDate);
  const overdueBoost = due.getTime() < now.getTime() ? 15 : 0;
  const minutes = base + overdueBoost;
  const basis =
    overdueBoost > 0
      ? `${typeBasis} + 15 min overdue buffer`
      : typeBasis;
  return { minutes, basis };
}

/**
 * Estimated study minutes already accounted for by completed focus sessions
 * linked to this homework. Only `completed` sessions count — cancelled and
 * interrupted sessions are intentionally excluded so we never over-credit.
 */
export function focusedMinutesForHomework(homeworkId: string, focusHistory: FocusSession[]): number {
  let total = 0;
  for (const s of focusHistory) {
    if (s.homeworkId !== homeworkId) continue;
    if (s.status !== 'completed') continue;
    total += Math.max(0, Math.round(s.actualDurationSec / 60));
  }
  return total;
}

function effectivePriority(item: HomeworkItem): StudyPriority {
  return normalizeHomeworkPriority(item.priority);
}

/**
 * Rank score. Lower = more urgent (scheduled first).
 *
 * Priority is the primary key and the deadline is the secondary key. That order
 * is deliberate: priority is the student's explicit statement of what matters
 * most, so an `urgent` item is scheduled ahead of a `low` one even when the low
 * item is due sooner. Within the same priority, the nearer deadline wins.
 *
 * The multiplier (32) is larger than the widest realistic deadline spread inside
 * one priority band (the horizon is clamped to 60 days), so priority bands can
 * never be overtaken by a deadline inside a lower band.
 *
 * Overdue work (negative `daysUntilDue`) is clamped to 0 so it ranks at the top
 * of its priority band rather than below a deadline that has not happened yet.
 * Deterministic tie-break by title then id happens in the caller's sort, so
 * ordering never depends on input array order.
 */
function computeRank(
  priority: StudyPriority,
  daysUntilDue: number,
  horizonDays: number,
): number {
  const priorityBand = PRIORITY_WEIGHT[priority]; // low=1 .. urgent=4
  // Clamp the due-date spread to the planning horizon so a far-future deadline
  // can never inflate into a lower priority band. The multiplier (horizonDays +
  // 1) is one more than the widest possible due-score spread, so priority is
  // always the dominant key exactly as documented: an urgent item is scheduled
  // ahead of everything else regardless of how far away its deadline is.
  const dueScore = Math.min(horizonDays, Math.max(0, daysUntilDue));
  return (4 - priorityBand) * (horizonDays + 1) + dueScore;
}

function formatMinTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function clampWindow(w: TimeWindow): TimeWindow {
  const startMin = Math.max(0, Math.min(1440, w.startMin));
  const endMin = Math.max(0, Math.min(1440, w.endMin));
  if (endMin <= startMin) return { startMin: 0, endMin: 0 };
  return { startMin, endMin };
}

function sessionTouchesDate(s: Session, iso: string): boolean {
  // One-off sessions are bound to an exact date; recurring ones apply every week.
  if (s.recurring) return true;
  return s.date === iso;
}

/**
 * Free-time finder: given the full session list and a date, return the list of
 * free [start,end) windows (in minutes-from-midnight) inside the daily window,
 * already excluding any past portion of "today".
 */
export function findFreeWindowsForDate(
  sessions: Session[],
  iso: string,
  day: DayOfWeek,
  window: TimeWindow,
  opts: { nowMin?: number; ignoreSessionIds?: string[] } = {},
): TimeWindow[] {
  const win = clampWindow(window);
  if (win.endMin <= win.startMin) return [];

  const ignore = new Set(opts.ignoreSessionIds ?? []);
  const busy: TimeWindow[] = [];
  for (const s of sessions) {
    if (ignore.has(s.id)) continue;
    if (s.day !== day) continue;
    if (!sessionTouchesDate(s, iso)) continue;
    const bStart = toMin(s.startTime);
    const bEnd = toMin(s.endTime);
    if (bEnd <= bStart) continue; // malformed; skip rather than corrupt
    busy.push({ startMin: bStart, endMin: bEnd });
  }
  busy.sort((a, b) => a.startMin - b.startMin);

  // Merge overlapping busy intervals.
  const merged: TimeWindow[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && b.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, b.endMin);
    } else {
      merged.push({ ...b });
    }
  }

  // Subtract busy intervals from the daily window.
  const free: TimeWindow[] = [];
  let cursor = win.startMin;
  for (const b of merged) {
    if (b.endMin <= cursor) continue;
    if (b.startMin > cursor) {
      free.push({ startMin: cursor, endMin: Math.min(b.startMin, win.endMin) });
    }
    cursor = Math.max(cursor, b.endMin);
    if (cursor >= win.endMin) break;
  }
  if (cursor < win.endMin) {
    free.push({ startMin: cursor, endMin: win.endMin });
  }

  // On "today", drop the portion already in the past so we never schedule retroactively.
  if (typeof opts.nowMin === 'number') {
    const nowMin = opts.nowMin;
    const clipped: TimeWindow[] = [];
    for (const f of free) {
      if (f.endMin <= nowMin) continue;
      const startMin = Math.max(f.startMin, nowMin);
      if (f.endMin > startMin) clipped.push({ startMin, endMin: f.endMin });
    }
    return clipped;
  }

  return free.filter((f) => f.endMin > f.startMin);
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Build the ordered list of study blocks to fill, given free windows and block size.
 * Greedy but deterministic: earliest-first, split long windows into fixed blocks.
 */
export function buildStudyBlocks(
  free: TimeWindow[],
  blockMinutes: number,
  limit: number,
): StudyBlock[] {
  const blocks: StudyBlock[] = [];
  if (blockMinutes <= 0 || limit <= 0) return blocks;
  for (const w of free) {
    let start = w.startMin;
    while (start + blockMinutes <= w.endMin && blocks.length < limit) {
      blocks.push({ date: '', day: 0, startMin: start, endMin: start + blockMinutes });
      start += blockMinutes;
    }
    if (blocks.length >= limit) break;
  }
  return blocks;
}

/**
 * Core planner. Pure function of its inputs.
 */
export function planStudySessions(input: {
  now: Date;
  homework: HomeworkItem[];
  sessions: Session[];
  subjects: Subject[];
  focusHistory: FocusSession[];
  options?: PlannerOptions;
}): SchedulePlan {
  const {
    now,
    homework,
    sessions,
    subjects,
    focusHistory,
    options = {},
  } = input;

  const horizonDays = clampInt(options.horizonDays ?? 7, 1, 60);
  const blockMinutes = clampInt(options.blockMinutes ?? 50, 10, 240);
  const maxBlocksPerHomework = clampInt(options.maxBlocksPerHomework ?? 3, 1, 20);
  const maxBlocksPerDay = clampInt(options.maxBlocksPerDay ?? 3, 1, 20);
  const dailyWindow = clampWindow(options.dailyWindow ?? { startMin: 8 * 60, endMin: 22 * 60 });
  const allowedDays = new Set<DayOfWeek>(
    options.allowedDays ?? [1, 2, 3, 4, 5, 6, 0],
  );
  const ignoreSessionIds = options.ignoreSessionIds ?? [];

  const nowIso = toIsoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));

  // ---- 1. Build ranked, still-relevant homework list -------------------------
  const ranked: RankedHomework[] = [];
  const unscheduled: UnscheduledHomework[] = [];

  for (const item of homework) {
    if (item.hide) {
      unscheduled.push({ homeworkId: item.id, title: item.title, reason: 'Hidden from planning.' });
      continue;
    }
    if (item.status === 'completed' || item.status === 'submitted') {
      unscheduled.push({
        homeworkId: item.id,
        title: item.title,
        reason: 'Already completed/submitted.',
      });
      continue;
    }

    const due = new Date(item.dueDate);
    if (Number.isNaN(due.getTime())) {
      unscheduled.push({
        homeworkId: item.id,
        title: item.title,
        reason: 'Missing or invalid due date.',
      });
      continue;
    }

    const dueIso = toIsoDate(due);
    const daysUntilDue = daysBetween(nowIso, dueIso);
    const priority = effectivePriority(item);

    const { minutes: estimate } = estimateStudyMinutes(item, now);
    const focused = focusedMinutesForHomework(item.id, focusHistory);
    const remainingMinutes = Math.max(0, estimate - focused);

    if (remainingMinutes === 0) {
      unscheduled.push({
        homeworkId: item.id,
        title: item.title,
        reason: estimate === 0 ? 'No study needed.' : `Fully covered by ${focused} min of completed focus time.`,
      });
      continue;
    }

    // Describe what actually drives the rank. Priority is the primary key and
    // the deadline the secondary one, so only claim priority when it is the
    // reason this item outranks a nearer-deadline one.
    const duePhrase =
      daysUntilDue < 0
        ? `overdue by ${-daysUntilDue} day(s)`
        : daysUntilDue === 0
          ? 'due today'
          : `due in ${daysUntilDue} day(s)`;
    const reason =
      priority === 'urgent'
        ? `Marked urgent — scheduled ahead of everything else, ${duePhrase}.`
        : `${priority} priority, ${duePhrase}.`;

    ranked.push({
      item,
      priority,
      remainingMinutes,
      rank: computeRank(priority, daysUntilDue, horizonDays),
      daysUntilDue,
      reason,
    });
  }

  // Deterministic ordering: rank, then title, then id.
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const t = a.item.title.localeCompare(b.item.title);
    if (t !== 0) return t;
    return a.item.id.localeCompare(b.item.id);
  });

  // ---- 2. Precompute per-day free windows ------------------------------------
  interface DayPlan {
    iso: string;
    day: DayOfWeek;
    free: TimeWindow[];
  }
  const dayPlans: DayPlan[] = [];
  for (let offset = 0; offset < horizonDays; offset++) {
    const iso = addDays(nowIso, offset);
    const d = parseIsoDate(iso);
    if (!d) continue;
    const dow = dayOfWeekFromDate(d);
    if (!allowedDays.has(dow)) continue;
    const free = findFreeWindowsForDate(sessions, iso, dow, dailyWindow, {
      nowMin: offset === 0 ? nowMin : undefined,
      ignoreSessionIds,
    });
    dayPlans.push({ iso, day: dow, free });
  }

  // ---- 3. Allocate blocks to homework in rank order --------------------------
  const suggestions: StudySuggestion[] = [];
  const coverageGaps: CoverageGap[] = [];
  const dayUsage = new Map<string, number>(); // iso -> blocks placed
  const placedBusy = new Map<string, TimeWindow[]>(); // iso -> extra busy windows (from other suggestions)

  for (const entry of ranked) {
    const { item, priority, remainingMinutes, daysUntilDue, reason } = entry;
    const subject = subjectByName.get((item.subject || '').toLowerCase()) ?? null;
    const { basis } = estimateStudyMinutes(item, now);

    let toSchedule = remainingMinutes;
    let blocksForItem = 0;
    let firstExplanation = true;

    for (const dp of dayPlans) {
      if (toSchedule <= 0 || blocksForItem >= maxBlocksPerHomework) break;

      // Never schedule past the deadline day.
      if (daysUntilDue >= 0 && daysBetween(nowIso, dp.iso) > daysUntilDue) break;

      const usedToday = dayUsage.get(dp.iso) ?? 0;
      if (usedToday >= maxBlocksPerDay) continue;

      // Recompute free windows, subtracting blocks already suggested on this day.
      const extra = placedBusy.get(dp.iso) ?? [];
      const effective = subtractWindows(dp.free, extra);
      const available = buildStudyBlocks(effective, blockMinutes, maxBlocksPerDay - usedToday);
      if (available.length === 0) continue;

      for (const b of available) {
        if (toSchedule <= 0 || blocksForItem >= maxBlocksPerHomework) break;
        const used = dayUsage.get(dp.iso) ?? 0;
        if (used >= maxBlocksPerDay) break;

        const minutes = Math.min(blockMinutes, toSchedule);
        const startMin = b.startMin;
        const endMin = startMin + minutes;
        toSchedule -= minutes;
        blocksForItem += 1;
        dayUsage.set(dp.iso, used + 1);

        // Record as busy so later homework won't double-book this slot.
        const list = placedBusy.get(dp.iso) ?? [];
        list.push({ startMin, endMin });
        placedBusy.set(dp.iso, list);

        const subjectId = subject?.id ?? null;
        const explanation = firstExplanation
          ? `${reason} ${basis} for an estimated ${remainingMinutes} min of study. Placed in free time between your commitments.`
          : `Continuation block for ${item.title} (${toSchedule} min still remaining after this block).`;
        firstExplanation = false;

        suggestions.push({
          homeworkId: item.id,
          title: item.title,
          subject: item.subject,
          subjectId,
          priority,
          date: dp.iso,
          day: dp.day,
          startMin,
          endMin,
          minutes,
          explanation,
        });
      }
    }

    // Coverage gap: could not schedule the full estimate before the deadline.
    if (toSchedule > 0) {
      coverageGaps.push({
        homeworkId: item.id,
        title: item.title,
        scheduledMinutes: remainingMinutes - toSchedule,
        estimatedMinutes: remainingMinutes,
        shortfallMinutes: toSchedule,
      });
    }

    if (blocksForItem === 0) {
      unscheduled.push({
        homeworkId: item.id,
        title: item.title,
        reason:
          daysUntilDue < 0
            ? `Already overdue (due ${-daysUntilDue} day(s) ago) and no free time before now.`
            : 'No free study windows within the planning horizon and daily window.',
      });
    }
  }

  // Deterministic output ordering: by date, then start time, then homework id.
  suggestions.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return a.homeworkId.localeCompare(b.homeworkId);
  });

  return { suggestions, unscheduled, coverageGaps };
}

/** Subtract a list of busy windows from a list of free windows. */
function subtractWindows(free: TimeWindow[], busy: TimeWindow[]): TimeWindow[] {
  if (busy.length === 0) return free.map((w) => ({ ...w }));
  const result: TimeWindow[] = [];
  for (const f of free) {
    let segments: TimeWindow[] = [{ ...f }];
    for (const b of busy) {
      const next: TimeWindow[] = [];
      for (const seg of segments) {
        if (b.endMin <= seg.startMin || b.startMin >= seg.endMin) {
          next.push(seg);
          continue;
        }
        if (b.startMin > seg.startMin) {
          next.push({ startMin: seg.startMin, endMin: b.startMin });
        }
        if (b.endMin < seg.endMin) {
          next.push({ startMin: b.endMin, endMin: seg.endMin });
        }
      }
      segments = next;
    }
    result.push(...segments);
  }
  return result.filter((w) => w.endMin > w.startMin);
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Explain why a specific suggestion conflicts (or doesn't) with existing sessions. */
export function explainConflict(
  s: StudySuggestion,
  sessions: Session[],
): { conflicts: boolean; detail: string } {
  const overlapping = sessions.filter((sess) => {
    if (sess.day !== s.day) return false;
    if (!sessionTouchesDate(sess, s.date)) return false;
    const bStart = toMin(sess.startTime);
    const bEnd = toMin(sess.endTime);
    return s.startMin < bEnd && s.endMin > bStart;
  });
  if (overlapping.length === 0) {
    return { conflicts: false, detail: 'No overlap with existing commitments.' };
  }
  const names = overlapping
    .map((o) => `${o.startTime}–${o.endTime} (${o.type})`)
    .join(', ');
  return { conflicts: true, detail: `Overlaps: ${names}` };
}

export function formatMinClock(min: number): string {
  return formatMinTime(min);
}

export { DAY_ORDER };
