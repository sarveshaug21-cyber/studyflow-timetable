import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimetableProvider } from '@/context/TimetableContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastProvider } from '@/components/ui/Toast';
import { HomeworkView } from './HomeworkView';
import type { HomeworkItem, Subject } from '@/types';

const subject: Subject = {
  id: 'sub-1',
  name: 'Mathematics',
  code: 'MATH101',
  color: '#3b82f6',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const homeworkItem = (overrides: Partial<HomeworkItem> = {}): HomeworkItem => ({
  id: 'hw-1',
  title: 'Maths Homework',
  subject: 'Mathematics',
  teacher: 'Mr. Smith',
  group: '9A',
  type: 'Assignment',
  dueDate: new Date('2026-10-20T00:00:00.000Z'),
  status: 'pending',
  submissionType: 'online',
  hide: false,
  source: 'manual',
  ...overrides,
});

function renderHomeworkView({
  homework = [],
  subjects = [subject],
}: {
  homework?: HomeworkItem[];
  subjects?: Subject[];
} = {}) {
  return render(
    <TimetableProvider>
      <SettingsProvider>
        <ToastProvider>
          <HomeworkView
            homework={homework}
            subjects={subjects}
            onImportClick={vi.fn()}
            onAddHomework={vi.fn()}
            onUpdateHomework={vi.fn()}
            onRemoveHomework={vi.fn()}
          />
        </ToastProvider>
      </SettingsProvider>
    </TimetableProvider>,
  );
}

describe('HomeworkView', () => {
  it('renders empty state when there is no homework', () => {
    renderHomeworkView();
    expect(screen.getByText('No homework found')).toBeInTheDocument();
    expect(screen.getByText('Import from file or add manually to get started')).toBeInTheDocument();
  });

  it('renders homework cards', () => {
    renderHomeworkView({ homework: [homeworkItem()] });
    expect(screen.getByText('Maths Homework')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('Mr. Smith')).toBeInTheDocument();
  });

  it('filters homework by status', () => {
    renderHomeworkView({
      homework: [
        homeworkItem({ id: 'hw-1', status: 'pending', title: 'Pending Homework' }),
        homeworkItem({ id: 'hw-2', status: 'completed', title: 'Completed Homework' }),
      ],
    });

    // Default filter is 'all' - both should show
    expect(screen.getByText('Pending Homework')).toBeInTheDocument();
    expect(screen.getByText('Completed Homework')).toBeInTheDocument();

    // Click the filter dropdown and select 'completed'
    const filterButton = screen.getByRole('button', { name: /^Filter:/ });
    fireEvent.click(filterButton);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Completed' }));
    expect(screen.queryByText('Pending Homework')).not.toBeInTheDocument();
    expect(screen.getByText('Completed Homework')).toBeInTheDocument();
  });

  it('searches homework by title', () => {
    renderHomeworkView({
      homework: [
        homeworkItem({ id: 'hw-1', title: 'Maths Homework' }),
        homeworkItem({ id: 'hw-2', title: 'English Essay' }),
      ],
    });

    const searchInput = screen.getByPlaceholderText('Search homework...');
    fireEvent.change(searchInput, { target: { value: 'Maths' } });
    expect(screen.getByText('Maths Homework')).toBeInTheDocument();
    expect(screen.queryByText('English Essay')).not.toBeInTheDocument();
  });

  it('opens add homework editor when Add Manually is clicked', () => {
    renderHomeworkView();
    const addButton = screen.getByRole('button', { name: /Add Manually/ });
    fireEvent.click(addButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeInTheDocument();
  });

  it('opens edit homework editor when Edit is clicked', () => {
    renderHomeworkView({ homework: [homeworkItem()] });
    const editButton = screen.getByRole('button', { name: 'Edit homework' });
    fireEvent.click(editButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mathematics' })).toBeInTheDocument();
  });

  it('deletes homework when Delete is clicked', () => {
    const onRemoveHomework = vi.fn();
    render(
      <TimetableProvider>
        <SettingsProvider>
          <ToastProvider>
            <HomeworkView
              homework={[homeworkItem()]}
              subjects={[subject]}
              onImportClick={vi.fn()}
              onAddHomework={vi.fn()}
              onUpdateHomework={vi.fn()}
              onRemoveHomework={onRemoveHomework}
            />
          </ToastProvider>
        </SettingsProvider>
      </TimetableProvider>,
    );
    const deleteButton = screen.getByRole('button', { name: 'Delete homework' });
    fireEvent.click(deleteButton);
    expect(onRemoveHomework).toHaveBeenCalledWith('hw-1');
  });
});
