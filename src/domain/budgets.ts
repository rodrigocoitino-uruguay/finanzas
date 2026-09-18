import { fromCents, toCents } from './money';
import type { Budget, Category, Transaction } from './types';

export type BudgetState = 'ok' | 'warn' | 'over';

export const WARN_AT = 0.8;

export interface BudgetProgress {
  budget: Budget;
  category: Category;
  /** Gastado en el mes, en la moneda del tope. */
  spent: number;
  /** Pendientes (recurrentes sin confirmar) del mes, en la moneda del tope. */
  pending: number;
  /** spent / tope */
  ratio: number;
  state: BudgetState;
}

/** Azul hasta el 80 %, ámbar entre 80 y 100 %, alerta por encima del 100 %. */
export function budgetState(ratio: number): BudgetState {
  if (ratio > 1) return 'over';
  if (ratio >= WARN_AT) return 'warn';
  return 'ok';
}

/** Avance de cada presupuesto en un mes (yyyy-mm), de mayor a menor uso. */
export function budgetProgress(
  budgets: readonly Budget[],
  txs: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  month: string,
): BudgetProgress[] {
  const spent = new Map<string, { UYU: number; USD: number; pUYU: number; pUSD: number }>();
  for (const tx of txs) {
    if (tx.kind !== 'expense' || !tx.date.startsWith(month)) continue;
    const acc = spent.get(tx.categoryId) ?? { UYU: 0, USD: 0, pUYU: 0, pUSD: 0 };
    if (tx.status === 'confirmed') {
      acc.UYU += toCents(tx.amountUYU);
      acc.USD += toCents(tx.amountUSD);
    } else {
      acc.pUYU += toCents(tx.amountUYU);
      acc.pUSD += toCents(tx.amountUSD);
    }
    spent.set(tx.categoryId, acc);
  }

  const out: BudgetProgress[] = [];
  for (const budget of budgets) {
    const category = categories.get(budget.categoryId);
    if (!category || budget.amount <= 0) continue;
    const acc = spent.get(budget.categoryId);
    const s = fromCents(acc ? acc[budget.currency] : 0);
    const p = fromCents(acc ? (budget.currency === 'UYU' ? acc.pUYU : acc.pUSD) : 0);
    const ratio = s / budget.amount;
    out.push({ budget, category, spent: s, pending: p, ratio, state: budgetState(ratio) });
  }
  return out.sort((a, b) => b.ratio - a.ratio || a.category.name.localeCompare(b.category.name, 'es'));
}

/** Los que pasaron el 80 % (o el 100 %). */
export function budgetAlerts(progress: readonly BudgetProgress[]): BudgetProgress[] {
  return progress.filter((p) => p.state !== 'ok');
}
