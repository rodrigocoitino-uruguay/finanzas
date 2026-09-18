import { useMemo } from 'react';
import { useCategoryMap, useTransactionsInRange } from '../../db/hooks';
import { evolutionMonths, summaryMonths } from '../../domain/analytics';
import { comparisonRange, isInRange, periodRange, type DateRange } from '../../domain/periods';
import type { Transaction } from '../../domain/types';
import { addMonthsISO, todayISO } from '../../lib/dates';
import { useDisplayCurrency } from '../../store/settings';
import { useUI } from '../../store/ui';

const EMPTY: Transaction[] = [];

function monthStart(month: string): string {
  return `${month}-01`;
}

/**
 * Datos compartidos por Resumen, Gastos e Ingresos: una sola consulta que cubre
 * el período, el período anterior y los meses de los gráficos.
 */
export function useAnalytics() {
  const period = useUI((s) => s.period);
  const currency = useDisplayCurrency();
  const categories = useCategoryMap();
  const today = todayISO();

  const ctx = useMemo(() => {
    const range = periodRange(period);
    const comparison = comparisonRange(period, today);
    const prev = comparison.range;
    const summary = summaryMonths(period, today);
    const evolution = evolutionMonths(period, today);
    const starts = [range.from, prev.from, monthStart(summary[0]), monthStart(evolution[0])];
    const ends = [range.to, prev.to, addMonthsISO(monthStart(summary.at(-1)!), 1), addMonthsISO(monthStart(evolution.at(-1)!), 1)];
    const query: DateRange = { from: starts.sort()[0], to: ends.sort().at(-1)! };
    return { range, prev, comparisonLabel: comparison.label, summary, evolution, query };
  }, [period, today]);

  const all = useTransactionsInRange(ctx.query);

  const split = useMemo(() => {
    const list = all ?? EMPTY;
    return {
      current: list.filter((t) => isInRange(t.date, ctx.range)),
      previous: list.filter((t) => isInRange(t.date, ctx.prev)),
    };
  }, [all, ctx]);

  return {
    loading: all === undefined,
    period,
    currency,
    categories,
    all: all ?? EMPTY,
    ...split,
    ...ctx,
  };
}
