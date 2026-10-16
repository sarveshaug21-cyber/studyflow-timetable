import { Fragment, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      contentRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  return (
    <Fragment>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-modal animate-scale-in',
          sizes[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 p-6 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </Fragment>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="btn-secondary"
          disabled={loading}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={variant === 'destructive' ? 'btn-destructive' : 'btn-primary'}
          disabled={loading}
        >
          {loading ? 'Loading...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}