import { useContext } from 'react';
import { TimetableContext } from '@/context/TimetableContext';

export function useTimetable() {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetable must be used within a TimetableProvider');
  }
  return context;
}