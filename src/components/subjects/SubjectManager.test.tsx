import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TimetableProvider } from '@/context/TimetableContext';
import { SubjectManager } from '@/components/subjects/SubjectManager';

describe('SubjectManager', () => {
  it('renders the subjects view with add subject button', () => {
    render(
      <TimetableProvider>
        <SubjectManager />
      </TimetableProvider>,
    );
    expect(screen.getByText('Subjects')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add Subject/ }).length).toBeGreaterThan(0);
  });

  it('adds a subject through the full add flow', async () => {
    render(
      <TimetableProvider>
        <SubjectManager />
      </TimetableProvider>,
    );
    // Click the first "Add Subject" button (in the header)
    const addButtons = screen.getAllByRole('button', { name: /Add Subject/ });
    await addButtons[0].click();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Fill name and code inputs within the dialog
    const dialogContainer = within(dialog);
    const nameInput = dialogContainer.getByPlaceholderText(/Computer Science/) as HTMLInputElement;
    const codeInput = dialogContainer.getByPlaceholderText(/CS101/) as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    expect(codeInput).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Test Subject' } });
    fireEvent.change(codeInput, { target: { value: 'TS101' } });

    // Submit the form via the submit button
    await dialogContainer.getByRole('button', { name: /Add Subject/ }).click();

    expect(screen.getByText('Test Subject')).toBeInTheDocument();
  });
});
