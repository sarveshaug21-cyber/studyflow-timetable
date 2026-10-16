import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, parseISO } from 'date-fns';
import { ToastProvider } from '@/components/ui/Toast';
import { SettingsProvider } from '@/context/SettingsContext';
import { TimetableProvider } from '@/context/TimetableContext';
import { FocusProvider } from '@/context/FocusContext';
import { StudyPlanner } from '@/components/planner/StudyPlanner';
import { useTimetable } from '@/hooks/useTimetable';
import type { HomeworkItem, Session, Subject, TimetableState } from '@/types';

// The global setup stubs localStorage with bare vi.fn()s (no values). The
// providers hydrate from localStorage on mount, so install a working store here
// and seed a timetable with one subject, one conflicting session and one
// homework item.
const store = new Map<string, string>();
function installLocalStorage() {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  });
}

// Pin "now" to the test's logical today: Wednesday 2026-10-14 09:00.
// The fixture seeds a lesson at 10:30 on day 3 (Wednesday) and homework due
// "tomorrow" (Thursday 2026-10-15). Without this, the planner sees the real
// env date (Thu 2026-10-15) and finds zero windows before the deadline.
const FIXED_DATE = new Date('2026-10-14T09:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_DATE);
  installLocalStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

const subject: Subject = {
  id: 'sub-maths',
  name: 'Maths',
  code: 'MATH101',
  color: '#0000ff',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const lesson: Session = {
  id: 'sess-lesson',
  subjectId: 'sub-maths',
  day: 3, // Wednesday (today)
  startTime: '10:30',
  endTime: '12:00',
  type: 'lecture',
  location: 'Room 1',
  notes: '',
  recurring: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

// Due tomorrow (Thu 2026-10-15), so it is not yet overdue. With no
// user-provided estimate the engine derives 120 min from the "Essay" type and
// fills 3 x 50-min blocks across the free time before the deadline.
const homework: HomeworkItem = {
  id: 'hw-1',
  title: 'Essay on Quadratics',
  subject: 'Maths',
  teacher: 'Mr. Smith',
  group: 'Set 2',
  type: 'Essay',
  dueDate: new Date(2026, 9, 15),
  status: 'pending',
  submissionType: 'online',
  hide: false,
  source: 'manual',
  priority: 'high',
};

// A second item with an explicit user override: the engine must honour the 20
// min and place exactly one block, proving the override is respected.
const homeworkOverride: HomeworkItem = {
  id: 'hw-ovr',
  title: 'Reading on Kinematics',
  subject: 'Physics',
  teacher: 'Dr. Brown',
  group: 'Set 2',
  type: 'Essay',
  dueDate: new Date(2026, 9, 16),
  status: 'pending',
  submissionType: 'online',
  hide: false,
  source: 'manual',
  priority: 'low',
  estimatedMinutes: 20,
};

function seedTimetable(overrides: Partial<TimetableState> = {}) {
  const base: TimetableState = {
    subjects: [subject],
    sessions: [lesson],
    homework: [homework],
    currentWeekStart: '2026-10-12T00:00:00.000Z',
    view: 'weekly',
    timeIncrement: 30,
    showWeekends: false,
    timeRange: { start: '08:00', end: '22:00' },
    ...overrides,
  };
  store.set('studyflow-timetable', JSON.stringify(base));
}

function renderPlanner() {
  return render(
    <ToastProvider>
      <SettingsProvider>
        <TimetableProvider>
          <FocusProvider>
            <StudyPlanner />
            <MutationControls />
          </FocusProvider>
        </TimetableProvider>
      </SettingsProvider>
    </ToastProvider>,
  );
}

/**
 * Test-only controls that change the live timetable context, so the adaptive
 * path (inputs changed → notice → re-plan → explanation) can be driven through
 * the real provider instead of mocked state.
 */
function MutationControls() {
  const { addHomework, addSession } = useTimetable();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          addHomework({
            title: 'New Worksheet',
            subject: 'Maths',
            teacher: 'Mr. Smith',
            group: 'Set 2',
            type: 'Homework',
            dueDate: new Date(2026, 9, 17),
            status: 'pending',
            submissionType: 'online',
            hide: false,
            source: 'manual',
            priority: 'low',
          })
        }
      >
        add-homework
      </button>
      <button
        type="button"
        onClick={() =>
          addSession({
            subjectId: 'sub-maths',
            day: 5,
            date: '2026-10-16',
            startTime: '15:00',
            endTime: '16:00',
            type: 'study',
            location: '',
            notes: 'Accepted block',
            recurring: false,
          })
        }
      >
        add-accepted-study
      </button>
    </div>
  );
}

async function generatePlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /plan my study/i }));
  // Wait on the unique summary line — the homework title itself appears in
  // both the suggestion row and the coverage-gap list, so it is not unique.
  await screen.findByText(/· 0 selected/);
}

