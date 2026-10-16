import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react';
import type { ViewMode } from '@/types';
import { getWeekStartISO, getMonthLabel } from '@/utils/calendar';

export type CalendarContextType = {
  view: ViewMode;
  selectedDate: string; // yyyy-MM-dd
  setView: (view: ViewMode) => void;
  setSelectedDate: (date: string) => void;
  goToToday: () => void;
  next: () => void;
  prev: () => void;
  weekStartISO: string; // Monday of the week containing selectedDate (week/day views)
  monthLabel: string; // e.g. "October 2025" (month view)
};

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<ViewMode>('weekly');
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const [selectedDate, setSelectedDateState] = useState<string>(todayISO);

  const setView = useCallback((nextView: ViewMode) => {
    setViewState(nextView);
  }, []);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setSelectedDateState(now.toISOString().slice(0, 10));
  }, []);

  const next = useCallback(() => {
    setSelectedDateState((prev) => {
      const d = new Date(`${prev}T00:00:00`);
      switch (view) {
        case 'month':
          d.setMonth(d.getMonth() + 1);
          break;
        case 'day':
          d.setDate(d.getDate() + 1);
          break;
        default: // weekly, agenda
          d.setDate(d.getDate() + 7);
          break;
      }
      return d.toISOString().slice(0, 10);
    });
  }, [view]);

  const prev = useCallback(() => {
    setSelectedDateState((prev) => {
      const d = new Date(`${prev}T00:00:00`);
      switch (view) {
        case 'month':
          d.setMonth(d.getMonth() - 1);
          break;
        case 'day':
          d.setDate(d.getDate() - 1);
          break;
        default: // weekly, agenda
          d.setDate(d.getDate() - 7);
          break;
      }
      return d.toISOString().slice(0, 10);
    });
  }, [view]);

  const weekStartISO = useMemo(() => getWeekStartISO(selectedDate), [selectedDate]);
  const monthLabel = useMemo(() => {
    const [year, month] = selectedDate.split('-').map(Number);
    return getMonthLabel(year, month - 1);
  }, [selectedDate]);

  const value = useMemo(
    () => ({
      view,
      selectedDate,
      setView,
      setSelectedDate,
      goToToday,
      next,
      prev,
      weekStartISO,
      monthLabel,
    }),
    [view, selectedDate, setView, setSelectedDate, goToToday, next, prev, weekStartISO, monthLabel],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}

export { CalendarContext };
