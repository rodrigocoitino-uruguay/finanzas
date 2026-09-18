import { differenceInCalendarDays, endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from 'date-fns';
import {
  addDaysISO,
  addMonthsISO,
  capitalize,
  formatDate,
  formatMonthYear,
  parseISODate,
  toISODate,
} from '../lib/dates';

export type PeriodMode = 'month' | 'last3' | 'year' | 'custom';

export interface Period {
  mode: PeriodMode;
  /** Día de referencia (yyyy-mm-dd): define el mes, el trimestre móvil o el año. */
  anchor: string;
  /** Solo para "custom" (inclusive). */
  from?: string;
  to?: string;
}

/** Rango de fechas inclusive, en yyyy-mm-dd. */
export interface DateRange {
  from: string;
  to: string;
}

export function currentMonthPeriod(today: string): Period {
  return { mode: 'month', anchor: today };
}

export function periodRange(p: Period): DateRange {
  if (p.mode === 'custom') {
    const from = p.from ?? p.anchor;
    const to = p.to ?? p.anchor;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  const a = parseISODate(p.anchor);
  switch (p.mode) {
    case 'month':
      return { from: toISODate(startOfMonth(a)), to: toISODate(endOfMonth(a)) };
    case 'last3':
      return { from: toISODate(startOfMonth(subMonths(a, 2))), to: toISODate(endOfMonth(a)) };
    case 'year':
      return { from: toISODate(startOfYear(a)), to: toISODate(endOfYear(a)) };
  }
}

/** Mueve el período un "paso" (mes, trimestre móvil, año o la misma cantidad de días). */
export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  switch (p.mode) {
    case 'month':
      return { ...p, anchor: addMonthsISO(p.anchor, dir) };
    case 'last3':
      return { ...p, anchor: addMonthsISO(p.anchor, 3 * dir) };
    case 'year':
      return { ...p, anchor: addMonthsISO(p.anchor, 12 * dir) };
    case 'custom': {
      const { from, to } = periodRange(p);
      const len = differenceInCalendarDays(parseISODate(to), parseISODate(from)) + 1;
      const nf = addDaysISO(from, len * dir);
      const nt = addDaysISO(to, len * dir);
      return { mode: 'custom', anchor: nt, from: nf, to: nt };
    }
  }
}

/** Período anterior equivalente (para la variación %). */
export function previousRange(p: Period): DateRange {
  return periodRange(shiftPeriod(p, -1));
}

export function isInRange(date: string, r: DateRange): boolean {
  return date >= r.from && date <= r.to;
}

/** Meses (yyyy-mm) que toca el rango, en orden. */
export function monthsInRange(r: DateRange): string[] {
  const out: string[] = [];
  let cur = `${r.from.slice(0, 7)}-01`;
  const last = r.to.slice(0, 7);
  while (cur.slice(0, 7) <= last) {
    out.push(cur.slice(0, 7));
    cur = addMonthsISO(cur, 1);
  }
  return out;
}

/** Los `n` meses que terminan en el mes de `anchor` (inclusive). */
export function lastNMonths(anchor: string, n: number): string[] {
  const start = addMonthsISO(`${anchor.slice(0, 7)}-01`, -(n - 1));
  return monthsInRange({ from: start, to: anchor });
}

export function periodLabel(p: Period): string {
  const r = periodRange(p);
  switch (p.mode) {
    case 'month':
      return formatMonthYear(p.anchor);
    case 'last3': {
      const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
      const from = capitalize(formatDate(r.from, sameYear ? 'MMM' : 'MMM yyyy'));
      return `${from} – ${capitalize(formatDate(r.to, 'MMM yyyy'))}`.replace(/\./g, '');
    }
    case 'year':
      return r.from.slice(0, 4);
    case 'custom': {
      const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
      const from = formatDate(r.from, sameYear ? 'd MMM' : 'd MMM yy');
      return `${from} – ${formatDate(r.to, 'd MMM yy')}`.replace(/\./g, '');
    }
  }
}

export const PERIOD_MODE_LABEL: Record<PeriodMode, string> = {
  month: 'Mes',
  last3: 'Últimos 3 meses',
  year: 'Año',
  custom: 'Personalizado',
};

/** "vs. agosto", "vs. 2025", "vs. trimestre anterior"… */
export function previousLabel(p: Period): string {
  switch (p.mode) {
    case 'month':
      return `vs. ${formatDate(shiftPeriod(p, -1).anchor, 'MMMM')}`;
    case 'last3':
      return 'vs. 3 meses anteriores';
    case 'year':
      return `vs. ${shiftPeriod(p, -1).anchor.slice(0, 4)}`;
    case 'custom':
      return 'vs. período anterior';
  }
}

export interface Comparison {
  range: DateRange;
  label: string;
}

/**
 * Contra qué se compara el período. Si el mes (o el año) está en curso, se compara
 * contra los mismos días del período anterior: comparar 16 días contra un mes
 * entero siempre daría una caída engañosa.
 */
export function comparisonRange(p: Period, today: string): Comparison {
  const current = periodRange(p);
  const inProgress = current.from <= today && today < current.to;
  if (inProgress && p.mode === 'month') {
    const prevStart = periodRange(shiftPeriod(p, -1)).from;
    const prevEnd = periodRange(shiftPeriod(p, -1)).to;
    const day = Number(today.slice(8, 10));
    const candidate = addDaysISO(prevStart, day - 1);
    const to = candidate > prevEnd ? prevEnd : candidate;
    return { range: { from: prevStart, to }, label: `vs. 1–${day} ${formatDate(prevStart, 'MMM').replace('.', '')}` };
  }
  if (inProgress && p.mode === 'year') {
    const prevYear = String(Number(today.slice(0, 4)) - 1);
    const sameDay = `${prevYear}${today.slice(4)}`;
    const to = sameDay.endsWith('02-29') ? `${prevYear}-02-28` : sameDay;
    return { range: { from: `${prevYear}-01-01`, to }, label: `vs. mismo período ${prevYear}` };
  }
  return { range: previousRange(p), label: previousLabel(p) };
}
