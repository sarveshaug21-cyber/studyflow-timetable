import {
  addDays,
  eachDayOfInterval,
  format,
  getDay,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import type { Session, Subject, DayOfWeek, HomeworkItem } from '@/types';
import { timeToMinutes } from '@/utils/date';
import { occursOnDate } from '@/utils/calendar';
import type { EventInput } from '@fullcalendar/react';
import { getContrastColor } from '@/utils/colors';

/** Stable prefix so FullCalendar event ids never collide with other sources. */
const FC_SESSION_PREFIX = 'fc-session';
const FC_HOMEWORK_PREFIX = 'fc-homework';

/** Minimum session duration enforced for drag/resize (matches the editor's 30-min increment). */
export const MIN_SESSION_MINUTES = 30;

export interface SessionDelta {
  date?: string;
  day?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  overnight?: boolean;
}

/**
 * ISO date part of a Date, in local time (StudyFlow stores all dates as local yyyy-MM-dd).
 */
function localDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function localTimeString(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/** True when `end` falls on a later calendar day than `start` (a midnight crossing). */
function isOvernight(start: Date, end: Date): boolean {
  return localDateString(start) !== localDateString(end);
}

/**
 * Does this session apply on `dateISO`? Mirrors `sessionsOnDate` semantics per-session:
 * one-off by date/span, recurring by rule/weekday, overnight on both its dates.
 */
function sessionAppliesOnDate(session: Session, dateISO: string): boolean {
  const dayOfWeek = getDay(new Date(`${dateISO}T00:00:00`)) as DayOfWeek;

  if (session.recurring) {
    if (session.recurrenceRule) return occursOnDate(session, dateISO);
    // Legacy weekly-forever on `day`.
    return session.day === dayOfWeek;
  }
  // One-off session.
  if (session.date && session.endDate) {
    // ISO yyyy-MM-dd strings compare lexicographically in chronological order.
    return dateISO >= session.date && dateISO <= session.endDate;
  }
  if (session.date) {
    if (session.overnight) {
      const nextDay = format(addDays(session.date, 1), 'yyyy-MM-dd');
      return dateISO === session.date || dateISO === nextDay;
    }
    return session.date === dateISO;
  }
  // No date at all: fall back to matching by weekday (defensive).
  return session.day === dayOfWeek;
}

/**
 * Expand a single `Session` into the FullCalendar events that represent it on the
 * given calendar days. Returns one event per applicable day; overnight sessions
 * render on both their start date and the following day, matching StudyFlow's
 * existing day/week rendering.
 */
function expandSession(
  session: Session,
  subjectById: Map<string, Subject>,
  days: Date[],
): EventInput[] {
  const events: EventInput[] = [];
  const subject = session.subjectId ? subjectById.get(session.subjectId) : undefined;
  const color = subject?.color;
  const title = subject ? `${subject.code}: ${subject.name}` : session.id;

  const base: EventInput = {
    title,
    className: 'sf-event',
    extendedProps: {
      kind: 'session',
      sessionId: session.id,
      instanceDate: undefined as string | undefined,
      subjectId: session.subjectId,
      subjectCode: subject?.code,
      subjectName: subject?.name,
      subjectColor: subject?.color,
      type: session.type,
      location: session.location,
      notes: session.notes,
      recurring: session.recurring,
      overnight: session.overnight ?? false,
    },
    allDay: false, // timed by default; the all-day branch overrides with `true`
    ...(color ? { color, contrastColor: getContrastColor(color) } : {}),
  };

  const addEvent = (dateISO: string, startTime: string, endTime: string, overnight: boolean) => {
    events.push({
      ...base,
      id: `${FC_SESSION_PREFIX}-${session.id}@${dateISO}${overnight ? '-overnight' : ''}`,
      start: `${dateISO}T${startTime}`,
      end: `${dateISO}T${endTime}`,
      extendedProps: {
        ...base.extendedProps,
        instanceDate: dateISO,
        overnight,
      },
    });
  };

  const extended = (dateISO: string, overnight: boolean) => ({
    ...base.extendedProps,
    instanceDate: dateISO,
    overnight,
  });

  if (session.allDay) {
    for (const day of days) {
      const dateISO = localDateString(day);
      if (sessionAppliesOnDate(session, dateISO)) {
        events.push({
          ...base,
          id: `${FC_SESSION_PREFIX}-${session.id}@${dateISO}`,
          allDay: true,
          start: dateISO,
          end: localDateString(addDays(day, 1)),
        });
      }
    }
    return events;
  }

  for (const day of days) {
    const dateISO = localDateString(day);

    const isOvernightType =
      session.overnight || timeToMinutes(session.endTime) <= timeToMinutes(session.startTime);

    if (isOvernightType) {
      // Overnight sessions render a single event on their start date that
      // FullCalendar segments at midnight onto the following day. Skip the
      // continuation day so it isn't drawn twice.
      if (session.date && dateISO === localDateString(addDays(session.date, 1))) continue;
      if (!sessionAppliesOnDate(session, dateISO)) continue;
      const endOnDateISO = localDateString(addDays(day, 1));
      events.push({
        ...base,
        id: `${FC_SESSION_PREFIX}-${session.id}@${dateISO}-overnight`,
        start: `${dateISO}T${session.startTime}`,
        end: `${endOnDateISO}T${session.endTime}`,
        extendedProps: extended(dateISO, true),
      });
      continue;
    }

    if (!sessionAppliesOnDate(session, dateISO)) continue;
    addEvent(dateISO, session.startTime, session.endTime, false);
  }

  return events;
}

/**
 * Build the FullCalendar `events` array for the visible window.
 *
 * StudyFlow state (`state.sessions` / `state.homework` via TimetableContext +
 * localStorage) remains the single source of truth; FullCalendar only ever
 * receives derived events and reports user intent back through callbacks.
 *
 * `windowStart`/`windowEnd` are local-date bounds (inclusive) defining the
 * expansion window for recurring sessions.
 */
export function buildCalendarEvents({
  sessions,
  subjects,
  homework,
  windowStart,
  windowEnd,
}: {
  sessions: Session[];
  subjects: Subject[];
  homework: HomeworkItem[];
  windowStart: Date;
  windowEnd: Date;
}): EventInput[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const days = eachDayOfInterval({ start: windowStart, end: windowEnd });

  const events: EventInput[] = [];
  for (const session of sessions) {
    events.push(...expandSession(session, subjectById, days));
  }

  // Homework deadlines: all-day events on the due date (non-completed only).
  for (const item of homework) {
    if (item.status === 'completed' || item.status === 'submitted') continue;
    const due = startOfDay(item.dueDate);
    if (!isWithinInterval(due, { start: windowStart, end: windowEnd })) continue;
    const subject = subjects.find((s) => s.name === item.subject);
    const color = subject?.color;
    events.push({
      id: `${FC_HOMEWORK_PREFIX}-${item.id}`,
      title: item.title,
      allDay: true,
      start: localDateString(due),
      end: localDateString(addDays(due, 1)),
      className: 'sf-event sf-event--homework',
      ...(color ? { color, contrastColor: getContrastColor(color) } : {}),
      extendedProps: {
        kind: 'homework',
        homeworkId: item.id,
        subject: item.subject,
        subjectColor: subject?.color,
        dueDate: localDateString(due),
      },
    });
  }

  return events;
}

/**
 * Compute the session field updates implied by a FullCalendar `eventDrop`.
 * Returns `null` when the drop must be rejected (caller reverts the event).
 */
export function computeSessionUpdateFromDrop(input: {
  /** The dropped event (already moved by FullCalendar). */
  event: EventInput & { start: Date | null; end: Date | null; extendedProps: Record<string, unknown> };
  /** The event's previous state. */
  oldEvent: EventInput & { start: Date | null; end: Date | null };
  sessions: Session[];
  /** Visible slot bounds (HH:mm). */
  slotMinTime: string;
  slotMaxTime: string;
}): SessionDelta | null {
  const { event, sessions, slotMinTime, slotMaxTime } = input;
  const sessionId = String((event.extendedProps as Record<string, unknown>)['sessionId'] ?? '');
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const start = event.start;
  const end = event.end;
  if (!start || !end || event.allDay) return null; // all-day moves are edited via the modal
  if (session.endDate) return null; // multi-day spans: edit via the modal

  const startMinutes = timeToMinutes(localTimeString(start));
  const endMinutes = timeToMinutes(localTimeString(end));
  const duration = end.getTime() - start.getTime();
  const overnight = isOvernight(start, end);

  if (duration < MIN_SESSION_MINUTES * 60 * 1000) return null; // below minimum

  const slotStart = timeToMinutes(slotMinTime);
  const slotEnd = timeToMinutes(slotMaxTime);

  if (startMinutes < slotStart || startMinutes >= slotEnd) return null; // outside visible day
  if (!overnight) {
    if (endMinutes <= startMinutes) return null;
    if (endMinutes > slotEnd) return null;
  } else {
    // Overnight: end must still be after start and end on the next day.
    if (endMinutes <= 0 || endMinutes >= 1440) return null;
  }

  const delta: SessionDelta = {
    date: localDateString(start),
    startTime: localTimeString(start),
    endTime: localTimeString(end),
    overnight,
  };

  // One-off dated sessions move to the dropped date; legacy recurring sessions
  // (no rule) also adopt the new weekday. Rule-bound recurring series keep
  // their weekday pattern and only change their time of day.
  if (!session.recurring || !session.recurrenceRule) {
    delta.day = getDay(start) as DayOfWeek;
  }

  return delta;
}

/**
 * Compute the session field updates implied by a FullCalendar `eventResize`.
 * Returns `null` when the resize must be rejected (caller reverts the event).
 */
export function computeSessionUpdateFromResize(input: {
  event: EventInput & { start: Date | null; end: Date | null; extendedProps: Record<string, unknown> };
  sessions: Session[];
  slotMaxTime: string;
}): SessionDelta | null {
  const { event, sessions, slotMaxTime } = input;
  const sessionId = String((event.extendedProps as Record<string, unknown>)['sessionId'] ?? '');
  const session = sessions.find((s) => s.id === sessionId);
  if (!session || event.allDay || !event.start || !event.end) return null;

  const start = event.start;
  const end = event.end;
  const duration = end.getTime() - start.getTime();
  const overnight = isOvernight(start, end);

  if (duration < MIN_SESSION_MINUTES * 60 * 1000) return null;

  const endMinutes = timeToMinutes(localTimeString(end));
  const slotEnd = timeToMinutes(slotMaxTime);

  if (!overnight) {
    if (endMinutes <= timeToMinutes(localTimeString(start))) return null;
    if (endMinutes > slotEnd) return null;
  } else if (endMinutes <= 0 || endMinutes >= 1440) {
    return null;
  }

  return {
    endTime: localTimeString(end),
    overnight,
  };
}

/** Map a StudyFlow `ViewMode` to a FullCalendar view name. */
export function fullCalendarViewFor(view: string): 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth' | 'listWeek' {
  switch (view) {
    case 'day':
      return 'timeGridDay';
    case 'month':
      return 'dayGridMonth';
    case 'agenda':
      return 'listWeek';
    case 'weekly':
    default:
      return 'timeGridWeek';
  }
}
