import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimetableProvider } from '@/context/TimetableContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ImportDialog } from './ImportDialog';
import type { HomeworkItem, Subject } from '@/types';

const subject: Subject = {
  id: 'sub-1',
  name: 'Mathematics',
  code: 'MATH101',
  color: '#3b82f6',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function renderImportDialog({
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
          <ImportDialog
            isOpen
            onClose={vi.fn()}
            homework={homework}
            subjects={subjects}
            onImported={vi.fn()}
          />
        </ToastProvider>
      </SettingsProvider>
    </TimetableProvider>,
  );
}

describe('ImportDialog', () => {
  beforeEach(() => {
    if (typeof window.URL === 'undefined') {
      (window as unknown as { URL: { createObjectURL: () => string; revokeObjectURL: () => void } }).URL = {
        createObjectURL: () => 'blob:mock-url',
        revokeObjectURL: () => {},
      };
    } else {
      const url = window.URL as unknown as { createObjectURL: () => string; revokeObjectURL: () => void };
      url.createObjectURL = () => 'blob:mock-url';
      url.revokeObjectURL = () => {};
    }

    vi.spyOn(window, 'FileReader').mockImplementation(function () {
      const reader = {
        onload: null as ((ev: ProgressEvent) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        result: null as string | null,
        readAsText: async (file: File) => {
          const text = await file.text();
          if (reader.onload) {
            reader.onload({ target: { result: text } } as unknown as ProgressEvent);
          }
        },
        readAsArrayBuffer: () => {},
        abort: () => {},
        error: null,
        readyState: 0,
      };
      return reader as unknown as FileReader;
    });
  });

  it('renders the import dialog with file selection interface', () => {
    renderImportDialog();
    expect(screen.getByRole('dialog', { name: 'Import Homework' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose CSV or JSON file' })).toBeInTheDocument();
  });

  it('shows file info after selecting a file', () => {
    renderImportDialog();
    const fileInput = screen.getByLabelText<HTMLInputElement>('Choose CSV or JSON file');
    const file = new File(['title,subject,dueDate\nTest Task,Math,2026-10-20\n'], 'test.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    expect(screen.getByText('test.csv')).toBeInTheDocument();
    expect(screen.getByText(/48 B/)).toBeInTheDocument();
  });

  it('shows parse error for invalid file', async () => {
    renderImportDialog();
    const fileInput = screen.getByLabelText<HTMLInputElement>('Choose CSV or JSON file');
    const file = new File(['not valid csv content without headers'], 'bad.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText(/Unable to auto-detect/)).toBeInTheDocument();
  });

  it('shows preview with parsed records', async () => {
    renderImportDialog();
    const fileInput = screen.getByLabelText<HTMLInputElement>('Choose CSV or JSON file');
    const file = new File(
      ['title,subject,dueDate\nTest Task,Math,2026-10-20\nEnglish Essay,English,2026-10-25'],
      'test.csv',
      { type: 'text/csv' },
    );
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('English Essay')).toBeInTheDocument();
    expect(screen.getByText('Preview: test.csv')).toBeInTheDocument();
  });

  it('shows import result after applying', async () => {
    renderImportDialog({ homework: [], subjects: [subject] });
    const fileInput = screen.getByLabelText<HTMLInputElement>('Choose CSV or JSON file');
    const file = new File(
      ['title,subject,dueDate\nTest Task,Math,2026-10-20'],
      'test.csv',
      { type: 'text/csv' },
    );
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText('Test Task')).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /Import 1 record/ });
    fireEvent.click(applyButton);

    expect(screen.getByText('Import complete')).toBeInTheDocument();
    expect(screen.getByText('1 homework item imported and added to your list.')).toBeInTheDocument();
  });
});