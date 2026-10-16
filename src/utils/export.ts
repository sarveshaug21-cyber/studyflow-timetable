import type { TimetableState } from '@/types';

export function exportToJSON(state: TimetableState): string {
  return JSON.stringify(state, null, 2);
}

export function exportToCSV(state: TimetableState): string {
  const headers = [
    'Subject',
    'Code',
    'Day',
    'Start Time',
    'End Time',
    'Type',
    'Location',
    'Instructor',
    'Room',
    'Notes',
    'Recurring',
  ];

  const rows = state.sessions.map(session => {
    const subject = state.subjects.find(s => s.id === session.subjectId);
    return [
      subject?.name || 'Unknown',
      subject?.code || '',
      getDayLabel(session.day),
      session.startTime,
      session.endTime,
      session.type,
      session.location || '',
      subject?.instructor || '',
      subject?.room || '',
      session.notes || '',
      session.recurring ? 'Yes' : 'No',
    ];
  });

  return [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getDayLabel(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || '';
}

export async function exportToICS(state: TimetableState): Promise<string> {
  const { createEvents } = await import('ics');
  
  const events = state.sessions.map(session => {
    const subject = state.subjects.find(s => s.id === session.subjectId);
    if (!subject) return null;

    const weekStart = new Date(state.currentWeekStart);
    const dayIndex = session.day === 0 ? 6 : session.day - 1;
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayIndex);

    const [startHour, startMin] = session.startTime.split(':').map(Number);
    const [endHour, endMin] = session.endTime.split(':').map(Number);

    const start = new Date(eventDate);
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(eventDate);
    end.setHours(endHour, endMin, 0, 0);

    return {
      title: `${subject.code}: ${subject.name} (${session.type})`,
      description: [
        `Subject: ${subject.name} (${subject.code})`,
        `Type: ${session.type}`,
        session.location ? `Location: ${session.location}` : '',
        subject.instructor ? `Instructor: ${subject.instructor}` : '',
        subject.room ? `Room: ${subject.room}` : '',
        session.notes ? `Notes: ${session.notes}` : '',
      ].filter(Boolean).join('\n'),
      location: session.location || subject.room || '',
      start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()] as [number, number, number, number, number],
      end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()] as [number, number, number, number, number],
      recurrenceRule: session.recurring ? 'FREQ=WEEKLY' : undefined,
    };
  }).filter((e): e is NonNullable<typeof e> => e !== null);

  const { error, value } = createEvents(events);
  if (error) throw new Error('Failed to generate ICS file');
  return value ?? '';
}

export async function exportToPNG(element: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
    }, 'image/png');
  });
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}