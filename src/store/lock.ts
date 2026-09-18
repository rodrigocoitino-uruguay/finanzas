import { create } from 'zustand';

interface LockState {
  /** Ya se decidió si arrancar bloqueada (según haya PIN). */
  ready: boolean;
  locked: boolean;
  /** La app está en segundo plano: se tapa el contenido (vista previa del selector de apps). */
  obscured: boolean;
  init: (hasPin: boolean) => void;
  lock: () => void;
  unlock: () => void;
  setObscured: (obscured: boolean) => void;
}

export const useLock = create<LockState>()((set) => ({
  ready: false,
  locked: false,
  obscured: false,
  init: (hasPin) => set({ ready: true, locked: hasPin }),
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
  setObscured: (obscured) => set({ obscured }),
}));
