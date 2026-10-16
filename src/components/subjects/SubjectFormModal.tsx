import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button } from '@/components/ui';
import { SUBJECT_COLORS } from '@/utils/colors';
import type { Subject } from '@/types';

interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
  onSubmit: (data: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function SubjectFormModal({ isOpen, onClose, subject, onSubmit }: SubjectFormModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    color: string;
    instructor: string;
    room: string;
  }>({
    name: '',
    code: '',
    color: SUBJECT_COLORS[0].value,
    instructor: '',
    room: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = subject !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Subject name is required';
    if (!formData.code.trim()) newErrors.code = 'Subject code is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      color: formData.color,
      instructor: formData.instructor.trim() || undefined,
      room: formData.room.trim() || undefined,
    });
  };

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Subject' : 'Add Subject'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Subject Name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          error={errors.name}
          placeholder="e.g., Introduction to Computer Science"
          autoFocus
        />
        <Input
          label="Subject Code"
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
          error={errors.code}
          placeholder="e.g., CS101"
          maxLength={10}
        />
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map(({ value, name }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleColorChange(value)}
                className={`relative h-8 w-8 rounded-lg transition-all ${
                  formData.color === value
                    ? 'ring-2 ring-brand-500 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: value }}
                aria-label={name}
                aria-pressed={formData.color === value}
              >
                {formData.color === value && (
                  <svg className="absolute inset-0 h-5 w-5 mx-auto my-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="Instructor (optional)"
          value={formData.instructor}
          onChange={(e) => setFormData(prev => ({ ...prev, instructor: e.target.value }))}
          placeholder="e.g., Dr. Sarah Chen"
        />
        <Input
          label="Room (optional)"
          value={formData.room}
          onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
          placeholder="e.g., Room 204, Engineering Building"
        />
        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {isEditing ? 'Save Changes' : 'Add Subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}