import { useTimetable } from '@/hooks/useTimetable';
import { TimeAxis } from './TimeAxis';
import { DayColumn } from './DayColumn';
import { WEEKDAYS, ALL_DAYS } from '@/types';
import { useRef, useEffect } from 'react';

export function TimetableGrid() {
  const { state } = useTimetable();
  const days = state.showWeekends ? ALL_DAYS : WEEKDAYS;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
          {days.map(day => (
            <DayColumn key={day} day={day} />
          ))}
        </div>
      </div>
    </div>
  );
}