beforeEach(() => {
  installLocalStorage();
});

describe('StudyPlanner', () => {
  it('renders the heading and a generate button before any plan exists', () => {
    renderPlanner();
    expect(screen.getByRole('heading', { name: /study planner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plan my study/i })).toBeInTheDocument();
  });

  it('generates suggestions without touching the stored sessions', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);
  await screen.findByText(/· 0 selected/);
    // The exact block count depends on how much free time the engine finds, but
    // it always produces at least one block and reports the honest shortfall
    // (which may be zero if the estimate fits in the available windows).
    expect(screen.getByText(/suggestion/)).toBeInTheDocument();

    const stored = JSON.parse(store.get('studyflow-timetable') as string) as TimetableState;
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0].id).toBe('sess-lesson');
  });

  it('keeps the confirm button disabled until a suggestion is selected', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    const confirm = screen.getByRole('button', { name: /^schedule 0 selected$/i });
    expect(confirm).toBeDisabled();
  });

  it('enables confirm after selecting all, then saves study sessions additively', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    await user.click(screen.getByRole('button', { name: /select all/i }));
    const confirm = await screen.findByRole('button', { name: /schedule [1-9]\d* selected/i });
    expect(confirm).toBeEnabled();
    const count = Number(/schedule (\d+) selected/i.exec(confirm.textContent ?? '')?.[1] ?? '0');
    expect(count).toBeGreaterThan(0);
    await user.click(confirm);

    const stored = JSON.parse(store.get('studyflow-timetable') as string) as TimetableState;
    // Additive: the original lesson survives and exactly `count` study blocks are added.
    expect(stored.sessions).toHaveLength(1 + count);
    expect(stored.sessions.some((s) => s.id === 'sess-lesson')).toBe(true);

    const study = stored.sessions.filter((s) => s.type === 'study');
    expect(study).toHaveLength(count);
    for (const block of study) {
      expect(block.recurring).toBe(false);
      expect(block.date).toBeDefined();
      expect(block.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(block.endTime).toMatch(/^\d{2}:\d{2}$/);
      expect(block.notes).toContain('Essay on Quadratics');
      // Never double-book the 10:30–12:00 lesson.
      expect(block.startTime < '10:30' || block.startTime >= '12:00').toBe(true);
    }
  });

  it('honours a user-provided estimatedMinutes override', async () => {
    seedTimetable({ homework: [homeworkOverride] });
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);
  await screen.findByText(/· 0 selected/);
    // 20 min fits in a single block, so no shortfall is reported.
    expect(screen.queryByText(/min shortfall before the deadline/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /^schedule 1 selected$/i }));

    const stored = JSON.parse(store.get('studyflow-timetable') as string) as TimetableState;
    const study = stored.sessions.filter((s) => s.type === 'study');
    expect(study).toHaveLength(1);
    expect(study[0].notes).toContain('Reading on Kinematics');
  });

  it('shows a success banner after saving and clears the plan', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /^schedule \d+ selected$/i }));

    expect(await screen.findByText(/Scheduled \d+ study sessions?\./)).toBeInTheDocument();
    expect(screen.queryByText(/min shortfall before the deadline/)).not.toBeInTheDocument();
  });

  it('clears the plan without saving anything when Clear is pressed', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    await user.click(screen.getByRole('button', { name: /^clear$/i }));

    expect(screen.queryByText(/min shortfall before the deadline/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plan my study/i })).toBeInTheDocument();
    const stored = JSON.parse(store.get('studyflow-timetable') as string) as TimetableState;
    expect(stored.sessions).toHaveLength(1);
  });

  it('lists unscheduled homework with its honest reason', async () => {
    seedTimetable({
      homework: [
        homework,
        { ...homework, id: 'hw-2', title: 'Done Already', status: 'completed' },
      ],
    });
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    expect(await screen.findByText(/not scheduled/i)).toBeInTheDocument();
    expect(screen.getByText('Done Already')).toBeInTheDocument();
    expect(screen.getByText(/already completed\/submitted/i)).toBeInTheDocument();
  });
});

