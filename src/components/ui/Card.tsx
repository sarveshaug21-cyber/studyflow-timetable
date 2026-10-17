import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated';
}

function CardBase({ className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900',
        variant === 'elevated' && 'shadow-card',
        variant === 'default' && 'shadow-subtle',
        className,
      )}
    />
  )
}

export const Card = Object.assign(CardBase, {
  Header: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={cn('flex flex-col space-y-1.5 px-6 py-4', className)}>{children}</div>
  ),
  Title: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} className={cn('text-sm font-semibold text-neutral-900 dark:text-neutral-100', className)}>{children}</h3>
  ),
  Description: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)}>{children}</p>
  ),
  Body: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={cn('px-6 py-4', className)}>{children}</div>
  ),
  Footer: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={cn('flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100 dark:border-neutral-800', className)}>{children}</div>
  ),
});
