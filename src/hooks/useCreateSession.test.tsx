import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useCreateSession } from './useCreateSession';
import type { DayOfWeek } from '@/types';
import type { TimetableLayoutConfig } from '@/context/TimetableLayoutContext';

const config: TimetableLayoutConfig = {
  timeRange: { start: '08:00', end: '22:00' },
  timeIncrement: 30,
  pixelsPerHour: 60,
  headerHeight: 40,
  timeAxisWidth: 60,
};

function TestHook({
  date = '2026-10-14',
  day = 3 as DayOfWeek,
  onCreate,
}: {
  date?: string;
  day?: DayOfWeek;
  onCreate?: (date: string, startTime: string, endTime: string, day: DayOfWeek) => void;
}) {
  const { containerRef, onPointerDown, preview } = useCreateSession({
    date,
    day,
    config,
    onCreate: onCreate || vi.fn(),
  });
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
      }}
      onPointerDown={onPointerDown}
      data-testid="create-container"
      style={{ touchAction: 'none', height: 480, position: 'relative' }}
    >
      {preview && <div data-testid="preview" style={{ top: preview.top, height: preview.height }} />}
    </div>
  );
}

// Captures native window listeners registered by the hook via mockImplementation.
let upListener: ((ev: PointerEvent) => void) | null = null;
let cancelListener: ((ev: PointerEvent) => void) | null = null;

beforeEach(() => {
  upListener = null;
  cancelListener = null;
  vi.spyOn(window, 'addEventListener').mockImplementation(
    (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'pointerup') upListener = listener as (ev: PointerEvent) => void;
      if (type === 'pointercancel') cancelListener = listener as (ev: PointerEvent) => void;
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** pointerDown at y px on the container. Returns the rect used. */
function pointerDownAt(y: number) {
  const container = screen.getByTestId('create-container');
  const rect = container.getBoundingClientRect();
  fireEvent.pointerDown(container, {
    pointerType: 'mouse',
    clientY: rect.top + y,
  });
  return rect;
}

/** Invoke the captured window 'pointerup' listener at y2 px. */
function pointerUpAt(rect: DOMRect, y2: number) {
  expect(upListener).toBeDefined();
  act(() => {
    upListener?.({ clientY: rect.top + y2, pointerType: 'mouse' } as unknown as PointerEvent);
  });
}

/** Invoke the captured window 'pointercancel' listener. */
function pointerCancel() {
  expect(cancelListener).toBeDefined();
  act(() => {
    cancelListener?.({} as unknown as PointerEvent);
  });
}

describe('useCreateSession', () => {
  it('creates a session on a pure click (no drag)', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const rect = pointerDownAt(100); // 09:40 → snap 09:30
    pointerUpAt(rect, 100); // end = start + 30min = 10:00
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('2026-10-14', '09:30', '10:00', 3);
  });

  it('creates a session from a drag selection', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const rect = pointerDownAt(100); // 09:30
    pointerUpAt(rect, 180); // 11:00
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('2026-10-14', '09:30', '11:00', 3);
  });

  it('snaps start and end to the configured increment', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const rect = pointerDownAt(105); // 09:45 → snap 10:00
    pointerUpAt(rect, 185); // 11:05 → snap 11:00
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('2026-10-14', '10:00', '11:00', 3);
  });

  it('clamps end time to the range end', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const rect = pointerDownAt(780); // 21:00 exactly
    pointerUpAt(rect, 900); // drag past range end → clamped to 22:00
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('2026-10-14', '21:00', '22:00', 3);
  });

  it('creates default-duration session when clicking at range start', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const rect = pointerDownAt(0); // 08:00
    pointerUpAt(rect, 0); // end = 08:00 → +30min = 08:30
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('2026-10-14', '08:00', '08:30', 3);
  });

  it('does not create when clicking an existing session (event propagation)', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const container = screen.getByTestId('create-container');
    const sessionEl = document.createElement('div');
    sessionEl.setAttribute('data-session-id', 'sess-1');
    container.appendChild(sessionEl);
    const rect = container.getBoundingClientRect();
    fireEvent.pointerDown(sessionEl, {
      pointerType: 'mouse',
      clientY: rect.top + 100,
    });
    // No pointerup listener was registered (pointerDown returned early).
    expect(upListener).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('cancels cleanly on pointercancel without creating', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    pointerDownAt(100);
    pointerCancel();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows a preview bar while dragging and clears it on release', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const rect = pointerDownAt(100);
    expect(screen.getByTestId('preview')).toBeInTheDocument();
    pointerUpAt(rect, 200);
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('ignores touch pointer types', () => {
    const onCreate = vi.fn();
    render(<TestHook onCreate={onCreate} />);
    const container = screen.getByTestId('create-container');
    const rect = container.getBoundingClientRect();
    fireEvent.pointerDown(container, {
      pointerType: 'touch',
      clientY: rect.top + 100,
    });
    // No window listeners registered for touch.
    expect(upListener).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('uses the configured date', () => {
    const onCreate = vi.fn();
    render(<TestHook date='2026-10-20' onCreate={onCreate} />);
    const rect = pointerDownAt(60); // 09:00 exactly
    pointerUpAt(rect, 60); // end 09:30
    expect(onCreate).toHaveBeenCalledWith('2026-10-20', '09:00', '09:30', 3);
  });
});
