import { monthKey } from '../lib/dates';
import { fromCents, toCents } from './money';
import { lastNMonths, monthsInRange, periodRange, type Period } from './periods';
import { amountIn } from './transactions';
import type { Category, Currency, Group, IncomeGroup, Kind, Transaction } from './types';

/** Los pendientes (recurrentes sin confirmar) nunca cuentan en los totales. */
export function confirmedOnly(txs: readonly Transaction[]): Transaction[] {
  return txs.filter((t) => t.status === 'confirmed');
}

export interface PeriodTotals {
  income: number;
  expense: number;
  balance: number;
  fixed: number;
  variable: number;
  salary: number;
  freelance: number;
  otherIncome: number;
  count: number;
}

export function computeTotals(
  txs: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  currency: Currency,
): PeriodTotals {
  const c = { income: 0, expense: 0, fixed: 0, variable: 0, salary: 0, freelance: 0, other: 0, count: 0 };
  for (const tx of txs) {
    if (tx.status !== 'confirmed') continue;
    const cents = toCents(amountIn(tx, currency));
    const group = categories.get(tx.categoryId)?.group;
    c.count++;
    if (tx.kind === 'expense') {
      c.expense += cents;
      if (group === 'fixed') c.fixed += cents;
      else c.variable += cents; // sin categoría conocida cuenta como variable
    } else {
      c.income += cents;
      if (group === 'salary') c.salary += cents;
      else if (group === 'freelance') c.freelance += cents;
      else c.other += cents;
    }
  }
  return {
    income: fromCents(c.income),
    expense: fromCents(c.expense),
    balance: fromCents(c.income - c.expense),
    fixed: fromCents(c.fixed),
    variable: fromCents(c.variable),
    salary: fromCents(c.salary),
    freelance: fromCents(c.freelance),
    otherIncome: fromCents(c.other),
    count: c.count,
  };
}

export interface Slice {
  /** categoryId, grupo, u "others". */
  id: string;
  name: string;
  color: string;
  amount: number;
  /** Proporción del total (0–1). */
  share: number;
  count: number;
  group?: Group;
  categoryIds: string[];
}

export const OTHERS_ID = 'others';
export const OTHERS_COLOR = '#737373';

function withShares(items: Omit<Slice, 'share'>[]): Slice[] {
  const totalCents = items.reduce((acc, i) => acc + toCents(i.amount), 0);
  return items
    .filter((i) => i.amount > 0)
    .map((i) => ({ ...i, share: totalCents === 0 ? 0 : toCents(i.amount) / totalCents }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'es'));
}

export interface BreakdownFilter {
  kind: Kind;
  /** Solo gastos fijos / variables, o un tipo de ingreso. */
  group?: Group;
}

/** Total por categoría, de mayor a menor. */
export function breakdownByCategory(
  txs: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  currency: Currency,
  filter: BreakdownFilter,
): Slice[] {
  const acc = new Map<string, { cents: number; count: number }>();
  for (const tx of txs) {
    if (tx.status !== 'confirmed' || tx.kind !== filter.kind) continue;
    const cat = categories.get(tx.categoryId);
    if (filter.group && cat?.group !== filter.group) continue;
    const cur = acc.get(tx.categoryId) ?? { cents: 0, count: 0 };
    cur.cents += toCents(amountIn(tx, currency));
    cur.count++;
    acc.set(tx.categoryId, cur);
  }
  return withShares(
    [...acc.entries()].map(([id, { cents, count }]) => {
      const cat = categories.get(id);
      return {
        id,
        name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? OTHERS_COLOR,
        group: cat?.group,
        amount: fromCents(cents),
        count,
        categoryIds: [id],
      };
    }),
  );
}

const INCOME_GROUP_ORDER: IncomeGroup[] = ['salary', 'freelance', 'other'];
export const INCOME_GROUP_COLOR: Record<IncomeGroup, string> = {
  salary: '#34D399',
  freelance: '#0698A4',
  other: '#227702',
};
const INCOME_GROUP_NAME: Record<IncomeGroup, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Otros ingresos',
};

/** Ingresos por tipo (Sueldo / Freelance / Otro). */
export function breakdownByIncomeGroup(
  txs: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  currency: Currency,
): Slice[] {
  const acc = new Map<IncomeGroup, { cents: number; count: number; ids: Set<string> }>();
  for (const tx of txs) {
    if (tx.status !== 'confirmed' || tx.kind !== 'income') continue;
    const g = categories.get(tx.categoryId)?.group;
    const group: IncomeGroup = g === 'salary' || g === 'freelance' ? g : 'other';
    const cur = acc.get(group) ?? { cents: 0, count: 0, ids: new Set<string>() };
    cur.cents += toCents(amountIn(tx, currency));
    cur.count++;
    cur.ids.add(tx.categoryId);
    acc.set(group, cur);
  }
  return withShares(
    INCOME_GROUP_ORDER.filter((g) => acc.has(g)).map((g) => {
      const v = acc.get(g)!;
      return {
        id: g,
        name: INCOME_GROUP_NAME[g],
        color: INCOME_GROUP_COLOR[g],
        group: g,
        amount: fromCents(v.cents),
        count: v.count,
        categoryIds: [...v.ids],
      };
    }),
  );
}

