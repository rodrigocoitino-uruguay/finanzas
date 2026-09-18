import { useMemo } from 'react';
import { useBudgets, useCategoryMap, useTransactionsInRange } from '../../db/hooks';
import { budgetProgress } from '../../domain/budgets';
import { periodRange, type Period } from '../../domain/periods';
import { addMonthsISO, todayISO } from '../../lib/dates';

/** Los presupuestos son mensuales: si el período no es un mes, se usa el mes en curso (o el último del período). */
export function budgetMonthFor(period: Period, today: string): string {
  if (period.mode === 'month') return period.anchor.slice(0, 7);
  const r = periodRange(period);
  return (r.to < today ? r.to : today).slice(0, 7);
}

export function useBudgetProgress(period: Period) {
  const today = todayISO();
  const month = budgetMonthFor(period, today);
  const range = useMemo(() => ({ from: `${month}-01`, to: addMonthsISO(`${month}-01`, 1) }), [month]);
  const txs = useTransactionsInRange(range);
  const budgets = useBudgets();
  const categories = useCategoryMap();
  const progress = useMemo(
    () => budgetProgress(budgets, txs ?? [], categories, month),
    [budgets, txs, categories, month],
  );
  return { month, progress, budgets, loading: txs === undefined };
}
