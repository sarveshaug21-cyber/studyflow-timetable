import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FullCalendarView } from './FullCalendarView';
import { TimetableProvider } from '@/context/TimetableContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { TimetableState, Subject } from '@/types';

const STORAGE_KEY = 'studyflow-timetable';
const store = new Map<string, string>();

function installStorage(initial: Record<string, string> = {}) {
  store.clear();
  Object.entries(initial).forEach(([k, v]) => store.set(k, v));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  });
}

const csSubject: Subject = {
  id: 'sub-cs',
  name: 'Introduction to Computer Science',
  code: 'CS101',
  color: '#3b82f6',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const mathSubject: Subject = {
  id: 'sub-maths',
  name: 'Calculus I',
  code: 'MATH101',
  color: '#10b981',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const seed = (): TimetableState => ({
  subjects: [csSubject, mathSubject],
  sessions: [
    {
      id: 's-recurring',
      subjectId: 'sub-cs',
      day: 1, // Monday
      startTime: '09:00',
      endTime: '10:00',
      type: 'lecture',
      recurring: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 's-oneoff',
      subjectId: 'sub-maths',
      date: '2026-10-13', // Tuesday
      day: 2,
      startTime: '14:00',
      endTime: '15:00',
      type: 'lab',
      recurring: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 's-overnight',
      subjectId: 'sub-cs',
      date: '2026-10-13',
      day: 2,
      startTime: '23:00',
      endTime: '01:00',
      type: 'lecture',
      recurring: false,
      overnight: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  homework: [
    {
      id: 'hw-1',
      title: 'Essay',
      subject: 'Introduction to Computer Science',
      teacher: 'Prof. X',
      group: 'A',
      type: 'Essay',
      dueDate: new Date('2026-10-14T00:00:00.000Z'),
      status: 'pending',
      submissionType: 'online',
      hide: false,
      source: 'manual',
    },
  ],
  currentWeekStart: '2026-10-12T00:00:00.000Z',
  view: 'weekly',
  timeIncrement: 30,
  showWeekends: false,
  timeRange: { start: '00:00', end: '24:00' },
});

function renderView() {
  store.set(STORAGE_KEY, JSON.stringify(seed()));
  return render(
    <TimetableProvider>
      <CalendarProvider>
        <ThemeProvider>
          <ToastProvider>
            <FullCalendarView />
          </ToastProvider>
        </ThemeProvider>
      </CalendarProvider>
    </TimetableProvider>,
  );
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  store.clear();
});

describe('FullCalendarView', () => {
  it('renders recurring, one-off and overnight session events', async () => {
    renderView();

    await waitFor(() =>
      expect(screen.getByText('MATH101: Calculus I')).toBeInTheDocument(),
    );
    // The recurring Monday lecture renders once per Monday in the expansion window.
    expect(
      screen.getAllByText('CS101: Introduction to Computer Science').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('renders homework deadlines as all-day events', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Due: Essay')).toBeInTheDocument());
  });

  it('opens the session editor when an event is clicked', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('MATH101: Calculus I')).toBeInTheDocument());
    const lab = screen.getByText('MATH101: Calculus I').closest('[role="button"]')!;
    // FullCalendar v7 triggers eventClick via its own pointer layer; in happy-dom
    // we drive the native keyboard handler (Enter on a focusable event button).
    (lab as HTMLElement).focus();
    lab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await waitFor(() => expect(screen.getByText('Edit Session')).toBeInTheDocument());
    expect(screen.getByDisplayValue('14:00')).toBeInTheDocument();
    expect(screen.getByText('MATH101 - Calculus I')).toBeInTheDocument();
  });
});
