import { useCallback } from 'react';
import { useKeyboard } from './useKeyboard';
import type { ViewMode } from '@/types';

/**
 * Calendar keyboard shortcuts.
 *
 * Shortcuts are suppressed when typing in an input/textarea/select or
 * contentEditable element (handled by `useKeyboard`), and when any modifier
 * key (Ctrl, Alt, Meta, Shift) is held.
 *
 * Shortcuts:
 *   t   → go to today
 *   1   → weekly view
 *   2   → day view
 *   3   → month view
 *   4   → agenda view
 *   n   → next period
 *   p   → previous period
 *   c   → add session (open editor)
 */
export function useKeyboardShortcuts({
  goToToday,
  next,
  prev,
  setView,
  onAddSession,
}: {
  goToToday: () => void;
  next: () => void;
  prev: () => void;
  setView: (view: ViewMode) => void;
  onAddSession: () => void;
}) {
  const handler = useCallback((e: KeyboardEvent) => {
    // Ignore modifier keys.
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    switch (e.key) {
      case 't':
        e.preventDefault();
        goToToday();
        break;
      case '1':
        e.preventDefault();
        setView('weekly');
        break;
      case '2':
        e.preventDefault();
        setView('day');
        break;
      case '3':
        e.preventDefault();
        setView('month');
        break;
      case '4':
        e.preventDefault();
        setView('agenda');
        break;
      case 'n':
        e.preventDefault();
        next();
        break;
      case 'p':
        e.preventDefault();
        prev();
        break;
      case 'c':
        e.preventDefault();
        onAddSession();
        break;
    }
  }, [goToToday, next, prev, setView, onAddSession]);

  useKeyboard(handler);
}
