import { useState, useCallback, useContext, ReactNode, createContext } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastContextType {
  toast: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const duration = newToast.duration ?? 5000;
    setToasts(prev => [...prev, { ...newToast, id }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'border-green-200 dark:border-green-900 text-green-800 dark:text-green-200',
    error: 'border-red-200 dark:border-red-900 text-red-800 dark:text-red-200',
    warning: 'border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200',
    info: 'border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200',
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-950',
    error: 'bg-red-50 dark:bg-red-950',
    warning: 'bg-amber-50 dark:bg-amber-950',
    info: 'bg-blue-50 dark:bg-blue-950',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-elevated animate-slide-in pointer-events-auto',
              'max-w-sm',
              colors[toast.type],
              bgColors[toast.type]
            )}
            role="alert"
          >
            <Icon className="flex-shrink-0 h-5 w-5 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-sm opacity-90">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="flex-shrink-0 rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}