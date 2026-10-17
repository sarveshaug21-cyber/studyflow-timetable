import { useState, useEffect } from 'react';
import {
  HOMEWORK_PRIORITIES,
  MAX_ESTIMATED_MINUTES,
  MIN_ESTIMATED_MINUTES,
  normalizeEstimatedMinutes,
  normalizeHomeworkPriority,
  type HomeworkItem,
  type HomeworkPriority,
} from '@/types';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SelectDropdown } from '@/components/ui/Dropdown';

interface HomeworkEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (homework: Omit<HomeworkItem, 'id'>) => void;
  initialData?: HomeworkItem;
  subjects: Array<{ id: string; name: string; color: string }>;
  isEditing?: boolean;
  onDelete?: () => void;
}

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' as const },
  { label: 'Submitted', value: 'submitted' as const },
  { label: 'Completed', value: 'completed' as const },
] as const;

const SUBMISSION_TYPE_OPTIONS = [
  { label: 'Online', value: 'online' as const },
  { label: 'Paper', value: 'paper' as const },
  { label: 'Upload', value: 'upload' as const },
] as const;

const TYPE_OPTIONS = [
  { label: 'Homework', value: 'Homework' },
  { label: 'Coursework', value: 'Coursework' },
  { label: 'Lab Report', value: 'Lab Report' },
  { label: 'Essay', value: 'Essay' },
  { label: 'Problem Set', value: 'Problem Set' },
  { label: 'Reading', value: 'Reading' },
  { label: 'Project', value: 'Project' },
  { label: 'Other', value: 'Other' },
] as const;

const PRIORITY_OPTIONS = HOMEWORK_PRIORITIES.map((p) => ({
  label: p.label,
  value: p.value,
}));

/** Shown in the "leave blank to auto-estimate" hint and the range error. */
const ESTIMATE_PLACEHOLDER = 'Auto';
const MAX_ESTIMATE_DIGITS = 4;
const MIN_ESTIMATE_LABEL = `${MIN_ESTIMATED_MINUTES} min`;
const MAX_ESTIMATE_LABEL = `${MAX_ESTIMATED_MINUTES} min`;

