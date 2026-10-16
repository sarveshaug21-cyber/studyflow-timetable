import { useCalendar } from '@/hooks/useCalendar';
import { getDayLabel } from '@/types';
import { cn } from '@/utils/cn';
import type { MonthDay } from '@/utils/calendar';
import type { Session, Subject } from '@/types';
import { MonthEvent } from './MonthEvent';

const MAX_VISIBLE_EVENTS = 3;

interface MonthCellProps {
  day: MonthDay;
  sessions: Session[];
  subjects: Subject[];
  onSelectDate: (date: string) => void;
  onSessionClick: (session: Session) => void;
}

export function MonthCell({
  day,
  sessions,
  subjects,
  onSelectDate,
  onSessionClick,
}: MonthCellProps) {
  const { setSelectedDate } = useCalendar();
  const allDay = sessions.filter((s) => s.allDay);
  const timed = sessions.filter((s) => !s.allDay);

  const handleCellClick = () => {
    setSelectedDate(day.date);
    onSelectDate(day.date);
  };

  const moreCount = timed.length - MAX_VISIBLE_EVENTS;

  return (
    <div
      className={cn(
        'flex flex-col border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950',
        day.isToday && 'bg-brand-50/50 dark:bg-brand-900/10 ring-1 ring-brand-500 dark:ring-brand-400',
        !day.isCurrentMonth && 'bg-neutral-50/50 dark:bg-neutral-950/50 text-neutral-400 dark:text-neutral-500',
        'hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors',
      )}
      role="gridcell"
      aria-label={
        day.isCurrentMonth
          ? `${getDayLabel(day.dayOfWeek)}, ${day.date}${day.isToday ? ' (today)' : ''}${
              sessions.length ? `, ${sessions.length} session${sessions.length === 1 ? '' : 's'}` : ''
            }`
          : ''
      }
      onClick={day.isCurrentMonth ? handleCellClick : undefined}
      style={{ minHeight: 110 }}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <span
          className={cn(
            'text-sm font-medium',
            !day.isCurrentMonth ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200',
            day.isToday && 'text-brand-700 dark:text-brand-300',
          )}
        >
          {day.isCurrentMonth ? new Date(day.date).getDate() : ''}
        </span>
        {day.isToday && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Today
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* All-day strip */}
        {allDay.length > 0 && (
          <div className="flex flex-col gap-1 px-2 pt-1">
            {allDay.map((session) => {
              const subject = subjects.find((s) => s.id === session.subjectId);
              if (!subject) return null;
              return (
                <MonthEvent
                  key={session.id}
                  session={session}
                  subject={subject}
                  isAllDay
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionClick(session);
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Timed events */}
        <div className="flex-1 flex flex-col gap-1 px-2 pb-1">
          {timed.slice(0, MAX_VISIBLE_EVENTS).map((session) => {
            const subject = subjects.find((s) => s.id === session.subjectId);
            if (!subject) return null;
            return (
              <MonthEvent
                key={session.id}
                session={session}
                subject={subject}
                onClick={(e) => {
                  e.stopPropagation();
                  onSessionClick(session);
                }}
              />
            );
          })}
          {moreCount > 0 && (
            <div
              className="flex items-center justify-center px-1.5 py-0.5 rounded border border-dashed text-[10px] font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDate(day.date);
                }
              }}
              onClick={() => onSelectDate(day.date)}
            >
              +{moreCount} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
