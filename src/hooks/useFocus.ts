import { useContext } from 'react';
import { FocusContext } from '@/context/FocusContext';

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}
