import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, getDay } from 'date-fns';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import type {
  CalendarApi,
  DateClickInfo,
  DateSelectInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo,
} from '@fullcalendar/react';
import { useTimetable } from '@/hooks/useTimetable';
import { useCalendar } from '@/hooks/useCalendar';
import { useToast } from '@/hooks/useToast';
import { SessionEditor } from '@/components/sessions';
import { HomeworkEditor } from '@/components/homework/HomeworkEditor';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import type { Session, HomeworkItem, DayOfWeek } from '@/types';
import {
  buildCalendarEvents,
  computeSessionUpdateFromDrop,
  computeSessionUpdateFromResize,
  fullCalendarViewFor,
} from '@/utils/fullcalendar';
import { timeToMinutes, minutesToTime } from '@/utils/date';
import { getContrastColor } from '@/utils/colors';
import { cn } from '@/utils/cn';

/**
 * FullCalendar-backed timetable view.
 *
 * StudyFlow's TimetableContext (sessions + homework persisted to localStorage)
 * remains the single source of truth. FullCalendar is a pure view layer: it
 * receives derived `events` on every render and reports user intent back
 * through `eventClick`/`eventDrop`/`eventResize`/`dateSelect`/`dateClick`,
 * which dispatch through the existing `addSession`/`updateSession`/
 * `deleteSession`/`addHomework`/`updateHomework` actions.
 *
 * The legacy custom views (`TimetableGrid`, `DayView`, `MonthView`,
 * `AgendaView`) are left untouched in `src` and serve as the fallback.
 */
