import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimetableProvider } from '@/context/TimetableContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { TimetableLayoutProvider } from '@/context/TimetableLayoutContext';
import { MonthView } from './MonthView';

function renderMonthView() {
  return render(
    <TimetableProvider>
      <TimetableLayoutProvider>
        <CalendarProvider>
          <MonthView />
        </CalendarProvider>
      </TimetableLayoutProvider>
    </TimetableProvider>,
  );
}

describe('MonthView', () => {
  it('renders the month grid with weekday headers and day cells', () => {
    renderMonthView();
    // Weekday headers (Monday-first)
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // Month/year heading present
    expect(screen.getByText(/\w+ \d{4}/)).toBeInTheDocument();
  });

  it('marks today with a Today pill', () => {
    renderMonthView();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
