import { useMemo, useState } from 'react';
import { DAYS_OF_WEEK } from '@/types';
import { useTimetable } from '@/hooks/useTimetable';
import { useCalendar } from '@/hooks/useCalendar';
import { SessionEditor } from '@/components/sessions';
import { Modal } from '@/components/ui/Modal';
import { chunkWeeks, getMonthDays, sessionsOnDate } from '@/utils/calendar';
import type { MonthDay } from '@/utils/calendar';
import type { Session, DayOfWeek } from '@/types';
import { MonthCell } from './MonthCell';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function MonthView() {
  const { state, addSession, updateSession, subjects } = useTimetable();
  const { selectedDate, setSelectedDate, monthLabel } = useCalendar();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [createDay, setCreateDay] = useState<DayOfWeek | null>(null);

  const year = Number(selectedDate.slice(0, 4));
  const month = Number(selectedDate.slice(5, 7)) - 1;
  const days: MonthDay[] = getMonthDays(year, month);
  const weeks = chunkWeeks(days);

  const sessionsByDate = useMemo(
    () =>
      new Map(
        days.map((d) => [d.date, sessionsOnDate(state.sessions, d.date)]),
      ),
    [state.sessions, days],
  );

  const openCreate = (day: DayOfWeek) => {
    setCreateDay(day);
    setEditingSession(null);
    setEditorOpen(true);
  };

  const openEdit = (session: Session) => {
    setEditingSession(session);
    setCreateDay(null);
    setEditorOpen(true);
  };

  const handleSubmit = (data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingSession) {
      updateSession({ ...editingSession, ...data });
    } else {
      addSession(data);
    }
    setEditorOpen(false);
    setEditingSession(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {monthLabel}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {selectedDate.slice(5, 7)}/{selectedDate.slice(8, 10)}/{selectedDate.slice(0, 4)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => openCreate(1)}
            className="gap-1.5"
            aria-label="Add session"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Session</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-full">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 border-b border-neutral-200 dark:border-neutral-800 pb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d.value} className="text-center">
                {d.shortLabel}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} style={{ display: 'contents' }}>
                {week.map((day) => {
                  const sessions = sessionsByDate.get(day.date) ?? [];
                  return (
                    <MonthCell
                      key={day.date}
                      day={day}
                      sessions={sessions}
                      subjects={subjects}
                      onSelectDate={setSelectedDate}
                      onSessionClick={openEdit}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} title="Session" size="md">
        <SessionEditor
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSubmit={handleSubmit}
          initialData={
            editingSession
              ? {
                  subjectId: editingSession.subjectId,
                  day: editingSession.day,
                  startTime: editingSession.startTime,
                  endTime: editingSession.endTime,
                  type: editingSession.type,
                  location: editingSession.location || '',
                  notes: editingSession.notes || '',
                  recurring: editingSession.recurring,
                }
              : {
                  subjectId: '',
                  day: createDay ?? 1,
                  startTime: '09:00',
                  endTime: '10:00',
                  type: 'lecture',
                  location: '',
                  notes: '',
                  recurring: true,
                }
          }
          subjects={subjects}
        />
      </Modal>
    </div>
  );
}