describe('StudyPlanner adaptive re-planning', () => {
  it('flags the plan as stale when homework changes, without silently changing it', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    const before = screen.getByText(/\d+ suggestions? ·/).textContent;

    await user.click(screen.getByRole('button', { name: 'add-homework' }));

    // The existing suggestions stay exactly as they were — nothing moves
    // without the student asking for it — but the staleness is surfaced.
    expect(
      await screen.findByText(/changed since this plan was built/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/\d+ suggestions? ·/).textContent).toBe(before);
    expect(screen.queryByText(/what changed in this plan/i)).not.toBeInTheDocument();
  });

  it('regenerates on request and explains what changed', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    await user.click(screen.getByRole('button', { name: 'add-homework' }));
    await screen.findByText(/changed since this plan was built/i);

    await user.click(screen.getByRole('button', { name: /^re-plan$/i }));

    const panelHeading = await screen.findByText(/what changed in this plan/i);
    // The staleness notice clears once the plan matches the inputs again.
    expect(
      screen.queryByText(/changed since this plan was built/i),
    ).not.toBeInTheDocument();
    // Any difference against the previous plan is explained, not silent.
    const panel = panelHeading.closest('div.rounded-xl') as HTMLElement;
    expect(within(panel).getByText('New Worksheet')).toBeInTheDocument();
    expect(within(panel).getByText('added')).toBeInTheDocument();
    expect(within(panel).getByText(/New homework/i)).toBeInTheDocument();
  });

  it('dismisses the change explanation without touching the plan', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    await user.click(screen.getByRole('button', { name: 'add-homework' }));
    await screen.findByText(/changed since this plan was built/i);
    await user.click(screen.getByRole('button', { name: /^re-plan$/i }));
    await screen.findByText(/what changed in this plan/i);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText(/what changed in this plan/i)).not.toBeInTheDocument();
    // The plan itself is untouched: suggestions are still listed.
    expect(screen.getByText(/\d+ suggestions? ·/)).toBeInTheDocument();
  });

  it('never re-plans over an already accepted study block', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    // Accept every suggested block, then re-plan on top of the accepted ones.
    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(
      await screen.findByRole('button', { name: /^schedule \d+ selected$/i }),
    );
    await screen.findByText(/Scheduled \d+ study sessions?\./);

    const afterAccept = JSON.parse(store.get('studyflow-timetable') as string) as TimetableState;
    const accepted = afterAccept.sessions.filter((s) => s.type === 'study');
    expect(accepted.length).toBeGreaterThan(0);

    // New homework gives the re-plan something to schedule (the old homework's
    // windows are now fully booked by the accepted blocks).
    await user.click(screen.getByRole('button', { name: 'add-homework' }));
    await user.click(screen.getByRole('button', { name: /plan my study/i }));

    // The re-plan must produce blocks for the new homework (selection starts
    // empty after a confirm, so the summary reads "0 selected" once rows exist).
    await screen.findByText(/· 0 selected/);
    expect(screen.getAllByText('New Worksheet').length).toBeGreaterThan(0);

    // ...none of which sit in an accepted block's date-and-time window — date
    // plus clock together are exactly what counts as a duplicate booking.
    const rows = screen.getAllByRole('listitem').map((n) => n.textContent ?? '');
    for (const block of accepted) {
      if (!block.date) continue;
      const dayLabel = format(parseISO(block.date), 'EEE, MMM d');
      const window = `${block.startTime}–${block.endTime}`;
      const collides = rows.some(
        (r) => r.includes(dayLabel) && r.includes(window) && r.includes('New Worksheet'),
      );
      expect({ block: block.id, window: `${dayLabel} ${window}`, collides }).toEqual({
        block: block.id,
        window: `${dayLabel} ${window}`,
        collides: false,
      });
    }

    // Planning itself never writes to the timetable: only the accepted blocks
    // from earlier are stored, unchanged in count.
    const afterReplan = JSON.parse(store.get('studyflow-timetable') as string) as TimetableState;
    expect(afterReplan.sessions).toHaveLength(afterAccept.sessions.length);
  });

  it('keeps selected suggestions that survive a re-plan', async () => {
    seedTimetable();
    const user = userEvent.setup();
    renderPlanner();
    await generatePlan(user);

    await user.click(screen.getByRole('button', { name: /select all/i }));
    await screen.findByText(/· [1-9]\d* selected/);

    await user.click(screen.getByRole('button', { name: 'add-homework' }));
    await screen.findByText(/changed since this plan was built/i);
    await user.click(screen.getByRole('button', { name: /^re-plan$/i }));

    // Selection survives: the original rows were not reset by the re-plan.
    expect(await screen.findByText(/· [1-9]\d* selected/)).toBeInTheDocument();
  });
});
