import { describe, it, expect } from 'vitest';
import type { Session, Subject, HomeworkItem } from '@/types';
import {
  buildCalendarEvents,
  computeSessionUpdateFromDrop,
  computeSessionUpdateFromResize,
  fullCalendarViewFor,
  MIN_SESSION_MINUTES,
} from './fullcalendar';

const subject: Subject = {
  id: 'sub-1',
  name: 'Introduction to Computer Science',
  code: 'CS101',
  color: '#3b82f6',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const baseSession = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  subjectId: 'sub-1',
  day: 1,
  startTime: '09:00',
  endTime: '10:00',
  type: 'lecture',
  recurring: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const windowStart = new Date('2026-10-12T00:00:00'); // Monday
const windowEnd = new Date('2026-10-18T00:00:00'); // Sunday

const eventsFor = (session: Session) =>
  buildCalendarEvents({
    sessions: [session],
    subjects: [subject],
    homework: [],
    windowStart,
    windowEnd,
  });

describe('fullCalendarViewFor', () => {
  it('maps StudyFlow views to FullCalendar views', () => {
    expect(fullCalendarViewFor('weekly')).toBe('timeGridWeek');
    expect(fullCalendarViewFor('day')).toBe('timeGridDay');
    expect(fullCalendarViewFor('month')).toBe('dayGridMonth');
    expect(fullCalendarViewFor('agenda')).toBe('listWeek');
  });
});

describe('buildCalendarEvents — one-off sessions', () => {
  it('renders a one-off session on its date', () => {
    const events = eventsFor(baseSession({ date: '2026-10-13' }));
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('fc-session-s1@2026-10-13');
    expect(events[0]!.start).toBe('2026-10-13T09:00');
    expect(events[0]!.end).toBe('2026-10-13T10:00');
    expect(events[0]!.allDay).toBe(false);
    expect(events[0]!.extendedProps!.sessionId).toBe('s1');
    expect(events[0]!.extendedProps!.instanceDate).toBe('2026-10-13');
  });

  it('does not render outside the expansion window', () => {
    const events = eventsFor(baseSession({ date: '2026-11-01' }));
    expect(events).toHaveLength(0);
  });

  it('colours the event from the subject', () => {
    const events = eventsFor(baseSession({ date: '2026-10-13' }));
    expect(events[0]!.color).toBe('#3b82f6');
    expect(events[0]!.contrastColor).toBe('#fafafa'); // #3b82f6 → light text
    expect(events[0]!.className).toBe('sf-event');
  });
});

describe('buildCalendarEvents — overnight sessions', () => {
  it('renders an overnight session across midnight on both dates', () => {
    const events = eventsFor(
      baseSession({
        id: 's2',
        date: '2026-10-13',
        startTime: '23:00',
        endTime: '01:00',
        overnight: true,
      }),
    );
    // One event on the start date; FullCalendar segments it at midnight so the
    // 00:00→01:00 continuation appears on the following day automatically.
    expect(events).toHaveLength(1);
    expect(events[0]!.start).toBe('2026-10-13T23:00');
    expect(events[0]!.end).toBe('2026-10-14T01:00');
    expect(events[0]!.extendedProps!.overnight).toBe(true);
  });
});

describe('buildCalendarEvents — recurring sessions', () => {
  it('renders a weekly recurring session on its weekday within the window', () => {
    const events = eventsFor(
      baseSession({
        id: 's3',
        date: undefined,
        day: 3, // Wednesday
        recurring: true,
      }),
    );
    const dates = events.map((e) => String(e.start).slice(0, 10));
    expect(dates).toEqual(['2026-10-14']); // Wednesday in window
  });

  it('renders a bounded weekly series on each occurrence', () => {
    const events = eventsFor(
      baseSession({
        id: 's4',
        day: 1,
        recurring: true,
        recurrenceRule: 'weekly',
        recurrenceStartDate: '2026-10-12',
        recurrenceEndDate: '2026-10-18',
        recurrenceWeekdays: [1, 4],
      }),
    );
    const dates = events.map((e) => String(e.start).slice(0, 10)).sort();
    expect(dates).toEqual(['2026-10-12', '2026-10-15']);
  });

  it('stops a daily series at max occurrences', () => {
    const events = eventsFor(
      baseSession({
        id: 's5',
        date: '2026-10-12',
        day: 1,
        recurring: true,
        recurrenceRule: 'daily',
        recurrenceMaxOccurrences: 2,
      }),
    );
    expect(events).toHaveLength(2);
  });
});

describe('buildCalendarEvents — multi-day and all-day sessions', () => {
  it('renders a multi-day session on each day of its span', () => {
    const events = eventsFor(
      baseSession({
        id: 's6',
        date: '2026-10-13',
        endDate: '2026-10-15',
        day: 2,
        startTime: '10:00',
        endTime: '11:00',
      }),
    );
    const dates = events.map((e) => String(e.start).slice(0, 10)).sort();
    expect(dates).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(events.every((e) => String(e.end).endsWith('T11:00'))).toBe(true);
  });

  it('renders an all-day session as an all-day event', () => {
    const events = eventsFor(
      baseSession({
        id: 's7',
        date: '2026-10-13',
        allDay: true,
        startTime: '00:00',
        endTime: '23:59',
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.allDay).toBe(true);
    expect(events[0]!.start).toBe('2026-10-13');
    expect(events[0]!.end).toBe('2026-10-14');
  });
});

describe('buildCalendarEvents — homework deadlines', () => {
  const homework: HomeworkItem = {
    id: 'hw-1',
    title: 'Essay',
    subject: 'Introduction to Computer Science',
    teacher: 'Prof. X',
    group: 'A',
    type: 'Essay',
    dueDate: new Date('2026-10-14T00:00:00'),
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
  };

  it('renders a pending homework as an all-day deadline event', () => {
    const events = buildCalendarEvents({
      sessions: [],
      subjects: [subject],
      homework: [homework],
      windowStart,
      windowEnd,
    });
    const hw = events.find((e) => e.id === 'fc-homework-hw-1');
    expect(hw).toBeDefined();
    expect(hw!.allDay).toBe(true);
    expect(hw!.title).toBe('Essay'); // 'Due: ' prefix is added by eventContent rendering
    expect(hw!.start).toBe('2026-10-14');
    expect(hw!.end).toBe('2026-10-15');
    expect(hw!.className).toBe('sf-event sf-event--homework');
  });

  it('excludes completed homework', () => {
    const events = buildCalendarEvents({
      sessions: [],
      subjects: [subject],
      homework: [{ ...homework, status: 'completed' }],
      windowStart,
      windowEnd,
    });
    expect(events.find((e) => e.id === 'fc-homework-hw-1')).toBeUndefined();
  });

  it('ignores homework due outside the window', () => {
    const events = buildCalendarEvents({
      sessions: [],
      subjects: [subject],
      homework: [{ ...homework, dueDate: new Date('2026-11-01T00:00:00') }],
      windowStart,
      windowEnd,
    });
    expect(events.length).toBe(0);
  });
});

describe('computeSessionUpdateFromDrop', () => {
  const sessions: Session[] = [
    baseSession({ id: 'move-1', date: '2026-10-13' }),
    baseSession({
      id: 'move-2',
      date: '2026-10-13',
      day: 1,
      recurring: true,
      recurrenceRule: 'weekly',
      recurrenceStartDate: '2026-10-12',
    }),
  ];

  const makeEvent = (startISO: string, endISO: string, sessionId = 'move-1') => ({
    id: 'fc',
    start: new Date(startISO),
    end: new Date(endISO),
    allDay: false,
    extendedProps: { sessionId },
  } as unknown as Parameters<typeof computeSessionUpdateFromDrop>[0]['event']);

  const oldEvent = makeEvent('2026-10-13T09:00:00', '2026-10-13T10:00:00');

  it('computes a dated move delta preserving duration', () => {
    const event = makeEvent('2026-10-14T11:00:00', '2026-10-14T12:00:00');
    const delta = computeSessionUpdateFromDrop({
      event,
      oldEvent,
      sessions,
      slotMinTime: '08:00',
      slotMaxTime: '18:00',
    });
    expect(delta).toEqual({
      date: '2026-10-14',
      day: 3,
      startTime: '11:00',
      endTime: '12:00',
      overnight: false,
    });
  });

  it('rejects a drop that would finish after the slot range', () => {
    const event = makeEvent('2026-10-13T17:30:00', '2026-10-13T18:30:00');
    expect(
      computeSessionUpdateFromDrop({
        event,
        oldEvent,
        sessions,
        slotMinTime: '08:00',
        slotMaxTime: '18:00',
      }),
    ).toBeNull();
  });

  it('rejects an all-day drop', () => {
    const event = {
      ...makeEvent('2026-10-13T09:00:00', '2026-10-13T10:00:00'),
      allDay: true,
    };
    expect(
      computeSessionUpdateFromDrop({
        event,
        oldEvent,
        sessions,
        slotMinTime: '08:00',
        slotMaxTime: '18:00',
      }),
    ).toBeNull();
  });

  it('rejects a move of a multi-day session', () => {
    const multi = sessions.concat(baseSession({ id: 'move-3', date: '2026-10-13', endDate: '2026-10-15' }));
    const event = makeEvent('2026-10-14T09:00:00', '2026-10-14T10:00:00', 'move-3');
    expect(
      computeSessionUpdateFromDrop({
        event,
        oldEvent,
        sessions: multi,
        slotMinTime: '08:00',
        slotMaxTime: '18:00',
      }),
    ).toBeNull();
  });

  it('rejects a drop below the minimum duration', () => {
    const event = makeEvent('2026-10-13T09:00:00', '2026-10-13T09:10:00');
    expect(
      computeSessionUpdateFromDrop({
        event,
        oldEvent,
        sessions,
        slotMinTime: '08:00',
        slotMaxTime: '18:00',
      }),
    ).toBeNull();
  });

  it('moves an overnight session onto a new date', () => {
    const overnight = sessions.concat(
      baseSession({ id: 'move-4', date: '2026-10-13', startTime: '23:00', endTime: '01:00', overnight: true }),
    );
    const event = makeEvent('2026-10-14T23:00:00', '2026-10-15T01:00:00');
    const delta = computeSessionUpdateFromDrop({
      event,
      oldEvent,
      sessions: overnight,
      slotMinTime: '00:00',
      slotMaxTime: '24:00',
    });
    expect(delta).toEqual({
      date: '2026-10-14',
      day: 3,
      startTime: '23:00',
      endTime: '01:00',
      overnight: true,
    });
  });

  it('keeps the weekday pattern for a rule-bound recurring series (time only)', () => {
    // move-2 is rule-bound weekly (Mondays): dragging an occurrence changes its
    // time of day but not the series' weekday pattern.
    const event = makeEvent('2026-10-14T11:00:00', '2026-10-14T12:00:00', 'move-2');
    const delta = computeSessionUpdateFromDrop({
      event,
      oldEvent,
      sessions,
      slotMinTime: '08:00',
      slotMaxTime: '18:00',
    });
    expect(delta?.day).toBeUndefined();
    expect(delta?.startTime).toBe('11:00');
  });

  it('adopts the new weekday for a legacy recurring session', () => {
    const legacy = sessions.concat(
      baseSession({ id: 'move-5', day: 1, startTime: '09:00', endTime: '10:00', recurring: true, date: undefined }),
    );
    const event = makeEvent('2026-10-14T11:00:00', '2026-10-14T12:00:00', 'move-5');
    const delta = computeSessionUpdateFromDrop({
      event,
      oldEvent,
      sessions: legacy,
      slotMinTime: '08:00',
      slotMaxTime: '18:00',
    });
    expect(delta?.day).toBe(3); // Wednesday
    expect(delta?.startTime).toBe('11:00');
  });
});

describe('computeSessionUpdateFromResize', () => {
  const sessions: Session[] = [baseSession({ id: 'res-1', date: '2026-10-13' })];

  const makeEvent = (endISO: string) =>
    ({
      id: 'fc',
      start: new Date('2026-10-13T09:00:00'),
      end: new Date(endISO),
      allDay: false,
      extendedProps: { sessionId: 'res-1' },
    } as unknown as Parameters<typeof computeSessionUpdateFromResize>[0]['event']);

  it('computes a longer end time', () => {
    const delta = computeSessionUpdateFromResize({
      event: makeEvent('2026-10-13T11:30:00'),
      sessions,
      slotMaxTime: '18:00',
    });
    expect(delta).toEqual({ endTime: '11:30', overnight: false });
  });

  it('rejects a resize below the minimum duration', () => {
    expect(
      computeSessionUpdateFromResize({
        event: makeEvent('2026-10-13T09:10:00'),
        sessions,
        slotMaxTime: '18:00',
      }),
    ).toBeNull();
  });

  it('rejects an all-day resize', () => {
    expect(
      computeSessionUpdateFromResize({
        event: { ...makeEvent('2026-10-13T11:00:00'), allDay: true },
        sessions,
        slotMaxTime: '18:00',
      }),
    ).toBeNull();
  });

  it('records an overnight resize crossing midnight', () => {
    const sessions = [
      baseSession({ id: 'res-2', date: '2026-10-13', startTime: '23:00', endTime: '01:00', overnight: true }),
    ];
    const delta = computeSessionUpdateFromResize({
      event: {
        id: 'fc',
        start: new Date('2026-10-13T23:00:00'),
        end: new Date('2026-10-14T02:00:00'),
        allDay: false,
        extendedProps: { sessionId: 'res-2' },
      },
      sessions,
      slotMaxTime: '24:00',
    });
    expect(delta).toEqual({ endTime: '02:00', overnight: true });
  });
});

describe('MIN_SESSION_MINUTES', () => {
  it('is 30 minutes', () => {
    expect(MIN_SESSION_MINUTES).toBe(30);
  });
});
