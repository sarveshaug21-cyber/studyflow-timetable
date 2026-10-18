import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimetableProvider } from '@/context/TimetableContext';
import { SessionBlock } from '@/components/timetable/SessionBlock';
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
  id: 'sub-maths',
  name: 'Maths',
  code: 'MATH101',
  color: '#3b82f6',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const timedSession: Session = {
  id: 'sess-timed',
  subjectId: 'sub-maths',
  day: 3,
  startTime: '10:30',
  endTime: '12:00',
  type: 'lecture',
  location: 'Room 1',
  notes: 'Bring calculator',
  recurring: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const allDaySession: Session = {
  ...timedSession,
  id: 'sess-allday',
  allDay: true,
  startTime: '00:00',
  endTime: '23:59',
};

// Mirrors the aria-label SessionBlock computes for its block element.
function blockName(session: Session) {
  return session.allDay
    ? `${subject.code}: ${subject.name} (All day)`
    : `${subject.code}: ${subject.name}, ${session.startTime} - ${session.endTime}`;
}

// Form labels are not programmatically linked to their inputs (no htmlFor),
// so locate each field by following its label text.
function field(label: string) {
  return screen.getByText(label).parentElement!.querySelector('select, input, textarea')!;
}

function seed(sessions: Session[] = []) {
  const base: TimetableState = {
    subjects: [subject],
    sessions,
    homework: [],
    currentWeekStart: '2026-10-12T00:00:00.000Z',
    view: 'weekly',
    timeIncrement: 30,
    showWeekends: false,
    timeRange: { start: '08:00', end: '22:00' },
  };
  store.set(STORAGE_KEY, JSON.stringify(base));
}

function renderBlock(session: Session) {
  return render(
    <TimetableProvider>
      <SessionBlock session={session} subject={subject} top={0} height={100} />
    </TimetableProvider>,
  );
}

function storedSession(id: string): Session | undefined {
  const raw = store.get(STORAGE_KEY);
  expect(raw, 'timetable state should be persisted to localStorage').toBeDefined();
  return (JSON.parse(raw!) as TimetableState).sessions.find((s) => s.id === id);
}

function openEditor(session: Session) {
  fireEvent.click(screen.getByRole('button', { name: blockName(session) }));
}

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  store.clear();
});

describe('SessionBlock inline all-day editor', () => {
  it('renders the block and opens the editor modal when clicked', () => {
    seed([timedSession]);
    renderBlock(timedSession);

    expect(screen.getByText('MATH101')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openEditor(timedSession);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('opens an existing all-day event with the checkbox enabled and no time fields', () => {
    seed([allDaySession]);
    renderBlock(allDaySession);

    openEditor(allDaySession);

    expect(screen.getByRole('checkbox', { name: 'All-day event' })).toBeChecked();
    expect(screen.queryByText('Start Time')).not.toBeInTheDocument();
    expect(screen.queryByText('End Time')).not.toBeInTheDocument();
    // Unrelated metadata is still visible/editable in all-day mode.
    expect(screen.getByDisplayValue('Room 1')).toBeInTheDocument();
  });

  it('switching a timed session to all-day hides time fields and saves 00:00–23:59 with allDay: true', async () => {
    seed([timedSession]);
    renderBlock(timedSession);

    openEditor(timedSession);

    expect(screen.getByDisplayValue('10:30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'All-day event' })).not.toBeChecked();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'All-day event' }));

    expect(screen.getByRole('checkbox', { name: 'All-day event' })).toBeChecked();
    expect(screen.queryByText('Start Time')).not.toBeInTheDocument();
    expect(screen.queryByText('End Time')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const saved = storedSession('sess-timed');
    expect(saved).toBeDefined();
    expect(saved!.allDay).toBe(true);
    expect(saved!.startTime).toBe('00:00');
    expect(saved!.endTime).toBe('23:59');
    expect(saved!.day).toBe(3);
    expect(saved!.type).toBe('lecture');
    expect(saved!.location).toBe('Room 1');
    expect(saved!.notes).toBe('Bring calculator');
    expect(saved!.recurring).toBe(true);
    expect(saved!.subjectId).toBe('sub-maths');
    expect(saved!.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('switching an all-day event back to timed restores time editing and saves allDay: false', async () => {
    seed([allDaySession]);
    renderBlock(allDaySession);

    openEditor(allDaySession);

    expect(screen.getByRole('checkbox', { name: 'All-day event' })).toBeChecked();
    expect(screen.queryByText('Start Time')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'All-day event' }));

    expect(screen.getByRole('checkbox', { name: 'All-day event' })).not.toBeChecked();
    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();

    await user.selectOptions(field('Start Time'), '14:00');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const saved = storedSession('sess-allday');
    expect(saved).toBeDefined();
    expect(saved!.allDay).toBe(false);
    expect(saved!.startTime).toBe('14:00');
    expect(saved!.endTime).toBe('23:59');
    expect(saved!.day).toBe(3);
    expect(saved!.type).toBe('lecture');
    expect(saved!.location).toBe('Room 1');
  });

  it('editing a timed session preserves unrelated session metadata', async () => {
    seed([timedSession]);
    renderBlock(timedSession);

    openEditor(timedSession);

    const user = userEvent.setup();
    const locationInput = screen.getByDisplayValue('Room 1');
    await user.clear(locationInput);
    await user.type(locationInput, 'Room 2');
    const notesInput = screen.getByDisplayValue('Bring calculator');
    await user.type(notesInput, ' — second period');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const saved = storedSession('sess-timed');
    expect(saved).toBeDefined();
    expect(saved!.location).toBe('Room 2');
    expect(saved!.notes).toBe('Bring calculator — second period');
    expect(saved!.startTime).toBe('10:30');
    expect(saved!.endTime).toBe('12:00');
    expect(saved!.allDay).toBe(false);
    expect(saved!.type).toBe('lecture');
    expect(saved!.day).toBe(3);
    expect(saved!.recurring).toBe(true);
    expect(saved!.subjectId).toBe('sub-maths');
    expect(saved!.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('cancel closes the editor without saving any changes', async () => {
    seed([timedSession]);
    renderBlock(timedSession);

    openEditor(timedSession);

    const user = userEvent.setup();
    const locationInput = screen.getByDisplayValue('Room 1');
    await user.clear(locationInput);
    await user.type(locationInput, 'Room 2');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const saved = storedSession('sess-timed');
    expect(saved).toBeDefined();
    expect(saved!.location).toBe('Room 1');
    expect(saved!.allDay).not.toBe(true);
    expect(saved!.startTime).toBe('10:30');
  });
});
