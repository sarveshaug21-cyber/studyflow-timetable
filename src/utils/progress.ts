import type { FocusSession, HomeworkItem } from '@/types';
import { getOverdueHomeworkFromArray } from '@/context/TimetableContext';
import { format } from 'date-fns';

export interface SubjectBreakdown {
  subject: string;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface DailyPoint {
  date: string;
  label: string;
  focusMinutes: number;
  homeworkCompleted: number;
}

export interface ProgressStats {
  homework: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    completedThisWeek: number;
    completedDateUnknown: number;
    hasAnyHomework: boolean;
  };
  focus: {
    totalSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    interruptedSessions: number;
    totalFocusMinutes: number;
    totalUnverifiedMinutes: number;
    averageSessionMinutes: number | null;
    hasAnySession: boolean;
  };
  weekly: DailyPoint[];
  subjects: SubjectBreakdown[];
}

export function isHomeworkDone(status: HomeworkItem['status']): boolean {
  return status === 'completed' || status === 'submitted';
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Last `days` calendar days ending today (inclusive), oldest first. */
export function buildDailyWindow(now: Date, days = 7): DailyPoint[] {
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(now);
    date.setDate(date.getDate() - i);
    points.push({
      date: dayKey(date),
      label: format(date, 'EEE'),
      focusMinutes: 0,
      homeworkCompleted: 0,
    });
  }
  return points;
}

export function computeProgressStats(
  homework: HomeworkItem[],
  focusHistory: FocusSession[],
  now: Date = new Date(),
  weekDays = 7,
): ProgressStats {
  const today = startOfDay(now);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - (weekDays - 1));

  const doneItems = homework.filter((h) => isHomeworkDone(h.status));
  const overdueItems = getOverdueHomeworkFromArray(homework);
  // Pending = not done and not overdue (overdue items may still carry status 'pending' in source data)
  const pendingCount = homework.length - doneItems.length - overdueItems.length;

  let completedThisWeek = 0;
  let completedDateUnknown = 0;
  for (const item of doneItems) {
    if (!item.completedAt) {
      completedDateUnknown += 1;
      continue;
    }
    const completedDate = startOfDay(new Date(item.completedAt));
    if (!Number.isNaN(completedDate.getTime()) && completedDate >= weekStart && completedDate <= today) {
      completedThisWeek += 1;
    }
  }

  const completedSessions = focusHistory.filter((s) => s.status === 'completed');
  const cancelledSessions = focusHistory.filter((s) => s.status === 'cancelled');
  const interruptedSessions = focusHistory.filter((s) => s.status === 'interrupted');

  const totalFocusSeconds = completedSessions.reduce((sum, s) => sum + Math.max(0, s.actualDurationSec), 0);
  const totalUnverifiedSeconds = interruptedSessions.reduce((sum, s) => sum + Math.max(0, s.actualDurationSec), 0);

  const weekly = buildDailyWindow(now, weekDays);
  const byDate = new Map(weekly.map((p) => [p.date, p]));

  for (const session of focusHistory) {
    const ended = new Date(session.endedAt);
    if (Number.isNaN(ended.getTime())) continue;
    // Only completed sessions count toward verified focus time on the chart.
    if (session.status !== 'completed') continue;
    const point = byDate.get(dayKey(ended));
    if (point) {
      point.focusMinutes += Math.round(Math.max(0, session.actualDurationSec) / 60);
    }
  }

  for (const item of doneItems) {
    if (!item.completedAt) continue;
    const completedDate = new Date(item.completedAt);
    if (Number.isNaN(completedDate.getTime())) continue;
    const point = byDate.get(dayKey(completedDate));
    if (point) {
      point.homeworkCompleted += 1;
    }
  }

  const subjectMap = new Map<string, SubjectBreakdown>();
  const overdueIds = new Set(overdueItems.map((h) => h.id));
  for (const item of homework) {
    const key = item.subject || 'Unassigned';
    let entry = subjectMap.get(key);
    if (!entry) {
      entry = { subject: key, total: 0, completed: 0, pending: 0, overdue: 0 };
      subjectMap.set(key, entry);
    }
    entry.total += 1;
    if (isHomeworkDone(item.status)) {
      entry.completed += 1;
    } else if (overdueIds.has(item.id)) {
      entry.overdue += 1;
    } else {
      entry.pending += 1;
    }
  }
  const subjects = [...subjectMap.values()].sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject));

  return {
    homework: {
      total: homework.length,
      completed: doneItems.length,
      pending: Math.max(0, pendingCount),
      overdue: overdueItems.length,
      completedThisWeek,
      completedDateUnknown,
      hasAnyHomework: homework.length > 0,
    },
    focus: {
      totalSessions: focusHistory.length,
      completedSessions: completedSessions.length,
      cancelledSessions: cancelledSessions.length,
      interruptedSessions: interruptedSessions.length,
      totalFocusMinutes: Math.round(totalFocusSeconds / 60),
      totalUnverifiedMinutes: Math.round(totalUnverifiedSeconds / 60),
      averageSessionMinutes:
        completedSessions.length > 0
          ? Math.round(totalFocusSeconds / completedSessions.length / 60)
          : null,
      hasAnySession: focusHistory.length > 0,
    },
    weekly,
    subjects,
  };
}

export function formatTotalMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
