import { cn } from '@/utils/cn';
import { type HTMLAttributes, type ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'brand';
  size?: 'sm' | 'md';
}

const badgeVariants = {
  default: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  secondary: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
};

const badgeSizes = {
  sm: 'px-2 py-0.5 text-[10px] font-medium',
  md: 'px-2.5 py-0.5 text-xs font-medium',
};

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-full border whitespace-nowrap',
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
