import { useState } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import { MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Dropdown } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { getContrastColor } from '@/utils/colors';
import type { Session, Subject } from '@/types';

interface SessionBlockProps {
  session: Session;
  subject: Subject;
  top: number;
  height: number;
}

export function SessionBlock({ session, subject, top, height }: SessionBlockProps) {
  const { deleteSession, updateSession } = useTimetable();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const textColor = getContrastColor(subject.color);

  return (
    <>
      <div
        className="absolute left-1 right-1 rounded-lg transition-all duration-150 hover:shadow-md hover:scale-[1.01] z-10"
        style={{
          top: top,
          height: height,
          minHeight: '32px',
          backgroundColor: subject.color,
          color: textColor,
        } as React.CSSProperties}
        role="button"
        tabIndex={0}
        aria-label={`${subject.code}: ${subject.name}, ${session.startTime} - ${session.endTime}`}
        onClick={() => setEditOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditOpen(true);
          }
        }}
      >
        <div className="p-2 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{subject.code}</p>
              <p className="text-xs truncate opacity-90">{subject.name}</p>
            </div>
            <Dropdown
              trigger={
                <button
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 hover:bg-white/10 transition-all"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              }
              items={[
                { label: 'Edit', value: 'edit', icon: <Edit2 className="h-4 w-4" />, shortcut: 'E' },
                { label: 'Delete', value: 'delete', icon: <Trash2 className="h-4 w-4" />, destructive: true, shortcut: 'Del' },
              ]}
              onSelect={(value) => {
                if (value === 'edit') setEditOpen(true);
                if (value === 'delete') setDeleteConfirmOpen(true);
              }}
            />
          </div>
          <div className="flex items-end justify-between gap-1 mt-1">
            <span className="text-xs font-mono">{session.startTime} - {session.endTime}</span>
            {session.location && (
              <span className="text-xs opacity-90 truncate max-w-[60px]">{session.location}</span>
            )}
          </div>
        </div>
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
  session: Session;
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
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });
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