export function FullCalendarView() {
  const {
    state,
    subjects,
    sessions,
    homework,
    addSession,
    updateSession,
    deleteSession,
    addHomework,
    updateHomework,
  } = useTimetable();
  const { view, selectedDate } = useCalendar();
  const { toast } = useToast();

  const calendarRef = useRef<CalendarApi | null>(null);

  const [sessionEditorOpen, setSessionEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [createInitialData, setCreateInitialData] = useState<Partial<Session>>({});
  const [homeworkEditorOpen, setHomeworkEditorOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    subjectCode: string;
    subjectName: string;
  } | null>(null);

  const viewName = fullCalendarViewFor(view);
  const slotMinTime = state.timeRange.start;
  const slotMaxTime = state.timeRange.end;
  const slotHeaderInterval =
    state.timeIncrement === 60 ? { hours: 1 } : { minutes: 30 };

  const windowStart = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() - 35);
    return d;
  }, [selectedDate]);
  const windowEnd = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + 35);
    return d;
  }, [selectedDate]);

  const events = useMemo(
    () =>
      buildCalendarEvents({
        sessions,
        subjects,
        homework,
        windowStart,
        windowEnd,
      }),
    [sessions, subjects, homework, windowStart, windowEnd],
  );

  // StudyFlow's `selectedDate` is the source of truth: navigate FullCalendar to it.
  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar) return;
    if (format(calendar.getDate(), 'yyyy-MM-dd') !== selectedDate) {
      calendar.gotoDate(selectedDate);
    }
  }, [selectedDate]);

  // Apply view changes from CalendarNav.
  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar) return;
    calendar.changeView(viewName);
    if (format(calendar.getDate(), 'yyyy-MM-dd') !== selectedDate) {
      calendar.gotoDate(selectedDate);
    }
  }, [viewName, selectedDate]);

  const handleEventClick = useCallback(
    (info: EventClickInfo) => {
      const props = info.event.extendedProps as Record<string, string>;
      if (props['sessionId']) {
        const session = sessions.find((s) => s.id === props['sessionId']!);
        if (session) {
          setEditingSession(session);
          setSessionEditorOpen(true);
        }
        return;
      }
      if (props['homeworkId']) {
        const item = homework.find((h) => h.id === props['homeworkId']!);
        if (item) {
          setEditingHomework(item);
          setHomeworkEditorOpen(true);
        }
      }
    },
    [sessions, homework],
  );

  const handleEventDrop = useCallback(
    (info: EventDropInfo) => {
      const delta = computeSessionUpdateFromDrop({
        event: info.event as EventInput & {
          start: Date | null;
          end: Date | null;
          extendedProps: Record<string, unknown>;
        },
        oldEvent: info.oldEvent as EventInput & {
          start: Date | null;
          end: Date | null;
          extendedProps: Record<string, unknown>;
        },
        sessions,
        slotMinTime,
        slotMaxTime,
      });
      if (!delta) {
        info.revert();
        toast({
          type: 'warning',
          title: 'Move not allowed',
          message:
            'The session cannot be moved there. Use the session editor to change its date or time.',
        });
        return;
      }
      const session = sessions.find(
        (s) => s.id === String(info.event.extendedProps.sessionId),
      );
      if (!session) return;
      updateSession({
        ...session,
        ...delta,
        updatedAt: new Date().toISOString(),
      });
    },
    [sessions, slotMinTime, slotMaxTime, updateSession, toast],
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneInfo) => {
      const delta = computeSessionUpdateFromResize({
        event: info.event as EventInput & {
          start: Date | null;
          end: Date | null;
          extendedProps: Record<string, unknown>;
        },
        sessions,
        slotMaxTime,
      });
      if (!delta) {
        info.revert();
        toast({
          type: 'warning',
          title: 'Resize not allowed',
          message: 'The session cannot be resized to that duration.',
        });
        return;
      }
      const session = sessions.find(
        (s) => s.id === String(info.event.extendedProps.sessionId),
      );
      if (!session) return;
      updateSession({
        ...session,
        ...delta,
        updatedAt: new Date().toISOString(),
      });
    },
    [sessions, slotMaxTime, updateSession, toast],
  );

  const handleDateSelect = useCallback(
    (info: DateSelectInfo) => {
      const start = info.start;
      if (!start) return;
      const dateISO = format(start, 'yyyy-MM-dd');
      const day = getDay(start) as DayOfWeek;
      const startTime = `${start.getHours().toString().padStart(2, '0')}:${start
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const end = info.end;
      let endTime: string;
      if (!end || end.getTime() <= start.getTime()) {
        endTime = minutesToTime(timeToMinutes(startTime) + state.timeIncrement);
        if (timeToMinutes(endTime) > timeToMinutes(slotMaxTime)) {
          endTime = slotMaxTime;
        }
      } else {
        endTime = `${end.getHours().toString().padStart(2, '0')}:${end
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
      }
      setCreateInitialData({
        date: dateISO,
        day,
        startTime,
        endTime,
        recurring: false,
        allDay: info.allDay,
      });
      setEditingSession(null);
      setSessionEditorOpen(true);
    },
    [state.timeIncrement, slotMaxTime],
  );

  const handleDateClick = useCallback(
    (info: DateClickInfo) => {
      const dateISO = format(info.date, 'yyyy-MM-dd');
      const day = getDay(info.date) as DayOfWeek;
      let startTime = `${info.date.getHours().toString().padStart(2, '0')}:${info.date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      // Round a click down to the nearest slot so pre-filled times are valid.
      const startMinutes = timeToMinutes(startTime);
      const snapped = Math.floor(startMinutes / state.timeIncrement) * state.timeIncrement;
      startTime = `${Math.floor(snapped / 60).toString().padStart(2, '0')}:${(snapped % 60)
        .toString()
        .padStart(2, '0')}`;
      setCreateInitialData({
        date: dateISO,
        day,
        startTime,
        endTime: minutesToTime(timeToMinutes(startTime) + state.timeIncrement),
        recurring: false,
        allDay: info.allDay,
      });
      setEditingSession(null);
      setSessionEditorOpen(true);
    },
    [state.timeIncrement],
  );

  const handleEventDidMount = useCallback(
    (info: EventDisplayInfo & { el: HTMLElement }) => {
      const { el, event } = info;
      const props = event.extendedProps as Record<string, unknown>;
      const label = `${event.title}${
        props['kind'] === 'homework' ? ' — homework deadline' : ''
      }`;
      el.setAttribute('aria-label', label);
    },
    [],
  );

  const handleSessionSubmit = useCallback(
    (sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      if (editingSession) {
        updateSession({
          ...editingSession,
          ...sessionData,
          updatedAt: now,
        });
      } else {
        addSession(sessionData);
      }
      setSessionEditorOpen(false);
      setEditingSession(null);
      setCreateInitialData({});
    },
    [editingSession, addSession, updateSession],
  );

  const handleHomeworkSave = useCallback(
    (homeworkData: Omit<HomeworkItem, 'id'>) => {
      if (editingHomework) {
        updateHomework({ ...editingHomework, ...homeworkData });
      } else {
        addHomework(homeworkData);
      }
      setHomeworkEditorOpen(false);
      setEditingHomework(null);
    },
    [editingHomework, addHomework, updateHomework],
  );

  return (
    <div className="flex-1 min-h-0 overflow-auto" data-full-calendar-view>
      <FullCalendar
        ref={(el) => {
          calendarRef.current = el ? (el.getApi() as CalendarApi) : null;
        }}
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          listPlugin,
          interactionPlugin,
          classicThemePlugin,
        ]}
        initialView={viewName}
        initialDate={selectedDate}
        events={events}
        editable={true}
        selectable={true}
        eventStartEditable={true}
        eventDurationEditable={true}
        allDaySlot={true}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        slotHeaderInterval={slotHeaderInterval}
        slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        allDayText=""
        scrollTime={slotMinTime}
        firstDay={1}
        hiddenDays={state.showWeekends ? [] : [0, 6]}
        nowIndicator={true}
        eventInteractive={true}
        eventOverlap={true}
        eventContent={renderEventContent}
        eventDidMount={handleEventDidMount}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        select={handleDateSelect}
        dateClick={handleDateClick}
        headerToolbar={false}
      />

      <Modal
        isOpen={sessionEditorOpen}
        onClose={() => setSessionEditorOpen(false)}
        title={editingSession ? 'Edit Session' : 'Add Session'}
        size="md"
      >
        <SessionEditor
          isOpen={sessionEditorOpen}
          onClose={() => setSessionEditorOpen(false)}
          onSubmit={handleSessionSubmit}
          initialData={editingSession ?? createInitialData}
          subjects={subjects}
        />
      </Modal>

      <Modal
        isOpen={homeworkEditorOpen}
        onClose={() => setHomeworkEditorOpen(false)}
        title={editingHomework ? 'Edit Homework' : 'Add Homework'}
        size="md"
      >
        <HomeworkEditor
          isOpen={homeworkEditorOpen}
          onClose={() => setHomeworkEditorOpen(false)}
          onSave={handleHomeworkSave}
          initialData={editingHomework ?? undefined}
          subjects={subjects}
          isEditing={!!editingHomework}
        />
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteSession(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete Session"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.subjectCode}: ${deleteTarget.subjectName}"?`
            : ''
        }
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}

function renderEventContent(info: EventDisplayInfo): JSX.Element {
  const { event, timeText } = info;
  const props = event.extendedProps as Record<string, string | undefined>;
  const isHomework = props['kind'] === 'homework';
  const subjectColor = props['subjectColor'];
  const contrast = subjectColor ? getContrastColor(subjectColor) : '#09090b';

  const timePart = timeText ? (
    <span className="text-[10px] font-medium opacity-70 mr-2">{timeText}</span>
  ) : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-xs font-medium leading-none border',
        isHomework ? 'border-dashed' : 'border-solid',
      )}
      style={{
        color: contrast,
        borderColor: subjectColor ?? '#a1a1aa',
        backgroundColor: subjectColor ? `${subjectColor}1a` : '#e4e4e7',
      } as React.CSSProperties}
    >
      {timePart}
      <span className="truncate">{isHomework ? `Due: ${event.title}` : event.title}</span>
    </span>
  );
}
