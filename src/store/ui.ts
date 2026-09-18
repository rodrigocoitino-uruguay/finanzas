import { create } from 'zustand';
import { currentMonthPeriod, shiftPeriod, type Period } from '../domain/periods';
import type { TxFilters } from '../domain/transactions';
import type { Currency, ExpenseGroup, Kind } from '../domain/types';
import { todayISO } from '../lib/dates';

export type { TxFilters };

export type Tab = 'summary' | 'transactions' | 'expenses' | 'income' | 'settings';

export type ExpenseFilter = 'all' | 'fixed' | 'variable';
export type ExpenseView = 'categories' | 'evolution' | 'budgets';
export type IncomeView = 'types' | 'compare';

/** Hojas globales que se abren desde varios lugares. */
export type Panel = 'rates' | 'pending' | 'budgets' | 'recurring';

export type EntryState =
  | { open: false }
  | { open: true; editId?: string; presetKind?: Kind; key: number };

interface UIState {
  tab: Tab;
  /** Período global: lo comparten todas las pestañas. */
  period: Period;
  /** Moneda de visualización global. null hasta leer los ajustes. */
  displayCurrency: Currency | null;
  filters: TxFilters;
  entry: EntryState;
  lastExpenseGroup: ExpenseGroup;
  expenseFilter: ExpenseFilter;
  expenseView: ExpenseView;
  incomeView: IncomeView;
  panel: Panel | null;

  setTab: (tab: Tab) => void;
  setPeriod: (period: Period) => void;
  shiftPeriod: (dir: 1 | -1) => void;
  setDisplayCurrency: (c: Currency) => void;
  setFilters: (filters: TxFilters) => void;
  clearFilters: () => void;
  /** Va a Movimientos con esos filtros (y opcionalmente otro período). */
  showTransactions: (filters: TxFilters, period?: Period) => void;
  openEntry: (opts?: { editId?: string; presetKind?: Kind }) => void;
  closeEntry: () => void;
  setLastExpenseGroup: (g: ExpenseGroup) => void;
  setExpenseFilter: (f: ExpenseFilter) => void;
  setExpenseView: (v: ExpenseView) => void;
  setIncomeView: (v: IncomeView) => void;
  setPanel: (panel: Panel | null) => void;
}

let entryKey = 0;

export const useUI = create<UIState>()((set) => ({
  tab: 'summary',
  period: currentMonthPeriod(todayISO()),
  displayCurrency: null,
  filters: {},
  entry: { open: false },
  lastExpenseGroup: 'variable',
  expenseFilter: 'all',
  expenseView: 'categories',
  incomeView: 'types',
  panel: null,

  setTab: (tab) => set({ tab }),
  setPeriod: (period) => set({ period }),
  shiftPeriod: (dir) => set((s) => ({ period: shiftPeriod(s.period, dir) })),
  setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  showTransactions: (filters, period) =>
    set((s) => ({ tab: 'transactions', filters, period: period ?? s.period })),
  openEntry: (opts) => set({ entry: { open: true, key: ++entryKey, ...opts } }),
  closeEntry: () => set({ entry: { open: false } }),
  setLastExpenseGroup: (lastExpenseGroup) => set({ lastExpenseGroup }),
  setExpenseFilter: (expenseFilter) => set({ expenseFilter }),
  setExpenseView: (expenseView) => set({ expenseView }),
  setIncomeView: (incomeView) => set({ incomeView }),
  setPanel: (panel) => set({ panel }),
}));
