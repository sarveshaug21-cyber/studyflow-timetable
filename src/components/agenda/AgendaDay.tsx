import { formatTime12h, getTimeSlots } from '@/utils/date';
import { getDayLabel } from '@/types';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Dropdown } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { useTimetable } from '@/hooks/useTimetable';
import { getContrastColor } from '@/utils/colors';
import { cn } from '@/utils/cn';
import type { Session, Subject } from '@/types';
import { useState } from 'react';

interface AgendaSessionProps {
  session: Session & { subject: Subject };
}

function AgendaSessionItem({ session }: AgendaSessionProps) {
  const { deleteSession, updateSession } = useTimetable();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { subject } = session;
  const textColor = getContrastColor(subject.color);

  return (
    <>
      <div
        className="group flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:shadow-sm transition-shadow"
        style={{
          borderLeft: `4px solid ${subject.color}`,
          backgroundColor: `${subject.color}15`,
        } as React.CSSProperties}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium" style={{ backgroundColor: subject.color, color: textColor }}>
          {session.startTime.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{subject.code}</span>
            <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
              {session.type.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{subject.name}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{formatTime12h(session.startTime)} - {formatTime12h(session.endTime)}</span>
            {session.location && <span>{session.location}</span>}
          </div>
        </div>
        <Dropdown
          trigger={
            <button
              className={cn(
                'p-2 rounded transition-all duration-200',
                'opacity-50 group-hover:opacity-100 group-focus-within:opacity-100',
                'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                'focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none'
              )}
              aria-label="More options"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-5 w-5 text-neutral-400" aria-hidden="true" />
            </button>
          }
          items={[
            { label: 'Edit', value: 'edit', icon: <Edit2 className="h-4 w-4" /> },
            { label: 'Delete', value: 'delete', icon: <Trash2 className="h-4 w-4" />, destructive: true },
          ]}
          onSelect={(value) => {
            if (value === 'edit') setEditOpen(true);
            if (value === 'delete') setDeleteConfirmOpen(true);
          }}
        />
      </div>

      <SessionEditorModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        session={session}
        onUpdate={updateSession}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          deleteSession(session.id);
          setDeleteConfirmOpen(false);
        }}
        title="Delete Session"
        message={`Are you sure you want to delete "${subject.code}: ${subject.name}"?`}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}

interface SessionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session & { subject: Subject };
  onUpdate: (session: Session) => void;
}

function SessionEditorModal({ isOpen, onClose, session, onUpdate }: SessionEditorModalProps) {
  const { state } = useTimetable();
  const [formData, setFormData] = useState({
    subjectId: session.subjectId,
    day: session.day,
    startTime: session.startTime,
    endTime: session.endTime,
    type: session.type,
    location: session.location || '',
    notes: session.notes || '',
    recurring: session.recurring,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subjects = state.subjects;
  const timeSlots = getTimeSlots(state.timeRange, state.timeIncrement);
  const dayOptions = [
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '0', label: 'Sunday' },
  ];
  const typeOptions = [
    { value: 'lecture', label: 'Lecture' },
    { value: 'lab', label: 'Lab' },
    { value: 'tutorial', label: 'Tutorial' },
    { value: 'seminar', label: 'Seminar' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.subjectId) newErrors.subjectId = 'Subject is required';
    if (!formData.startTime) newErrors.startTime = 'Start time is required';
    if (!formData.endTime) newErrors.endTime = 'End time is required';
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onUpdate({
      ...session,
      ...formData,
      day: formData.day as Session['day'],
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Session"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Subject</label>
          <select
            value={formData.subjectId}
            onChange={(e) => setFormData(prev => ({ ...prev, subjectId: e.target.value }))}
            className="input"
            required
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id} style={{ borderLeft: `4px solid ${s.color}` }}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
          {errors.subjectId && <p className="text-sm text-red-600 mt-1">{errors.subjectId}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Day</label>
            <select
              value={String(formData.day)}
              onChange={(e) => setFormData(prev => ({ ...prev, day: Number(e.target.value) as Session['day'] }))}
              className="input"
            >
              {dayOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Session['type'] }))}
              className="input"
            >
              {typeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Start Time</label>
            <select
              value={formData.startTime}
              onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
              className="input"
              required
            >
              {timeSlots.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            {errors.startTime && <p className="text-sm text-red-600 mt-1">{errors.startTime}</p>}
          </div>

          <div>
            <label className="label">End Time</label>
            <select
              value={formData.endTime}
              onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
              className="input"
              required
            >
              {timeSlots.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            {errors.endTime && <p className="text-sm text-red-600 mt-1">{errors.endTime}</p>}
          </div>
        </div>

        <div>
          <label className="label">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            className="input"
            placeholder="Room, building, etc."
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="input min-h-[80px] resize-y"
            placeholder="Optional notes"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="recurring"
            checked={formData.recurring}
            onChange={(e) => setFormData(prev => ({ ...prev, recurring: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="recurring" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
            Recurring weekly
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface AgendaDayProps {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 0;
  sessions: (Session & { subject: Subject })[];
}

export function AgendaDay({ day, sessions }: AgendaDayProps) {
  const today = new Date().getDay() === (day === 0 ? 0 : day);

  if (sessions.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-6 ${today ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium ${today ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
              {getDayLabel(day, true)}
            </div>
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{getDayLabel(day)}</h3>
            {today && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Today</span>}
          </div>
        </div>
        <p className="mt-4 text-center text-neutral-500 dark:text-neutral-400">No sessions scheduled</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden ${today ? 'ring-1 ring-brand-500' : ''}`}>
      <div className={`px-4 py-3 flex items-center justify-between gap-3 ${today ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-neutral-50 dark:bg-neutral-900'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium ${today ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
            {getDayLabel(day, true)}
          </div>
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{getDayLabel(day)}</h3>
          {today && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Today</span>}
        </div>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {sessions.map(session => (
          <div key={session.id} className="p-3">
            <AgendaSessionItem session={session} />
          </div>
        ))}
      </div>
    </div>
  );
}