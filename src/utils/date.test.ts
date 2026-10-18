import { describe, it, expect } from 'vitest';
import {
  getWeekStart,
  getWeekEnd,
  formatWeekRange,
  getDayDate,
  isCurrentWeek,
  getTimeSlots,
  timeToMinutes,
  minutesToTime,
  formatTime12h,
  getSessionTop,
  getSessionHeight,
} from '@/utils/date';
import { addMinutes } from '@/utils/calendar';

describe('Date Utilities', () => {
  describe('getWeekStart', () => {
    it('returns Monday for a given date', () => {
      const wednesday = new Date('2024-01-10'); // Wednesday
      const weekStart = getWeekStart(wednesday);
      expect(weekStart.getDay()).toBe(1); // Monday
      expect(weekStart.toISOString().split('T')[0]).toBe('2024-01-08');
    });

    it('returns same date if already Monday', () => {
      const monday = new Date('2024-01-08');
      const weekStart = getWeekStart(monday);
      expect(weekStart.toISOString().split('T')[0]).toBe('2024-01-08');
    });

    it('returns previous Monday for Sunday', () => {
      const sunday = new Date('2024-01-14');
      const weekStart = getWeekStart(sunday);
      expect(weekStart.toISOString().split('T')[0]).toBe('2024-01-08');
    });
  });

  describe('getWeekEnd', () => {
    it('returns Sunday for a given date', () => {
      const wednesday = new Date('2024-01-10');
      const weekEnd = getWeekEnd(wednesday);
      expect(weekEnd.getDay()).toBe(0); // Sunday
      expect(weekEnd.toISOString().split('T')[0]).toBe('2024-01-14');
    });
  });

  describe('formatWeekRange', () => {
    it('formats week range correctly', () => {
      const date = new Date('2024-01-10');
      const range = formatWeekRange(date);
      expect(range).toMatch(/Jan 8 - Jan 14, 2024/);
    });
  });

  describe('getDayDate', () => {
    it('returns correct date for Monday', () => {
      const weekStart = new Date('2024-01-08');
      const monday = getDayDate(weekStart, 1);
      expect(monday.toISOString().split('T')[0]).toBe('2024-01-08');
    });

    it('returns correct date for Sunday', () => {
      const weekStart = new Date('2024-01-08');
      const sunday = getDayDate(weekStart, 0);
      expect(sunday.toISOString().split('T')[0]).toBe('2024-01-14');
    });

    it('returns correct date for Wednesday', () => {
      const weekStart = new Date('2024-01-08');
      const wednesday = getDayDate(weekStart, 3);
      expect(wednesday.toISOString().split('T')[0]).toBe('2024-01-10');
    });
  });

  describe('isCurrentWeek', () => {
    it('returns true for current week', () => {
      const now = new Date();
      const currentWeekStart = getWeekStart(now);
      expect(isCurrentWeek(currentWeekStart)).toBe(true);
    });

    it('returns false for different week', () => {
      const differentWeek = new Date('2020-01-01');
      expect(isCurrentWeek(differentWeek)).toBe(false);
    });
  });

  describe('getTimeSlots', () => {
    it('generates 30-minute slots', () => {
      const slots = getTimeSlots({ start: '08:00', end: '10:00' }, 30);
      expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
    });

    it('generates 60-minute slots', () => {
      const slots = getTimeSlots({ start: '08:00', end: '12:00' }, 60);
      expect(slots).toEqual(['08:00', '09:00', '10:00', '11:00']);
    });

    it('handles edge case where start equals end', () => {
      const slots = getTimeSlots({ start: '08:00', end: '08:00' }, 30);
      expect(slots).toEqual([]);
    });
  });

  describe('timeToMinutes', () => {
    it('converts time to minutes', () => {
      expect(timeToMinutes('08:00')).toBe(480);
      expect(timeToMinutes('12:30')).toBe(750);
      expect(timeToMinutes('23:59')).toBe(1439);
      expect(timeToMinutes('00:00')).toBe(0);
    });
  });

  describe('minutesToTime', () => {
    it('converts minutes to time string', () => {
      expect(minutesToTime(480)).toBe('08:00');
      expect(minutesToTime(750)).toBe('12:30');
      expect(minutesToTime(1439)).toBe('23:59');
      expect(minutesToTime(0)).toBe('00:00');
    });
  });

  describe('formatTime12h', () => {
    it('formats time in 12-hour format', () => {
      expect(formatTime12h('08:00')).toBe('8:00 AM');
      expect(formatTime12h('12:00')).toBe('12:00 PM');
      expect(formatTime12h('13:30')).toBe('1:30 PM');
      expect(formatTime12h('00:00')).toBe('12:00 AM');
      expect(formatTime12h('23:45')).toBe('11:45 PM');
    });
  });

  describe('getSessionTop', () => {
    it('calculates top position as percentage of grid', () => {
      // 09:00 is 60 minutes after 08:00, with 30-min increments = 2 slots
      // Returns slots * 100 = 200 (percentage of total grid height)
      const top = getSessionTop('09:00', { start: '08:00', end: '18:00' }, 30);
      expect(top).toBe(200);
    });

    it('returns 0 for session at start time', () => {
      const top = getSessionTop('08:00', { start: '08:00', end: '18:00' }, 30);
      expect(top).toBe(0);
    });

    it('calculates correctly with 60-min increments', () => {
      const top = getSessionTop('10:00', { start: '08:00', end: '18:00' }, 60);
      // 10:00 is 120 min after 08:00, with 60-min increments = 2 slots
      expect(top).toBe(200);
    });
  });

  describe('getSessionHeight', () => {
    it('calculates height as percentage of grid for 30-min session with 30-min increments', () => {
      // 30 min duration with 30-min increments = 1 slot * 100 = 100
      const height = getSessionHeight('09:00', '09:30', 30);
      expect(height).toBe(100);
    });

    it('calculates height for 60-min session with 30-min increments', () => {
      // 60 min duration with 30-min increments = 2 slots * 100 = 200
      const height = getSessionHeight('09:00', '10:00', 30);
      expect(height).toBe(200);
    });

    it('calculates height for 60-min session with 60-min increments', () => {
      // 60 min duration with 60-min increments = 1 slot * 100 = 100
      const height = getSessionHeight('09:00', '10:00', 60);
      expect(height).toBe(100);
    });

    it('calculates height for 90-min session with 30-min increments', () => {
      // 90 min duration with 30-min increments = 3 slots * 100 = 300
      const height = getSessionHeight('09:00', '10:30', 30);
      expect(height).toBe(300);
    });

    it('calculates height for overnight session', () => {
      // Overnight 23:00-01:00 = 120 min duration with 30-min increments = 4 slots * 100 = 400
      const height = getSessionHeight('23:00', '01:00', 30);
      expect(height).toBe(400);
    });
  });
});

describe('addMinutes wrap', () => {
  it('wraps past midnight when wrap is true', () => {
    expect(addMinutes('23:00', 120, true)).toBe('01:00');
    expect(addMinutes('22:30', 90, true)).toBe('00:00');
    expect(addMinutes('23:59', 2, true)).toBe('00:01');
  });

  it('does not wrap by default', () => {
    expect(addMinutes('23:00', 120)).toBe('25:00');
    expect(addMinutes('09:00', 30)).toBe('09:30');
  });
});