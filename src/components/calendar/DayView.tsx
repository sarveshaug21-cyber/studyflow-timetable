import { useCallback } from 'react';
import { addDays, format, getDay } from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useSensor } from '@dnd-kit/core';
import { cn } from '@/utils/cn';
import { useTimetable } from '@/hooks/useTimetable';
import { useTimetableLayout } from '@/context/TimetableLayoutContext';
import { useCalendar } from '@/hooks/useCalendar';
import { useCreateSession } from '@/hooks/useCreateSession';
import { TimeAxis } from '@/components/timetable/TimeAxis';
import { SessionBlock } from '@/components/timetable/SessionBlock';
import { CurrentTimeIndicator } from '@/components/timetable/CurrentTimeIndicator';
import { isToday } from '@/types';
import { timeToMinutes } from '@/utils/date';
import {
  shiftSessionByPixels,
  addMinutes,
  durationMinutes,
  assignColumns,
} from '@/utils/calendar';
import type { DayOfWeek } from '@/types';
import { sessionsOnDate } from '@/utils/calendar';

export function DayView({
  onCreateSession,
}: {
  onCreateSession?: (date: string, startTime: string, endTime: string, day: DayOfWeek) => void;
}) {
  const { state, subjects, sessions: allSessions, updateSession } = useTimetable();
  const { config, getSessionTop, getSessionHeight } = useTimetableLayout();
  const { selectedDate } = useCalendar();

  const dayOfWeek = getDay(new Date(`${selectedDate}T00:00:00`)) as DayOfWeek;
  const allSessionsOnDate = sessionsOnDate(state.sessions, selectedDate);
  const allDaySessions = allSessionsOnDate.filter((s) => s.allDay);
  const timedSessions = allSessionsOnDate.filter((s) => !s.allDay);

  const sensors = useSensor(PointerSensor);
  const pixelsPerMinute = config.pixelsPerHour / 60;

  const { containerRef, onPointerDown, preview } = useCreateSession({
    date: selectedDate,
    day: dayOfWeek,
    config,
    onCreate: onCreateSession ?? (() => {}),
  });

  const assigned = assignColumns(timedSessions);
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

          {/* All-day strip */}
          {allDaySessions.length > 0 && (
            <div className="flex flex-col gap-0.5 px-2 pt-1 pb-1 border-b border-neutral-200 dark:border-neutral-800">
              {allDaySessions.map((session) => {
                const subject = subjects.find((s) => s.id === session.subjectId);
                if (!subject) return null;
                return (
                  <SessionBlock
                    key={session.id}
                    session={session}
                    subject={subject}
                    top={0}
                    height={32}
                  />
                );
              })}
            </div>
          )}

          {/* Empty state when there are no sessions on this date */}
          {timedSessions.length === 0 && allDaySessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 mb-4">
                <svg className="h-6 w-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                No sessions on {format(new Date(selectedDate), 'EEEE, MMMM d')}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400">
                Click on a time slot to add a study session.
              </p>
            </div>
          )}

          <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{
              height: config.pixelsPerHour * 24,
              flexShrink: 0,
              touchAction: 'none',
            } as React.CSSProperties}
            onPointerDown={onPointerDown}
          >
            {selectedDate && onCreateSession && preview && (
              <div
                className="absolute left-1 right-1 bg-brand-500/20 border border-brand-500/50 rounded-sm pointer-events-none"
                style={{ top: preview.top, height: preview.height }}
              />
            )}
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
              {assigned.map((session) => {
                const subject = subjects.find((s) => s.id === session.subjectId);
                if (!subject) return null;
                // Overnight sessions span midnight: on the start date they run
                // from startTime to range end; on the following day they run
                // from 00:00 to endTime.
                const isOvernightContinuation =
                  session.overnight &&
                  session.date &&
                  selectedDate === format(addDays(session.date, 1), 'yyyy-MM-dd');
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
