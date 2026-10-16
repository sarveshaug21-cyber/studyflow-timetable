import { useTimetable } from '@/hooks/useTimetable';
import { AgendaDay } from './AgendaDay';
import { WEEKDAYS, ALL_DAYS } from '@/types';
import type { Session, Subject } from '@/types';

export function AgendaView() {
  const { state, getSessionsForDay, getSubject } = useTimetable();
  const days = state.showWeekends ? ALL_DAYS : WEEKDAYS;

  const sessionsByDay = days.map(day => {
    const sessions = getSessionsForDay(day).map(session => {
      const subject = getSubject(session.subjectId);
      return subject ? { ...session, subject } : null;
    }).filter((s): s is Session & { subject: Subject } => s !== null);
    
    return { day, sessions };
  });

  const hasAnySessions = sessionsByDay.some(d => d.sessions.length > 0);

  return (
    <div className="flex-1 overflow-auto p-4" role="region" aria-label="Agenda view">
      {!hasAnySessions && (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-6 w-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">No sessions this week</h3>
          <p className="text-neutral-500 dark:text-neutral-400">Add sessions to see them here</p>
        </div>
      )}

      {hasAnySessions && (
        <div className="space-y-6 max-w-3xl mx-auto">
          {sessionsByDay.map(({ day, sessions }) => (
            <AgendaDay key={day} day={day} sessions={sessions} />
          ))}
        </div>
      )}
    </div>
  );
}