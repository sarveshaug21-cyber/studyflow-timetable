import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CalendarNav } from './CalendarNav';
import { CalendarProvider } from '@/context/CalendarContext';
import { TimetableLayoutProvider } from '@/context/TimetableLayoutContext';
import { TimetableProvider } from '@/context/TimetableContext';
import { SettingsProvider } from '@/context/SettingsContext';

function renderCalendarNav() {
  return render(
    <TimetableProvider>
      <SettingsProvider>
        <TimetableLayoutProvider>
          <CalendarProvider>
            <CalendarNav />
          </CalendarProvider>
        </TimetableLayoutProvider>
      </SettingsProvider>
    </TimetableProvider>
  );
}

describe('CalendarNav date picker', () => {
  it('renders the date picker input', () => {
    renderCalendarNav();
    expect(
      screen.getByLabelText(/go to date/i),
    ).toBeInTheDocument();
  });

  it('updates the selected date when a date is chosen', () => {
    renderCalendarNav();
    const dateInput = screen.getByLabelText(/go to date/i) as HTMLInputElement;
    expect(dateInput.value).toBe(new Date().toISOString().slice(0, 10));

    fireEvent.change(dateInput, { target: { value: '2026-12-25' } });
    expect(dateInput.value).toBe('2026-12-25');
  });
});
