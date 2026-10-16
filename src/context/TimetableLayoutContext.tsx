import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import type { TimeRange, TimeIncrement } from '@/types';

export interface TimetableLayoutConfig {
  timeRange: TimeRange;
  timeIncrement: TimeIncrement;
  pixelsPerHour: number;
  headerHeight: number;
  timeAxisWidth: number;
}

export interface TimetableLayoutContextType {
  config: TimetableLayoutConfig;
  setConfig: (config: Partial<TimetableLayoutConfig>) => void;
  setTimeRange: (range: TimeRange) => void;
  setTimeIncrement: (increment: TimeIncrement) => void;
  getTimeSlots: () => string[];
  getTotalMinutes: () => number;
  getPixelsPerMinute: () => number;
  getSessionTop: (startTime: string) => number;
  getSessionHeight: (startTime: string, endTime: string) => number;
  getHourTop: (hour: number) => number;
  getHourLabel: (hour: number) => string;
  timeToPixels: (time: string) => number;
}

const DEFAULT_CONFIG_BASE = {
  timeIncrement: 30 as TimeIncrement,
  pixelsPerHour: 60,
  headerHeight: 40,
  timeAxisWidth: 60,
};

const TimetableLayoutContext = createContext<TimetableLayoutContextType | undefined>(undefined);

export function TimetableLayoutProvider({ children }: { children: React.ReactNode }) {
  const { state } = useTimetable();
  const [config, setConfigState] = useState(() => ({
    ...DEFAULT_CONFIG_BASE,
    timeRange: state.timeRange,
  }));

  // Sync with timetable context's timeRange and timeIncrement
  useEffect(() => {
    setConfigState(prev => ({
      ...prev,
      timeRange: state.timeRange,
      timeIncrement: state.timeIncrement,
    }));
  }, [state.timeRange, state.timeIncrement]);

  const setConfig = useCallback((newConfig: Partial<TimetableLayoutConfig>) => {
    setConfigState(prev => ({ ...prev, ...newConfig }));
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    setConfigState(prev => ({ ...prev, timeRange: range }));
  }, []);

  const setTimeIncrement = useCallback((increment: TimeIncrement) => {
    setConfigState(prev => ({ ...prev, timeIncrement: increment }));
  }, []);

  const timeSlots = useMemo(() => {
    const { timeRange, timeIncrement } = config;
    const slots: string[] = [];
    const startMinutes = timeToMinutes(timeRange.start);
    const endMinutes = timeToMinutes(timeRange.end);
    
    let current = startMinutes;
    while (current < endMinutes) {
      slots.push(minutesToTime(current));
      current += timeIncrement;
    }
    return slots;
  }, [config]);

  const totalMinutes = useMemo(() => {
    const { timeRange } = config;
    return timeToMinutes(timeRange.end) - timeToMinutes(timeRange.start);
  }, [config]);

  const pixelsPerMinute = useMemo(() => {
    return config.pixelsPerHour / 60;
  }, [config.pixelsPerHour]);

  const getTimeSlots = useCallback(() => timeSlots, [timeSlots]);

  const getTotalMinutes = useCallback(() => totalMinutes, [totalMinutes]);

  const getPixelsPerMinute = useCallback(() => pixelsPerMinute, [pixelsPerMinute]);

  const getSessionTop = useCallback((startTime: string) => {
    const { timeRange } = config;
    const startMinutes = timeToMinutes(timeRange.start);
    const sessionStartMinutes = timeToMinutes(startTime);
    const diffMinutes = sessionStartMinutes - startMinutes;
    return diffMinutes * pixelsPerMinute;
  }, [config, pixelsPerMinute]);

  const getSessionHeight = useCallback((startTime: string, endTime: string) => {
    const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
    return durationMinutes * pixelsPerMinute;
  }, [pixelsPerMinute]);

  const getHourTop = useCallback((hour: number) => {
    const { timeRange } = config;
    const startMinutes = timeToMinutes(timeRange.start);
    const hourMinutes = hour * 60;
    const diffMinutes = hourMinutes - startMinutes;
    return diffMinutes * pixelsPerMinute;
  }, [config, pixelsPerMinute]);

  const getHourLabel = useCallback((hour: number) => {
    const displayHour = hour % 24;
    return `${displayHour.toString().padStart(2, '0')}:00`;
  }, []);

  const timeToPixels = useCallback((time: string) => {
    const { timeRange } = config;
    const startMinutes = timeToMinutes(timeRange.start);
    const timeMinutes = timeToMinutes(time);
    const diffMinutes = timeMinutes - startMinutes;
    return diffMinutes * pixelsPerMinute;
  }, [config, pixelsPerMinute]);

  const value = useMemo(() => ({
    config,
    setConfig,
    setTimeRange,
    setTimeIncrement,
    getTimeSlots,
    getTotalMinutes,
    getPixelsPerMinute,
    getSessionTop,
    getSessionHeight,
    getHourTop,
    getHourLabel,
    timeToPixels,
  }), [
    config,
    setConfig,
    setTimeRange,
    setTimeIncrement,
    getPixelsPerMinute,
    getTotalMinutes,
    getTimeSlots,
    getSessionTop,
    getSessionHeight,
    getHourTop,
    getHourLabel,
    timeToPixels,
  ]);

  return (
    <TimetableLayoutContext.Provider value={value}>
      {children}
    </TimetableLayoutContext.Provider>
  );
}

export function useTimetableLayout() {
  const context = useContext(TimetableLayoutContext);
  if (!context) {
    throw new Error('useTimetableLayout must be used within a TimetableLayoutProvider');
  }
  return context;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}