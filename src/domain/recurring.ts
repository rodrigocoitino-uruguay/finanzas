import { getDaysInMonth } from 'date-fns';
import { addMonthsISO, parseISODate } from '../lib/dates';
import { pickRate } from './fx';
import { convert } from './money';
import type { Rate, Recurring, Transaction } from './types';

/** Como mucho se ponen al día estos meses (si la app no se abrió en mucho tiempo). */
export const MAX_CATCH_UP_MONTHS = 6;

/** Fecha de la cuota en un mes: el día pedido o el último del mes (31 → 30 de abril, 28/29 de febrero). */
export function occurrenceDate(month: string, dayOfMonth: number): string {
  const days = getDaysInMonth(parseISODate(`${month}-01`));
  const day = Math.min(Math.max(1, Math.round(dayOfMonth)), days);
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Meses a generar después del último generado, hasta el actual (inclusive), con tope. */
export function monthsToGenerate(lastGenerated: string | undefined, currentMonth: string): string[] {
  if (lastGenerated && lastGenerated >= currentMonth) return [];
  const out: string[] = [];
  let m = lastGenerated ? addMonthsISO(`${lastGenerated}-01`, 1).slice(0, 7) : currentMonth;
  while (m <= currentMonth) {
    out.push(m);
    m = addMonthsISO(`${m}-01`, 1).slice(0, 7);
  }
  return out.slice(-MAX_CATCH_UP_MONTHS);
}

/** Movimiento pendiente de confirmar para un recurrente en un mes. */
export function buildPending(
  rec: Recurring,
  month: string,
  rates: readonly Rate[],
  nowISO: string,
  makeId: () => string,
): Transaction | null {
  const date = occurrenceDate(month, rec.dayOfMonth);
  const found = pickRate(rates, date);
  if (!found) return null;
  const t = rec.templateTx;
  const tx: Transaction = {
    id: makeId(),
    kind: t.kind,
    amount: t.amount,
    currency: t.currency,
    rateAtDate: found.rate,
    ...convert(t.amount, t.currency, found.rate),
    categoryId: t.categoryId,
    date,
    status: 'pending',
    recurringId: rec.id,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
  if (found.approximate) tx.rateApprox = true;
  if (t.note) tx.note = t.note;
  if (rec.isDemo) tx.isDemo = true;
  return tx;
}

/**
 * Fecha con la que se confirma: si se confirma antes del día previsto, se asume que
 * se pagó/cobró hoy; si es después, se mantiene el día previsto.
 */
export function confirmDate(scheduled: string, today: string): string {
  return scheduled > today ? today : scheduled;
}
