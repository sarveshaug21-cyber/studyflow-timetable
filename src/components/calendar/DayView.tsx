import { useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor } from '@dnd-kit/core';
import { format, getDay } from 'date-fns';
import { cn } from '@/utils/cn';
import { useTimetable } from '@/hooks/useTimetable';
import { useTimetableLayout } from '@/context/TimetableLayoutContext';
import { useCalendar } from '@/hooks/useCalendar';
import { TimeAxis } from '@/components/timetable/TimeAxis';
import { SessionBlock } from '@/components/timetable/SessionBlock';
import { CurrentTimeIndicator } from '@/components/timetable/CurrentTimeIndicator';
import { isToday } from '@/types';
import { timeToMinutes } from '@/utils/date';
import { shiftSessionByPixels, addMinutes, durationMinutes } from '@/utils/calendar';
import type { DayOfWeek } from '@/types';
import { sessionsOnDate } from '@/utils/calendar';

export function DayView() {
  const { state, subjects, sessions: allSessions, updateSession } = useTimetable();
  const { config, getSessionTop, getSessionHeight } = useTimetableLayout();
  const { selectedDate } = useCalendar();

  const dayOfWeek = getDay(new Date(`${selectedDate}T00:00:00`)) as DayOfWeek;
  const sessions = useMemo(
    () => sessionsOnDate(state.sessions, selectedDate),
    [state.sessions, selectedDate],
  );

  const sensors = useSensor(PointerSensor);
  const pixelsPerMinute = config.pixelsPerHour / 60;

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const id = String(event.active.id);
      const isResize = id.startsWith('resize:');
      const sessionId = id.replace(/^(move:|resize:)/, '');
      const session = allSessions.find((s) => s.id === sessionId);
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
    [allSessions, updateSession, config, pixelsPerMinute],
  );

  return (
    <div className="flex overflow-auto h-full" data-day-view role="grid" aria-label="Day timetable">
      <div className="sticky left-0 z-10 flex-shrink-0">
        <TimeAxis />
      </div>
      <div className="flex min-w-0 flex-1">
        <div
          className="relative flex flex-col overflow-hidden bg-white dark:bg-neutral-950"
          style={{
            height: config.pixelsPerHour * 24 + config.headerHeight,
            flexShrink: 0,
          }}
          role="gridcell"
          aria-label={`${format(new Date(selectedDate), 'EEEE MMM d')}${isToday(dayOfWeek) ? ' (today)' : ''}`}
        >
          <div className="flex h-10 items-center justify-center px-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <span className={cn(
              'font-medium text-sm',
              isToday(dayOfWeek) ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-700 dark:text-neutral-300',
            )}>
              {format(new Date(selectedDate), 'EEE MMM d')}
            </span>
            {isToday(dayOfWeek) && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                Today
              </span>
            )}
          </div>
          <div
            className="relative overflow-hidden"
            style={{ height: config.pixelsPerHour * 24, flexShrink: 0 }}
          >
            <div
              className="absolute inset-0 grid border-b border-neutral-100 dark:border-neutral-800"
              style={{
                gridTemplateRows: `repeat(48, ${config.pixelsPerHour * 0.5}px)`,
              }}
            >
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="relative border-t border-neutral-100 dark:border-neutral-800" />
              ))}
            </div>
            <DndContext sensors={[sensors]} onDragEnd={onDragEnd}>
              {sessions.map((session) => {
                const subject = subjects.find((s) => s.id === session.subjectId);
                if (!subject) return null;
                return (
                  <SessionBlock
                    key={session.id}
                    session={session}
                    subject={subject}
                    top={getSessionTop(session.startTime)}
                    height={getSessionHeight(session.startTime, session.endTime)}
                  />
                );
              })}
            </DndContext>
            <CurrentTimeIndicator
              day={dayOfWeek}
              timeRange={config.timeRange}
              timeIncrement={config.timeIncrement}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
