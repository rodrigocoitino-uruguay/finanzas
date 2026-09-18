import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** Registra el service worker (funcionamiento sin conexión) y avisa si hay una versión nueva. */
export function UpdatePrompt({ visible }: { visible: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), CHECK_EVERY_MS);
    },
  });

  if (!needRefresh || !visible) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ top: 'calc(var(--safe-top) + 8px)' }}
    >
      <div className="flex max-w-full animate-rise items-center gap-2 rounded-2xl border border-line bg-raised py-1 pr-1 pl-4 text-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <RefreshCw size={15} strokeWidth={1.75} className="shrink-0 text-expense" aria-hidden="true" />
        <span className="py-2">Hay una versión nueva</span>
        <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-10 rounded-full px-3 text-muted">
          Luego
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-10 rounded-full bg-fg px-4 font-medium text-bg active:opacity-80"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
