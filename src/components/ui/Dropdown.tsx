import { useState, useRef, useEffect, useCallback, cloneElement, isValidElement } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, onSelect, align = 'right', className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Clicking the trigger element toggles the menu open/closed. The trigger is
  // cloned so any onClick the parent supplied is preserved and invoked.
  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
          if (typeof trigger.props.onClick === 'function') {
            trigger.props.onClick(e);
          }
        },
      })
    : trigger;

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      {triggerElement}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-elevated overflow-hidden animate-slide-in',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                if (!item.disabled) {
                  onSelect(item.value);
                  close();
                }
              }}
              disabled={item.disabled}
              role="menuitem"
              tabIndex={-1}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
                'focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800',
                item.disabled
                  ? 'text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                  : item.destructive
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              {item.icon && <span className="flex h-4 w-4">{item.icon}</span>}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface SelectDropdownProps {
  value: string;
  placeholder: string;
  items: DropdownItem[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function SelectDropdown({
  value,
  placeholder,
  items,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItem = items.find(item => item.value === value);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  return (
    <div ref={dropdownRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-left transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
          disabled
            ? 'opacity-50 cursor-not-allowed border-neutral-200 dark:border-neutral-800'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className={cn('truncate', selectedItem ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400')}>
          {selectedItem?.label || placeholder}
        </span>
        <ChevronDown className={cn('flex-shrink-0 h-4 w-4 text-neutral-400 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-elevated overflow-hidden animate-slide-in"
          role="listbox"
        >
          {items.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                if (!item.disabled) {
                  onChange(item.value);
                  close();
                }
              }}
              disabled={item.disabled}
              role="option"
              aria-selected={item.value === value}
              tabIndex={-1}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
                'focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800',
                item.disabled
                  ? 'text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                  : item.destructive
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              {item.value === value && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
              {item.icon && <span className="flex h-4 w-4">{item.icon}</span>}
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}