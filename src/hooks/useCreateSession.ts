import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import type { DayOfWeek } from '@/types';
import type { TimetableLayoutConfig } from '@/context/TimetableLayoutContext';
import { timeToMinutes, pixelsToTime } from '@/utils/date';
import { snapToIncrement, addMinutes } from '@/utils/calendar';

interface UseCreateSessionOptions {
  /** ISO date (yyyy-MM-dd) for the column/view being created on. */
  date: string;
  /** Day of week of the column/view (used for the new session's `day` field). */
  day: DayOfWeek;
  /** Layout config for time range, increment, and pixels-per-hour. */
  config: TimetableLayoutConfig;
  /** Called when the user finishes a click or drag on an empty slot. */
  onCreate: (date: string, startTime: string, endTime: string, day: DayOfWeek) => void;
}

/** Preview bar rendered while the user is clicking/dragging to create a session. */
interface CreatePreview {
  top: number; // pixels from grid container top
  height: number; // pixels
}

export function useCreateSession({
  date,
  day,
  config,
  onCreate,
}: UseCreateSessionOptions): {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  preview: CreatePreview | null;
} {
  const pointerRef = useRef<{
    startY: number;
    startTime: string;
    rect: DOMRect;
  } | null>(null);
  const [preview, setPreview] = useState<CreatePreview | null>(null);
  const containerRef: MutableRefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);

  const rangeEndMinutes = timeToMinutes(config.timeRange.end);

  // Store the latest DOM listeners in refs so endDrag can remove them without
  // circular useCallback dependencies.
  const moveHandlerRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const upHandlerRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const cancelHandlerRef = useRef<(() => void) | null>(null);

  const endDrag = useCallback(() => {
    if (moveHandlerRef.current) {
      window.removeEventListener('pointermove', moveHandlerRef.current);
    }
    if (upHandlerRef.current) {
      window.removeEventListener('pointerup', upHandlerRef.current);
    }
    if (cancelHandlerRef.current) {
      window.removeEventListener('pointercancel', cancelHandlerRef.current);
    }
    document.documentElement.style.userSelect = '';
    if (containerRef.current) {
      containerRef.current.style.touchAction = '';
    }
    pointerRef.current = null;
  }, []);

  const onPointerMove = (ev: PointerEvent) => {
    if (!pointerRef.current) return;
    const { startY, rect } = pointerRef.current;
    const endY = ev.clientY - rect.top;
    setPreview({
      top: Math.min(startY, endY),
      height: Math.max(1, Math.abs(endY - startY)),
    });
  };
  moveHandlerRef.current = onPointerMove;

  const onPointerUp = (ev: PointerEvent) => {
    // Save the drag start ref before endDrag clears it.
    const ref = pointerRef.current;
    endDrag();
    if (!ref) return;

    const { startTime, rect } = ref;
    const endY = ev.clientY - rect.top;
    let endTime = snapToIncrement(
      pixelsToTime(endY, config),
      config.timeIncrement
    );
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    // Clamp end to the time range.
    if (endMinutes > rangeEndMinutes) {
      endTime = config.timeRange.end;
    }
    // Ensure end > start (minimum one increment). If a full increment can't
    // fit inside the range, abort the creation.
    if (timeToMinutes(endTime) <= startMinutes) {
      endTime = addMinutes(startTime, config.timeIncrement);
      if (timeToMinutes(endTime) > rangeEndMinutes) {
        setPreview(null);
        return;
      }
    }

    setPreview(null);
    onCreate(date, startTime, endTime, day);
  };
  upHandlerRef.current = onPointerUp;

  const onPointerCancel = () => {
    endDrag();
    setPreview(null);
  };
  cancelHandlerRef.current = onPointerCancel;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only mouse/trackpad (ignore touch — mobile not a target for this flow).
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    // Never interfere with an existing session or its controls.
    if ((e.target as Element).closest('[data-session-id]')) return;
    if (pointerRef.current) return;

    e.preventDefault();
    if (containerRef.current) {
      containerRef.current.style.touchAction = 'none';
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const startY = e.clientY - rect.top;
    const startTime = snapToIncrement(
      pixelsToTime(startY, config),
      config.timeIncrement
    );

    pointerRef.current = { startY, startTime, rect };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    document.documentElement.style.userSelect = 'none';

    // Show a default-duration preview at the click position. For a pure click
    // (no drag), pointerup immediately clamps endTime to startTime + increment.
    setPreview({
      top: startY,
      height: Math.max(
        1,
        config.pixelsPerHour * (config.timeIncrement / 60)
      ),
    });
  };

  return { containerRef, onPointerDown, preview };
}

export type { CreatePreview };
