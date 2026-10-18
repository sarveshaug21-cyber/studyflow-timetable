import { useCallback } from 'react';
import { addDays, format } from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useSensor } from '@dnd-kit/core';
import { useTimetable } from '@/hooks/useTimetable';
import { useTimetableLayout } from '@/context/TimetableLayoutContext';
import { SessionBlock } from './SessionBlock';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { useCreateSession } from '@/hooks/useCreateSession';
import { timeToMinutes } from '@/utils/date';
import {
  shiftSessionByPixels,
  addMinutes,
  durationMinutes,
  assignColumns,
} from '@/utils/calendar';
import { isToday, type DayOfWeek } from '@/types';
import { cn } from '@/utils/cn';

interface DayColumnProps {
  day: DayOfWeek;
  /** ISO date (yyyy-MM-dd) of this column's date (weekly view). */
  date?: string;
  /** Callback when the user clicks/drags an empty slot to create a session. */
  onCreateSession?: (date: string, startTime: string, endTime: string, day: DayOfWeek) => void;
  className?: string;
}

export function DayColumn({
  day,
  date,
  onCreateSession,
  className,
}: DayColumnProps) {
  const { getSessionsForDay, getSubject, sessions, updateSession } = useTimetable();
  const { config, getTimeSlots, getSessionTop, getSessionHeight } = useTimetableLayout();
  const columnSessions = getSessionsForDay(day);
  const today = isToday(day);
  const timeSlots = getTimeSlots();

  const sensors = useSensor(PointerSensor);
  const pixelsPerMinute = config.pixelsPerHour / 60;

  const { containerRef, onPointerDown, preview } = useCreateSession({
    date: date ?? '',
    day,
    config,
    onCreate: onCreateSession ?? (() => {}),
  });

  const assigned = assignColumns(columnSessions);
  const maxColumns =
    assigned.length > 0
      ? Math.max(...assigned.map((s) => s.column)) + 1
      : 1;
  const colWidth = 100 / maxColumns;

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const id = String(event.active.id);
      const isResize = id.startsWith('resize:');
      const sessionId = id.replace(/^(move:|resize:)/, '');
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      if (isResize) {
        const deltaMinutes = Math.round(event.delta.y / pixelsPerMinute);
        const duration = Math.max(30, durationMinutes(session.startTime, session.endTime) + deltaMinutes);
        const endTime = addMinutes(session.startTime, duration);
        const rangeEndMinutes = timeToMinutes(config.timeRange.end);
        if (timeToMinutes(endTime) > rangeEndMinutes) {
          const newDuration = rangeEndMinutes - timeToMinutes(session.startTime);
          if (newDuration < 30) return;
          updateSession({ ...session, endTime: addMinutes(session.startTime, newDuration) });
          return;
        }
        updateSession({ ...session, endTime });
        return;
      }

      const { startTime, endTime } = shiftSessionByPixels(
        session,
        event.delta.y,
        pixelsPerMinute,
        config.timeRange,
        config.timeIncrement,
      );
      updateSession({ ...session, startTime, endTime });
    },
    [sessions, updateSession, config, pixelsPerMinute],
  );

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
        ref={containerRef}
        className="relative overflow-hidden"
        data-testid="day-column-grid"
        style={{
          height: config.pixelsPerHour * 24,
          flexShrink: 0,
          touchAction: 'none',
        } as React.CSSProperties}
        onPointerDown={onPointerDown}
      >
        {date && onCreateSession && preview && (
          <div
            className="absolute left-1 right-1 bg-brand-500/20 border border-brand-500/50 rounded-sm pointer-events-none"
            style={{ top: preview.top, height: preview.height }}
          />
        )}
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
        <DndContext sensors={[sensors]} onDragEnd={onDragEnd}>
          {assigned.map((session) => {
            const subject = getSubject(session.subjectId);
            if (!subject) return null;
            // Overnight sessions span midnight: on the start date they run from
            // startTime to range end; on the following day they run from 00:00
            // to endTime.
            const isOvernightContinuation =
              session.overnight &&
              session.date &&
              date === format(addDays(session.date, 1), 'yyyy-MM-dd');
            const renderStartTime = isOvernightContinuation
              ? '00:00'
              : session.startTime;
            const top = getSessionTop(renderStartTime);
            const height = getSessionHeight(
              renderStartTime,
              session.endTime,
            );
            return (
              <SessionBlock
                key={session.id}
                session={session}
                subject={subject}
                top={top}
                height={height}
                left={session.column * colWidth}
                width={colWidth}
              />
            );
          })}
        </DndContext>
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