import { useTimetable } from '@/hooks/useTimetable';
import { useTimetableLayout } from '@/context/TimetableLayoutContext';
import { SessionBlock } from './SessionBlock';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { isToday } from '@/types';
import { cn } from '@/utils/cn';

interface DayColumnProps {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 0;
  className?: string;
}

export function DayColumn({ day, className }: DayColumnProps) {
  const { getSessionsForDay, getSubject } = useTimetable();
  const { config, getTimeSlots, getSessionTop, getSessionHeight } = useTimetableLayout();
  const sessions = getSessionsForDay(day);
  const today = isToday(day);
  const timeSlots = getTimeSlots();

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden',
        'bg-white dark:bg-neutral-950',
        today && 'bg-brand-50/50 dark:bg-brand-900/10',
        className
      )}
      style={{
        height: config.pixelsPerHour * 24 + config.headerHeight,
        flexShrink: 0,
      } as React.CSSProperties}
      role="gridcell"
      aria-label={getDayLabel(day)}
    >
      <div className="flex h-10 items-center justify-center px-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <span className={cn(
          'font-medium text-sm',
          today ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-700 dark:text-neutral-300'
        )}>
          {getDayShortLabel(day)}
        </span>
        {today && (
          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Today
          </span>
        )}
      </div>
      <div
        className="relative overflow-hidden"
        style={{
          height: config.pixelsPerHour * 24,
          flexShrink: 0,
        } as React.CSSProperties}
      >
        <div
          className="absolute inset-0 grid border-b border-neutral-100 dark:border-neutral-800"
          style={{
            gridTemplateRows: `repeat(${timeSlots.length}, ${config.pixelsPerHour * config.timeIncrement / 60}px)`,
          }}
        >
          {timeSlots.map((time, index) => (
            <div
              key={time}
              data-time={time}
              className="relative border-t border-neutral-100 dark:border-neutral-800"
            >
              {index < timeSlots.length - 1 && (
                <div className="absolute bottom-0 left-0 right-0 border-b border-dashed border-neutral-200 dark:border-neutral-700" />
              )}
            </div>
          ))}
        </div>
        {sessions.map(session => {
          const subject = getSubject(session.subjectId);
          if (!subject) return null;
          const top = getSessionTop(session.startTime);
          const height = getSessionHeight(session.startTime, session.endTime);
          return (
            <SessionBlock
              key={session.id}
              session={session}
              subject={subject}
              top={top}
              height={height}
            />
          );
        })}
        <CurrentTimeIndicator day={day} timeRange={config.timeRange} timeIncrement={config.timeIncrement} />
      </div>
    </div>
  );
}

function getDayLabel(day: 1 | 2 | 3 | 4 | 5 | 6 | 0): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || '';
}

function getDayShortLabel(day: 1 | 2 | 3 | 4 | 5 | 6 | 0): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[day] || '';
}