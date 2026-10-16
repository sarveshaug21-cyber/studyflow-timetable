import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeworkEditor } from '@/components/homework/HomeworkEditor';
import { HOMEWORK_PRIORITIES } from '@/types';
import type { HomeworkItem, Subject } from '@/types';

const subjects: Subject[] = [
  {
    id: 'sub-maths',
    name: 'Maths',
    code: 'MATH101',
    color: '#0000ff',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

function makeItem(overrides: Partial<HomeworkItem> = {}): HomeworkItem {
  return {
    id: 'hw-1',
    title: 'Chapter 3 Exercises',
    subject: 'Maths',
    teacher: 'Mr. Smith',
    group: '10A',
    type: 'Homework',
    dueDate: new Date('2026-10-20T00:00:00'),
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
    ...overrides,
  };
}

function renderEditor(
  props: Partial<React.ComponentProps<typeof HomeworkEditor>> = {},
) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <HomeworkEditor
      isOpen
      onClose={onClose}
      onSave={onSave}
      subjects={subjects}
      {...props}
    />,
  );
  return { onSave, onClose };
}

/** The estimate is a number Input labelled "Study estimate (minutes)". */
function estimateInput() {
  return screen.getByLabelText('Study estimate in minutes') as HTMLInputElement;
}

/** Priority is a SelectDropdown button carrying aria-label="Priority". */
function priorityTrigger() {
  return screen.getByRole('button', { name: 'Priority' });
}

function titleInput() {
  return screen.getByPlaceholderText('e.g. Chapter 3 Exercises') as HTMLInputElement;
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^save$/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomeworkEditor planning fields', () => {
  it('renders a priority control and a study-estimate field', () => {
    renderEditor();
    expect(priorityTrigger()).toBeInTheDocument();
    expect(estimateInput()).toBeInTheDocument();
  });

  it('defaults to Normal priority and a blank estimate for a new item', () => {
    renderEditor();
    expect(priorityTrigger()).toHaveTextContent('Normal');
    expect(estimateInput().value).toBe('');
  });

  it('pre-fills priority and estimate when editing an existing item', () => {
    renderEditor({
      initialData: makeItem({ priority: 'urgent', estimatedMinutes: 90 }),
    });
    expect(priorityTrigger()).toHaveTextContent('Urgent');
    expect(estimateInput().value).toBe('90');
  });

  it('shows an empty estimate for a legacy item with no estimate', () => {
    renderEditor({ initialData: makeItem({ priority: 'high' }) });
    expect(estimateInput().value).toBe('');
    expect(priorityTrigger()).toHaveTextContent('High');
  });

  it('offers every priority option', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(priorityTrigger());
    for (const p of HOMEWORK_PRIORITIES) {
      expect(
        screen.getByRole('option', { name: new RegExp(p.label) }),
      ).toBeInTheDocument();
    }
  });

  it('saves the chosen priority and estimate', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ initialData: makeItem() });

    await user.click(priorityTrigger());
    await user.click(screen.getByRole('option', { name: /High/ }));
    await user.clear(estimateInput());
    await user.type(estimateInput(), '45');
    await submit(user);

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as HomeworkItem;
    expect(saved.priority).toBe('high');
    expect(saved.estimatedMinutes).toBe(45);
  });

  it('preserves an existing priority and estimate when only the title changes', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({
      initialData: makeItem({ priority: 'urgent', estimatedMinutes: 30 }),
    });

    await user.clear(titleInput());
    await user.type(titleInput(), 'Renamed work');
    await submit(user);

    const saved = onSave.mock.calls[0][0] as HomeworkItem;
    expect(saved.title).toBe('Renamed work');
    expect(saved.priority).toBe('urgent');
    expect(saved.estimatedMinutes).toBe(30);
  });

  it('rejects an estimate below the minimum and does not save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ initialData: makeItem() });
    await user.type(estimateInput(), '2');
    await submit(user);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter between/)).toBeInTheDocument();
  });

  it('rejects an estimate above the maximum and does not save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ initialData: makeItem() });
    await user.type(estimateInput(), '100000');
    await submit(user);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter between/)).toBeInTheDocument();
  });

  it('rejects a non-integer estimate and does not save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ initialData: makeItem() });
    // A number input discards non-numeric keystrokes, but a decimal is a
    // realistic typing mistake and must not silently truncate to an integer.
    await user.type(estimateInput(), '45.5');
    await submit(user);
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/whole number of minutes|leave blank to auto-estimate/i),
    ).toBeInTheDocument();
  });

  it('accepts a blank estimate as auto-estimate (undefined)', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ initialData: makeItem() });
    await user.clear(estimateInput());
    await submit(user);
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as HomeworkItem;
    expect(saved.estimatedMinutes).toBeUndefined();
  });

  it('saves the boundary estimate at exactly the minimum', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ initialData: makeItem() });
    await user.clear(estimateInput());
    await user.type(estimateInput(), '5');
    await submit(user);
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as HomeworkItem;
    expect(saved.estimatedMinutes).toBe(5);
  });

  it('shows the priority description for the selected priority', () => {
    renderEditor({ initialData: makeItem({ priority: 'urgent' }) });
    const description = HOMEWORK_PRIORITIES.find((p) => p.value === 'urgent')!
      .description;
    expect(screen.getByText(description)).toBeInTheDocument();
  });
});