export function HomeworkEditor({
  isOpen,
  onClose,
  onSave,
  initialData,
  subjects,
  isEditing = false,
  onDelete,
}: HomeworkEditorProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [group, setGroup] = useState('');
  const [type, setType] = useState('Homework');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'pending' | 'submitted' | 'completed' | 'overdue'>('pending');
  const [submissionType, setSubmissionType] = useState<'online' | 'paper' | 'upload' | null>('online');
  const [viewUrl, setViewUrl] = useState('');
  const [hide, setHide] = useState(false);
  // Kept as a string so an in-progress edit like "4" or "45" is not clobbered
  // by normalisation while the student is still typing.
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [priority, setPriority] = useState<HomeworkPriority>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setSubject(initialData.subject);
      setTeacher(initialData.teacher);
      setGroup(initialData.group);
      setType(initialData.type);
      setDueDate(format(new Date(initialData.dueDate), 'yyyy-MM-dd'));
      setStatus(initialData.status);
      setSubmissionType(initialData.submissionType);
      setViewUrl(initialData.viewUrl || '');
      setHide(initialData.hide);
      setPriority(normalizeHomeworkPriority(initialData.priority));
      setEstimatedMinutes(
        initialData.estimatedMinutes === undefined ? '' : String(initialData.estimatedMinutes),
      );
    } else {
      setTitle('');
      setSubject('');
      setTeacher('');
      setGroup('');
      setType('Homework');
      setDueDate(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'));
      setStatus('pending');
      setSubmissionType('online');
      setViewUrl('');
      setHide(false);
      setPriority('medium');
      setEstimatedMinutes('');
    }
    setErrors({});
  }, [initialData, isEditing]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!subject.trim()) newErrors.subject = 'Subject is required';
    if (!dueDate) newErrors.dueDate = 'Due date is required';
    // Blank is valid and means "auto-estimate". Anything else must be a whole
    // number of minutes inside the supported range.
    if (estimatedMinutes.trim() !== '') {
      const parsed = Number(estimatedMinutes);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        newErrors.estimatedMinutes = 'Enter a whole number of minutes, or leave blank to auto-estimate';
      } else if (parsed < MIN_ESTIMATED_MINUTES || parsed > MAX_ESTIMATED_MINUTES) {
        newErrors.estimatedMinutes = `Enter between ${MIN_ESTIMATE_LABEL} and ${MAX_ESTIMATE_LABEL}`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const homeworkData = {
      title: title.trim(),
      subject: subject.trim(),
      teacher: teacher.trim(),
      group: group.trim(),
      type: type.trim(),
      dueDate: new Date(dueDate + 'T00:00:00'),
      status,
      submissionType,
      viewUrl: viewUrl.trim() || undefined,
      hide,
      source: 'manual' as const,
      // Priority is validated by the dropdown; the normalisation here is a
      // defensive second line so a stale/legacy value can never be persisted.
      priority: normalizeHomeworkPriority(priority),
      // `undefined` (not null/0) means "no override — auto-estimate", which the
      // scheduler reads as a signal to fall back to its type/status heuristic.
      estimatedMinutes: normalizeEstimatedMinutes(estimatedMinutes),
    };
    onSave(homeworkData);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Homework' : 'Add Homework'}
      description={isEditing ? 'Update the homework details' : 'Add a new homework assignment'}
      size="lg"
    >
      {/* noValidate: our own validate() owns every message. Browser-native
          constraint checks on the number input (min/max) would otherwise block
          submit silently before validate() runs, so the student sees no reason
          the form did not save. */}
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 Exercises"
              error={errors.title}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <SelectDropdown
              placeholder="Select subject"
              value={subject}
              items={subjects.map(s => ({ label: s.name, value: s.name }))}
              onChange={setSubject}
              disabled={isEditing}
            />
            {errors.subject && <p className="mt-1 text-sm text-red-500">{errors.subject}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Type
            </label>
            <SelectDropdown
              placeholder="Select type"
              value={type}
              items={TYPE_OPTIONS.map(t => ({ label: t.label, value: t.value }))}
              onChange={setType}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Teacher
            </label>
            <Input
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="e.g. Mr. Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Group/Class
            </label>
            <Input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. 10A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="pl-10"
                error={errors.dueDate}
              />
            </div>
            {errors.dueDate && <p className="mt-1 text-sm text-red-500">{errors.dueDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Priority
            </label>
            <SelectDropdown
              value={priority}
              placeholder="Select priority"
              items={PRIORITY_OPTIONS}
              onChange={(v) => setPriority(normalizeHomeworkPriority(v))}
              aria-label="Priority"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {HOMEWORK_PRIORITIES.find((p) => p.value === priority)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Study estimate (minutes)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_ESTIMATED_MINUTES}
              max={MAX_ESTIMATED_MINUTES}
              step={1}
              maxLength={MAX_ESTIMATE_DIGITS}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder={ESTIMATE_PLACEHOLDER}
              error={errors.estimatedMinutes}
              hint={`Leave blank to estimate automatically. Range ${MIN_ESTIMATE_LABEL}–${MAX_ESTIMATE_LABEL}.`}
              aria-label="Study estimate in minutes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Status
            </label>
            <SelectDropdown
              placeholder="Select status"
              value={status}
              items={STATUS_OPTIONS.map(s => ({ label: s.label, value: s.value }))}
              onChange={(v) => setStatus(v as 'pending' | 'submitted' | 'completed' | 'overdue')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Submission Type
            </label>
            <SelectDropdown
              placeholder="Select type"
              value={submissionType || ''}
              items={SUBMISSION_TYPE_OPTIONS.map(s => ({ label: s.label, value: s.value }))}
              onChange={(v) => setSubmissionType(v as 'online' | 'paper' | 'upload' | null)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              View URL (optional)
            </label>
            <Input
              type="url"
              value={viewUrl}
              onChange={(e) => setViewUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hide}
                onChange={(e) => setHide(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">Hide from main view</span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-3 justify-end">
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="gap-2 flex-1 sm:flex-none"
            >
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="gap-2 flex-1 sm:flex-none"
          >
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}