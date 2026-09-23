import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      resolver.current?.(ok);
      resolver.current = null;
      setPending(null);
    },
    [],
  );

  const api = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-8 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            className="tac-card w-full max-w-sm animate-fade-in p-5"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              {pending.danger && (
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-loss/15">
                  <AlertTriangle size={18} className="text-loss" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold leading-snug">{pending.title}</h3>
                {pending.message && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{pending.message}</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="tac-btn tac-btn-ghost h-11 flex-1 text-sm"
                onClick={() => close(false)}
              >
                {pending.cancelText ?? '取消'}
              </button>
              <button
                type="button"
                className={`tac-btn h-11 flex-1 text-sm ${pending.danger ? 'tac-btn-danger' : 'tac-btn-primary'}`}
                onClick={() => close(true)}
              >
                {pending.confirmText ?? '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
