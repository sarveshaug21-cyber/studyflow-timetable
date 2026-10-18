import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimetableProvider } from '@/context/TimetableContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { AgendaView } from './AgendaView';
import type { Session, Subject, TimetableState } from '@/types';

const STORAGE_KEY = 'studyflow-timetable';
const store = new Map<string, string>();

function installLocalStorage() {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  });
}

const subject: Subject = {
  id: 'sub-1',
  name: 'Mathematics',
  code: 'MATH101',
  color: '#3b82f6',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  subjectId: 'sub-1',
  day: 1,
  startTime: '09:00',
  endTime: '10:00',
  type: 'lecture',
  location: 'Room 101',
  notes: '',
  recurring: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

function seed(sessions: Session[] = []) {
  const base: TimetableState = {
    subjects: [subject],
    sessions,
    homework: [],
    currentWeekStart: '2026-10-12T00:00:00.000Z',
    view: 'weekly',
    timeIncrement: 30,
    showWeekends: false,
    timeRange: { start: '08:00', end: '18:00' },
  };
  store.set(STORAGE_KEY, JSON.stringify(base));
}

function renderAgendaView() {
  return render(
    <TimetableProvider>
      <SettingsProvider>
        <AgendaView />
      </SettingsProvider>
    </TimetableProvider>,
  );
}

describe('AgendaView', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  it('renders empty state when there are no sessions', () => {
    seed();
    renderAgendaView();
    expect(screen.getByText('No sessions this week')).toBeInTheDocument();
    expect(screen.getByText('Add sessions to see them here')).toBeInTheDocument();
  });

  it('renders session groups by day', () => {
    seed([session()]);
    renderAgendaView();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('MATH101')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM - 10:00 AM')).toBeInTheDocument();
  });

  it('groups sessions under their correct day', () => {
    seed([
      session({ id: 's1', day: 1, startTime: '09:00', endTime: '10:00' }),
      session({ id: 's2', day: 3, startTime: '11:00', endTime: '12:00' }),
    ]);
    renderAgendaView();
    expect(screen.getAllByText('Monday')).toHaveLength(1);
    expect(screen.getAllByText('Wednesday')).toHaveLength(1);
    expect(screen.getAllByText('MATH101')).toHaveLength(2);
  });

  it('shows session count on each day header', () => {
    seed([
      session({ id: 's1', day: 1, startTime: '09:00', endTime: '10:00' }),
      session({ id: 's2', day: 1, startTime: '11:00', endTime: '12:00' }),
    ]);
    renderAgendaView();
    const countSpan = screen.getAllByText(/^\d+ session/).find(
      (el) => el.closest('div')?.querySelector('h3')?.textContent === 'Monday'
    );
    expect(countSpan).toBeInTheDocument();
  });

  it('shows today pill for the current day', () => {
    vi.setSystemTime(new Date('2026-10-12T00:00:00.000Z'));
    seed([session({ day: 1 })]);
    renderAgendaView();
    expect(screen.getByText('Today')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows edit and delete options in session dropdown', () => {
    seed([session()]);
    renderAgendaView();
    const moreButton = screen.getByRole('button', { name: 'More options' });
    fireEvent.click(moreButton);
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('renders overnight sessions on their start date', () => {
    seed([
      session({
        id: 's-overnight',
        day: 1,
        startTime: '23:00',
        endTime: '01:00',
        overnight: true,
        date: '2026-10-14',
      }),
    ]);
    renderAgendaView();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('MATH101')).toBeInTheDocument();
  });
});
