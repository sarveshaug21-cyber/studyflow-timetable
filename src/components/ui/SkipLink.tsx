import { type AnchorHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function SkipLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href="#main-content"
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50',
        'px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg shadow-elevated',
        'transition-all duration-200',
        className,
      )}
      {...props}
    >
      Skip to main content
    </a>
  );
}
