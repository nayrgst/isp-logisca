'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand';
}

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => settle(false)}
            className="absolute inset-0 animate-fade-in cursor-default bg-canvas/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm animate-pop rounded-panel border border-line-strong bg-overlay p-6 shadow-popover">
            <h2 id="confirm-title" className="text-base font-semibold text-ink">
              {options.title}
            </h2>
            {options.message && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{options.message}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => settle(false)} autoFocus>
                {options.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                variant={options.tone === 'danger' ? 'danger' : 'primary'}
                size="sm"
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  }
  return context;
}
