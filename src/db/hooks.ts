import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { DateRange } from '../domain/periods';
import type { Budget, Category, Rate, Recurring, Transaction } from '../domain/types';
import { db } from './db';
import { listTransactionsInRange } from './transactions';

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_RATES: Rate[] = [];

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.toArray(), [], EMPTY_CATEGORIES);
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useCategories();
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function useRates(): Rate[] {
  return useLiveQuery(() => db.rates.toArray(), [], EMPTY_RATES);
}

/** undefined mientras carga. */
export function useTransactionsInRange(range: DateRange): Transaction[] | undefined {
  return useLiveQuery(() => listTransactionsInRange(range), [range.from, range.to]);
}

export function useTransaction(id: string | undefined): Transaction | undefined {
  return useLiveQuery(() => (id ? db.transactions.get(id) : undefined), [id]);
}

const EMPTY_RECURRINGS: Recurring[] = [];
const EMPTY_BUDGETS: Budget[] = [];
const EMPTY_TXS: Transaction[] = [];

export function useRecurrings(): Recurring[] {
  return useLiveQuery(() => db.recurrings.toArray(), [], EMPTY_RECURRINGS);
}

export function useBudgets(): Budget[] {
  return useLiveQuery(() => db.budgets.toArray(), [], EMPTY_BUDGETS);
}

/** Recurrentes generados que esperan confirmación (de cualquier mes), por fecha. */
export function usePendingTransactions(): Transaction[] {
  return useLiveQuery(() => db.transactions.where('status').equals('pending').sortBy('date'), [], EMPTY_TXS);
}
