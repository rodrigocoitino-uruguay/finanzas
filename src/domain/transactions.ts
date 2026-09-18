import { normalizeName } from './categories';
import { sumMoney } from './money';
import type { Category, Currency, Group, Kind, Transaction } from './types';

export interface TxFilters {
  kind?: Kind;
  group?: Group;
  categoryIds?: string[];
  currency?: Currency;
  query?: string;
}

export function amountIn(tx: Transaction, currency: Currency): number {
  return currency === 'UYU' ? tx.amountUYU : tx.amountUSD;
}

/** Ingresos en positivo, gastos en negativo. */
export function signedAmountIn(tx: Transaction, currency: Currency): number {
  const v = amountIn(tx, currency);
  return tx.kind === 'income' ? v : -v;
}

export interface DayGroup {
  date: string;
  items: Transaction[];
  /** Neto del día (solo confirmados). */
  netUYU: number;
  netUSD: number;
}

/** Agrupa por día, del más reciente al más viejo; dentro del día, lo último cargado primero. */
export function groupByDay(txs: readonly Transaction[]): DayGroup[] {
  const byDate = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const list = byDate.get(tx.date);
    if (list) list.push(tx);
    else byDate.set(tx.date, [tx]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => {
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      const confirmed = items.filter((t) => t.status === 'confirmed');
      return {
        date,
        items,
        netUYU: sumMoney(confirmed.map((t) => signedAmountIn(t, 'UYU'))),
        netUSD: sumMoney(confirmed.map((t) => signedAmountIn(t, 'USD'))),
      };
    });
}

export function filterTransactions(
  txs: readonly Transaction[],
  filters: TxFilters,
  categories: ReadonlyMap<string, Category>,
): Transaction[] {
  const q = filters.query ? normalizeName(filters.query) : '';
  const ids = filters.categoryIds && filters.categoryIds.length > 0 ? new Set(filters.categoryIds) : null;
  return txs.filter((tx) => {
    if (filters.kind && tx.kind !== filters.kind) return false;
    if (filters.currency && tx.currency !== filters.currency) return false;
    if (ids && !ids.has(tx.categoryId)) return false;
    const cat = categories.get(tx.categoryId);
    if (filters.group && cat?.group !== filters.group) return false;
    if (q) {
      const haystack = normalizeName(`${cat?.name ?? ''} ${tx.note ?? ''}`);
      const amountDigits = String(tx.amount).replace('.', '');
      if (!haystack.includes(q) && !amountDigits.startsWith(q.replace(/[.,]/g, ''))) return false;
    }
    return true;
  });
}
