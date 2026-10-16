import { useMemo } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Hourglass,
  Flame,
  CalendarCheck2,
} from 'lucide-react';
import { useFocus } from '@/hooks/useFocus';
import { useTimetable } from '@/hooks/useTimetable';
import { computeProgressStats, formatTotalMinutes, type DailyPoint } from '@/utils/progress';
import { cn } from '@/utils/cn';

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'amber' | 'brand' | 'neutral';
}) {
  const accents = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    brand: 'text-brand-600 dark:text-brand-400',
    neutral: 'text-neutral-600 dark:text-neutral-400',
  };
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <span className={cn(accents[accent ?? 'neutral'])} aria-hidden="true">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>}
    </div>
  );
}

function BarChart({
  points,
  valueKey,
  title,
  emptyMessage,
  barClass,
  formatValue,
}: {
  points: DailyPoint[];
  valueKey: 'focusMinutes' | 'homeworkCompleted';
  title: string;
  emptyMessage: string;
  barClass: string;
  formatValue?: (v: number) => string;
}) {
  const hasAny = points.some((p) => p[valueKey] > 0);
  const max = Math.max(1, ...points.map((p) => p[valueKey]));

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {!hasAny ? (
        <p className="mt-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label={title}>
          {points.map((point) => {
            const value = point[valueKey];
            const height = value > 0 ? Math.max(8, (value / max) * 100) : 4;
            return (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400">
                  {value > 0 ? (formatValue ? formatValue(value) : String(value)) : ''}
                </span>
                <div
                  className={cn(
                    'w-full rounded-t',
                    value > 0 ? barClass : 'bg-neutral-100 dark:bg-neutral-800',
                  )}
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${value}`}
                />
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{point.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProgressDashboard() {
  const { homework } = useTimetable();
  const { history } = useFocus();

  const stats = useMemo(() => computeProgressStats(homework, history, new Date()), [homework, history]);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Progress
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Real statistics from your StudyFlow data — nothing is invented.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Homework done"
            value={stats.homework.hasAnyHomework ? `${stats.homework.completed} / ${stats.homework.total}` : '—'}
            sub={
              stats.homework.hasAnyHomework
                ? stats.homework.completedDateUnknown > 0
                  ? `${stats.homework.completedDateUnknown} completed before dates were tracked`
                  : 'Completed or submitted'
                : 'No homework data yet'
            }
            accent="green"
          />
          <StatCard
            icon={<Hourglass className="h-4 w-4" />}
            label="Pending"
            value={stats.homework.hasAnyHomework ? String(stats.homework.pending) : '—'}
            sub={stats.homework.hasAnyHomework ? 'Not yet overdue' : 'No homework data yet'}
            accent="neutral"
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overdue"
            value={stats.homework.hasAnyHomework ? String(stats.homework.overdue) : '—'}
            sub={stats.homework.hasAnyHomework ? 'Past due date' : 'No homework data yet'}
            accent={stats.homework.overdue > 0 ? 'red' : 'neutral'}
          />
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Focus time"
            value={stats.focus.hasAnySession ? formatTotalMinutes(stats.focus.totalFocusMinutes) : '—'}
            sub={
              stats.focus.hasAnySession
                ? `${stats.focus.completedSessions} completed session${stats.focus.completedSessions === 1 ? '' : 's'}${
                    stats.focus.averageSessionMinutes !== null
                      ? ` · avg ${stats.focus.averageSessionMinutes}m`
                      : ''
                  }`
                : 'No focus sessions yet'
            }
            accent="brand"
          />
        </div>

        {stats.focus.interruptedSessions > 0 && (
          <p className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {stats.focus.interruptedSessions} interrupted session
            {stats.focus.interruptedSessions === 1 ? '' : 's'} (
            {formatTotalMinutes(stats.focus.totalUnverifiedMinutes)} wall-clock) could not be verified
            as completed — they are excluded from focus time on purpose.
            {stats.focus.cancelledSessions > 0 &&
              ` ${stats.focus.cancelledSessions} cancelled session${stats.focus.cancelledSessions === 1 ? '' : 's'} also excluded.`}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <BarChart
            points={stats.weekly}
            valueKey="focusMinutes"
            title={`Focus minutes — last ${stats.weekly.length} days`}
            emptyMessage={
              stats.focus.hasAnySession
                ? 'No completed focus sessions in the last 7 days.'
                : 'No focus sessions recorded yet.'
            }
            barClass="bg-brand-500"
            formatValue={(v) => `${v}m`}
          />
          <BarChart
            points={stats.weekly}
            valueKey="homeworkCompleted"
            title={`Homework completed — last ${stats.weekly.length} days`}
            emptyMessage={
              stats.homework.hasAnyHomework
                ? stats.homework.completedDateUnknown > 0
                  ? 'Completed homework exists but has no completion date (added before date tracking).'
                  : 'No homework marked complete in the last 7 days.'
                : 'No homework yet.'
            }
            barClass="bg-green-500"
          />
        </div>

        <section
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
          aria-label="Subject breakdown"
        >
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Subject breakdown
          </h3>
          {!stats.homework.hasAnyHomework ? (
            <p className="mt-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Add homework to see per-subject progress.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    <th className="py-2 pr-4 font-medium">Subject</th>
                    <th className="py-2 pr-4 font-medium text-right">Total</th>
                    <th className="py-2 pr-4 font-medium text-right">Done</th>
                    <th className="py-2 pr-4 font-medium text-right">Pending</th>
                    <th className="py-2 font-medium text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.subjects.map((s) => (
                    <tr
                      key={s.subject}
                      className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium text-neutral-900 dark:text-neutral-100">
                        {s.subject}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                        {s.total}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-green-600 dark:text-green-400">
                        {s.completed}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                        {s.pending}
                      </td>
                      <td
                        className={cn(
                          'py-2 text-right tabular-nums',
                          s.overdue > 0
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : 'text-neutral-600 dark:text-neutral-300',
                        )}
                      >
                        {s.overdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
          aria-label="Weekly homework completion"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <CalendarCheck2 className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            This week
          </h3>
          {stats.homework.hasAnyHomework ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <Clock3 className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              {stats.homework.completedThisWeek} homework item
              {stats.homework.completedThisWeek === 1 ? '' : 's'} marked complete in the last 7 days.
            </p>
          ) : (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              No homework data yet — statistics will appear once you add or sync homework.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
