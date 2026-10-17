import { cn } from '@/utils/cn';
import { type HTMLAttributes, type ReactNode } from 'react';

export interface SectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

function SectionBase({ className, children, padded = true, ...props }: SectionProps) {
  return (
    <div
      {...props}
      className={cn('space-y-6', padded && 'px-6 py-6', className)}
    >
      {children}
    </div>
  )
}

export const Section = Object.assign(SectionBase, {
  Header: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={cn('flex flex-col space-y-1.5 px-6 py-4', className)}>{children}</div>
  ),
  Body: ({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={cn('px-6 py-4', className)}>{children}</div>
  ),
});

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({
  className,
  title,
  description,
  actions,
  ...props
}: SectionHeaderProps) {
  return (
    <div {...props} className={cn('flex items-center justify-between gap-2 mb-4', className)}>
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
