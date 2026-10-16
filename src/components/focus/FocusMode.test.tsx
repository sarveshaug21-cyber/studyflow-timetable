import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/Toast';
import { SettingsProvider } from '@/context/SettingsContext';
import { TimetableProvider } from '@/context/TimetableContext';
import { FocusProvider } from '@/context/FocusContext';
import { FocusMode } from '@/components/focus/FocusMode';

function renderFocusMode() {
  return render(
    <ToastProvider>
      <SettingsProvider>
        <TimetableProvider>
          <FocusProvider>
            <FocusMode />
          </FocusProvider>
        </TimetableProvider>
      </SettingsProvider>
    </ToastProvider>,
  );
}

describe('FocusMode', () => {
  it('renders the heading, timer and a start button', () => {
    renderFocusMode();
    expect(screen.getByRole('heading', { name: /focus mode/i })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('25:00');
    expect(screen.getByRole('button', { name: /start focus session/i })).toBeInTheDocument();
  });

  it('shows ready state and history empty state before any session', () => {
    renderFocusMode();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText(/no focus sessions recorded yet/i)).toBeInTheDocument();
  });

  it('start switches to running state with pause/reset/finish controls', async () => {
    const user = userEvent.setup();
    renderFocusMode();
    await user.click(screen.getByRole('button', { name: /start focus session/i }));

    expect(screen.getByRole('button', { name: /pause focus session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset timer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish session early/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start focus session/i })).not.toBeInTheDocument();
    expect(screen.getByText('Focusing')).toBeInTheDocument();
  });

  it('disables duration and homework selects while a session is active', async () => {
    const user = userEvent.setup();
    renderFocusMode();
    await user.click(screen.getByRole('button', { name: /start focus session/i }));

    expect(screen.getByTestId('focus-duration-select')).toBeDisabled();
    expect(screen.getByTestId('focus-homework-select')).toBeDisabled();
  });

  it('pause then resume toggles the running state', async () => {
    const user = userEvent.setup();
    renderFocusMode();
    await user.click(screen.getByRole('button', { name: /start focus session/i }));
    await user.click(screen.getByRole('button', { name: /pause focus session/i }));

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume focus session/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /resume focus session/i }));
    expect(screen.getByText('Focusing')).toBeInTheDocument();
  });

  it('reset with no elapsed time returns to idle without logging a session', async () => {
    const user = userEvent.setup();
    renderFocusMode();
    await user.click(screen.getByRole('button', { name: /start focus session/i }));
    await user.click(screen.getByRole('button', { name: /reset timer/i }));

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start focus session/i })).toBeInTheDocument();
    expect(screen.getByText(/no focus sessions recorded yet/i)).toBeInTheDocument();
  });
});
