import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimetableProvider } from '@/context/TimetableContext';
import { FocusProvider } from '@/context/FocusContext';
import { ProgressDashboard } from '@/components/progress/ProgressDashboard';

function renderDashboard() {
  return render(
    <TimetableProvider>
      <FocusProvider>
        <ProgressDashboard />
      </FocusProvider>
    </TimetableProvider>,
  );
}

describe('ProgressDashboard', () => {
  it('renders the heading', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: /^progress$/i })).toBeInTheDocument();
  });

  it('shows unavailable markers (—), not fake zeros, when there is no data', () => {
    renderDashboard();
    // Stat cards show an em dash rather than inventing "0"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText(/no homework data yet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no focus sessions yet/i).length).toBeGreaterThan(0);
  });

  it('shows honest empty states on the charts', () => {
    renderDashboard();
    expect(screen.getByText(/no focus sessions recorded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add homework to see per-subject progress/i)).toBeInTheDocument();
  });

  it('mentions that statistics come from real data', () => {
    renderDashboard();
    expect(screen.getByText(/real statistics from your studyflow data/i)).toBeInTheDocument();
  });
});
