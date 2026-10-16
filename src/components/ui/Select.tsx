import { forwardRef, type SelectHTMLAttributes, type OptionHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface SelectOption extends OptionHTMLAttributes<HTMLOptionElement> {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 transition-colors duration-150 appearance-none',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-neutral-300 dark:border-neutral-700',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(option => {
            const { value, label, ...rest } = option;
            return (
              <option key={value} value={value} {...rest}>
                {label}
              </option>
            );
          })}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';