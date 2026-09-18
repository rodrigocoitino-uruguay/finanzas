import { Trash2 } from 'lucide-react';
import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

interface SwipeRowProps {
  children: ReactNode;
  onDelete: () => void;
  onTap?: () => void;
  /** Texto accesible del botón (la fila entera). */
  label: string;
}

const DECIDE_PX = 8;

/** Fila que se toca para editar y se desliza a la izquierda para borrar. */
export function SwipeRow({ children, onDelete, onTap, label }: SwipeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const s = useRef({ active: false, decided: false, horizontal: false, x0: 0, y0: 0, dx: 0, id: -1, dragged: false });

  const setX = (x: number, animate: boolean) => {
    const el = rowRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 200ms var(--ease-soft)' : 'none';
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    s.current = { active: true, decided: false, horizontal: false, x0: e.clientX, y0: e.clientY, dx: 0, id: e.pointerId, dragged: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const st = s.current;
    if (!st.active || st.id !== e.pointerId) return;
    const dx = e.clientX - st.x0;
    const dy = e.clientY - st.y0;
    if (!st.decided) {
      if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
      st.decided = true;
      st.horizontal = dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!st.horizontal) {
        st.active = false;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    st.dragged = true;
    st.dx = Math.min(0, dx);
    setX(st.dx, false);
  };

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const st = s.current;
    if (!st.active || st.id !== e.pointerId) return;
    st.active = false;
    if (!st.horizontal) return;
    const width = rowRef.current?.offsetWidth ?? 320;
    if (!cancelled && -st.dx > Math.min(120, width * 0.35)) {
      setX(-width, true);
      window.setTimeout(onDelete, 180);
    } else {
      setX(0, true);
    }
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (s.current.dragged) {
      e.preventDefault();
      s.current.dragged = false;
      return;
    }
    onTap?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap?.();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end bg-alert/15 pr-6 text-alert"
      >
        <Trash2 size={20} strokeWidth={1.5} />
      </div>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-description="Tocá para editar. Deslizá a la izquierda para borrar."
        className="relative touch-pan-y bg-bg transition-colors duration-150 active:bg-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
