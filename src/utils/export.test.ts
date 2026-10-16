import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToJSON, exportToCSV, exportToICS, downloadFile, downloadBlob } from '@/utils/export';
import type { TimetableState, Subject, Session } from '@/types';

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  document.body.appendChild = mockAppendChild;
  document.body.removeChild = mockRemoveChild;
  HTMLAnchorElement.prototype.click = mockClick;
});

const mockSubject: Subject = {
  id: 'sub-1',
  name: 'Test Subject',
  code: 'TS101',
  color: '#3b82f6',
  instructor: 'Dr. Test',
  room: 'Room 101',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockSession: Session = {
  id: 'sess-1',
  subjectId: 'sub-1',
  day: 1,
  startTime: '09:00',
  endTime: '10:30',
  type: 'lecture',
  location: 'Room 101',
  notes: 'Test notes',
  recurring: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockState: TimetableState = {
  subjects: [mockSubject],
  sessions: [mockSession],
  homework: [],
  currentWeekStart: '2024-01-08T00:00:00.000Z',
  view: 'weekly',
  timeIncrement: 30,
  showWeekends: false,
  timeRange: { start: '08:00', end: '18:00' },
};

describe('Export Utilities', () => {
  describe('exportToJSON', () => {
    it('exports state as formatted JSON', () => {
      const json = exportToJSON(mockState);
      const parsed = JSON.parse(json);
      expect(parsed.subjects).toHaveLength(1);
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.subjects[0].code).toBe('TS101');
    });

    it('handles empty state', () => {
      const emptyState: TimetableState = {
        subjects: [],
        sessions: [],
        homework: [],
        currentWeekStart: '2024-01-08T00:00:00.000Z',
        view: 'weekly',
        timeIncrement: 30,
        showWeekends: false,
        timeRange: { start: '08:00', end: '18:00' },
      };
      const json = exportToJSON(emptyState);
      const parsed = JSON.parse(json);
      expect(parsed.subjects).toHaveLength(0);
      expect(parsed.sessions).toHaveLength(0);
    });
  });

  describe('exportToCSV', () => {
    it('exports sessions as CSV with headers', () => {
      const csv = exportToCSV(mockState);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Subject,Code,Day,Start Time,End Time,Type,Location,Instructor,Room,Notes,Recurring');
      expect(lines[1]).toContain('Test Subject');
      expect(lines[1]).toContain('TS101');
      expect(lines[1]).toContain('Monday');
      expect(lines[1]).toContain('09:00');
      expect(lines[1]).toContain('10:30');
      expect(lines[1]).toContain('lecture');
      expect(lines[1]).toContain('Room 101');
      expect(lines[1]).toContain('Dr. Test');
      expect(lines[1]).toContain('Test notes');
      expect(lines[1]).toContain('Yes');
    });

    it('escapes CSV values with commas', () => {
      const stateWithComma: TimetableState = {
        ...mockState,
        sessions: [{
          ...mockSession,
          location: 'Room 101, Building A',
        }],
      };
      const csv = exportToCSV(stateWithComma);
      expect(csv).toContain('"Room 101, Building A"');
    });

    it('escapes CSV values with quotes', () => {
      const stateWithQuotes: TimetableState = {
        ...mockState,
        sessions: [{
          ...mockSession,
          notes: 'Test "quoted" notes',
        }],
      };
      const csv = exportToCSV(stateWithQuotes);
      expect(csv).toContain('"Test ""quoted"" notes"');
    });

    it('escapes CSV values with newlines', () => {
      const stateWithNewline: TimetableState = {
        ...mockState,
        sessions: [{
          ...mockSession,
          notes: 'Line 1\nLine 2',
        }],
      };
      const csv = exportToCSV(stateWithNewline);
      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it('handles session without subject', () => {
      const stateWithoutSubject: TimetableState = {
        ...mockState,
        subjects: [],
        sessions: [{
          ...mockSession,
          subjectId: 'non-existent',
        }],
      };
      const csv = exportToCSV(stateWithoutSubject);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('Unknown');
    });
  });

  describe('exportToICS', () => {
    it('generates valid ICS content', async () => {
      const ics = await exportToICS(mockState);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('TS101: Test Subject (lecture)');
      expect(ics).toContain('FREQ=WEEKLY');
    });

    it('handles session without subject', async () => {
      const stateWithoutSubject: TimetableState = {
        ...mockState,
        subjects: [],
        sessions: [{
          ...mockSession,
          subjectId: 'non-existent',
        }],
      };
      const ics = await exportToICS(stateWithoutSubject);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      // Should not contain events since subject is not found
    });

    it('includes location and description', async () => {
      const ics = await exportToICS(mockState);
      expect(ics).toContain('Room 101');
      expect(ics).toContain('Dr. Test');
      expect(ics).toContain('Test notes');
    });

    it('sets correct start and end dates for Monday session', async () => {
      const ics = await exportToICS(mockState);
      // Monday Jan 8, 2024 at 09:00
      expect(ics).toContain('DTSTART:20240108T090000');
      expect(ics).toContain('DTEND:20240108T103000');
    });
  });

  describe('downloadFile', () => {
    it('creates blob and triggers download', () => {
      downloadFile('test content', 'test.txt', 'text/plain');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('downloadBlob', () => {
    it('triggers download for blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});