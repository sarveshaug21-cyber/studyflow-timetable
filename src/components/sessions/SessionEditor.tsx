import { useState } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import type { Session, Subject } from '@/types';
import { getTimeSlots } from '@/utils/date';

interface SessionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: Partial<Session>;
  subjects: Subject[];
}

export function SessionEditor({ isOpen, onClose, onSubmit, initialData, subjects }: SessionEditorProps) {
  const { state } = useTimetable();
  const [formData, setFormData] = useState<{
    subjectId: string;
    day: 1 | 2 | 3 | 4 | 5 | 6 | 0;
    startTime: string;
    endTime: string;
    type: Session['type'];
    location: string;
    notes: string;
    recurring: boolean;
  }>({
    subjectId: initialData?.subjectId || '',
    day: initialData?.day || 1,
    startTime: initialData?.startTime || state.timeRange.start,
    endTime: initialData?.endTime || '',
    type: initialData?.type || 'lecture' as Session['type'],
    location: initialData?.location || '',
    notes: initialData?.notes || '',
    recurring: initialData?.recurring ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    onSubmit({
      subjectId: formData.subjectId,
      day: Number(formData.day) as Session['day'],
      startTime: formData.startTime,
      endTime: formData.endTime,
      type: formData.type,
      location: formData.location,
      notes: formData.notes,
      recurring: formData.recurring,
    });
    onClose();
  };

  const endTimeOptions = timeSlots.filter(t => t > formData.startTime);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Session"
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
            <option value="">Select a subject</option>
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
              {endTimeOptions.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            {errors.endTime && <p className="text-sm text-red-600 mt-1">{errors.endTime}</p>}
          </div>
        </div>

        <Input
          label="Location (optional)"
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="Room, building, etc."
        />

        <div>
          <label className="label">Notes (optional)</label>
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Add Session
          </Button>
        </div>
      </form>
    </Modal>
  );
}