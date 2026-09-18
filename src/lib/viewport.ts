import { useEffect } from 'react';

/**
 * En iOS el teclado no achica la ventana: tapa el contenido. Publicamos el
 * tamaño real visible en variables CSS para que los bottom sheets queden arriba del teclado.
 */
export function useVisualViewportVars(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--vv-height', `${vv.height}px`);
        root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
        root.dataset.kb = window.innerHeight - vv.height > 120 ? 'open' : 'closed';
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}

/**
 * iOS solo abre el teclado si el foco ocurre dentro del toque del usuario.
 * Enfocamos un input invisible en ese momento; cuando el formulario aparece,
 * el foco pasa al campo real y el teclado queda abierto.
 */
export function primeKeyboard(inputMode: 'decimal' | 'text' = 'decimal'): void {
  const el = document.createElement('input');
  el.type = 'text';
  el.inputMode = inputMode;
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  Object.assign(el.style, {
    position: 'fixed',
    top: '40%',
    left: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    fontSize: '16px',
    border: '0',
    padding: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(el);
  el.focus({ preventScroll: true });
  window.setTimeout(() => el.remove(), 1500);
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Pantallas táctiles: al enfocar un campo aparece el teclado en pantalla. */
export const IS_TOUCH =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

/** Cierra el teclado en pantalla (saca el foco del campo activo). */
export function dismissKeyboard(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}
