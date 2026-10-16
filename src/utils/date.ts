import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import type { DayOfWeek, TimeRange } from '@/types';
import type { TimetableLayoutConfig } from '@/types';

export function getWeekStart(date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function formatWeekRange(date: Date): string {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
}

export function getDayDate(weekStart: Date, day: DayOfWeek): Date {
  const dayIndex = day === 0 ? 6 : day - 1;
  return addDays(weekStart, dayIndex);
}

export function isCurrentWeek(weekStart: Date): boolean {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  return isSameDay(weekStart, currentWeekStart);
}

export function getTimeSlots(range: TimeRange, increment: 30 | 60): string[] {
  const slots: string[] = [];
  const startMinutes = timeToMinutes(range.start);
  const endMinutes = timeToMinutes(range.end);
  
  let current = startMinutes;
  while (current < endMinutes) {
    slots.push(minutesToTime(current));
    current += increment;
  }
  
  return slots;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function formatTime24h(time: string): string {
  return time;
}

export function getSessionTop(startTime: string, range: TimeRange, increment: 30 | 60): number {
  const startMinutes = timeToMinutes(range.start);
  const sessionStartMinutes = timeToMinutes(startTime);
  const diffMinutes = sessionStartMinutes - startMinutes;
  const slots = diffMinutes / increment;
  return slots * 100;
}

export function getSessionHeight(startTime: string, endTime: string, increment: 30 | 60): number {
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  const slots = durationMinutes / increment;
  return slots * 100;
}

export function getTotalMinutes(range: TimeRange): number {
  return timeToMinutes(range.end) - timeToMinutes(range.start);
}

export function getPixelsPerMinute(config: TimetableLayoutConfig): number {
  return config.pixelsPerHour / 60;
}

export function getSessionTopPixels(startTime: string, config: TimetableLayoutConfig): number {
  const { timeRange } = config;
  const startMinutes = timeToMinutes(timeRange.start);
  const sessionStartMinutes = timeToMinutes(startTime);
  const diffMinutes = sessionStartMinutes - startMinutes;
  const pixelsPerMinute = config.pixelsPerHour / 60;
  return diffMinutes * pixelsPerMinute;
}

export function getSessionHeightPixels(startTime: string, endTime: string, config: TimetableLayoutConfig): number {
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  const pixelsPerMinute = config.pixelsPerHour / 60;
  return durationMinutes * pixelsPerMinute;
}

export function getHourTopPixels(hour: number, config: TimetableLayoutConfig): number {
  const { timeRange } = config;
  const startMinutes = timeToMinutes(timeRange.start);
  const hourMinutes = hour * 60;
  const diffMinutes = hourMinutes - startMinutes;
  const pixelsPerMinute = config.pixelsPerHour / 60;
  return diffMinutes * pixelsPerMinute;
}

export function getTimeSlotsForConfig(config: TimetableLayoutConfig): string[] {
  return getTimeSlots(config.timeRange, config.timeIncrement);
}

export function getHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

export function timeToPixels(time: string, config: TimetableLayoutConfig): number {
  const { timeRange } = config;
  const startMinutes = timeToMinutes(timeRange.start);
  const timeMinutes = timeToMinutes(time);
  const diffMinutes = timeMinutes - startMinutes;
  const pixelsPerMinute = config.pixelsPerHour / 60;
  return diffMinutes * pixelsPerMinute;
}

export function pixelsToTime(pixels: number, config: TimetableLayoutConfig): string {
  const { timeRange } = config;
  const startMinutes = timeToMinutes(timeRange.start);
  const pixelsPerMinute = config.pixelsPerHour / 60;
  const minutes = startMinutes + pixels / pixelsPerMinute;
  return minutesToTime(Math.round(minutes));
}