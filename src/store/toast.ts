import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** ms */
  duration: number;
}

interface ToastState {
  current: Toast | null;
  show: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => void;
  dismiss: (id?: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>()((set) => ({
  current: null,
  show: (t) => set({ current: { duration: 2500, ...t, id: nextId++ } }),
  dismiss: (id) => set((s) => (id === undefined || s.current?.id === id ? { current: null } : s)),
}));

export const toast = (message: string, opts: Partial<Omit<Toast, 'id' | 'message'>> = {}) =>
  useToast.getState().show({ message, ...opts });
