import { useTimetable } from '@/hooks/useTimetable';
import { useCalendar } from '@/hooks/useCalendar';
import { TimeAxis } from './TimeAxis';
import { DayColumn } from './DayColumn';
import { WEEKDAYS, ALL_DAYS } from '@/types';
import { getWeekDates } from '@/utils/calendar';
import { type DayOfWeek } from '@/types';
import { useRef, useEffect } from 'react';

export function TimetableGrid({ onCreateSession }: { onCreateSession?: (date: string, startTime: string, endTime: string, day: DayOfWeek) => void }) {
  const { state } = useTimetable();
  const { weekStartISO } = useCalendar();
  const days = state.showWeekends ? ALL_DAYS : WEEKDAYS;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // One ISO date per column: Monday is index 0, Sunday is index 6.
  const weekDates = weekStartISO ? getWeekDates(weekStartISO) : [];
  const dateFor = (day: DayOfWeek): string => {
    const index = day === 0 ? 6 : day - 1;
    return weekDates[index] ?? '';
  };

  // Expose scroll container for programmatic scrolling
  useEffect(() => {
    if (scrollContainerRef.current) {
      (window as Window & { __timetableScrollContainer?: HTMLDivElement | null }).__timetableScrollContainer = scrollContainerRef.current;
    }
    return () => {
      (window as Window & { __timetableScrollContainer?: HTMLDivElement | null }).__timetableScrollContainer = null;
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="flex overflow-auto"
      style={{ minHeight: 'calc(100vh - 200px)' }}
      data-timetable-grid
      role="grid"
      aria-label="Weekly timetable"
    >
      <div className="sticky left-0 z-10 flex-shrink-0">
        <TimeAxis />
      </div>
      <div className="flex min-w-0 flex-1">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${days.length}, 1fr)`,
            minWidth: days.length * 150,
          } as React.CSSProperties}
        >
          {days.map((day) => (
            <DayColumn
              key={day}
              day={day}
              date={dateFor(day)}
              onCreateSession={onCreateSession}
            />
          ))}
        </div>
      </div>
    </div>
  );
}