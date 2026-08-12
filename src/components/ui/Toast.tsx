'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3600;
const EXIT_MS = 200;

const typeStyles: Record<ToastType, { shell: string; icon: string; bar: string }> = {
  success: {
    shell: 'border-ok/40 bg-surface-raised text-ink',
    icon: 'text-ok',
    bar: 'bg-ok',
  },
  error: {
    shell: 'border-danger/50 bg-surface-raised text-ink',
    icon: 'text-danger',
    bar: 'bg-danger',
  },
  info: {
    shell: 'border-line-strong bg-surface-raised text-ink',
    icon: 'text-brand-strong',
    bar: 'bg-brand',
  },
};

const typeIcon: Record<ToastType, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  /* Saída em duas etapas: marca `leaving` para a animação rodar, só então
     desmonta. Antes o item era removido direto e sumia sem transição. */
  const dismiss = useCallback((id: number) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast))
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, EXIT_MS);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, type, leaving: false }]);
      window.setTimeout(() => dismiss(id), VISIBLE_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = typeStyles[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border px-4 py-3 text-sm shadow-popover backdrop-blur-sm ${style.shell} ${
                toast.leaving ? 'animate-toast-out' : 'animate-toast-in'
              }`}
            >
              <svg
                className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={typeIcon[toast.type]}
                />
              </svg>
              <span className="min-w-0 flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dispensar"
                className="-mr-1 shrink-0 rounded-control p-1 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Barra de tempo: mostra quanto falta para sumir sozinho. */}
              <span
                aria-hidden
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${style.bar}`}
                style={{
                  animation: toast.leaving
                    ? 'none'
                    : `toast-timer ${VISIBLE_MS}ms linear forwards`,
                }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider');
  }
  return context;
}
