import { Plus } from 'lucide-react';
import { primeKeyboard } from '../lib/viewport';
import { useUI } from '../store/ui';

export function Fab() {
  const openEntry = useUI((s) => s.openEntry);
  const tab = useUI((s) => s.tab);
  return (
    <button
      type="button"
      aria-label="Cargar movimiento"
      onClick={() => {
        primeKeyboard();
        openEntry({ presetKind: tab === 'income' ? 'income' : undefined });
      }}
      className="fixed z-40 grid size-14 place-items-center rounded-full bg-fg text-bg shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-transform duration-150 active:scale-95"
      style={{
        right: 'max(calc(var(--safe-right) + 20px), calc((100vw - 36rem) / 2 + 20px))',
        bottom: 'calc(var(--safe-bottom) + var(--tabbar-h) + 16px)',
      }}
    >
      <Plus size={26} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