export interface TopResult {
  /** Lo que se dibuja: las más grandes y, si hace falta, una porción "Otros". */
  visible: Slice[];
  /** Las categorías agrupadas en "Otros". */
  rest: Slice[];
}

/**
 * Las `max` más grandes y el resto agrupado en "Otros".
 * Si sobra una sola, se muestra tal cual (no tiene sentido un "Otros" de una).
 */
export function topWithOthers(items: readonly Slice[], max = 6): TopResult {
  if (items.length <= max + 1) return { visible: [...items], rest: [] };
  const top = items.slice(0, max);
  const rest = items.slice(max);
  const cents = rest.reduce((a, s) => a + toCents(s.amount), 0);
  const others: Slice = {
    id: OTHERS_ID,
    name: 'Otros',
    color: OTHERS_COLOR,
    amount: fromCents(cents),
    share: rest.reduce((a, s) => a + s.share, 0),
    count: rest.reduce((a, s) => a + s.count, 0),
    categoryIds: rest.flatMap((s) => s.categoryIds),
  };
  return { visible: [...top, others], rest };
}

export interface MonthPoint {
  /** yyyy-mm */
  month: string;
  fixed: number;
  variable: number;
  expense: number;
  income: number;
  balance: number;
}

export function monthlySeries(
  txs: readonly Transaction[],
  categories: ReadonlyMap<string, Category>,
  currency: Currency,
  months: readonly string[],
): MonthPoint[] {
  const idx = new Map(months.map((m, i) => [m, i]));
  const acc = months.map(() => ({ fixed: 0, variable: 0, income: 0 }));
  for (const tx of txs) {
    if (tx.status !== 'confirmed') continue;
    const i = idx.get(monthKey(tx.date));
    if (i === undefined) continue;
    const cents = toCents(amountIn(tx, currency));
    if (tx.kind === 'income') acc[i].income += cents;
    else if (categories.get(tx.categoryId)?.group === 'fixed') acc[i].fixed += cents;
    else acc[i].variable += cents;
  }
  return months.map((month, i) => {
    const a = acc[i];
    return {
      month,
      fixed: fromCents(a.fixed),
      variable: fromCents(a.variable),
      expense: fromCents(a.fixed + a.variable),
      income: fromCents(a.income),
      balance: fromCents(a.income - a.fixed - a.variable),
    };
  });
}

/** Qué parte del ingreso se va en gastos (0,62 = 62 %). null si no hubo ingresos. */
export function spendingRatio(totals: Pick<PeriodTotals, 'income' | 'expense'>): number | null {
  return totals.income > 0 ? totals.expense / totals.income : null;
}

/**
 * Cuántos dólares "se fueron en pesos": los gastos cargados en UYU, pasados a USD
 * con la cotización de cada movimiento.
 */
export function usdSpentInPesos(txs: readonly Transaction[]): number {
  let cents = 0;
  for (const tx of txs) {
    if (tx.status === 'confirmed' && tx.kind === 'expense' && tx.currency === 'UYU') cents += toCents(tx.amountUSD);
  }
  return fromCents(cents);
}

const MAX_EVOLUTION_MONTHS = 12;

/**
 * Meses para el gráfico de evolución: los del período, o los últimos 6 si el
 * período es un solo mes (una barra sola no dice nada). Nunca meses futuros.
 */
export function evolutionMonths(period: Period, today: string): string[] {
  const range = periodRange(period);
  const end = range.to < today ? range.to : today;
  if (period.mode === 'month') return lastNMonths(end < range.from ? range.to : end, 6);
  let months = monthsInRange({ from: range.from, to: end < range.from ? range.to : end });
  if (months.length < 2) months = lastNMonths(range.to < today ? range.to : today, 6);
  return months.slice(-MAX_EVOLUTION_MONTHS);
}

/** Últimos 6 meses que terminan en el período elegido (mini gráfico del Resumen). */
export function summaryMonths(period: Period, today: string): string[] {
  const range = periodRange(period);
  const end = range.to < today ? range.to : today;
  return lastNMonths(end < range.from ? range.from : end, 6);
}

export function groupShare(fixed: number, variable: number): { fixed: number; variable: number } {
  const total = toCents(fixed) + toCents(variable);
  if (total === 0) return { fixed: 0, variable: 0 };
  const f = toCents(fixed) / total;
  return { fixed: f, variable: 1 - f };
}
