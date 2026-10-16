import { describe, it, expect } from 'vitest';
import {
  generateId,
  getDayLabel,
  getSessionTypeLabel,
  timeToMinutes,
  minutesToTime,
  getTimeSlots,
  getSessionDuration,
  formatTime,
  isToday,
  getWeekStart,
  getWeekEnd,
  formatWeekRange,
  DayOfWeek,
} from '@/types';

describe('Type Utilities', () => {
  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('getDayLabel', () => {
    it('returns full day name by default', () => {
      expect(getDayLabel(1)).toBe('Monday');
      expect(getDayLabel(5)).toBe('Friday');
      expect(getDayLabel(0)).toBe('Sunday');
    });

    it('returns short day name when requested', () => {
      expect(getDayLabel(1, true)).toBe('Mon');
      expect(getDayLabel(5, true)).toBe('Fri');
      expect(getDayLabel(0, true)).toBe('Sun');
    });

    it('returns empty string for invalid day', () => {
      expect(getDayLabel(8 as DayOfWeek)).toBe('');
    });
  });

  describe('getSessionTypeLabel', () => {
    it('returns full type label by default', () => {
      expect(getSessionTypeLabel('lecture')).toBe('Lecture');
      expect(getSessionTypeLabel('lab')).toBe('Lab');
      expect(getSessionTypeLabel('tutorial')).toBe('Tutorial');
      expect(getSessionTypeLabel('seminar')).toBe('Seminar');
    });

    it('returns short label when requested', () => {
      expect(getSessionTypeLabel('lecture', true)).toBe('LEC');
      expect(getSessionTypeLabel('lab', true)).toBe('LAB');
      expect(getSessionTypeLabel('tutorial', true)).toBe('TUT');
      expect(getSessionTypeLabel('seminar', true)).toBe('SEM');
    });
  });

  describe('timeToMinutes', () => {
    it('converts time to minutes correctly', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:00')).toBe(60);
      expect(timeToMinutes('12:30')).toBe(750);
      expect(timeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('minutesToTime', () => {
    it('converts minutes to time string', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(60)).toBe('01:00');
      expect(minutesToTime(750)).toBe('12:30');
      expect(minutesToTime(1439)).toBe('23:59');
    });
  });

  describe('getTimeSlots', () => {
    it('generates 30-minute slots', () => {
      const slots = getTimeSlots('08:00', '10:00', 30);
      expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
    });

    it('generates 60-minute slots', () => {
      const slots = getTimeSlots('08:00', '12:00', 60);
      expect(slots).toEqual(['08:00', '09:00', '10:00', '11:00']);
    });

    it('returns empty array when start equals end', () => {
      const slots = getTimeSlots('08:00', '08:00', 30);
      expect(slots).toEqual([]);
    });

    it('handles cross-midnight not supported (start < end)', () => {
      const slots = getTimeSlots('22:00', '06:00', 60);
      expect(slots).toEqual([]);
    });
  });

  describe('getSessionDuration', () => {
    it('calculates duration in minutes', () => {
      expect(getSessionDuration('09:00', '10:00')).toBe(60);
      expect(getSessionDuration('09:00', '09:30')).toBe(30);
      expect(getSessionDuration('13:15', '14:45')).toBe(90);
    });
  });

  describe('formatTime', () => {
    it('formats time in 12-hour format', () => {
      expect(formatTime('08:00')).toBe('8:00 AM');
      expect(formatTime('12:00')).toBe('12:00 PM');
      expect(formatTime('13:30')).toBe('1:30 PM');
      expect(formatTime('00:00')).toBe('12:00 AM');
      expect(formatTime('23:45')).toBe('11:45 PM');
    });
  });

  describe('isToday', () => {
    it('returns true for current day of week', () => {
      const today = new Date().getDay();
      const dayOfWeek = (today === 0 ? 0 : today) as DayOfWeek;
      expect(isToday(dayOfWeek)).toBe(true);
    });

    it('returns false for different day', () => {
      const today = new Date().getDay();
      const differentDay = (today + 1) % 7;
      const dayOfWeek = (differentDay === 0 ? 0 : differentDay) as DayOfWeek;
      expect(isToday(dayOfWeek)).toBe(false);
    });
  });

  describe('getWeekStart', () => {
    it('returns Monday for any date in the week', () => {
      const wednesday = new Date('2024-01-10');
      const weekStart = getWeekStart(wednesday);
      expect(weekStart.getDay()).toBe(1);
      expect(weekStart.toISOString().split('T')[0]).toBe('2024-01-08');
    });

    it('handles Sunday correctly', () => {
      const sunday = new Date('2024-01-14');
      const weekStart = getWeekStart(sunday);
      expect(weekStart.getDay()).toBe(1);
      expect(weekStart.toISOString().split('T')[0]).toBe('2024-01-08');
    });
  });

  describe('getWeekEnd', () => {
    it('returns Sunday for the week', () => {
      const wednesday = new Date('2024-01-10');
      const weekEnd = getWeekEnd(wednesday);
      expect(weekEnd.getDay()).toBe(0);
      expect(weekEnd.toISOString().split('T')[0]).toBe('2024-01-14');
    });
  });

  describe('formatWeekRange', () => {
    it('formats week range with month and day (adds 6 days)', () => {
      const date = new Date('2024-01-10');
      const range = formatWeekRange(date);
      // types/index.ts formatWeekRange adds 6 days to the start date
      expect(range).toMatch(/Jan 10 - Jan 16/);
    });
  });
});