import { useEffect } from 'react';
import { useToast } from '../../store/toast';
import { useUI } from '../../store/ui';

export function Toaster() {
  const current = useToast((s) => s.current);
  const dismiss = useToast((s) => s.dismiss);
  // Con el formulario abierto, arriba: abajo taparía los campos (y el teclado).
  const atTop = useUI((s) => s.entry.open);

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => dismiss(current.id), current.duration);
    return () => window.clearTimeout(t);
  }, [current, dismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={
        atTop
          ? { top: 'calc(var(--safe-top) + 8px)' }
          : { bottom: 'calc(var(--safe-bottom) + var(--tabbar-h) + 88px)' }
      }
    >
      {current && (
        <div
          key={current.id}
          role="status"
          className="pointer-events-auto flex min-h-11 max-w-full animate-rise items-center gap-3 rounded-2xl border border-line bg-raised py-1 pl-4 pr-2 text-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          <span className="line-clamp-2 min-w-0 py-2 leading-snug">{current.message}</span>
          {current.actionLabel ? (
            <button
              type="button"
              onClick={() => {
                current.onAction?.();
                dismiss(current.id);
              }}
              className="min-h-9 shrink-0 rounded-full px-3 font-medium text-expense active:bg-line"
            >
              {current.actionLabel}
            </button>
          ) : (
            <span className="w-2" />
          )}
        </div>
      )}
    </div>
  );
}
