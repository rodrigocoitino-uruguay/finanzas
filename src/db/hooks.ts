import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import type { DateRange } from '../domain/periods';
import type { Category, Rate, Transaction } from '../domain/types';
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
