import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { SUBJECT_COLORS, getContrastColor } from '@/utils/colors';
import { cn } from '@/utils/cn';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, className, disabled = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={pickerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'relative h-10 w-10 rounded-lg border transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
        )}
        style={{ backgroundColor: value, borderColor: value }}
        aria-label="Choose color"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {value === getContrastColor(value) ? (
          <Check className="absolute inset-0 h-6 w-6 mx-auto my-auto text-white" />
        ) : (
          <Check className="absolute inset-0 h-6 w-6 mx-auto my-auto text-neutral-900" />
        )}
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-2 left-0 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-elevated animate-slide-in">
          <div className="grid grid-cols-5 gap-1.5" role="listbox" aria-label="Color options">
            {SUBJECT_COLORS.map(({ value: colorValue, name }) => (
              <button
                key={colorValue}
                onClick={() => {
                  onChange(colorValue);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={colorValue === value}
                aria-label={name}
                className={cn(
                  'relative h-8 w-8 rounded-lg transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
                  colorValue === value ? 'ring-2 ring-brand-500 scale-110' : 'hover:scale-105'
                )}
                style={{ backgroundColor: colorValue }}
              >
                {colorValue === value && (
                  <Check
                    className="absolute inset-0 h-5 w-5 mx-auto my-auto"
                    style={{ color: getContrastColor(colorValue) }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ColorSwatchProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ColorSwatch({ color, size = 'md', className }: ColorSwatchProps) {
  const sizes = {
    sm: 'h-3 w-3',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-300 dark:border-neutral-700',
        sizes[size],
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}