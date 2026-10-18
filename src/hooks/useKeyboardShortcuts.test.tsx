import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function TestShortcuts({
  goToToday,
  next,
  prev,
  setView,
  onAddSession,
}: {
  goToToday: () => void;
  next: () => void;
  prev: () => void;
  setView: (view: string) => void;
  onAddSession: () => void;
}) {
  useKeyboardShortcuts({ goToToday, next, prev, setView, onAddSession });
  return <div data-testid="shortcuts-host">host</div>;
}

describe('useKeyboardShortcuts', () => {
  it('goes to today on "t"', () => {
    const goToToday = vi.fn();
    render(
      <TestShortcuts
        goToToday={goToToday}
        next={vi.fn()}
        prev={vi.fn()}
        setView={vi.fn()}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: 't' });
    expect(goToToday).toHaveBeenCalledTimes(1);
  });

  it('switches to weekly view on "1"', () => {
    const setView = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={vi.fn()}
        prev={vi.fn()}
        setView={setView}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: '1' });
    expect(setView).toHaveBeenCalledWith('weekly');
  });

  it('switches to day view on "2"', () => {
    const setView = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={vi.fn()}
        prev={vi.fn()}
        setView={setView}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: '2' });
    expect(setView).toHaveBeenCalledWith('day');
  });

  it('switches to month view on "3"', () => {
    const setView = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={vi.fn()}
        prev={vi.fn()}
        setView={setView}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: '3' });
    expect(setView).toHaveBeenCalledWith('month');
  });

  it('switches to agenda view on "4"', () => {
    const setView = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={vi.fn()}
        prev={vi.fn()}
        setView={setView}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: '4' });
    expect(setView).toHaveBeenCalledWith('agenda');
  });

  it('goes to next period on "n"', () => {
    const next = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={next}
        prev={vi.fn()}
        setView={vi.fn()}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('goes to previous period on "p"', () => {
    const prev = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={vi.fn()}
        prev={prev}
        setView={vi.fn()}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('opens add session on "c"', () => {
    const onAddSession = vi.fn();
    render(
      <TestShortcuts
        goToToday={vi.fn()}
        next={vi.fn()}
        prev={vi.fn()}
        setView={vi.fn()}
        onAddSession={onAddSession}
      />,
    );
    fireEvent.keyDown(document.body, { key: 'c' });
    expect(onAddSession).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts with modifier keys', () => {
    const goToToday = vi.fn();
    render(
      <TestShortcuts
        goToToday={goToToday}
        next={vi.fn()}
        prev={vi.fn()}
        setView={vi.fn()}
        onAddSession={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.body, { key: 't', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 't', altKey: true });
    fireEvent.keyDown(document.body, { key: 't', metaKey: true });
    fireEvent.keyDown(document.body, { key: 't', shiftKey: true });
    expect(goToToday).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when typing in an input', () => {
    const goToToday = vi.fn();
    const { container } = render(
      <TestShortcuts
        goToToday={goToToday}
        next={vi.fn()}
        prev={vi.fn()}
        setView={vi.fn()}
        onAddSession={vi.fn()}
      />,
    );
    const input = container.ownerDocument.createElement('input');
    container.ownerDocument.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 't' });
    expect(goToToday).not.toHaveBeenCalled();
  });
});
