import { useState } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import type { Session, Subject, DayOfWeek, RecurrenceFrequency } from '@/types';
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
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    type: Session['type'];
    location: string;
    notes: string;
    recurring: boolean;
    recurrenceRule: RecurrenceFrequency | undefined;
    recurrenceWeekdays: DayOfWeek[];
    recurrenceStartDate: string;
    recurrenceEndDate: string;
    recurrenceMaxOccurrences: number | undefined;
    allDay: boolean;
    overnight: boolean;
  }>({
    subjectId: initialData?.subjectId || '',
    day: initialData?.day || 1,
    startDate: initialData?.date || '',
    endDate: initialData?.endDate || '',
    startTime: initialData?.startTime || state.timeRange.start,
    endTime: initialData?.endTime || '',
    type: initialData?.type || 'lecture' as Session['type'],
    location: initialData?.location || '',
    notes: initialData?.notes || '',
    recurring: initialData?.recurring ?? true,
    recurrenceRule: initialData?.recurrenceRule,
    recurrenceWeekdays: initialData?.recurrenceWeekdays ?? [],
    recurrenceStartDate: initialData?.recurrenceStartDate || '',
    recurrenceEndDate: initialData?.recurrenceEndDate || '',
    recurrenceMaxOccurrences: initialData?.recurrenceMaxOccurrences,
    allDay: initialData?.allDay ?? false,
    overnight: initialData?.overnight ?? false,
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
    if (!formData.recurring && !formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.allDay && !formData.startTime) newErrors.startTime = 'Start time is required';
    if (!formData.allDay && !formData.endTime) newErrors.endTime = 'End time is required';
    if (
      !formData.allDay &&
      !formData.overnight &&
      formData.startTime &&
      formData.endTime &&
      formData.startTime >= formData.endTime
    ) {
      newErrors.endTime = 'End time must be after start time';
    }
    if (
      formData.overnight &&
      formData.startTime &&
      formData.endTime &&
      formData.startTime === formData.endTime
    ) {
      newErrors.endTime = 'Overnight session must have a different end time.';
    }
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'End date must be on or after the start date';
    }
    // Recurrence validation.
    if (formData.recurring && formData.recurrenceRule) {
      if (formData.recurrenceRule !== 'weekly' && formData.recurrenceWeekdays.length > 0) {
        newErrors.recurrenceWeekdays = 'Weekdays only apply to weekly recurrence.';
      }
      if (formData.recurrenceEndDate && formData.recurrenceStartDate && formData.recurrenceEndDate < formData.recurrenceStartDate) {
        newErrors.recurrenceEndDate = 'End date must be on or after the start date.';
      }
      if (formData.recurrenceMaxOccurrences !== undefined && formData.recurrenceMaxOccurrences < 1) {
        newErrors.recurrenceMaxOccurrences = 'Must be at least 1.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const day = formData.recurring
      ? formData.day
      : new Date(formData.startDate).getDay() as Session['day'];

    const overnight = formData.overnight && !formData.allDay && !formData.recurring;

    onSubmit({
      subjectId: formData.subjectId,
      day,
      startTime: formData.allDay ? '00:00' : formData.startTime,
      endTime: formData.allDay ? '23:59' : formData.endTime,
      type: formData.type,
      location: formData.location,
      notes: formData.notes,
      recurring: formData.recurring,
      allDay: formData.allDay,
      overnight,
      // One-off sessions carry an explicit date range; recurring sessions do not.
      ...(formData.recurring
        ? {
            recurrenceRule: formData.recurrenceRule,
            ...(formData.recurrenceRule === 'weekly' && formData.recurrenceWeekdays.length > 0
              ? { recurrenceWeekdays: formData.recurrenceWeekdays }
              : {}),
            ...(formData.recurrenceStartDate ? { recurrenceStartDate: formData.recurrenceStartDate } : {}),
            ...(formData.recurrenceEndDate ? { recurrenceEndDate: formData.recurrenceEndDate } : {}),
            ...(formData.recurrenceMaxOccurrences !== undefined
              ? { recurrenceMaxOccurrences: formData.recurrenceMaxOccurrences }
              : {}),
          }
        : {
            date: formData.startDate,
            endDate: formData.endDate || undefined,
          }),
    });
    onClose();
  };

  const endTimeOptions = formData.overnight
    ? timeSlots
    : timeSlots.filter(t => t > formData.startTime);

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

        {!formData.recurring && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="input"
                required
              />
              {errors.startDate && <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>}
            </div>

            <div>
              <label className="label">End date (multi-day)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="input"
              />
              {errors.endDate && <p className="text-sm text-red-600 mt-1">{errors.endDate}</p>}
            </div>
          </div>
        )}

        {!formData.allDay && (
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
        )}

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

        {formData.recurring && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Recurrence frequency</label>
              <select
                value={formData.recurrenceRule || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrenceRule: e.target.value as RecurrenceFrequency || undefined, recurrenceWeekdays: e.target.value === 'weekly' ? [prev.day] : [] }))}
                className="input"
              >
                <option value="">Weekly forever</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="label">Repeat starts</label>
              <input
                type="date"
                value={formData.recurrenceStartDate}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrenceStartDate: e.target.value }))}
                className="input"
              />
            </div>

            <div>
              <label className="label">Repeat ends</label>
              <input
                type="date"
                value={formData.recurrenceEndDate}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                className="input"
              />
            </div>

            <div>
              <label className="label">Max occurrences</label>
              <input
                type="number"
                value={formData.recurrenceMaxOccurrences ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrenceMaxOccurrences: e.target.value ? Number(e.target.value) : undefined }))}
                className="input"
                min="1"
              />
            </div>
          </div>
        )}

        {formData.recurring && formData.recurrenceRule === 'weekly' && (
              <div className="grid gap-4 sm:grid-cols-3">
            {dayOptions.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`weekday-${opt.value}`}
                  checked={formData.recurrenceWeekdays.includes(opt.value as unknown as DayOfWeek)}
                  onChange={(e) => {
                    const val = opt.value as unknown as DayOfWeek;
                    setFormData(prev => ({
                      ...prev,
                      recurrenceWeekdays: e.target.checked
                        ? [...prev.recurrenceWeekdays, val]
                        : prev.recurrenceWeekdays.filter((d) => d !== val),
                    }));
                  }}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor={`weekday-${opt.value}`} className="text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  {opt.label}
                </label>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allDay"
            checked={formData.allDay}
            onChange={(e) => setFormData(prev => ({ ...prev, allDay: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="allDay" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
            All-day event
          </label>
        </div>

        {!formData.allDay && !formData.recurring && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="overnight"
              checked={formData.overnight}
              onChange={(e) => setFormData(prev => ({ ...prev, overnight: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="overnight" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
              Overnight (spans midnight)
            </label>
          </div>
        )}

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