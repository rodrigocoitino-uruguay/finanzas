import { X } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { IconButton } from './IconButton';

const HeaderSlotContext = createContext<HTMLDivElement | null>(null);

/** Elemento del encabezado del sheet donde el contenido puede montar controles (vía portal). */
export function useSheetHeaderSlot(): HTMLDivElement | null {
  return useContext(HeaderSlotContext);
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Título accesible (y visible salvo que se pase `header`). */
  title: string;
  /** Reemplaza el título visible (el título queda para lectores de pantalla). */
  header?: ReactNode;
  /** Deja un hueco en el encabezado para que el contenido monte sus controles (useSheetHeaderSlot). */
  headerSlot?: boolean;
  children: ReactNode;
  /**
   * Si es true, el contenido maneja su propio scroll y pie (flex column).
   * Si no, se envuelve en un área scrolleable con padding.
   */
  bare?: boolean;
  onExited?: () => void;
}

const EXIT_MS = 200;
const DISMISS_DISTANCE = 110;

/** Bottom sheet: se arrastra hacia abajo para cerrar, Escape cierra, queda arriba del teclado. */
export function Sheet({ open, onClose, title, header, headerSlot, children, bare, onExited }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const drag = useRef<{ y0: number; t0: number; dy: number; id: number } | null>(null);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  if (open && !mounted) setMounted(true);
  if (open && closing) setClosing(false);
  if (!open && mounted && !closing) setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
      onExitedRef.current?.();
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      if (previous && previous !== document.body && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const setOffset = (dy: number, animate: boolean) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${EXIT_MS}ms var(--ease-soft)` : 'none';
    el.style.transform = dy > 0 ? `translate3d(0, ${dy}px, 0)` : '';
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, [role="radio"]')) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    setOffset(d.dy, false);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > DISMISS_DISTANCE || (d.dy > 30 && velocity > 0.6)) {
      onClose();
    } else {
      setOffset(0, true);
    }
  };

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cx('fixed inset-0 z-50 bg-black/65', closing ? 'animate-fade-out' : 'animate-fade-in')}
      />
      {/* Contenedor del tamaño del área visible (arriba del teclado de iOS). */}
      <div
        className="pointer-events-none fixed inset-x-0 z-50"
        style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100%)' }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            'pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col outline-none',
            'rounded-t-[var(--radius-sheet)] border-t border-line bg-surface',
            // Se extiende hacia abajo: detrás del teclado translúcido se ve el panel, no la página.
            "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[60vh] after:bg-surface after:content-['']",
            closing ? 'animate-sheet-out' : 'animate-sheet-in',
          )}
          style={{ maxHeight: 'calc(100% - var(--safe-top) - 8px)' }}
        >
          <div
            className="shrink-0 touch-none select-none px-4 pt-2"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div aria-hidden="true" className="mx-auto mb-1 h-1 w-9 rounded-full bg-line" />
            <div className="flex min-h-11 items-center gap-2">
              <h2
                id={titleId}
                className={
                  header || headerSlot ? 'sr-only' : 'flex-1 pl-1 font-display text-[22px] font-semibold tracking-tight'
                }
              >
                {title}
              </h2>
              {header && <div className="min-w-0 flex-1">{header}</div>}
              {headerSlot && <div ref={setSlot} className="min-w-0 flex-1" />}
              <IconButton label="Cerrar" onClick={onClose} className="-mr-1">
                <X size={20} strokeWidth={1.5} />
              </IconButton>
            </div>
          </div>
          <HeaderSlotContext.Provider value={slot}>
            {bare ? (
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            ) : (
              <div className="scroll-area min-h-0 flex-1 px-5 pb-[max(20px,var(--safe-bottom))] pt-2">{children}</div>
            )}
          </HeaderSlotContext.Provider>
        </div>
      </div>
    </>,
    document.body,
  );
}
